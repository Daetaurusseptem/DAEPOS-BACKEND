import { Router } from 'express';
import { login, renewToken, demoReset } from '../controllers/authController';
import { verifyToken } from '../middleware/jwtMiddleware';

const router = Router();

router.post('/', login);
router.get('/renew', [verifyToken], renewToken);
router.post('/demo-reset', demoReset);

export default router;
