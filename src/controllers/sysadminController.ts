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
import SubscriptionPlan from '../models-mongoose/SubscriptionPlan';
import GlobalSettings from '../models-mongoose/GlobalSettings';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_DEV_KEY!, { apiVersion: '2023-10-16' });

// Caché simple en memoria para GMV
let cachedGMV: number | null = null;
let lastGMVCacheTime: number = 0;
const GMV_CACHE_TTL = 5 * 60 * 1000; // 5 minutos en milisegundos

// 1. Obtener métricas globales para la Torre de Control
export const getGlobalMetrics = async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    let gmv = 0;

    // Usar caché si está disponible y vigente
    if (cachedGMV !== null && (now - lastGMVCacheTime) < GMV_CACHE_TTL) {
      gmv = cachedGMV;
    } else {
      // GMV Global (Volumen transaccional total) - Solo calcular si expiró caché
      const gmvAggregate = await Sale.aggregate([
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]);
      gmv = gmvAggregate[0]?.total || 0;
      cachedGMV = gmv;
      lastGMVCacheTime = now;
    }

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

export const seedPlans = async (req: Request, res: Response) => {
  try {
    const plans = [
      {
        name: 'Plan Básico',
        stripeProductId: 'prod_basic_123', // El Sysadmin debe actualizarlo con el ID real de Stripe
        maxBranches: 1,
        maxUsers: 3,
        maxActiveRegisters: 1,
        features: ['basic_reports'],
        isActive: true
      },
      {
        name: 'Plan Pro',
        stripeProductId: 'prod_pro_456',
        maxBranches: 3,
        maxUsers: 10,
        maxActiveRegisters: 3,
        features: ['basic_reports', 'advanced_reports', 'kds', 'inventory_transfers'],
        isActive: true
      },
      {
        name: 'Plan Enterprise',
        stripeProductId: 'prod_enterprise_789',
        maxBranches: -1, // Ilimitado
        maxUsers: -1,
        maxActiveRegisters: -1,
        features: ['basic_reports', 'advanced_reports', 'kds', 'inventory_transfers', 'api_access'],
        isActive: true
      }
    ];

    for (const plan of plans) {
      await SubscriptionPlan.findOneAndUpdate(
        { name: plan.name },
        plan,
        { upsert: true, new: true }
      );
    }

    res.status(200).json({ ok: true, msg: 'Planes inicializados con éxito' });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al inicializar planes', error });
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
    name,
    planId
  } = req.body;

  // Usar transacciones solo en producciÃ³n (requiere MongoDB Replica Set)
  const isProd = process.env.NODE_ENV === 'production';
  const session = isProd ? await mongoose.startSession() : null;
  if (session) session.startTransaction();

  try {
    // Validar si el usuario ya existe
    const existingUser = session ? await User.findOne({ username }).session(session) : await User.findOne({ username });
    if (existingUser) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(409).json({ ok: false, msg: 'El nombre de usuario ya estÃ¡ registrado' });
    }

    // Pre-generar el ID del administrador para romper la dependencia circular
    const adminId = new mongoose.Types.ObjectId();

    let planType = 'Gratuito';
    let subStatus = 'inactive';
    let billingType = 'stripe';
    if (planId) {
      const plan = await SubscriptionPlan.findById(planId);
      if (plan) {
        planType = plan.name;
        billingType = plan.billingType;
        if (billingType === 'manual') {
          subStatus = 'manual'; // Manual plans are active upon creation
        } else {
          subStatus = 'inactive'; // Stripe plans wait for card input
        }
      }
    }

    // 1. Crear Empresa
    const newCompany = new Company({
      name: companyName,
      address: companyAddress,
      tel: companyTel,
      email: companyEmail,
      SubscriptionHistory: [],
      adminId: adminId, // Asignar el ID pre-generado
      planId: planId || undefined,
      planType: planType,
      billingType: billingType,
      subscriptionStatus: subStatus
    });
    const savedCompany = await newCompany.save(session ? { session } : undefined);

    // 2. Crear Sucursal Inicial
    const newBranch = new Branch({
      name: branchName || 'Sucursal Principal',
      address: branchAddress || companyAddress,
      tel: branchTel || companyTel,
      email: companyEmail,
      company: savedCompany._id,
      saleType: saleType || 'retail'
    });
    const savedBranch = await newBranch.save(session ? { session } : undefined);

    // 3. Crear DueÃ±o de Empresa (Company Admin)
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      _id: adminId, // Usar el ID pre-generado
      name,
      username,
      email,
      password: hashedPassword,
      role: 'companyAdmin',
      companyId: savedCompany._id,
      branch: savedBranch._id, // Asociar tambiÃ©n a la primera sucursal para rapidez
      img: 'no-image',
      permissions: ['inventory_management', 'sales_reports', 'customer_management']
    });
    const savedUser = await newUser.save(session ? { session } : undefined);

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    res.status(201).json({
      ok: true,
      msg: 'Onboarding express completado con Ã©xito',
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
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    res.status(500).json({ ok: false, msg: `Error al realizar onboarding express: ${error}` });
  }
};

