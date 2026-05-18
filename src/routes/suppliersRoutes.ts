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


const router = express.Router();

// Ruta para crear un nuevo proveedor
router.post('/:companyId', createSupplier);

// Ruta para obtener todos los proveedores
router.get('/', getAllSuppliers);

// Ruta para obtener proveedores de una Company específica
router.get('/company/:companyId', getCompanySuppliers);

// Endpoints de Reabastecimientos Programados
router.post('/restock/schedule', createRestockSchedule);
router.get('/restock/company/:companyId', getCompanyRestockSchedules);
router.put('/restock/:id', updateRestockStatus);
router.delete('/restock/:id', deleteRestockSchedule);

// Ruta para obtener un proveedor por su ID (Dejar al final para evitar colisiones)
router.get('/:id', getSupplierById);

// Ruta para actualizar un proveedor
router.put('/:id', updateSupplier);

// Ruta para eliminar un proveedor
router.delete('/:id', deleteSupplier);


export default router;
