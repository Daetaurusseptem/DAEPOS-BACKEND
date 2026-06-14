import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Product from '../models-mongoose/Product';
import Company from '../models-mongoose/Company';
import Category from '../models-mongoose/Category';
import InventoryItem from '../models-mongoose/InventoryItem';
import Sale from '../models-mongoose/Sale';
import Branch from '../models-mongoose/Branch';
import { subirArchivo } from '../controllers/fileUploadController';

// Crear un nuevo producto + ítem de inventario
export const createProduct = async (req: Request, res: Response) => {
  const { companyId } = req.params;
  const { barCode, stock, costPrice, sellingPrice, unitOfMeasure, ...productData } = req.body;

  try {
    const companyDb = await Company.findById(companyId);
    if (!companyDb) {
      return res.status(404).json({
        ok: false,
        msg: 'No existe la Company seleccionada',
      });
    }

    // 1. Crear el Producto (Catálogo)
    productData.company = companyId;
    const newProduct = new Product(productData);
    const savedProduct = await newProduct.save();

    // 2. Crear el Item de Inventario vinculado si se proporcionan datos
    // Si no se proporcionan, creamos uno básico con valores en cero
    const newInventoryItem = new InventoryItem({
      product: savedProduct._id,
      company: companyId,
      barCode: barCode || `GEN-${Date.now()}`,
      stock: stock || 0,
      costPrice: costPrice || 0,
      sellingPrice: sellingPrice || 0,
      measurement: unitOfMeasure || 'unit',
    });

    await newInventoryItem.save();

    return res.status(201).json({
      ok: true,
      savedProduct,
      inventoryItem: newInventoryItem,
    });
  } catch (error) {
    console.error('Error in createProduct:', error);
    return res.status(400).json({ ok: false, message: error });
  }
};

// Obtener todos los productos
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const products = await Product.find().populate('supplier');
    res.status(200).json({ ok: true, products });
  } catch (error) {
    res.status(500).json({ message: error });
  }
};

// Obtener todos los productos de una Company para sysadmin
export const getAllProductsOfCompanyForSysadmin = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const companyDb = await Company.findById(companyId);
    if (!companyDb) {
      return res.status(404).json({
        ok: false,
        msg: 'No existe la Company seleccionada',
      });
    }

    const products = await Product.find({ company: companyId }).populate('supplier');
    res.status(200).json({ ok: true, products });
  } catch (error) {
    res.status(500).json({ message: error });
  }
};

// Obtener todos los productos de una Company
export const getAllCompanyProducts = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const products = await Product.find({ company: companyId }).populate('supplier');
    res.status(200).json({ ok: true, products });
  } catch (error) {
    res.status(500).json({ message: error });
  }
};

// Obtener un producto por ID (incluyendo inventario)
export const getProductById = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id).populate('supplier');
    if (!product) return res.status(404).json({ ok: false, message: 'Producto no encontrado' });

    // Buscar todos los ítems de inventario asociados (de todas las sucursales)
    const inventoryItems = await InventoryItem.find({ product: product._id }).populate('branch', 'name');

    res.status(200).json({
      ok: true,
      product,
      inventoryItems,
      inventoryItem: inventoryItems[0] || null,
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error });
  }
};

// Actualizar un producto + inventario
export const updateProduct = async (req: Request, res: Response) => {
  const { barCode, stock, costPrice, sellingPrice, unitOfMeasure, ...productData } = req.body;

  try {
    // 1. Actualizar Datos del Producto
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, productData, { new: true });
    if (!updatedProduct) return res.status(404).json({ ok: false, message: 'Producto no encontrado' });

    // 2. Actualizar Datos de Inventario vinculados
    const inventoryUpdate: any = {};
    if (barCode !== undefined) inventoryUpdate.barCode = barCode;
    if (stock !== undefined) inventoryUpdate.stock = stock;
    if (costPrice !== undefined) inventoryUpdate.costPrice = costPrice;
    if (sellingPrice !== undefined) inventoryUpdate.sellingPrice = sellingPrice;
    if (unitOfMeasure !== undefined) inventoryUpdate.measurement = unitOfMeasure;

    let updatedInventory = null;
    if (Object.keys(inventoryUpdate).length > 0) {
      const userId = (req as any).uid;
      const query: any = { product: updatedProduct._id };

      if (userId) {
        const User = mongoose.model('User');
        const user = await User.findById(userId);
        if (user && (user as any).branch) {
          query.branch = (user as any).branch;
        }
      }

      if (req.body.branchId) {
        query.branch = req.body.branchId;
      }

      updatedInventory = await InventoryItem.findOneAndUpdate(
        query,
        { $set: inventoryUpdate },
        { new: true, upsert: true }, // Upsert por si acaso no existía el registro de inventario
      );
    }

    res.status(200).json({
      ok: true,
      product: updatedProduct,
      inventoryItem: updatedInventory,
    });
  } catch (error) {
    res.status(400).json({ ok: false, message: error });
  }
};

