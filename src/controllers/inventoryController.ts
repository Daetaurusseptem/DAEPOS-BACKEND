import { Request, Response } from 'express';
import InventoryItem from '../models-mongoose/InventoryItem';
import Recipe from '../models-mongoose/Recipe';
import Product from '../models-mongoose/Product';
import User from '../models-mongoose/User';

export const createInventoryItem = async (req: Request, res: Response) => {
  try {
    // Si no se pasó un proveedor explícitamente pero hay un producto asociado,
    // vincular el proveedor de ese producto de manera automática e invisible.
    if (!req.body.supplier && req.body.product) {
      const prod = await Product.findById(req.body.product).exec();
      if (prod && prod.supplier) {
        req.body.supplier = prod.supplier;
      }
    }

    const item = new InventoryItem(req.body);
    await item.save();
    res.status(201).json({ ok: true, item });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Error creating inventory item', error });
  }
};

export const getInventoryByCompany = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { search = '', type = 'all', branchId, supplier } = req.query;

    const query: any = { company: companyId };

    const userId = (req as any).uid;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    if (user.role === 'admin' || user.role === 'user') {
      if (user.branch) {
        query.branch = user.branch;
      }
    } else {
      if (branchId) {
        query.branch = branchId;
      }
    }

    if (supplier) {
      query.supplier = supplier;
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (type === 'raw_material') {
      query.product = { $exists: false };
    } else if (type === 'product') {
      query.product = { $exists: true };
    }

    const items = await InventoryItem.find(query)
      .populate('supplier')
      .populate({
        path: 'product',
        populate: {
          path: 'recipe',
          model: 'Recipe',
        },
      })
      .populate('branch', 'name')
      .sort({ name: 1 })
      .lean();

    // Calcular el Stock Teórico para productos compuestos de manera optimizada
    const rawMaterialsStock = await InventoryItem.find({ company: companyId, rawMaterial: { $exists: true } }).lean();
    const rmStockMap: Record<string, number> = {};
    rawMaterialsStock.forEach((rm) => {
      const bId = rm.branch ? rm.branch.toString() : 'global';
      const rmId = rm.rawMaterial ? rm.rawMaterial.toString() : '';
      if (rmId) {
        const key = `${bId}-${rmId}`;
        rmStockMap[key] = (rmStockMap[key] || 0) + rm.stock;
      }
    });

    items.forEach((item: any) => {
      if (
        item.product &&
        item.product.isComposite &&
        item.product.recipe &&
        item.product.recipe.sizes &&
        item.product.recipe.sizes.length > 0
      ) {
        const recipe = item.product.recipe;
        const targetSize = recipe.sizes[0];

        if (targetSize && targetSize.ingredients) {
          let maxYield = Infinity;
          const bId = item.branch ? (item.branch._id || item.branch).toString() : 'global';

          targetSize.ingredients.forEach((ing: any) => {
            const reqQty = ing.quantity;
            const rmId = ing.ingredient.toString();
            const key = `${bId}-${rmId}`;
            const currentStock = rmStockMap[key] || 0;

            if (reqQty > 0) {
              const possible = Math.floor(currentStock / reqQty);
              if (possible < maxYield) maxYield = possible;
            }
          });

          item.theoreticalStock = maxYield === Infinity ? 0 : maxYield;
        } else {
          item.theoreticalStock = 0;
        }
      }
    });

    res.status(200).json({ ok: true, items });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Error fetching inventory', error });
  }
};

export const getInventoryByCategory = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { category, search = '', page = 1, limit = 10, branchId } = req.query;

    const query: any = { company: companyId };

    const userId = (req as any).uid;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    if (user.role === 'admin' || user.role === 'user') {
      if (user.branch) {
        query.branch = user.branch;
      }
    } else {
      if (branchId) {
        query.branch = branchId;
      }
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Si se especifica categoría, buscamos los productos que pertenecen a esa categoría
    // y luego los InventoryItems vinculados a esos productos
    if (category) {
      const productsInCategory = await Product.find({ categories: category }).select('_id');
      const productIds = productsInCategory.map((p) => p._id);
      query.product = { $in: productIds };
    } else {
      // Si no hay categoría, al menos aseguramos que sean productos de venta
      query.product = { $exists: true };
    }

    const items = await InventoryItem.find(query)
      .populate({
        path: 'product',
        populate: {
          path: 'recipe',
          model: 'Recipe',
        },
      })
      .populate('supplier')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .sort({ name: 1 })
      .lean();

    // Calcular el Stock Teórico para productos compuestos de manera optimizada
    const rawMaterialsStock = await InventoryItem.find({ company: companyId, rawMaterial: { $exists: true } }).lean();
    const rmStockMap: Record<string, number> = {};
    rawMaterialsStock.forEach((rm) => {
      const bId = rm.branch ? rm.branch.toString() : 'global';
      const rmId = rm.rawMaterial ? rm.rawMaterial.toString() : '';
      if (rmId) {
        const key = `${bId}-${rmId}`;
        rmStockMap[key] = (rmStockMap[key] || 0) + rm.stock;
      }
    });

    items.forEach((item: any) => {
      if (
        item.product &&
        item.product.isComposite &&
        item.product.recipe &&
        item.product.recipe.sizes &&
        item.product.recipe.sizes.length > 0
      ) {
        const recipe = item.product.recipe;
        // Calcular el stock teórico basándonos en el tamaño por defecto (el primero)
        const targetSize = recipe.sizes[0];

        if (targetSize && targetSize.ingredients) {
          let maxYield = Infinity;
          const bId = item.branch ? (item.branch._id || item.branch).toString() : 'global';

          targetSize.ingredients.forEach((ing: any) => {
            const reqQty = ing.quantity;
            const rmId = ing.ingredient.toString();
            const key = `${bId}-${rmId}`;
            const currentStock = rmStockMap[key] || 0;

            if (reqQty > 0) {
              const possible = Math.floor(currentStock / reqQty);
              if (possible < maxYield) maxYield = possible;
            }
          });

          item.theoreticalStock = maxYield === Infinity ? 0 : maxYield;
        } else {
          item.theoreticalStock = 0;
        }
      }
    });

    const total = await InventoryItem.countDocuments(query);

    res.status(200).json({
      ok: true,
      items,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      totalItems: total,
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Error fetching inventory by category', error });
  }
};

export const updateInventoryItem = async (req: Request, res: Response) => {
  try {
    const item = await InventoryItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ ok: false, message: 'Item not found' });
    res.status(200).json({ ok: true, item });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Error updating inventory item', error });
  }
};

