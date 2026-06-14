import { Router } from 'express';
import {
  getGlobalMetrics,
  onboardCompanyExpress,
  impersonateCompany,
  getSystemErrors,
  getCompanyTelemetry,
  updateCompanySubscriptionManual,
  seedPlans,
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getSaleForensics,
  searchGlobalTransactions,
  searchCompanySubscriptions,
  overrideSubscription,
  getSubscriptionDetails,
  getGlobalSettings,
  updateGlobalSettings,
} from '../controllers/sysadminController';
import { verifyToken, validarSysAdmin } from '../middleware/jwtMiddleware';

const router = Router();

router.get('/metrics', verifyToken, validarSysAdmin, getGlobalMetrics);
router.post('/onboard', verifyToken, validarSysAdmin, onboardCompanyExpress);
router.post('/impersonate/:companyId', verifyToken, validarSysAdmin, impersonateCompany);
router.get('/errors', verifyToken, validarSysAdmin, getSystemErrors);
router.get('/telemetry/transactions', verifyToken, validarSysAdmin, searchGlobalTransactions);
router.get('/telemetry/:companyId', verifyToken, validarSysAdmin, getCompanyTelemetry);
router.get('/telemetry/sale/:id', verifyToken, validarSysAdmin, getSaleForensics);
router.put('/subscription/:companyId', verifyToken, validarSysAdmin, updateCompanySubscriptionManual);
router.post('/seed-plans', verifyToken, validarSysAdmin, seedPlans);

// Subscriptions Dashboard (SaaS Override)
router.get('/subscriptions', verifyToken, validarSysAdmin, searchCompanySubscriptions);
router.get('/subscriptions/:companyId/details', verifyToken, validarSysAdmin, getSubscriptionDetails);
router.put('/subscriptions/:companyId/override', verifyToken, validarSysAdmin, overrideSubscription);

// Planes de Suscripción (Tiers)
router.get('/plans', verifyToken, validarSysAdmin, getPlans);
router.post('/plans', verifyToken, validarSysAdmin, createPlan);
router.put('/plans/:id', verifyToken, validarSysAdmin, updatePlan);
router.delete('/plans/:id', verifyToken, validarSysAdmin, deletePlan);

// Ajustes Globales (Settings)
router.get('/settings', verifyToken, getGlobalSettings); // Abierto para usuarios autenticados (CEO) para ver datos bancarios
router.put('/settings', verifyToken, validarSysAdmin, updateGlobalSettings); // Solo sysadmin puede editarlos

export default router;
