import { Request, Response } from 'express';
import PendingOrder from '../models-mongoose/PendingOrder';
import Sale from '../models-mongoose/Sale';
import CashRegister from '../models-mongoose/CashRegister';
import InventoryItem from '../models-mongoose/InventoryItem';
import Product from '../models-mongoose/Product';
import Recipe from '../models-mongoose/Recipe';
import Branch from '../models-mongoose/Branch';
import { getIO } from '../socket';

// Función para deducir el stock de un ítem simple
const deductStockForSimpleItem = async (itemId: string, quantity: number) => {
  const item = await InventoryItem.findById(itemId);
  if (!item) throw new Error('Insumo no encontrado en el inventario.');
  item.stock -= quantity;
  if (item.stock < 0) throw new Error(`Stock insuficiente para el ítem: ${item.name}`);
  await item.save();
};

// Función para deducir ingredientes para un ítem compuesto
const deductIngredientsForCompositeItem = async (
  recipeId: any,
  quantity: number,
  branchId: any,
  multiplier: number = 1,
  sizeName?: string,
) => {
  const recipe = await Recipe.findById(recipeId).populate('sizes.ingredients.ingredient');
  if (!recipe) throw new Error('Receta no encontrada.');

  let targetSize;
  if (sizeName) {
    targetSize = recipe.sizes.find((s) => s.name === sizeName);
  }
  if (!targetSize && recipe.sizes && recipe.sizes.length > 0) {
    targetSize = recipe.sizes[0]; // Fallback al primero
  }

  if (!targetSize || !targetSize.ingredients) {
    throw new Error(`La receta no tiene ingredientes configurados para el tamaño especificado.`);
  }

  for (const recipeIngredient of targetSize.ingredients) {
    const ingredientItem = await InventoryItem.findOne({
      rawMaterial: recipeIngredient.ingredient._id,
      branch: branchId,
    });
    if (!ingredientItem) {
      throw new Error(
        `Insumo ${(recipeIngredient.ingredient as any).name || 'desconocido'} no está registrado en esta sucursal.`,
      );
    }
    ingredientItem.stock -= recipeIngredient.quantity * quantity * multiplier;
    if (ingredientItem.stock < 0) {
      throw new Error(`Stock insuficiente de ${ingredientItem.name} en esta sucursal.`);
    }
    await ingredientItem.save();
  }
};

// Procesar la venta y actualizar el inventario
const processSale = async (productsSold: any[], branchId: any) => {
  for (const productSold of productsSold) {
    const item = await InventoryItem.findOne({ product: productSold.product, branch: branchId }).populate('product');
    if (!item)
      throw new Error(`El producto ${productSold.product} no está registrado en el inventario de esta sucursal.`);

    const product = await Product.findById((item.product as any)._id);
    if (!product) throw new Error('Producto no encontrado.');

    if (product.isComposite) {
      if (!product.recipe) throw new Error('El producto compuesto no tiene receta asociada.');
      await deductIngredientsForCompositeItem(
        product.recipe,
        productSold.quantity,
        branchId,
        productSold.multiplier || 1,
        productSold.sizeName,
      );
    } else {
      await deductStockForSimpleItem(item._id.toString(), productSold.quantity);
    }
  }
};

// Revertir inventario descontado (para cancelaciones)
const rollbackInventory = async (productsSold: any[], branchId: any) => {
  for (const productSold of productsSold) {
    const item = await InventoryItem.findOne({ product: productSold.product, branch: branchId }).populate('product');
    if (!item) continue; // Si no existe, no podemos reabastecer

    const product = await Product.findById((item.product as any)._id);
    if (!product) continue;

    if (product.isComposite) {
      if (!product.recipe) continue;
      const recipe = await Recipe.findById(product.recipe).populate('sizes.ingredients.ingredient');
      if (recipe) {
        let targetSize;
        if (productSold.sizeName) {
          targetSize = recipe.sizes.find((s) => s.name === productSold.sizeName);
        }
        if (!targetSize && recipe.sizes && recipe.sizes.length > 0) {
          targetSize = recipe.sizes[0];
        }

        if (targetSize && targetSize.ingredients) {
          for (const recipeIngredient of targetSize.ingredients) {
            const ingredientItem = await InventoryItem.findOne({
              rawMaterial: recipeIngredient.ingredient._id,
              branch: branchId,
            });
            if (ingredientItem) {
              ingredientItem.stock += recipeIngredient.quantity * productSold.quantity * (productSold.multiplier || 1);
              await ingredientItem.save();
            }
          }
        }
      }
    } else {
      item.stock += productSold.quantity;
      await item.save();
    }
  }
};

