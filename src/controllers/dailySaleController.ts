import { Request, Response } from 'express';
import Sale from '../models-mongoose/Sale';

// Obtener todas las ventas del día
export const getDailySales = async (req: Request, res: Response) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const dailySales = await Sale.find({
      date: { $gte: startOfDay, $lte: endOfDay },
    })
      .populate('user')
      .populate('productsSold.product');

    res.status(200).json(dailySales);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching daily sales', error });
  }
};
