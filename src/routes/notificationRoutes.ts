import { Router } from 'express';
import { verifyToken } from '../middleware/jwtMiddleware';
import { getMyNotifications, markAsRead, markAllAsRead } from '../controllers/notificationController';

const router = Router();

// Todas las rutas requieren autenticación con Token
router.get('/', verifyToken, getMyNotifications);
router.put('/read-all', verifyToken, markAllAsRead);
router.put('/:id/read', verifyToken, markAsRead);

export default router;
