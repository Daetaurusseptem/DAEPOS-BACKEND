import { Router } from 'express';
import { subirArchivo } from '../controllers/fileUploadController';

const router = Router();

router.put('/:tipo/:id', subirArchivo);

export default router;
