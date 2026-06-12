import { Router } from 'express';
import { createBranch, getBranchesByCompany, getBranchById, updateBranch, deleteBranch } from '../controllers/branchController';
import { verifyToken, validarAdminCompany } from '../middleware/jwtMiddleware';
import { checkBranchLimit } from '../middleware/enforceTierLimits';

const router = Router();

router.post('/', [verifyToken, validarAdminCompany, checkBranchLimit], createBranch);
router.get('/company/:companyId', [verifyToken, validarAdminCompany], getBranchesByCompany);
router.get('/:id', [verifyToken], getBranchById);
router.put('/:id', [verifyToken, validarAdminCompany], updateBranch);
router.delete('/:companyId/:id', [verifyToken, validarAdminCompany], deleteBranch);

export default router;
