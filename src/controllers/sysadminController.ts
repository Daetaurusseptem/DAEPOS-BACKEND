import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import Company from '../models-mongoose/Company';
import Branch from '../models-mongoose/Branch';
import User from '../models-mongoose/User';
import Sale from '../models-mongoose/Sale';
import CashRegister from '../models-mongoose/CashRegister';
import SystemError from '../models-mongoose/SystemError';
import { generarJWT } from '../helpers/jwt-helper';

// 1. Obtener métricas globales para la Torre de Control
export const getGlobalMetrics = async (req: Request, res: Response) => {
  try {
    // GMV Global (Volumen transaccional total)
    const gmvAggregate = await Sale.aggregate([
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const gmv = gmvAggregate[0]?.total || 0;

    // Empresas activas
    const activeCompanies = await Company.countDocuments();

    // Errores del sistema activos
    const totalErrors = await SystemError.countDocuments();

    // Cajas abiertas actualmente (POS activos)
    const openRegistersCount = await CashRegister.countDocuments({ closed: false });

    // Live Feed: Últimas 10 ventas del sistema
    const liveFeed = await Sale.find()
      .sort({ date: -1 })
      .limit(10)
      .populate('company', 'name')
      .populate('user', 'name');

    res.status(200).json({
      ok: true,
      metrics: {
        gmv,
        activeCompanies,
        totalErrors,
        openRegisters: openRegistersCount
      },
      liveFeed
    });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al obtener métricas globales', error });
  }
};

// 2. Onboarding Express en un solo flujo transaccional
export const onboardCompanyExpress = async (req: Request, res: Response) => {
  const {
    companyName,
    companyAddress,
    companyTel,
    companyEmail,
    saleType,
    branchName,
    branchAddress,
    branchTel,
    username,
    email,
    password,
    name
  } = req.body;

  // Iniciar una sesión transaccional para garantizar consistencia atómica
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validar si el usuario ya existe
    const existingUser = await User.findOne({ username }).session(session);
    if (existingUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({ ok: false, msg: 'El nombre de usuario ya está registrado' });
    }

    // 1. Crear Empresa
    const newCompany = new Company({
      name: companyName,
      address: companyAddress,
      tel: companyTel,
      email: companyEmail,
      status: 'active',
      paymentMethod: 'cash',
      paymentReference: 'trial',
      SuscriptionsHistory: []
    });
    const savedCompany = await newCompany.save({ session });

    // 2. Crear Sucursal Inicial
    const newBranch = new Branch({
      name: branchName || 'Sucursal Principal',
      address: branchAddress || companyAddress,
      tel: branchTel || companyTel,
      email: companyEmail,
      company: savedCompany._id,
      saleType: saleType || 'retail'
    });
    const savedBranch = await newBranch.save({ session });

    // 3. Crear Dueño de Empresa (Company Admin)
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      username,
      email,
      password: hashedPassword,
      role: 'companyAdmin',
      companyId: savedCompany._id,
      branch: savedBranch._id, // Asociar también a la primera sucursal para rapidez
      img: 'no-image',
      permissions: ['inventory_management', 'sales_reports', 'customer_management']
    });
    const savedUser = await newUser.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      ok: true,
      msg: 'Onboarding express completado con éxito',
      company: savedCompany,
      branch: savedBranch,
      user: {
        _id: savedUser._id,
        name: savedUser.name,
        username: savedUser.username,
        email: savedUser.email,
        role: savedUser.role
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ ok: false, msg: `Error al realizar onboarding express: ${error}` });
  }
};

// 3. Generar token de impersonación (Asistencia al Cliente)
export const impersonateCompany = async (req: Request, res: Response) => {
  const { companyId } = req.params;

  try {
    // Buscar el primer Administrador de esa empresa para impersonarlo
    const targetUser = await User.findOne({ companyId, role: 'companyAdmin' });
    if (!targetUser) {
      return res.status(404).json({
        ok: false,
        msg: 'No se encontró un administrador para impersonar en esta empresa'
      });
    }

    // Generar el token temporal
    const token = await generarJWT(targetUser._id.toString());

    res.status(200).json({
      ok: true,
      msg: `Modo de soporte activado para: ${targetUser.name}`,
      token,
      user: {
        _id: targetUser._id,
        name: targetUser.name,
        username: targetUser.username,
        email: targetUser.email,
        role: targetUser.role,
        companyId: targetUser.companyId,
        branch: targetUser.branch
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al generar token de impersonación', error });
  }
};

// 4. Listar y depurar errores del sistema
export const getSystemErrors = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const errors = await SystemError.find()
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('companyId', 'name');

    const total = await SystemError.countDocuments();

    res.status(200).json({
      ok: true,
      errors,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al obtener los errores de sistema', error });
  }
};