// Crear una orden pendiente
export const createPendingOrder = async (req: Request, res: Response) => {
  try {
    const {
      table,
      clientName,
      type,
      inRestaurantDetails,
      driveThruDetails,
      deliveryDetails,
      productsSold,
      total,
      discount,
      company,
      branch,
      cashRegister,
      customer,
      appliedPromotion,
      waiter,
    } = req.body;

    // Validar caja abierta
    const register = await CashRegister.findById(cashRegister);
    if (!register || register.closed) {
      return res.status(400).json({ message: 'La caja registradora debe estar abierta para registrar un ticket.' });
    }

    // Consultar configuración de la sucursal
    const branchIdToSearch = typeof branch === 'object' && branch._id ? branch._id : branch;
    const branchDoc = await Branch.findById(branchIdToSearch);
    const isKitchenEnabled = branchDoc?.kitchenSettings?.enableKitchenModule ?? false;
    const maxShiftDurationHours = branchDoc?.shiftSettings?.maxShiftDurationHours || 12;
    const hoursOpen = (new Date().getTime() - register.startDate.getTime()) / (1000 * 60 * 60);

    if (hoursOpen > maxShiftDurationHours) {
      return res.status(400).json({
        message: `La caja ha excedido el tiempo máximo permitido de ${maxShiftDurationHours} horas. Por favor, solicita a un gerente que realice el corte de caja.`,
      });
    }

    let calculatedStatus: any = 'pending';
    let prepStartedAt: Date | undefined = undefined;

    if (isKitchenEnabled) {
      calculatedStatus = 'in_kitchen';
      prepStartedAt = new Date();
    }

    // Reserva de inventario en cuanto se crea la orden
    await processSale(productsSold, branch);

    const newOrder = new PendingOrder({
      user: (req as any).uid || register.user,
      waiter,
      table,
      clientName,
      type,
      kitchenStatus: calculatedStatus,
      paymentStatus: 'unpaid',
      prepStartedAt,
      inRestaurantDetails,
      driveThruDetails,
      deliveryDetails,
      productsSold: productsSold.map((p: any) => ({
        product: p.product._id || p.product,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        subtotal: p.subtotal,
        multiplier: p.multiplier,
        modifications: p.modifications || [],
        sizeName: p.sizeName,
        status: 'sent_to_kitchen',
      })),
      total,
      discount,
      company,
      branch,
      cashRegister,
      customer,
      appliedPromotion,
    });

    const savedOrder = await newOrder.save();

    // Emitir evento WS a la sala correcta (string ID)
    getIO().to(branchIdToSearch.toString()).emit('kds-update', savedOrder);

    res.status(201).json({ ok: true, pendingOrder: savedOrder });
  } catch (error: any) {
    res.status(500).json({ message: error.message || error });
  }
};

