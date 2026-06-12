import { Request, Response } from 'express';
import CashRegister from '../models-mongoose/CashRegister';
import PhysicalRegister from '../models-mongoose/PhysicalRegister';
import Sale from '../models-mongoose/Sale';
import User from '../models-mongoose/User';
import Company from '../models-mongoose/Company';
import Branch from '../models-mongoose/Branch';
import PendingOrder from '../models-mongoose/PendingOrder';
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

    const branchDoc = await Branch.findById(branchId);
    if (!branchDoc || branchDoc.isActive === false) {
      return res.status(403).json({ message: 'La sucursal se encuentra suspendida o inactiva. Operación denegada.' });
    }

    const company = await Company.findById(userDoc.companyId);
    if (!company) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    // Limit check is now handled by checkActiveRegistersLimit middleware

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
    const { actualAmount, notes, remanenteFloatAmount = 0, depositWithdrawalAmount = 0 } = req.body;

    const cashRegister = await CashRegister.findById(id);
    if (!cashRegister) {
      return res.status(404).json({ message: 'Turno no encontrado' });
    }

    if (cashRegister.closed) {
      return res.status(400).json({ message: 'Este turno ya ha sido cerrado' });
    }

    // Capa 1: Validación Estricta Anti-Huérfanos
    const hasPendingOrders = await PendingOrder.exists({
      cashRegister: cashRegister._id,
      $or: [
        { kitchenStatus: { $nin: ['delivered', 'canceled'] } },
        { paymentStatus: { $in: ['unpaid', 'partial'] } }
      ]
    });

    if (hasPendingOrders) {
      return res.status(400).json({ message: 'No puedes cerrar la caja. Tienes comandas pendientes de preparar o sin liquidar completamente en este turno. Por favor cóbralas o cancélalas primero.' });
    }

    // El expectedAmount ya se va actualizando en cada venta
    cashRegister.actualAmount = actualAmount;
    cashRegister.remanenteFloatAmount = remanenteFloatAmount;
    cashRegister.depositWithdrawalAmount = depositWithdrawalAmount;
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

// =====================================================================================
// HELPER PARA AUTO-LIMPIEZA Y SUSPENSIONES
// =====================================================================================
export const forceCloseUserCashRegisters = async (userId: string | any) => {
  try {
    const openRegisters = await CashRegister.find({ user: userId, closed: false });
    for (const register of openRegisters) {
      register.closed = true;
      register.endDate = new Date();
      register.actualAmount = 0;
      register.difference = 0 - register.expectedAmount;
      register.notes = (register.notes || '') + '\n[CIERRE FORZOSO]: El sistema cerró esta caja automáticamente porque el usuario fue suspendido (o su sucursal fue inhabilitada). El conteo físico se forzó a $0.00.';
      await register.save();
    }
  } catch (error) {
    console.error(`Error forzando cierre de caja para el usuario ${userId}:`, error);
  }
};

export const forceCloseBranchCashRegisters = async (branchId: string | any) => {
  try {
    const openRegisters = await CashRegister.find({ branch: branchId, closed: false });
    for (const register of openRegisters) {
      register.closed = true;
      register.endDate = new Date();
      register.actualAmount = 0;
      register.difference = 0 - register.expectedAmount;
      register.notes = (register.notes || '') + '\n[CIERRE FORZOSO]: El sistema cerró esta caja automáticamente porque la sucursal fue suspendida por downgrade. El conteo físico se forzó a $0.00.';
      await register.save();
    }
  } catch (error) {
    console.error(`Error forzando cierre de caja para sucursal ${branchId}:`, error);
  }
};

// Registrar un gasto de caja
export const addExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // ID del CashRegister (Turno)
    const { amount, reason, type = 'expense', depositReference = '' } = req.body;

    const cashRegister = await CashRegister.findById(id);
    if (!cashRegister || cashRegister.closed) {
      return res.status(404).json({ message: 'Turno activo no encontrado' });
    }

    if (amount > cashRegister.expectedAmount) {
      return res.status(400).json({ 
        message: `No hay suficiente efectivo disponible en caja para realizar este retiro. Efectivo disponible: $${cashRegister.expectedAmount.toFixed(2)}` 
      });
    }

    cashRegister.expenses.push({
      amount,
      reason,
      type,
      timestamp: new Date(),
      depositReference,
      auditStatus: type === 'withdrawal' ? 'pending' : 'verified'
    });

    // Restar del dinero esperado en caja
    cashRegister.expectedAmount -= amount;

    await cashRegister.save();
    res.status(200).json({ ok: true, cashRegister });
  } catch (error) {
    res.status(500).json({ message: 'Error adding expense', error });
  }
};

// Registrar huella de Corte X
export const registerCorteXLog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user, expectedAmount } = req.body;

    const cashRegister = await CashRegister.findById(id);
    if (!cashRegister || cashRegister.closed) {
      return res.status(404).json({ message: 'Turno activo no encontrado o ya cerrado' });
    }

    cashRegister.cortesX.push({
      timestamp: new Date(),
      generatedBy: user,
      expectedAmount: expectedAmount
    });

    await cashRegister.save();
    res.status(200).json({ ok: true, message: 'Huella de Corte X registrada correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error registering Corte X log', error });
  }
};

// Verificar/conciliar depósito por supervisor
export const verifyExpenseDeposit = async (req: Request, res: Response) => {
  try {
    const { id, expenseId } = req.params;
    const { auditStatus } = req.body; // 'verified' | 'rejected'
    const reqWithUid = req as any;
    const supervisorId = reqWithUid.uid;

    const cashRegister = await CashRegister.findById(id);
    if (!cashRegister) {
      return res.status(404).json({ message: 'Turno no encontrado' });
    }

    const expense = (cashRegister.expenses as any).id(expenseId);
    if (!expense) {
      return res.status(404).json({ message: 'Retiro no encontrado en este turno' });
    }

    expense.auditStatus = auditStatus;
    expense.auditedBy = supervisorId;
    expense.auditedAt = new Date();

    await cashRegister.save();
    res.status(200).json({ ok: true, message: `Estatus de depósito actualizado a ${auditStatus}`, cashRegister });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying deposit', error });
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

export const getUserCashRegistersHistory = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { date, page = 1, limit = 10 } = req.query;

    const query: any = { user: userId };

    if (date) {
      const startOfDay = moment.utc(date as string).startOf('day').toDate();
      const endOfDay = moment.utc(date as string).endOf('day').toDate();
      query.startDate = { $gte: startOfDay, $lte: endOfDay };
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const cashRegisters = await CashRegister.find(query)
      .populate('user', 'name username email img')
      .populate('physicalRegister', 'name description')
      .populate('branch', 'name')
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
    res.status(500).json({ message: 'Error fetching user cash registers history', error });
  }
};
