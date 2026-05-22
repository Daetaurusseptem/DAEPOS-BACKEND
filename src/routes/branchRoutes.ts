import express from 'express';
import { createBranch, getBranchesByCompany, getBranchById, updateBranch, deleteBranch } from '../controllers/branchController';
import { verifyToken, validarAdminOrSysAdmin, validarEmpresaUsuario } from '../middleware/jwtMiddleware';

const router = express.Router();

router.post('/', verifyToken, validarAdminOrSysAdmin, createBranch);
router.get('/company/:companyId', verifyToken, validarEmpresaUsuario, getBranchesByCompany);
router.get('/:id', verifyToken, getBranchById);
router.put('/:id', verifyToken, validarAdminOrSysAdmin, updateBranch);
router.delete('/:id', verifyToken, validarAdminOrSysAdmin, deleteBranch);

export default router;