// 3. Generar token de impersonaciÃ³n (Asistencia al Cliente)
export const impersonateCompany = async (req: Request, res: Response) => {
  const { companyId } = req.params;

  try {
    // Buscar el primer Administrador de esa empresa para impersonarlo
    const targetUser = await User.findOne({ companyId, role: 'companyAdmin' });
    if (!targetUser) {
      return res.status(404).json({
        ok: false,
        msg: 'No se encontrÃ³ un administrador para impersonar en esta empresa'
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
    res.status(500).json({ ok: false, msg: 'Error al generar token de impersonaciÃ³n', error });
  }
};

// 4. Listar y depurar errores del sistema
export const getSystemErrors = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, companyId, status, method, startDate, endDate } = req.query;
    
    const query: any = {};
    
    if (companyId && companyId !== 'null' && companyId !== '') query.companyId = companyId;
    if (status && status !== 'null' && status !== '') query.status = parseInt(status as string, 10);
    if (method && method !== 'null' && method !== '') query.method = method;
    
    if ((startDate && startDate !== 'null' && startDate !== '') || (endDate && endDate !== 'null' && endDate !== '')) {
      query.timestamp = {};
      if (startDate && startDate !== 'null' && startDate !== '') query.timestamp.$gte = new Date(startDate as string);
      if (endDate && endDate !== 'null' && endDate !== '') query.timestamp.$lte = new Date(endDate as string);
    }

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [errors, total] = await Promise.all([
      SystemError.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('companyId', 'name'),
      SystemError.countDocuments(query)
    ]);

    res.status(200).json({
      ok: true,
      errors,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al obtener los errores de sistema', error });
  }
};

// 10. Búsqueda y KPIs de Suscripciones (SysAdmin SaaS Override)
export const searchCompanySubscriptions = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status, planId, query: textQuery } = req.query;
    
    const query: any = {};
    if (status && status !== 'null' && status !== '') query.subscriptionStatus = status;
    if (planId && planId !== 'null' && planId !== '') query.planId = planId;
    if (textQuery && textQuery !== 'null' && textQuery !== '') {
      query.name = { $regex: textQuery, $options: 'i' };
    }

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [companies, total, allCompanies] = await Promise.all([
      Company.find(query)
        .populate('planId', 'name price')
        .skip(skip)
        .limit(limitNum)
        .sort({ createdAt: -1 }),
      Company.countDocuments(query),
      Company.find({}, 'subscriptionStatus planId isActive').populate('planId', 'price')
    ]);

    // Calcular KPIs
    let active = 0;
    let trialing = 0;
    let pastDue = 0;
    let canceled = 0;
    let mrr = 0;

    allCompanies.forEach(c => {
      if (!c.isActive || c.subscriptionStatus === 'canceled') canceled++;
      else if (c.subscriptionStatus === 'active' || c.subscriptionStatus === 'manual') active++;
      else if (c.subscriptionStatus === 'trialing') trialing++;
      else if (c.subscriptionStatus === 'past_due' || c.subscriptionStatus === 'unpaid') pastDue++;

      // Estimate MRR (if active or manual, add plan price)
      if ((c.subscriptionStatus === 'active' || c.subscriptionStatus === 'manual') && c.planId) {
        const plan: any = c.planId;
        if (plan && plan.price) mrr += plan.price;
      }
    });

    res.status(200).json({
      ok: true,
      companies,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      kpis: {
        active,
        trialing,
        pastDue,
        canceled,
        mrr
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al buscar suscripciones', error });
  }
};

// 11. Gestión B2B (Control Manual / SaaS Override)
export const overrideSubscription = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { status, currentPeriodEnd, manualOverride } = req.body;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ ok: false, msg: 'Empresa no encontrada' });
    }

    const isTurningOn = manualOverride === true && !company.manualOverride;
    const isTurningOff = manualOverride === false && company.manualOverride;

    if (isTurningOn) {
      company.previousSubscriptionState = {
        status: company.subscriptionStatus,
        currentPeriodEnd: company.currentPeriodEnd || new Date()
      };
      
      if (status) company.subscriptionStatus = status;
      if (currentPeriodEnd) company.currentPeriodEnd = new Date(currentPeriodEnd);
      company.manualOverride = true;
    } 
    else if (isTurningOff) {
      company.manualOverride = false;
      
      // 1. Restaurar de memoria
      if (company.previousSubscriptionState && company.previousSubscriptionState.status) {
        company.subscriptionStatus = company.previousSubscriptionState.status as any;
        if (company.previousSubscriptionState.currentPeriodEnd) {
          company.currentPeriodEnd = company.previousSubscriptionState.currentPeriodEnd;
        }
      }
      
      // 2. Fetch from Stripe para asegurar la verdad absoluta
      if (company.stripeSubscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(company.stripeSubscriptionId);
          const mapStatus = (s: string) => {
            if (s === 'active' || s === 'past_due' || s === 'canceled' || s === 'unpaid' || s === 'trialing') return s;
            return 'canceled';
          };
          company.subscriptionStatus = mapStatus(sub.status) as any;
          company.currentPeriodEnd = new Date(sub.current_period_end * 1000);
        } catch (err) {
          console.error('Error fetching subscription truth from stripe during fallback', err);
        }
      }
      
      company.previousSubscriptionState = undefined;
    } 
    else {
      // Simplemente se están actualizando propiedades sin cambiar el estado del switch
      if (status) company.subscriptionStatus = status;
      if (currentPeriodEnd) company.currentPeriodEnd = new Date(currentPeriodEnd);
      if (typeof manualOverride === 'boolean') company.manualOverride = manualOverride;
    }

    const updated = await company.save();
    
    res.status(200).json({ ok: true, company: updated, msg: 'Gestión B2B actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al actualizar gestión B2B', error });
  }
};

