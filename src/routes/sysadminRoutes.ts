import { Router } from 'express';
import { verifyToken, validarSysAdmin } from '../middleware/jwtMiddleware';
import {
  getGlobalMetrics,
  onboardCompanyExpress,
  impersonateCompany,
  getSystemErrors
} from '../controllers/sysadminController';

const router = Router();

router.get('/metrics', verifyToken, validarSysAdmin, getGlobalMetrics);
router.post('/onboard', verifyToken, validarSysAdmin, onboardCompanyExpress);
router.post('/impersonate/:companyId', verifyToken, validarSysAdmin, impersonateCompany);
router.get('/errors', verifyToken, validarSysAdmin, getSystemErrors);

export default router;
