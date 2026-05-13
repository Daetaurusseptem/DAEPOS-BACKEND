import { Router } from 'express';

import { validarAdminCompany, validarUserCompany, verifyToken } from '../middleware/jwtMiddleware';
import { createCategory, deleteCategory,getAllCategories,getAllCategoriesCompany,getCategoriesCompaniesPagination,getCategoryById, updateCategory } from '../controllers/categoryController';

const router = Router();

// Ruta para obtener todos los categorias (disponible para administradores)
router.get('/', verifyToken, getAllCategories);
// Ruta para obtener todos los categorias (disponible para administradores)
router.get('/company/pages/:companyId', verifyToken,validarAdminCompany, getCategoriesCompaniesPagination);

router.get('/company/:companyId', verifyToken, getAllCategoriesCompany);

// Ruta para obtener un categoria por su ID (disponible para usuarios y administradores)
router.get('/:id', getCategoryById);

// Ruta para crear un nuevo categoria (disponible para administradores)
router.post('/:companyId', verifyToken, createCategory);

// Ruta para actualizar un categoria por su ID (disponible para administradores)
router.put('/:id', verifyToken, updateCategory);

// Ruta para eliminar un categoria por su ID (disponible para administradores)
router.delete('/:id', verifyToken, deleteCategory);

export default router;
 