// 12. Detalles reales de suscripción con Stripe
export const getSubscriptionDetails = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    
    const company = await Company.findById(companyId).populate('planId', 'name price');
    if (!company) {
      return res.status(404).json({ ok: false, msg: 'Empresa no encontrada' });
    }

    let stripeSubscription = null;
    let stripeInvoices: any[] = [];
    let nextPayment = null;
    let nextPaymentAmount = null;
    let stripeStatus = company.billingType === 'manual' ? 'manual_b2b' : 'no_stripe_id';
    let cancelAtPeriodEnd = false;

    if (company.billingType === 'stripe' && company.stripeCustomerId) {
      try {
        if (!company.stripeCustomerId.includes('_123')) {
          const invoicesResponse = await stripe.invoices.list({
            customer: company.stripeCustomerId,
            limit: 3
          });
          stripeInvoices = invoicesResponse.data.map((inv: any) => ({
            id: inv.id,
            amount_paid: inv.amount_paid,
            amount_due: inv.amount_due,
            status: inv.status,
            invoice_pdf: inv.invoice_pdf,
            created: inv.created
          }));
        }
      } catch (err: any) {
        console.warn('Warning: No se pudieron obtener facturas de stripe', err.message);
      }

      if (company.stripeSubscriptionId && !company.stripeSubscriptionId.includes('_123')) {
        try {
          const sub = await stripe.subscriptions.retrieve(company.stripeSubscriptionId);
          stripeSubscription = sub;
          stripeStatus = sub.status;
          cancelAtPeriodEnd = sub.cancel_at_period_end;
          nextPayment = sub.current_period_end; // unix timestamp

          const upcoming = await stripe.invoices.retrieveUpcoming({
            customer: company.stripeCustomerId,
            subscription: company.stripeSubscriptionId
          });
          if (upcoming) {
            nextPaymentAmount = upcoming.amount_due;
          }
        } catch (err: any) {
          console.warn('Warning: No se pudo obtener la suscripción de stripe', err.message);
          stripeStatus = 'error_fetching';
        }
      } else {
        stripeStatus = 'no_subscription';
      }
    }

    res.status(200).json({
      ok: true,
      company: {
        _id: company._id,
        name: company.name,
        email: company.email,
        billingType: company.billingType,
        subscriptionStatus: company.subscriptionStatus,
        isActive: company.isActive,
        planId: company.planId,
        manualOverride: company.manualOverride,
        currentPeriodEnd: company.currentPeriodEnd
      },
      stripeData: {
        stripeStatus,
        cancelAtPeriodEnd,
        nextPayment,
        nextPaymentAmount,
        invoices: stripeInvoices
      }
    });

  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al obtener el detalle de la suscripción' });
  }
};

