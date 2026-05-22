import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Product from '../models-mongoose/Product';
import Company from '../models-mongoose/Company';
import Category from '../models-mongoose/Category';
import InventoryItem from '../models-mongoose/InventoryItem';
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
                msg: "No existe la Company seleccionada"
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
            unitOfMeasure: unitOfMeasure || 'unit'
        });

        await newInventoryItem.save();

        return res.status(201).json({ 
            ok: true, 
            savedProduct,
            inventoryItem: newInventoryItem 
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
                msg: "No existe la Company seleccionada"
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

        // Buscar el ítem de inventario asociado
        const inventoryItem = await InventoryItem.findOne({ product: product._id });

        res.status(200).json({ 
            ok: true, 
            product,
            inventoryItem: inventoryItem || null
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
        if (unitOfMeasure !== undefined) inventoryUpdate.unitOfMeasure = unitOfMeasure;

        let updatedInventory = null;
        if (Object.keys(inventoryUpdate).length > 0) {
            updatedInventory = await InventoryItem.findOneAndUpdate(
                { product: updatedProduct._id },
                { $set: inventoryUpdate },
                { new: true, upsert: true } // Upsert por si acaso no existía el registro de inventario
            );
        }

        res.status(200).json({
            ok: true,
            product: updatedProduct,
            inventoryItem: updatedInventory
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
            ...(search && { name: { $regex: new RegExp(search as string, 'i') } })
        };

        const products = await Product.find(query)
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));

        const total = await Product.countDocuments(query);

        res.status(200).json({
            products,
            totalPages: Math.ceil(total / Number(limit)),
            currentPage: Number(page),
            totalItems: total
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
        const { items, autoCreateCategories, supplierId } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ ok: false, msg: 'No items provided for upload' });
        }

        const companyDb = await Company.findById(companyId);
        if (!companyDb) {
            return res.status(404).json({ ok: false, msg: 'Company not found' });
        }

        // 1. Manejo de Categorías
        const categoryMap = new Map<string, mongoose.Types.ObjectId>();
        const uniqueCategoryNames = [...new Set(items.map(item => item.categoryName).filter(Boolean))];

        for (const catName of uniqueCategoryNames) {
            // Buscamos si la categoría ya existe para esta compañía
            // Usamos regex para que sea case-insensitive (ej: "Bebidas" == "bebidas")
            let category = await Category.findOne({ 
                company: companyId, 
                name: { $regex: new RegExp('^' + catName + '$', 'i') } 
            });

            if (!category && autoCreateCategories) {
                category = new Category({
                    company: companyId,
                    name: catName,
                    description: `Generada automáticamente desde importación masiva`
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
        let errors = [];
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
                errors.push({ row: i + 1, item, error: `La categoría '${item.categoryName}' no existe y la auto-creación está desactivada` });
                continue;
            }

            // Buscar si ya existe el item en el inventario de esta compañía
            const existingInventory = await InventoryItem.findOne({ company: companyId, barCode: item.barCode });

            if (existingInventory) {
                // ACTUALIZAR (UPSERT logic para existentes)
                inventoryOps.push({
                    updateOne: {
                        filter: { _id: existingInventory._id },
                        update: {
                            $set: {
                                stock: item.stock !== undefined ? Number(item.stock) : existingInventory.stock,
                                costPrice: item.costPrice !== undefined ? Number(item.costPrice) : existingInventory.costPrice,
                                sellingPrice: item.sellingPrice !== undefined ? Number(item.sellingPrice) : existingInventory.sellingPrice
                            }
                        }
                    }
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
                            supplier: supplierId,
                            categories: catId ? [catId] : [],
                            isComposite: false
                        }
                    }
                });

                inventoryOps.push({
                    insertOne: {
                        document: {
                            company: companyId,
                            supplier: supplierId,
                            product: _idProduct,
                            name: item.name,
                            barCode: item.barCode,
                            stock: item.stock ? Number(item.stock) : 0,
                            costPrice: item.costPrice ? Number(item.costPrice) : 0,
                            sellingPrice: item.sellingPrice ? Number(item.sellingPrice) : 0,
                            measurement: item.measurement || 'unit'
                        }
                    }
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
                errorsCount: errors.length
            },
            errors
        });

    } catch (error: any) {
        return res.status(500).json({ ok: false, msg: 'Error procesando archivo masivo', error: error.message });
    }
};
