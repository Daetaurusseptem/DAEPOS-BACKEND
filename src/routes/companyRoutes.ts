import { Router } from 'express';
import {
  createEmpresa,
  getAllEmpresas,
  getEmpresaById,
  updateEmpresa,
  deleteEmpresa,
  getCompaniesPages,
  getNumberCompanies,
} from '../controllers/companiesController'; // Asegúrate de ajustar la ruta al controlador
import { validarSysAdmin, verifyToken } from '../middleware/jwtMiddleware';

const router = Router();

router.get('/',verifyToken,validarSysAdmin, getCompaniesPages);
router.get('/number',verifyToken, validarSysAdmin, getNumberCompanies);
router.post('/',verifyToken,validarSysAdmin, createEmpresa);

router.get('/:id',verifyToken, getEmpresaById);
router.put('/:id', verifyToken,validarSysAdmin,updateEmpresa);
router.delete('/:id',verifyToken,validarSysAdmin, deleteEmpresa);

export default router;
