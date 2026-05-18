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
  bulkUploadProducts
} from '../controllers/productController';

import { validarSysAdmin, verifyToken } from '../middleware/jwtMiddleware'; // Asegúrate de importar los middlewares necesarios

const router = express.Router();

router.post('/bulk/:companyId', verifyToken, bulkUploadProducts);
router.post('/:companyId', verifyToken, createProduct);
router.get('/', getAllProducts);
router.get('/company/:id', getAllCompanyProducts);
router.get('/company/sysadmin/:companyId', [verifyToken, validarSysAdmin], getAllProductsOfCompanyForSysadmin);
router.get('/:id', getProductById);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.get('/search/:companyId', searchProducts);

export default router;
