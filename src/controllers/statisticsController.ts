import { Request, Response } from 'express';
import Sale from '../models-mongoose/Sale';
import InventoryItem from '../models-mongoose/InventoryItem';
import mongoose from 'mongoose';
import Company from '../models-mongoose/Company';

export const getSalesStatistics = async (req: Request, res: Response) => {
  try {
    const sales = await Sale.aggregate([
      {
        $group: {
          _id: { $month: "$date" },
          totalSales: { $sum: "$total" },
          totalDiscount: { $sum: "$discount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({ ok: true, sales });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sales statistics', error });
  }
};

export const getItemsStatistics = async (req: Request, res: Response) => {
  try {
    const items = await InventoryItem.aggregate([
      {
        $match: { product: { $exists: true, $ne: null } }
      },
      {
        $group: {
          _id: "$product",
          totalStock: { $sum: "$stock" },
          totalValue: { $sum: { $multiply: ["$stock", { $ifNull: ["$sellingPrice", 0] }] } },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalStock: -1 } }
    ]);

    res.status(200).json({ ok: true, items });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching items statistics', error });
  }
};

export const getIngredientsStatistics = async (req: Request, res: Response) => {
  try {
    const ingredients = await InventoryItem.aggregate([
      {
        $match: { product: { $exists: false } }
      },
      {
        $group: {
          _id: "$name",
          totalStock: { $sum: "$stock" },
          totalValue: { $sum: { $multiply: ["$stock", { $ifNull: ["$costPrice", 0] }] } },
          measurement: { $first: "$measurement" },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalStock: -1 } }
    ]);

    res.status(200).json({ ok: true, ingredients });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching ingredients statistics', error });
  }
};

export const getTopSellingProductsByWeek = async (req: Request, res: Response) => {
  try {
    const { year, week, companyId, branchId } = req.query;

    if (!year || !week || !companyId) {
      return res.status(400).json({ message: 'Year, week, and companyId are required' });
    }

    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31`);

    const matchStage: any = {
      date: {
        $gte: startDate,
        $lte: endDate
      },
      company: new mongoose.Types.ObjectId(companyId as string)
    };

    if (branchId) {
      matchStage.branch = new mongoose.Types.ObjectId(branchId as string);
    }

    const sales = await Sale.aggregate([
      {
        $match: matchStage
      },
      {
        $addFields: {
          week: { $isoWeek: "$date" }
        }
      },
      {
        $match: {
          week: parseInt(week as string)
        }
      },
      {
        $unwind: "$productsSold"
      },
      {
        $group: {
          _id: { week: "$week", product: "$productsSold.product" },
          totalQuantity: { $sum: "$productsSold.quantity" }
        }
      },
      {
        $lookup: {
          from: "products",
          localField: "_id.product",
          foreignField: "_id",
          as: "product"
        }
      },
      {
        $unwind: "$product"
      },
      {
        $sort: { totalQuantity: -1 }
      }
    ]);

    res.status(200).json({ ok: true, sales });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching top selling products by week', error });
  }
};

export const getIngredientsStatisticsByWeek = async (req: Request, res: Response) => {
  try {
    const { year, week, companyId, branchId } = req.query;

    if (!year || !week || !companyId) {
      return res.status(400).json({ message: 'Year, week, and companyId are required' });
    }

    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31`);

    const matchStage: any = {
      product: { $exists: false },
      receivedDate: {
        $gte: startDate,
        $lte: endDate
      },
      company: new mongoose.Types.ObjectId(companyId as string)
    };

    if (branchId) {
      matchStage.branch = new mongoose.Types.ObjectId(branchId as string);
    }

    const ingredients = await InventoryItem.aggregate([
      {
        $match: matchStage
      },
      {
        $addFields: {
          week: { $isoWeek: "$receivedDate" }
        }
      },
      {
        $match: {
          week: parseInt(week as string)
        }
      },
      {
        $group: {
          _id: "$name",
          totalStock: { $sum: "$stock" },
          totalValue: { $sum: { $multiply: ["$stock", { $ifNull: ["$costPrice", 0] }] } },
          measurement: { $first: "$measurement" },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalStock: -1 } }
    ]);

    res.status(200).json({ ok: true, ingredients });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching ingredients statistics by week', error });
  }
};

export const getDashboardSummary = async (req: Request, res: Response) => {
  try {
    const { companyId, branchId } = req.query;

    if (!companyId) {
      return res.status(400).json({ message: 'companyId is required' });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const companyObjectId = new mongoose.Types.ObjectId(companyId as string);
    const branchFilter: any = { company: companyObjectId };
    if (branchId) {
      branchFilter.branch = new mongoose.Types.ObjectId(branchId as string);
    }

    const salesFilter: any = {
      company: companyObjectId,
      date: { $gte: startOfDay, $lte: endOfDay }
    };
    if (branchId) {
      salesFilter.branch = new mongoose.Types.ObjectId(branchId as string);
    }

    // 1. Total Sales Today
    const salesToday = await Sale.aggregate([
      {
        $match: salesFilter
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$total" },
          count: { $sum: 1 }
        }
      }
    ]);

    // 2. Low Stock Count
    // a) Get all inventory items linked to a product
    const inventoryItems = await InventoryItem.find({
      ...branchFilter,
      product: { $exists: true, $ne: null }
    })
      .populate({
        path: 'product',
        match: { isComposite: true }, // Only populate composite products to save memory
        populate: {
          path: 'recipe',
          model: 'Recipe'
        }
      })
      .select('stock product branch lowStockThreshold')
      .lean();

    // b) Get all raw materials stock to calculate theoretical stock for composites
    const rawMaterialsStock = await InventoryItem.find({
      company: companyObjectId,
      rawMaterial: { $exists: true }
    }).select('stock rawMaterial branch').lean();

    const rmStockMap: Record<string, number> = {};
    rawMaterialsStock.forEach(rm => {
      const bId = rm.branch ? rm.branch.toString() : 'global';
      const rmId = rm.rawMaterial ? rm.rawMaterial.toString() : '';
      if (rmId) {
        const key = `${bId}-${rmId}`;
        rmStockMap[key] = (rmStockMap[key] || 0) + rm.stock;
      }
    });

    let lowStockCount = 0;

    inventoryItems.forEach((item: any) => {
      const threshold = item.lowStockThreshold !== undefined ? item.lowStockThreshold : 5;

      // Si item.product viene populateado, significa que es isComposite: true
      if (item.product && item.product.isComposite) {
        let theoreticalStock = 0;
        if (item.product.recipe && item.product.recipe.sizes && item.product.recipe.sizes.length > 0) {
          const recipe = item.product.recipe;
          const targetSize = recipe.sizes[0]; // Usamos la receta por defecto
          
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
            
            theoreticalStock = maxYield === Infinity ? 0 : maxYield;
          }
        }
        
        if (theoreticalStock < threshold) {
          lowStockCount++;
        }
      } else {
        // Es un producto simple
        if (item.stock < threshold) {
          lowStockCount++;
        }
      }
    });

    // 3. Active Registers
    const activeRegisters = await mongoose.model('CashRegister').countDocuments({
      ...branchFilter,
      closed: false
    });

    // 4. Recent Sales (Last 5)
    const recentSales = await Sale.find({ ...branchFilter })
      .sort({ date: -1 })
      .limit(5)
      .populate('user', 'name username')
      .populate('branch', 'name');

    res.status(200).json({
      ok: true,
      summary: {
        totalSalesToday: salesToday[0]?.total || 0,
        transactionsToday: salesToday[0]?.count || 0,
        lowStockCount,
        activeRegisters,
        recentSales
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard summary', error });
  }
};