// Eliminar un producto
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return res.status(404).json({ message: 'Producto no encontrado' });
    res.status(200).json({ message: 'Producto eliminado' });
  } catch (error) {
    res.status(500).json({ message: error });
  }
};

// Buscar productos
export const searchProducts = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 5, search = '', companyId } = req.query;

    if (!companyId || companyId === 'undefined') {
      return res.status(400).json({ ok: false, message: 'Company ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(companyId as string)) {
      return res.status(400).json({ ok: false, message: 'Invalid Company ID format' });
    }

    const query = {
      company: companyId,
      ...(search && { name: { $regex: new RegExp(search as string, 'i') } }),
    };

    const products = await Product.find(query)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Product.countDocuments(query);

    res.status(200).json({
      products,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      totalItems: total,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error });
  }
};

// Carga Masiva de Productos e Inventario
export const bulkUploadProducts = async (req: Request, res: Response) => {
  console.log('--- RECIBIENDO PETICIÓN DE CARGA MASIVA ---');
  try {
    const { companyId } = req.params;
    const { items, autoCreateCategories, supplierId, branchId } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, msg: 'No items provided for upload' });
    }

    const companyDb = await Company.findById(companyId);
    if (!companyDb) {
      return res.status(404).json({ ok: false, msg: 'Company not found' });
    }

    // Obtener la sucursal de destino (obligatoria en InventoryItem)
    const targetBranchId = branchId || (await Branch.findOne({ company: companyId }))?._id;
    if (!targetBranchId) {
      return res.status(400).json({
        ok: false,
        msg: 'No se encontró ninguna sucursal activa para esta compañía para registrar el inventario',
      });
    }

    // 1. Manejo de Categorías
    const categoryMap = new Map<string, mongoose.Types.ObjectId>();
    const uniqueCategoryNames = [...new Set(items.map((item) => item.categoryName).filter(Boolean))];

    for (const catName of uniqueCategoryNames) {
      // Buscamos si la categoría ya existe para esta compañía
      // Escapamos regex para evitar errores con caracteres especiales como '+'
      const escapedCatName = catName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let category = await Category.findOne({
        company: companyId,
        name: { $regex: new RegExp('^' + escapedCatName + '$', 'i') },
      });

      if (!category && autoCreateCategories) {
        category = new Category({
          company: companyId,
          name: catName,
          description: `Generada automáticamente desde importación masiva`,
        });
        await category.save();
      }

      if (category) {
        categoryMap.set(catName.toLowerCase(), category._id as mongoose.Types.ObjectId);
      }
    }

    // Preparar las operaciones bulk
    const productOps = [];
    const inventoryOps = [];
    const errors = [];
    let processedCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Validaciones básicas
      if (!item.barCode || !item.name) {
        errors.push({ row: i + 1, item, error: 'Falta código de barras o nombre' });
        continue;
      }

      const catId = item.categoryName ? categoryMap.get(item.categoryName.toLowerCase()) : null;
      if (item.categoryName && !catId) {
        errors.push({
          row: i + 1,
          item,
          error: `La categoría '${item.categoryName}' no existe y la auto-creación está desactivada`,
        });
        continue;
      }

      // Buscar si ya existe el item en el inventario de esta compañía y sucursal
      const existingInventory = await InventoryItem.findOne({
        company: companyId,
        branch: targetBranchId,
        barCode: item.barCode,
      });

      if (existingInventory) {
        // ACTUALIZAR (UPSERT logic para existentes)
        inventoryOps.push({
          updateOne: {
            filter: { _id: existingInventory._id },
            update: {
              $set: {
                stock: item.stock !== undefined ? Number(item.stock) : existingInventory.stock,
                costPrice: item.costPrice !== undefined ? Number(item.costPrice) : existingInventory.costPrice,
                sellingPrice:
                  item.sellingPrice !== undefined ? Number(item.sellingPrice) : existingInventory.sellingPrice,
              },
            },
          },
        });
        processedCount++;
      } else {
        // CREAR NUEVO (Product + InventoryItem)
        const _idProduct = new mongoose.Types.ObjectId();

        productOps.push({
          insertOne: {
            document: {
              _id: _idProduct,
              company: companyId,
              name: item.name,
              brand: item.brand || 'N/A',
              supplier: supplierId || null,
              categories: catId ? [catId] : [],
              isComposite: false,
            },
          },
        });

        inventoryOps.push({
          insertOne: {
            document: {
              company: companyId,
              branch: targetBranchId,
              supplier: supplierId || null,
              product: _idProduct,
              name: item.name,
              barCode: item.barCode,
              stock: item.stock ? Number(item.stock) : 0,
              costPrice: item.costPrice ? Number(item.costPrice) : 0,
              sellingPrice: item.sellingPrice ? Number(item.sellingPrice) : 0,
              measurement: item.measurement || 'unit',
            },
          },
        });
        processedCount++;
      }
    }

    // Ejecutar las operaciones masivas
    if (productOps.length > 0) {
      await Product.bulkWrite(productOps);
    }
    if (inventoryOps.length > 0) {
      await InventoryItem.bulkWrite(inventoryOps);
    }

    return res.status(200).json({
      ok: true,
      msg: 'Carga masiva completada',
      stats: {
        totalProcessed: processedCount,
        newProducts: productOps.length,
        updatedInventory: inventoryOps.length - productOps.length,
        errorsCount: errors.length,
      },
      errors,
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, msg: 'Error procesando archivo masivo', error: error.message });
  }
};

