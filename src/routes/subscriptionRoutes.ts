import { Router } from 'express';

import { verifyToken } from '../middleware/jwtMiddleware';
import { obtenerProductos } from '../controllers/subscriptionsController';

const router = Router();

router.get('/', obtenerProductos);


export default router;