// Obtener todas las órdenes pendientes activas
export const getActivePendingOrders = async (req: Request, res: Response) => {
  try {
    const { branchId, companyId } = req.query;
    const query: any = {
      kitchenStatus: { $ne: 'canceled' },
      $or: [
        { kitchenStatus: { $in: ['pending', 'in_kitchen', 'ready'] } },
        { paymentStatus: { $in: ['unpaid', 'partial'] } },
      ],
    };

    if (branchId) {
      query.branch = branchId;
      const openRegisters = await CashRegister.find({ branch: branchId, closed: false }).select('_id');
      query.cashRegister = { $in: openRegisters.map((r) => r._id) };
    } else if (companyId) {
      query.company = companyId;
      const openRegisters = await CashRegister.find({ company: companyId, closed: false }).select('_id');
      query.cashRegister = { $in: openRegisters.map((r) => r._id) };
    }

    const orders = await PendingOrder.find(query)
      .populate('user')
      .populate('waiter')
      .populate('preparedBy')
      .populate('productsSold.product')
      .sort({ date: -1 });

    res.status(200).json({ ok: true, pendingOrders: orders });
  } catch (error: any) {
    res.status(500).json({ message: error.message || error });
  }
};

// Actualizar estatus de orden pendiente (ej. Mandar a cocina / Listo / Entregado)
export const updatePendingOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'pending' | 'in_kitchen' | 'ready' | 'delivered' | 'canceled'

    const order = await PendingOrder.findById(id);
    if (!order) return res.status(404).json({ message: 'Orden pendiente no encontrada.' });

    // Validar transiciones de estado permitidas
    const allowedTransitions: Record<string, string[]> = {
      pending: ['in_kitchen', 'canceled'],
      in_kitchen: ['ready', 'canceled'],
      ready: ['delivered', 'in_kitchen', 'canceled'],
      delivered: [],
      canceled: [],
    };

    const currentStatus = order.kitchenStatus;
    if (!allowedTransitions[currentStatus]?.includes(status)) {
      return res.status(400).json({
        message: `No se puede cambiar de estado "${currentStatus}" a "${status}".`,
      });
    }

    order.kitchenStatus = status;

    // Registrar estampas de tiempo de cocina y servicio
    if (status === 'in_kitchen' && !order.prepStartedAt) {
      order.prepStartedAt = new Date();
    } else if (status === 'ready') {
      order.prepCompletedAt = new Date();
      if ((req as any).uid) {
        order.preparedBy = (req as any).uid;
      }
    } else if (status === 'delivered') {
      order.deliveredAt = new Date();
    }

    await order.save();

    // Emitir evento WS
    getIO().to(order.branch.toString()).emit('kds-update', order);

    res.status(200).json({ ok: true, pendingOrder: order });
  } catch (error: any) {
    res.status(500).json({ message: error.message || error });
  }
};

// Liquidar orden, deducir inventario y crear la venta oficial
export const payAndClosePendingOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { paymentMethod, paymentReference, receivedAmount, change } = req.body;

    const order = await PendingOrder.findById(id);
    if (!order) return res.status(404).json({ message: 'Orden pendiente no encontrada.' });

    if (order.kitchenStatus === 'canceled' || order.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Esta orden ya ha sido pagada o cancelada.' });
    }

    // 1. Validar caja registradora abierta
    const register = await CashRegister.findById(order.cashRegister);
    if (!register || register.closed) {
      return res.status(400).json({ message: 'La caja registradora debe estar abierta para liquidar el cobro.' });
    }

    // Calcula el monto de este pago específico
    const currentPaymentAmount = (receivedAmount || order.total) - (change || 0);

    // Registra el pago en la orden
    if (!order.payments) order.payments = [];
    order.payments.push({
      method: paymentMethod,
      amount: currentPaymentAmount,
      reference: paymentReference,
      date: new Date(),
    });

    const totalPaid = order.payments.reduce((acc, p) => acc + p.amount, 0);

    // Actualiza la caja registradora con este pago
    if (paymentMethod === 'cash') {
      register.payments.cash = (register.payments.cash || 0) + currentPaymentAmount;
    } else if (paymentMethod === 'debit') {
      register.payments.debit = (register.payments.debit || 0) + currentPaymentAmount;
    } else {
      register.payments.credit = (register.payments.credit || 0) + currentPaymentAmount;
    }
    register.expectedAmount = (register.expectedAmount || 0) + currentPaymentAmount;
    await register.save();

    if (totalPaid < order.total) {
      // Es un pago parcial
      order.paymentStatus = 'partial';
      await order.save();
      return res.status(200).json({ ok: true, partial: true, pendingOrder: order });
    }

    // Si el total ha sido cubierto
    order.paymentStatus = 'paid';
    await order.save();

    // Determinar método de pago para la Venta (mixed si hay más de 1 pago diferente)
    let finalPaymentMethod: any = order.payments[0].method;
    if (order.payments.some((p) => p.method !== finalPaymentMethod)) {
      finalPaymentMethod = 'mixed';
    }

    // Crear Venta Oficial
    const newSale = new Sale({
      user: order.user,
      cashRegister: order.cashRegister,
      date: new Date(),
      total: order.total,
      discount: order.discount,
      productsSold: order.productsSold,
      paymentMethod: finalPaymentMethod,
      payments: order.payments,
      paymentReference,
      receivedAmount: totalPaid,
      change,
      company: order.company,
      branch: order.branch,
      customer: order.customer,
      appliedPromotion: order.appliedPromotion,
      deliveryDetails: order.deliveryDetails,
    });

    await newSale.save();

    // Agregar la venta al array de ventas de la caja registradora
    register.sales.push(newSale._id as any);
    await register.save();

    res.status(200).json({ ok: true, sale: newSale });
  } catch (error: any) {
    res.status(500).json({ message: error.message || error });
  }
};

