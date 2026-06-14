import { Router } from 'express';
import { verifyToken } from '../middleware/jwtMiddleware';
import {
  createPromotion,
  getAllPromotions,
  validateDiscountCode,
  updatePromotion,
  deletePromotion,
} from '../controllers/promotionController';

const router = Router();

// Todas las rutas requieren token JWT verificado
router.post('/company/:companyId', verifyToken, createPromotion);
router.get('/company/:companyId', verifyToken, getAllPromotions);
router.get('/company/:companyId/validate/:code', verifyToken, validateDiscountCode);
router.put('/:id', verifyToken, updatePromotion);
router.delete('/:id', verifyToken, deletePromotion);

export default router;