// AUDITORIA: Obtener productos pendientes de verificación
export const getPendingVerificationProducts = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const products = await Product.find({ company: companyId, status: 'pending_verification' }).populate('supplier');
    
    // Adjuntar info de inventario
    const productsWithInventory = await Promise.all(products.map(async (prod) => {
      const inventoryItems = await InventoryItem.find({ product: prod._id }).populate('branch', 'name');
      return {
        ...prod.toObject(),
        inventoryItems
      };
    }));

    res.status(200).json({ ok: true, products: productsWithInventory });
  } catch (error) {
    res.status(500).json({ message: error });
  }
};

// AUDITORIA: Formalizar un producto (pasar a active)
export const formalizeProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { barCode, costPrice, sellingPrice, unitOfMeasure, categories, isComposite, recipe, name, brand, supplier } = req.body;
    
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ ok: false, message: 'Producto no encontrado' });

    // Actualizar producto
    if (name) product.name = name;
    if (brand) product.brand = brand;
    if (supplier) product.supplier = supplier;
    if (categories) product.categories = categories;
    if (isComposite !== undefined) product.isComposite = isComposite;
    if (recipe) product.recipe = recipe;
    product.status = 'active';
    await product.save();

    // Actualizar inventario
    const inventoryItems = await InventoryItem.find({ product: product._id });
    for (const inv of inventoryItems) {
      if (barCode) inv.barCode = barCode;
      if (costPrice !== undefined) inv.costPrice = costPrice;
      if (sellingPrice !== undefined) inv.sellingPrice = sellingPrice;
      if (unitOfMeasure) inv.measurement = unitOfMeasure;
      inv.name = product.name;
      await inv.save();
    }

    res.status(200).json({ ok: true, product, msg: 'Producto formalizado correctamente' });
  } catch (error) {
    res.status(500).json({ ok: false, message: error });
  }
};

// AUDITORIA: Fusionar producto temporal en producto existente
export const mergeProduct = async (req: Request, res: Response) => {
  try {
    const { sourceId } = req.params; // Producto temporal
    const { targetId } = req.body;   // Producto real existente

    if (sourceId === targetId) {
      return res.status(400).json({ ok: false, message: 'No puedes fusionar un producto consigo mismo' });
    }

    const sourceProduct = await Product.findById(sourceId);
    const targetProduct = await Product.findById(targetId);

    if (!sourceProduct || !targetProduct) {
      return res.status(404).json({ ok: false, message: 'Producto origen o destino no encontrado' });
    }

    // 1. Reasignar Ventas Pasadas
    await Sale.updateMany(
      { "productsSold.product": sourceId },
      { $set: { "productsSold.$[elem].product": targetId } },
      { arrayFilters: [{ "elem.product": sourceId }] }
    );

    // 2. Fusionar Inventarios
    const sourceInventories = await InventoryItem.find({ product: sourceId });
    for (const sourceInv of sourceInventories) {
      const targetInv = await InventoryItem.findOne({ product: targetId, branch: sourceInv.branch });
      
      if (targetInv) {
        // Promedio Ponderado de Costo
        const currentStock = targetInv.stock;
        const currentCost = targetInv.costPrice || 0;
        const newStock = sourceInv.stock;
        const newCost = sourceInv.costPrice || 0;

        let weightedCost = newCost;
        if (currentStock + newStock > 0) {
          weightedCost = (currentStock * currentCost + newStock * newCost) / (currentStock + newStock);
        }

        targetInv.stock += newStock;
        targetInv.costPrice = Math.round(weightedCost * 100) / 100;
        await targetInv.save();
      } else {
        // Si la sucursal de destino no tenía este producto, transferimos el item de inventario
        sourceInv.product = targetProduct._id as any;
        sourceInv.name = targetProduct.name;
        await sourceInv.save();
      }
    }

    // Eliminar inventarios origen que ya fueron fusionados
    await InventoryItem.deleteMany({ product: sourceId });

    // 3. Eliminar el producto temporal
    await Product.findByIdAndDelete(sourceId);

    res.status(200).json({ ok: true, msg: 'Producto fusionado correctamente' });
  } catch (error) {
    res.status(500).json({ ok: false, message: error });
  }
};