// Agregar ítems a una orden pendiente existente
export const addItemsToPendingOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newProductsSold, additionalTotal } = req.body;

    const order = await PendingOrder.findById(id);
    if (!order) return res.status(404).json({ message: 'Orden pendiente no encontrada.' });

    if (order.paymentStatus === 'paid' || order.kitchenStatus === 'canceled' || order.kitchenStatus === 'delivered') {
      return res.status(400).json({ message: 'No se pueden agregar ítems a una orden pagada, cancelada o entregada.' });
    }

    // Descontar inventario de los nuevos productos
    await processSale(newProductsSold, order.branch);

    // Marcar los nuevos productos
    const itemsToAdd = newProductsSold.map((p: any) => ({
      ...p,
      status: 'pending_kitchen',
    }));

    order.productsSold.push(...itemsToAdd);
    order.total += additionalTotal;

    // Si la orden estaba "ready", al añadir nuevos ítems debería regresar a "in_kitchen" para que el cocinero lo vea
    if (order.kitchenStatus === 'ready') {
      order.kitchenStatus = 'in_kitchen';
    }

    await order.save();

    // Emitir evento WS
    getIO().to(order.branch.toString()).emit('kds-update', order);

    res.status(200).json({ ok: true, pendingOrder: order });
  } catch (error: any) {
    res.status(500).json({ message: error.message || error });
  }
};

// Cancelar orden pendiente
export const cancelPendingOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = await PendingOrder.findById(id);
    if (!order) return res.status(404).json({ message: 'Orden no encontrada.' });

    // Revertir pagos parciales de la caja registradora
    if (order.paymentStatus === 'partial' && order.payments && order.payments.length > 0) {
      const register = await CashRegister.findById(order.cashRegister);
      if (register) {
        const totalPaid = order.payments.reduce((acc: number, p: any) => acc + p.amount, 0);
        register.expectedAmount = (register.expectedAmount || 0) - totalPaid;
        for (const payment of order.payments) {
          if (payment.method === 'cash') {
            register.payments.cash = (register.payments.cash || 0) - payment.amount;
          } else {
            register.payments.credit = (register.payments.credit || 0) - payment.amount;
          }
        }
        await register.save();
      }
    }

    order.kitchenStatus = 'canceled';
    await order.save();

    // Revertir inventario
    await rollbackInventory(order.productsSold, order.branch);

    // Emitir evento WS
    getIO().to(order.branch.toString()).emit('kds-update', order);

    res.status(200).json({ ok: true, message: 'Orden cancelada y eliminada del flujo de cocina con éxito.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || error });
  }
};
