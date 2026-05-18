import express from 'express';
import { createBranch, getBranchesByCompany, getBranchById, updateBranch, deleteBranch } from '../controllers/branchController';

const router = express.Router();

router.post('/', createBranch);
router.get('/company/:companyId', getBranchesByCompany);
router.get('/:id', getBranchById);
router.put('/:id', updateBranch);
router.delete('/:id', deleteBranch);

export default router;
