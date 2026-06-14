import express from 'express';
import { createSale, getAllSales, getSaleById } from '../controllers/saleController';
import { validarAdmin, validarEmpresaUsuario, verifyToken } from '../middleware/jwtMiddleware';
import { getSalesByCashRegister } from '../controllers/cashRegisterController';

const router = express.Router();

router.post('/', verifyToken, createSale);
router.get('/', verifyToken, getAllSales);
router.get('/:id', [verifyToken], getSaleById);
router.get('/cash-register/:cashRegisterId', verifyToken, getSalesByCashRegister);
export default router;
