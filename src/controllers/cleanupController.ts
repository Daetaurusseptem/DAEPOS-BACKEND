import { Request, Response } from 'express';
import CashRegister from '../models-mongoose/CashRegister';
import PendingOrder from '../models-mongoose/PendingOrder';
import moment from 'moment';

export const runAutoCleanup = async (req?: Request, res?: Response) => {
  try {
    const twentyFourHoursAgo = moment().subtract(24, 'hours').toDate();

    // 1. Cajas con más de 24 horas abiertas
    const openRegisters = await CashRegister.find({
      closed: false,
      startDate: { $lte: twentyFourHoursAgo },
    });

    for (const register of openRegisters) {
      register.closed = true;
      register.endDate = new Date();
      register.actualAmount = 0;
      register.difference = 0 - register.expectedAmount;
      register.notes =
        (register.notes || '') +
        '\n[CIERRE AUTOMÁTICO]: El sistema cerró esta caja tras >24hrs de inactividad. El conteo físico se forzó a $0.00, lo que genera el faltante reflejado en sistema.';
      await register.save();
    }

    // 2. Comandas (PendingOrders) huérfanas o impagas de más de 24 horas
    const pendingOrders = await PendingOrder.find({
      date: { $lte: twentyFourHoursAgo },
      $or: [{ kitchenStatus: { $nin: ['delivered', 'canceled'] } }, { paymentStatus: { $in: ['unpaid', 'partial'] } }],
    });

    for (const order of pendingOrders) {
      order.kitchenStatus = 'canceled';
      if (order.paymentStatus !== 'paid') {
        order.paymentStatus = 'unpaid';
      }
      await order.save();
    }

    if (res) {
      return res.status(200).json({
        message: 'Limpieza ejecutada correctamente',
        registersClosed: openRegisters.length,
        ordersCanceled: pendingOrders.length,
      });
    }
  } catch (error) {
    console.error('Error en auto-cleanup:', error);
    if (res) {
      return res.status(500).json({ error: 'Error ejecutando la limpieza' });
    }
  }
};
