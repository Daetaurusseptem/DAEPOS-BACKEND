import { Request, Response } from 'express';
import CashRegister from '../models-mongoose/CashRegister';
import PhysicalRegister from '../models-mongoose/PhysicalRegister';
import Sale from '../models-mongoose/Sale';
import User from '../models-mongoose/User';
import Company from '../models-mongoose/Company';
import moment from 'moment';

// Registrar el dinero inicial y abrir caja (Turno)
export const openCashRegister = async (req: Request, res: Response) => {
  try {
    const { user, physicalRegister, initialAmount } = req.body;
    
    // 1. Verificar si el usuario ya tiene una caja abierta
    const existingUserShift = await CashRegister.findOne({ user, closed: false });
    if (existingUserShift) {
      return res.status(400).json({ message: 'Ya tienes un turno abierto' });
    }

    // 2. Verificar si la caja física ya está ocupada
    const existingPhysicalShift = await CashRegister.findOne({ physicalRegister, closed: false });
    if (existingPhysicalShift) {
      return res.status(400).json({ message: 'Esta caja física ya está siendo utilizada en otro turno' });
    }

    // 3. Obtener empresa y validar límites de suscripción
    const userDoc = await User.findById(user);
    if (!userDoc || !userDoc.companyId) {
      return res.status(404).json({ message: 'Usuario o empresa no encontrados' });
    }

    const company = await Company.findById(userDoc.companyId);
    if (!company) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    const activeShiftsCount = await CashRegister.countDocuments({ 
      company: userDoc.companyId, 
      closed: false 
    });

    if (activeShiftsCount >= company.maxActiveRegisters) {
      return res.status(403).json({ 
        message: `Límite de cajas alcanzado (${company.maxActiveRegisters}). Cierra un turno activo para abrir uno nuevo.` 
      });
    }

    // 4. Crear el turno
    const newCashRegister = new CashRegister({
      user,
      physicalRegister,
      company: userDoc.companyId,
      initialAmount,
      expectedAmount: initialAmount,
      startDate: new Date(),
      closed: false
    }); 

    const savedCashRegister = await newCashRegister.save();
    res.status(201).json(savedCashRegister);
  } catch (error) {
    res.status(500).json({ message: 'Error opening cash register', error });
  }
};

// Cerrar caja (Corte Z)
export const closeCashRegister = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { actualAmount, notes } = req.body;

    const cashRegister = await CashRegister.findById(id);
    if (!cashRegister) {
      return res.status(404).json({ message: 'Turno no encontrado' });
    }

    if (cashRegister.closed) {
      return res.status(400).json({ message: 'Este turno ya ha sido cerrado' });
    }

    // El expectedAmount ya se va actualizando en cada venta
    cashRegister.actualAmount = actualAmount;
    cashRegister.difference = actualAmount - cashRegister.expectedAmount;
    cashRegister.notes = notes || '';
    cashRegister.endDate = new Date();
    cashRegister.closed = true;

    const savedCashRegister = await cashRegister.save();
    res.status(200).json(savedCashRegister);
  } catch (error) {
    res.status(500).json({ message: 'Error closing cash register', error});
  }
};

// Registrar un gasto de caja
export const addExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // ID del CashRegister (Turno)
    const { amount, reason, type = 'expense' } = req.body;

    const cashRegister = await CashRegister.findById(id);
    if (!cashRegister || cashRegister.closed) {
      return res.status(404).json({ message: 'Turno activo no encontrado' });
    }

    cashRegister.expenses.push({
      amount,
      reason,
      type,
      timestamp: new Date()
    });

    // Restar del dinero esperado en caja
    cashRegister.expectedAmount -= amount;

    await cashRegister.save();
    res.status(200).json({ ok: true, cashRegister });
  } catch (error) {
    res.status(500).json({ message: 'Error adding expense', error });
  }
};

export const hasOpenCashRegister = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const openCashRegister = await CashRegister.findOne({ user: userId, closed: false });
    res.status(200).json(!!openCashRegister);
  } catch (error) {
    res.status(500).json({ message: 'Error checking open cash register', error });
  }
};

export const getCashRegisters = async (req: Request, res: Response) => {
  try {
    const cashRegisters = await CashRegister.find()
      .populate('user')
      .populate('physicalRegister')
      .populate('sales');
    res.status(200).json(cashRegisters);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cash registers', error });
  }
};

export const getOpenCashRegister = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const openCashRegister = await CashRegister.findOne({ user: userId, closed: false })
      .populate('physicalRegister');

    if (!openCashRegister) {
      return res.status(404).json({ message: 'No open cash register found for this user' });
    }
    res.status(200).json(openCashRegister);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving open cash register', error });
  }
};

export const getOpenCashRegisterWithSales = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const openCashRegister = await CashRegister.findOne({ user: userId, closed: false })
      .populate('physicalRegister')
      .populate('sales');

    if (!openCashRegister) {
      return res.status(404).json({ message: 'No open cash register found for this user' });
    }
    res.status(200).json(openCashRegister);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving open cash register with sales', error });
  }
};

export const getUserCashRegistersByStartDate = async (req: Request, res: Response) => {
  try {
    const { userId, startDate } = req.params;
    const start = moment.utc(startDate).startOf('day').toDate();
    const end = moment.utc(startDate).endOf('day').toDate();

    const cashRegisters = await CashRegister.find({
      user: userId,
      startDate: { $gte: start, $lte: end }
    })
      .populate('user')
      .populate('physicalRegister')
      .populate('sales');

    res.status(200).json({ ok: true, cajas: cashRegisters });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user cash registers', error });
  }
};

export const getUserCajasByDate = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const cajas = await CashRegister.find({ user: userId }).select('startDate');
    const fechas = Array.from(new Set(cajas.map(caja => caja.startDate.toISOString().split('T')[0])));
    return res.status(200).json({ fechas });
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching dates', error });
  }
};

export const getCajaDetailsById = async (req: Request, res: Response) => {
  try {
    const { cajaId } = req.params;
    const cashRegister = await CashRegister.findById(cajaId)
      .populate('user')
      .populate('physicalRegister')
      .populate({
        path: 'sales',
        populate: { path: 'productsSold.product' }
      });

    if (!cashRegister) {
      return res.status(404).json({ message: 'Caja no encontrada' });
    }
    return res.status(200).json({ ok: true, caja: cashRegister });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching caja details', error });
  }
};

export const getSalesByCashRegister = async (req: Request, res: Response) => {
  try {
    const { cashRegisterId } = req.params;
    const sales = await Sale.find({ cashRegister: cashRegisterId })
      .populate('productsSold.product');
    res.status(200).json({ ok: true, sales });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sales for cash register', error });
  }
};