// =========================================================
// AJUSTES GLOBALES DE PLATAFORMA
// =========================================================
export const getGlobalSettings = async (req: Request, res: Response) => {
  try {
    let settings = await GlobalSettings.findOne();
    if (!settings) {
      settings = await GlobalSettings.create({});
    }
    res.json({ ok: true, settings });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al obtener settings globales' });
  }
};

export const updateGlobalSettings = async (req: Request, res: Response) => {
  try {
    let settings = await GlobalSettings.findOne();
    if (!settings) {
      settings = new GlobalSettings(req.body);
    } else {
      settings.bankInstructions = req.body.bankInstructions || settings.bankInstructions;
      settings.contactEmail = req.body.contactEmail || settings.contactEmail;
      settings.updatedAt = new Date();
    }
    await settings.save();
    res.json({ ok: true, settings });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al actualizar settings globales' });
  }
};

// 5. TelemetrÃ­a SaaS de Empresa EspecÃ­fica
export const getCompanyTelemetry = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;

    // GMV de la empresa
    const gmvAggregate = await Sale.aggregate([
      { $match: { company: new mongoose.Types.ObjectId(companyId) } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const gmv = gmvAggregate[0]?.total || 0;

    // Sucursales
    const branchesCount = await Branch.countDocuments({ company: companyId });

    // Usuarios
    const usersCount = await User.countDocuments({ companyId: companyId });

    // Cajas Abiertas
    const openRegistersCount = await CashRegister.countDocuments({ company: companyId, closed: false });

    // Resumen de la empresa
    const company = await Company.findById(companyId);

    res.status(200).json({
      ok: true,
      telemetry: {
        gmv,
        branchesCount,
        usersCount,
        openRegistersCount,
        isActive: company?.isActive !== false,
        status: company?.isActive ? 'active' : 'inactive'
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al obtener telemetrÃ­a de la empresa', error });
  }
};

import { enforceDowngradeLimits } from '../helpers/enforceDowngradeLimits';

// 6. Actualizar Suscripción Manual (SysAdmin Override) y Asignar Tier (Snapshot)
export const updateCompanySubscriptionManual = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { subscriptionStatus, currentPeriodEnd, manualOverride, planType, planId, customLimitsOverrides, snapshotExpirationDate } = req.body;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ ok: false, msg: 'Empresa no encontrada' });
    }

    if (subscriptionStatus !== undefined) company.subscriptionStatus = subscriptionStatus;
    if (currentPeriodEnd !== undefined) {
      if (!currentPeriodEnd) {
        company.currentPeriodEnd = undefined as any;
      } else {
        company.currentPeriodEnd = new Date(currentPeriodEnd);
      }
    }
    if (manualOverride !== undefined) company.manualOverride = manualOverride;
    if (planType !== undefined) company.planType = planType;
    if (customLimitsOverrides !== undefined) company.customLimitsOverrides = customLimitsOverrides;
    
    if (snapshotExpirationDate !== undefined) {
      company.snapshotExpirationDate = snapshotExpirationDate ? new Date(snapshotExpirationDate) : undefined;
    }

    // Si el sysadmin asigna un nuevo Tier, tomamos el Snapshot
    if (planId) {
      company.planId = planId;
      const plan = await SubscriptionPlan.findById(planId);
      if (plan) {
        company.currentLimits = {
          maxBranches: plan.maxBranches,
          maxUsers: plan.maxUsers,
          maxActiveRegisters: plan.maxActiveRegisters,
          features: plan.features
        };
      }
    }

    await company.save();

    // Aplicar lógica de Downgrade por si el nuevo plan/snapshot es menor a los recursos actuales
    await enforceDowngradeLimits(companyId);

    res.status(200).json({
      ok: true,
      msg: 'Suscripción actualizada exitosamente',
      company
    });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al actualizar suscripción manualmente', error });
  }
};

