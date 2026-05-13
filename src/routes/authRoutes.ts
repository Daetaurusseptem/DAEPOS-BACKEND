import { Router } from 'express';
import { login, renewToken } from '../controllers/authController';
import { verifyToken } from '../middleware/jwtMiddleware';

const router = Router();

router.post('/', login);
router.get('/renew', [verifyToken], renewToken)




export default router;
