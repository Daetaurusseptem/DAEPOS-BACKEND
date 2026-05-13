import express from 'express';
import { getDailySales } from '../controllers/dailySaleController';
import { verifyToken } from '../middleware/jwtMiddleware';

const router = express.Router();

// Obtener todas las ventas del día
router.get('/daily-sales', verifyToken, getDailySales);

export default router;
