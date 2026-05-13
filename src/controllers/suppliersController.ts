// src/controllers/supplierController.ts

import { Request, Response } from 'express';
import Supplier from '../models-mongoose/Supplier';
import Company from '../models-mongoose/Company';


// Crear un nuevo proveedor
export const createSupplier = async (req: Request, res: Response) => {
    try {
        const { companyId } = req.params;
        const { ...supplierData } = req.body;

        // Verificar si la Company existe
        const company = await Company.findById(companyId);

        if (!company) {
            return res.status(404).json({ message: 'Company no encontrada' });
        }

        const newSupplier = new Supplier({
            ...supplierData,
            company: companyId
        });
 
        const savedSupplier = await newSupplier.save();
        return res.status(201).json(savedSupplier);
    } catch (error) {
        return res.status(400).json({ message: error });
    }
};
// Obtener todos los proveedores
export const getAllSuppliers = async (req: Request, res: Response) => {
    try {
        const suppliers = await Supplier.find();
        res.status(200).json(suppliers);
    } catch (error) {
        res.status(500).json({ message: error });
    }
};

// Obtener un proveedor por ID
export const getSupplierById = async (req: Request, res: Response) => {
    try {
        const supplier = await Supplier.findById(req.params.id);
        if (!supplier) return res.status(404).json({ message: 'Proveedor no encontrado' });
        res.status(200).json({
            ok:true,
            supplier});
    } catch (error) {
        res.status(500).json({ message: error });
    }
};
export const getCompanySuppliers = async (req: Request, res: Response) => {
    try {
        const companyId = req.params.companyId;

        // Verificar si la Company existe
        const company = await Company.findById(companyId); 
        if (!company) {
            return res.status(404).json({ message: 'Company no encontrada' }); 
        }

        const suppliers = await Supplier.find({ company: companyId });
        res.status(200).json({ok:true,suppliers});
    } catch (error) {
        res.status(500).json({ ok:false, error }); 
    }
};

// Actualizar un proveedor
export const updateSupplier = async (req: Request, res: Response) => {
    try {
        const updatedSupplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedSupplier) return res.status(404).json({ message: 'Proveedor no encontrado' });
        res.status(200).json(updatedSupplier);
    } catch (error) {
        res.status(400).json({ message: error });
    }
};

// Eliminar un proveedor
export const deleteSupplier = async (req: Request, res: Response) => {
    try {
        const deletedSupplier = await Supplier.findByIdAndDelete(req.params.id);
        if (!deletedSupplier) return res.status(404).json({ message: 'Proveedor no encontrado' });
        res.status(200).json({ message: 'Proveedor eliminado' });
    } catch (error) {
        res.status(500).json({ message: error });
    }
};

export default {
    createSupplier,
    getAllSuppliers,
    getSupplierById,
    updateSupplier,
    deleteSupplier
};
