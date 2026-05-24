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
    
    // Validar que el usuario que intenta abrir la caja sea el mismo autenticado
    const reqWithUid = req as any;
    if (reqWithUid.uid && user !== reqWithUid.uid) {
      return res.status(403).json({ message: 'No tienes privilegios para abrir caja para otro usuario' });
    }
    
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

    // El campo branch debe ser obligatorio para asegurar la segmentación por sucursal
    const branchId = userDoc.branch;
    if (!branchId) {
      return res.status(400).json({ message: 'El cajero debe pertenecer a una sucursal para poder abrir caja' });
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
      branch: branchId, // <-- Guardar sucursal objetivo
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

export const getActiveRegistersByBranch = async (req: Request, res: Response) => {
  try {
    const { branchId } = req.params;
    const activeRegisters = await CashRegister.find({ branch: branchId, closed: false })
      .populate('user', 'name username email img')
      .populate('physicalRegister', 'name description');

    res.status(200).json({ ok: true, activeRegisters });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching active cash registers for branch', error });
  }
};

export const getCashRegistersHistory = async (req: Request, res: Response) => {
  try {
    const { branchId } = req.params;
    const { userId, startDate, endDate, discrepancy, page = 1, limit = 10 } = req.query;

    const query: any = { branch: branchId };

    if (userId) {
      query.user = userId;
    }

    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) {
        query.startDate.$gte = moment.utc(startDate as string).startOf('day').toDate();
      }
      if (endDate) {
        query.startDate.$lte = moment.utc(endDate as string).endOf('day').toDate();
      }
    }

    if (discrepancy) {
      if (discrepancy === 'perfect') {
        query.difference = 0;
      } else if (discrepancy === 'discrepancy') {
        query.difference = { $ne: 0 };
      } else if (discrepancy === 'deficit') {
        query.difference = { $lt: 0 };
      } else if (discrepancy === 'surplus') {
        query.difference = { $gt: 0 };
      }
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const cashRegisters = await CashRegister.find(query)
      .populate('user', 'name username email img')
      .populate('physicalRegister', 'name description')
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await CashRegister.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      ok: true,
      cashRegisters,
      total,
      page: pageNum,
      totalPages,
      limit: limitNum
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cash registers history', error });
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
