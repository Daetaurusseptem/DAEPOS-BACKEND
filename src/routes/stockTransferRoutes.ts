import { Router } from 'express';
import { createTransfer, getTransfersByCompany } from '../controllers/stockTransferController';

const router = Router();

router.post('/', createTransfer);
router.get('/company/:companyId', getTransfersByCompany);

export default router;
