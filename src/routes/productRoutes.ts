import express from 'express';
import {
  createProduct,
  deleteProduct,
  getAllCompanyProducts,
  getAllProducts,
  getProductById,
  searchProducts,
  updateProduct,
  getAllProductsOfCompanyForSysadmin,
  bulkUploadProducts,
  getPendingVerificationProducts,
  formalizeProduct,
  mergeProduct,
} from '../controllers/productController';

import {
  validarSysAdmin,
  verifyToken,
  validarEmpresaUsuario,
  validarAdminOrSysAdmin,
} from '../middleware/jwtMiddleware';

const router = express.Router();

router.get('/audit/pending/:companyId', verifyToken, validarEmpresaUsuario, validarAdminOrSysAdmin, getPendingVerificationProducts);
router.post('/audit/formalize/:id', verifyToken, validarAdminOrSysAdmin, formalizeProduct);
router.post('/audit/merge/:sourceId', verifyToken, validarAdminOrSysAdmin, mergeProduct);

router.post('/bulk/:companyId', verifyToken, validarEmpresaUsuario, validarAdminOrSysAdmin, bulkUploadProducts);
router.post('/:companyId', verifyToken, validarEmpresaUsuario, validarAdminOrSysAdmin, createProduct);
router.get('/', verifyToken, validarSysAdmin, getAllProducts);
router.get('/company/:companyId', verifyToken, validarEmpresaUsuario, getAllCompanyProducts);
router.get('/company/sysadmin/:companyId', [verifyToken, validarSysAdmin], getAllProductsOfCompanyForSysadmin);
router.get('/:id', verifyToken, getProductById);
router.put('/:id', verifyToken, validarAdminOrSysAdmin, updateProduct);
router.delete('/:id', verifyToken, validarAdminOrSysAdmin, deleteProduct);
router.get('/search/:companyId', verifyToken, validarEmpresaUsuario, searchProducts);

export default router;
