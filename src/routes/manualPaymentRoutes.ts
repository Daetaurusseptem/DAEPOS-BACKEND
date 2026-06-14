import { Router } from 'express';
import { verifyToken, validarSysAdmin, validarAdminOrSysAdmin } from '../middleware/jwtMiddleware';
import {
  createManualPayment,
  getMyPayments,
  getAllPayments,
  approvePayment,
  rejectPayment,
} from '../controllers/manualPaymentController';

const router = Router();

// Rutas para CEO (Company Admin)
router.post('/', verifyToken, validarAdminOrSysAdmin, createManualPayment);
router.get('/my-payments', verifyToken, validarAdminOrSysAdmin, getMyPayments);

// Rutas para Sysadmin
router.get('/sysadmin/all', verifyToken, validarSysAdmin, getAllPayments);
router.put('/sysadmin/:id/approve', verifyToken, validarSysAdmin, approvePayment);
router.put('/sysadmin/:id/reject', verifyToken, validarSysAdmin, rejectPayment);

export default router;