export const deleteInventoryItem = async (req: Request, res: Response) => {
  try {
    const item = await InventoryItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ ok: false, message: 'Item not found' });
    res.status(200).json({ ok: true, message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Error deleting inventory item', error });
  }
};

export const getInventoryItemById = async (req: Request, res: Response) => {
  try {
    const item = await InventoryItem.findById(req.params.id).populate('product').populate('supplier');
    if (!item) return res.status(404).json({ ok: false, message: 'Item not found' });
    res.status(200).json({ ok: true, item });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Error fetching inventory item', error });
  }
};

/**
 * Unified Stock Deduction Logic
 */
export const deductStock = async (inventoryItemId: string, quantity: number) => {
  const item = await InventoryItem.findById(inventoryItemId);
  if (!item) throw new Error(`Inventory item ${inventoryItemId} not found`);

  item.stock -= quantity;
  if (item.stock < 0) throw new Error(`Insufficient stock for ${item.name}`);

  await item.save();
};

export const deductRecipeIngredients = async (recipeId: string, multiplier: number, sizeName?: string) => {
  const recipe = await Recipe.findById(recipeId).populate('sizes.ingredients.ingredient');
  if (!recipe) throw new Error('Recipe not found');

  let targetSize;
  if (sizeName) {
    targetSize = recipe.sizes.find((s) => s.name === sizeName);
  }
  if (!targetSize && recipe.sizes && recipe.sizes.length > 0) {
    targetSize = recipe.sizes[0];
  }

  if (!targetSize || !targetSize.ingredients) {
    throw new Error(`La receta no tiene ingredientes configurados para el tamaño especificado.`);
  }

  for (const component of targetSize.ingredients) {
    await deductStock(component.ingredient._id.toString(), component.quantity * multiplier);
  }
};

export const processSale = async (req: Request, res: Response) => {
  const { productsSold, companyId } = req.body;

  try {
    for (const saleItem of productsSold) {
      // Find the primary inventory item for this product
      // A saleItem might point directly to an inventoryItemId
      const inventoryItem = await InventoryItem.findById(saleItem.inventoryItemId).populate('product');

      if (!inventoryItem) throw new Error(`Item ${saleItem.inventoryItemId} not found`);

      if (inventoryItem.product && (inventoryItem.product as any).isComposite) {
        if (!(inventoryItem.product as any).recipe)
          throw new Error(`Composite product ${(inventoryItem.product as any).name} has no recipe`);
        await deductRecipeIngredients((inventoryItem.product as any).recipe, saleItem.quantity, saleItem.sizeName);
      } else {
        await deductStock(inventoryItem._id.toString(), saleItem.quantity);
      }
    }

    res.status(200).json({ ok: true, message: 'Sale processed and stock updated' });
  } catch (error: any) {
    console.error('Sale Processing Error:', error);
    res.status(400).json({ ok: false, message: error.message });
  }
};

export const getStockByProductAndBranch = async (req: Request, res: Response) => {
  try {
    const { companyId, branchId, productId } = req.params;
    const item = await InventoryItem.findOne({ company: companyId, branch: branchId, product: productId });

    if (!item) {
      return res.status(200).json({ ok: true, stock: 0 });
    }

    res.status(200).json({ ok: true, stock: item.stock });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Error fetching stock', error });
  }
};

export const getRecipeStockDetails = async (req: Request, res: Response) => {
  try {
    const { productId, branchId } = req.params;

    const product = await Product.findById(productId).populate({
      path: 'recipe',
      populate: { path: 'sizes.ingredients.ingredient', model: 'RawMaterial' },
    });

    if (!product || !product.isComposite || !product.recipe) {
      return res.status(200).json({ ok: true, ingredients: [] });
    }

    const recipe: any = product.recipe;
    const ingredientsStock = [];

    // Consideramos el primer tamaño de receta por defecto para el reabastecimiento general
    const targetSize = recipe.sizes && recipe.sizes.length > 0 ? recipe.sizes[0] : null;

    if (targetSize && targetSize.ingredients) {
      for (const ing of targetSize.ingredients) {
        if (!ing.ingredient) continue;
        const rawMaterialId = ing.ingredient._id;
        const rawMaterialName = ing.ingredient.name;
        const measurementUnit = ing.ingredient.measurementUnit;

        const invItem = await InventoryItem.findOne({ rawMaterial: rawMaterialId, branch: branchId });

        ingredientsStock.push({
          rawMaterialId,
          name: rawMaterialName,
          measurementUnit,
          currentStock: invItem ? invItem.stock : 0,
          inventoryItemId: invItem ? invItem._id : null,
          reqQty: ing.quantity,
        });
      }
    }

    res.status(200).json({ ok: true, ingredients: ingredientsStock });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Error fetching recipe stock details', error });
  }
};

export default {
  createInventoryItem,
  getInventoryByCompany,
  updateInventoryItem,
  deleteInventoryItem,
  processSale,
  getRecipeStockDetails,
};
