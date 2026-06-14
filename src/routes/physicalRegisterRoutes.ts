import express from 'express';
import {
  createPhysicalRegister,
  getPhysicalRegistersByCompany,
  updatePhysicalRegister,
  deletePhysicalRegister,
} from '../controllers/physicalRegisterController';
import { verifyToken } from '../middleware/jwtMiddleware';

const router = express.Router();

router.get('/company/:companyId', verifyToken, getPhysicalRegistersByCompany);
router.post('/', verifyToken, createPhysicalRegister);
router.put('/:id', verifyToken, updatePhysicalRegister);
router.delete('/:id', verifyToken, deletePhysicalRegister);

export default router;
