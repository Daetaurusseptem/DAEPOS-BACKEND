import { Request, Response } from 'express';
import InventoryItem from '../models-mongoose/InventoryItem';
import Recipe from '../models-mongoose/Recipe';
import Product from '../models-mongoose/Product';

export const createInventoryItem = async (req: Request, res: Response) => {
  try {
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
    const { search = '', type = 'all' } = req.query;

    let query: any = { company: companyId };

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
      .populate('product')
      .sort({ name: 1 });

    res.status(200).json({ ok: true, items });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Error fetching inventory', error });
  }
};

export const getInventoryByCategory = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { category, search = '', page = 1, limit = 10 } = req.query;

    let query: any = { company: companyId };

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Si se especifica categoría, buscamos los productos que pertenecen a esa categoría
    // y luego los InventoryItems vinculados a esos productos
    if (category) {
      const productsInCategory = await Product.find({ categories: category }).select('_id');
      const productIds = productsInCategory.map(p => p._id);
      query.product = { $in: productIds };
    } else {
      // Si no hay categoría, al menos aseguramos que sean productos de venta
      query.product = { $exists: true };
    }

    const items = await InventoryItem.find(query)
      .populate('product')
      .populate('supplier')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .sort({ name: 1 });

    const total = await InventoryItem.countDocuments(query);

    res.status(200).json({
      ok: true,
      items,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      totalItems: total
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

export const deductRecipeIngredients = async (recipeId: string, multiplier: number) => {
  const recipe = await Recipe.findById(recipeId).populate('ingredients.ingredient');
  if (!recipe) throw new Error('Recipe not found');

  for (const component of recipe.ingredients) {
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
        if (!(inventoryItem.product as any).recipe) throw new Error(`Composite product ${(inventoryItem.product as any).name} has no recipe`);
        await deductRecipeIngredients((inventoryItem.product as any).recipe, saleItem.quantity);
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

export default {
  createInventoryItem,
  getInventoryByCompany,
  updateInventoryItem,
  deleteInventoryItem,
  processSale
};
