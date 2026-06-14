import { Router } from 'express';
import { verifyToken } from '../middleware/jwtMiddleware';
import {
  createCustomer,
  getAllCustomers,
  searchCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customerController';

const router = Router();

// Todas las rutas requieren token JWT verificado
router.post('/company/:companyId', verifyToken, createCustomer);
router.get('/company/:companyId', verifyToken, getAllCustomers);
router.get('/company/:companyId/search', verifyToken, searchCustomers);
router.get('/:id', verifyToken, getCustomerById);
router.put('/:id', verifyToken, updateCustomer);
router.delete('/:id', verifyToken, deleteCustomer);

export default router;
