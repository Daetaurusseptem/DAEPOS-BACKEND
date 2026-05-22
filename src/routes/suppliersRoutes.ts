// src/routes/supplierRoutes.ts

import express from 'express';
import { 
    createSupplier, 
    deleteSupplier, 
    getAllSuppliers, 
    getCompanySuppliers, 
    getSupplierById, 
    updateSupplier,
    createRestockSchedule,
    getCompanyRestockSchedules,
    updateRestockStatus,
    deleteRestockSchedule
} from '../controllers/suppliersController';
import { verifyToken, validarEmpresaUsuario, validarAdminOrSysAdmin, validarSysAdmin } from '../middleware/jwtMiddleware';

const router = express.Router();

// Ruta para crear un nuevo proveedor
router.post('/:companyId', verifyToken, validarEmpresaUsuario, validarAdminOrSysAdmin, createSupplier);

// Ruta para obtener todos los proveedores (Solo SysAdmin corporativo global)
router.get('/', verifyToken, validarSysAdmin, getAllSuppliers);

// Ruta para obtener proveedores de una Company específica
router.get('/company/:companyId', verifyToken, validarEmpresaUsuario, getCompanySuppliers);

// Endpoints de Reabastecimientos Programados
router.post('/restock/schedule', verifyToken, createRestockSchedule);
router.get('/restock/company/:companyId', verifyToken, validarEmpresaUsuario, getCompanyRestockSchedules);
router.put('/restock/:id', verifyToken, updateRestockStatus);
router.delete('/restock/:id', verifyToken, deleteRestockSchedule);

// Ruta para obtener un proveedor por su ID (Dejar al final para evitar colisiones)
router.get('/:id', verifyToken, getSupplierById);

// Ruta para actualizar un proveedor
router.put('/:id', verifyToken, validarAdminOrSysAdmin, updateSupplier);

// Ruta para eliminar un proveedor
router.delete('/:id', verifyToken, validarAdminOrSysAdmin, deleteSupplier);

export default router;
