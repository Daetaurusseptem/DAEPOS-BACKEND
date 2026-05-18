import { Request, Response } from 'express';
import StockTransfer from '../models-mongoose/StockTransfer';
import InventoryItem from '../models-mongoose/InventoryItem';
import Notification from '../models-mongoose/Notification';
import mongoose from 'mongoose';

/**
 * Los Replica Sets (necesarios para transacciones) no suelen estar activos en local/dev.
 * Esta bandera permite activar/desactivar la atomicidad según el entorno.
 */
const SHOULD_USE_TRANSACTIONS = process.env.USE_TRANSACTIONS === 'true' || process.env.NODE_ENV === 'production';

export const createTransfer = async (req: Request, res: Response) => {
  let session: any = null;
  
  if (SHOULD_USE_TRANSACTIONS) {
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch (error) {
      console.warn('⚠️ MongoDB Transactions enabled but not supported by server. Falling back to non-atomic.');
      session = null;
    }
  }

  try {
    const { company, product, fromBranch, toBranch, quantity, createdBy, notes } = req.body;

    if (fromBranch === toBranch) {
      if (session) await session.abortTransaction();
      return res.status(400).json({ ok: false, message: 'Source and destination branches must be different' });
    }

    // 1. Find source inventory item
    const sourceItem = await InventoryItem.findOne({ product, branch: fromBranch, company }).session(session);
    if (!sourceItem) {
      if (session) await session.abortTransaction();
      return res.status(404).json({ ok: false, message: 'Source inventory item not found' });
    }

    if (sourceItem.stock < quantity) {
      if (session) await session.abortTransaction();
      return res.status(400).json({ ok: false, message: 'Insufficient stock in source branch' });
    }

    // 2. Find or create destination inventory item
    let destItem = await InventoryItem.findOne({ product, branch: toBranch, company }).session(session);
    if (!destItem) {
      destItem = new InventoryItem({
        name: sourceItem.name,
        company,
        branch: toBranch,
        supplier: sourceItem.supplier,
        stock: 0,
        costPrice: sourceItem.costPrice,
        sellingPrice: sourceItem.sellingPrice,
        measurement: sourceItem.measurement,
        product,
        barCode: sourceItem.barCode
      });
    }

    // 3. Update stocks
    sourceItem.stock -= quantity;
    destItem.stock += quantity;

    await sourceItem.save({ session });
    await destItem.save({ session });

    // 4. Record transfer
    const transfer = new StockTransfer({
      company,
      product,
      fromBranch,
      toBranch,
      quantity,
      createdBy,
      notes,
      status: 'completed'
    });
    await transfer.save({ session });

    // 5. Notifications
    const notifFrom = new Notification({
      company,
      targetBranch: fromBranch,
      title: 'Salida de Stock por Traspaso',
      message: `Se han enviado ${quantity} unidades del producto hacia otra sucursal.`,
      type: 'warning',
      link: '/dashboard/admin/inventory/transfers'
    });
    
    const notifTo = new Notification({
      company,
      targetBranch: toBranch,
      title: 'Entrada de Stock por Traspaso',
      message: `Se han recibido ${quantity} unidades del producto desde otra sucursal.`,
      type: 'success',
      link: '/dashboard/admin/inventory/transfers'
    });

    await notifFrom.save({ session });
    await notifTo.save({ session });

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    res.status(201).json({ ok: true, transfer });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    console.error('Transfer Error:', error);
    res.status(500).json({ ok: false, message: 'Error processing transfer', error });
  }
};

export const getTransfersByCompany = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const transfers = await StockTransfer.find({ company: companyId })
      .populate('product', 'name')
      .populate('fromBranch', 'name')
      .populate('toBranch', 'name')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ ok: true, transfers });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Error fetching transfers', error });
  }
};
