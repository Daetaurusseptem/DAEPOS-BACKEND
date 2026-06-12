import express from 'express';
import { 
  createPendingOrder, 
  getActivePendingOrders, 
  updatePendingOrderStatus, 
  payAndClosePendingOrder, 
  cancelPendingOrder,
  addItemsToPendingOrder
} from '../controllers/pendingOrderController';
import { verifyToken } from '../middleware/jwtMiddleware';

const router = express.Router();

router.post('/', verifyToken, createPendingOrder);
router.get('/', verifyToken, getActivePendingOrders);
router.put('/:id/status', verifyToken, updatePendingOrderStatus);
router.put('/:id/add-items', verifyToken, addItemsToPendingOrder);
router.post('/:id/pay', verifyToken, payAndClosePendingOrder);
router.delete('/:id', verifyToken, cancelPendingOrder);

export default router;