// 7. CRUD de Subscription Plans
export const getPlans = async (req: Request, res: Response) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ createdAt: -1 });
    res.status(200).json({ ok: true, plans });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al obtener planes', error });
  }
};

export const createPlan = async (req: Request, res: Response) => {
  try {
    const newPlan = new SubscriptionPlan(req.body);
    const savedPlan = await newPlan.save();
    res.status(201).json({ ok: true, msg: 'Plan creado', plan: savedPlan });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al crear plan', error });
  }
};

export const updatePlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updatedPlan = await SubscriptionPlan.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedPlan) {
      return res.status(404).json({ ok: false, msg: 'Plan no encontrado' });
    }
    res.status(200).json({ ok: true, msg: 'Plan actualizado', plan: updatedPlan });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al actualizar plan', error });
  }
};

export const deletePlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deletedPlan = await SubscriptionPlan.findByIdAndDelete(id);
    if (!deletedPlan) {
      return res.status(404).json({ ok: false, msg: 'Plan no encontrado' });
    }
    res.status(200).json({ ok: true, msg: 'Plan eliminado' });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al eliminar plan', error });
  }
};

// 8. Análisis Forense de una Venta (Sysadmin Override)
export const getSaleForensics = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const sale = await Sale.findById(id)
      .populate('company', 'name email tel')
      .populate('branch', 'name address')
      .populate('user', 'name username role')
      .populate('cashRegister', 'registerName isPhysical')
      .populate('customer', 'name email phone')
      .populate('appliedPromotion', 'name discountPercentage')
      .populate({
        path: 'productsSold.product',
        select: 'name category price cost'
      });

    if (!sale) {
      return res.status(404).json({ ok: false, msg: 'Transacción no encontrada' });
    }

    res.status(200).json({ ok: true, sale });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al obtener análisis forense de la venta', error });
  }
};

// 9. Búsqueda Avanzada de Transacciones (Auditoría Sysadmin)
export const searchGlobalTransactions = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, companyId, branchId, startDate, endDate, paymentMethod } = req.query;
    
    const query: any = {};
    
    if (companyId && companyId !== 'null' && companyId !== '') query.company = companyId;
    if (branchId && branchId !== 'null' && branchId !== '') query.branch = branchId;
    if (paymentMethod && paymentMethod !== 'null' && paymentMethod !== '') query.paymentMethod = paymentMethod;
    
    if ((startDate && startDate !== 'null') || (endDate && endDate !== 'null')) {
      query.date = {};
      if (startDate && startDate !== 'null') query.date.$gte = new Date(startDate as string);
      if (endDate && endDate !== 'null') query.date.$lte = new Date(endDate as string);
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;
    
    const [transactions, total] = await Promise.all([
      Sale.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('company', 'name')
        .populate('branch', 'name')
        .populate('user', 'name role'),
      Sale.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      ok: true,
      transactions,
      total,
      page: pageNum,
      totalPages
    });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al buscar transacciones globales', error });
  }
};

