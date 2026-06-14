import { Router } from 'express';
import { verifyToken, validarSysAdmin, validarRol } from '../middleware/jwtMiddleware';
import {
  obtenerProductos,
  obtenerPreciosDeProducto,
  createCheckoutSession,
  obtenerFacturasEmpresa,
  createCustomerPortalSession,
} from '../controllers/subscriptionsController';

const router = Router();

router.get('/', obtenerProductos);
router.get('/prices/:id', obtenerPreciosDeProducto);

router.post('/create-checkout-session', [verifyToken], createCheckoutSession);

router.post('/portal', [verifyToken, validarRol('companyAdmin', 'sysadmin')], createCustomerPortalSession);

router.get('/admin/invoices/:companyId', [verifyToken, validarSysAdmin], obtenerFacturasEmpresa);

export default router;
