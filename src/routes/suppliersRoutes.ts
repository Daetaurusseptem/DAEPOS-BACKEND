// src/routes/supplierRoutes.ts

import express from 'express';
import { createSupplier, deleteSupplier, getAllSuppliers, getCompanySuppliers, getSupplierById, updateSupplier } from '../controllers/suppliersController';


const router = express.Router();

// Ruta para crear un nuevo proveedor
router.post('/:companyId', createSupplier);

// Ruta para obtener todos los proveedores
router.get('/', getAllSuppliers);

// Ruta para obtener un proveedor por su ID
router.get('/:id', getSupplierById);

// Ruta para actualizar un proveedor
router.put('/:id', updateSupplier);

// Ruta para eliminar un proveedor
router.delete('/:id', deleteSupplier);

// Ruta para obtener proveedores de una Company específica
router.get('/company/:companyId', getCompanySuppliers);


export default router;
