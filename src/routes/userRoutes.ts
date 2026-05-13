import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getAvailableAdmins,
  getAllNonAdminUsersOfCompany,
  isCompanyAdmin,
  getNumberUsers,
  getAllAdmins,
  getCompanyAdmin,
  getUserByIdSoloAdmin,
  getUnassignedAdmins,
  getAllUsersOfCompany,
} from '../controllers/userController';
import { validarAdmin, validarAdminCompany, validarAdminOrSysAdmin, validarSysAdmin, verifyToken } from '../middleware/jwtMiddleware';

const router = Router();

// Rutas estáticas
router.get('/', verifyToken, validarSysAdmin, getAllUsers);
router.get('/number', verifyToken, validarSysAdmin, getNumberUsers);
router.get('/admins/available', verifyToken, validarSysAdmin, getAvailableAdmins);
router.get('/company/admins/all', verifyToken, validarSysAdmin, getAllAdmins);
router.get('/company/admins/unassigned', verifyToken, validarSysAdmin, getUnassignedAdmins );
router.get('/company/admin/:adminId', verifyToken, validarAdminOrSysAdmin, getCompanyAdmin);

// Rutas dinámicas con parámetros específicos
router.get('/admins/:companyId/:adminId', verifyToken, validarSysAdmin, isCompanyAdmin);
router.get('/company/:adminId', [verifyToken, validarAdminOrSysAdmin], getAllNonAdminUsersOfCompany);
router.get('/company/sysadmin/:companyId', [verifyToken, validarAdminOrSysAdmin], getAllUsersOfCompany);

// Rutas dinámicas para acciones específicas de un usuario
router.get('/:id', verifyToken, validarSysAdmin, getUserById);
router.get('/company/solo/:id', verifyToken, validarAdmin,validarAdminCompany, getUserByIdSoloAdmin);
router.post('/', createUser);
router.put('/:id', verifyToken,[verifyToken, validarAdminCompany, validarAdminOrSysAdmin], updateUser);

// sysadmin
router.delete('/:id', verifyToken, validarSysAdmin, deleteUser);
// admin
router.delete('/admin/:companyId/:id', verifyToken, validarAdminCompany, deleteUser);

export default router;
 
