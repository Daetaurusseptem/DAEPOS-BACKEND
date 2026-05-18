// src/controllers/supplierController.ts

import { Request, Response } from 'express';
import Supplier from '../models-mongoose/Supplier';
import Company from '../models-mongoose/Company';
import SupplierRestock from '../models-mongoose/SupplierRestock';
import Notification from '../models-mongoose/Notification';


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

// Crear un reabastecimiento programado
export const createRestockSchedule = async (req: Request, res: Response) => {
    try {
        const restock = new SupplierRestock(req.body);
        await restock.save();

        // Generar Notificación Automática para la sucursal de destino
        try {
            const supplier = await Supplier.findById(restock.supplier);
            const supplierName = supplier ? supplier.name : 'Proveedor';
            
            const notif = new Notification({
                company: restock.company,
                targetBranch: restock.branch,
                title: 'Reabastecimiento Agendado',
                message: `Se ha programado una entrega de ${supplierName} para el ${new Date(restock.expectedDate).toLocaleDateString('es-MX')}.`,
                type: 'info',
                link: `/dashboard/admin/suppliers/details/${restock.supplier}`
            });
            await notif.save();
        } catch (notifErr) {
            console.error('Error creating restock notification:', notifErr);
        }

        return res.status(201).json({ ok: true, restock });
    } catch (error) {
        return res.status(400).json({ ok: false, message: error });
    }
};

// Obtener agenda de entregas para una compañía
export const getCompanyRestockSchedules = async (req: Request, res: Response) => {
    try {
        const { companyId } = req.params;
        const { status } = req.query;
        let query: any = { company: companyId };
        if (status) {
            query.status = status;
        }
        const restocks = await SupplierRestock.find(query)
            .populate('supplier')
            .populate('branch')
            .sort({ expectedDate: 1 });
        return res.status(200).json({ ok: true, restocks });
    } catch (error) {
        return res.status(500).json({ ok: false, message: error });
    }
};

// Actualizar estado del reabastecimiento con lógica de auto-recurrencia
export const updateRestockStatus = async (req: Request, res: Response) => {
    try {
        const { status, expectedDate, itemsSummary, notes } = req.body;
        const restock = await SupplierRestock.findById(req.params.id);
        if (!restock) return res.status(404).json({ ok: false, message: 'Reabastecimiento no encontrado' });

        if (status) restock.status = status;
        if (expectedDate) restock.expectedDate = expectedDate;
        if (itemsSummary) restock.itemsSummary = itemsSummary;
        if (notes !== undefined) restock.notes = notes;

        await restock.save();

        // Generar Notificación por Cambio de Estatus (Completado / Cancelado)
        if (status === 'completed' || status === 'cancelled') {
            try {
                const supplier = await Supplier.findById(restock.supplier);
                const supplierName = supplier ? supplier.name : 'Proveedor';
                
                const notif = new Notification({
                    company: restock.company,
                    targetBranch: restock.branch,
                    title: status === 'completed' ? 'Reabastecimiento Recibido' : 'Reabastecimiento Cancelado',
                    message: status === 'completed'
                        ? `La entrega de ${supplierName} ha sido verificada y recibida con éxito.`
                        : `Se ha cancelado la entrega programada de ${supplierName}.`,
                    type: status === 'completed' ? 'success' : 'error',
                    link: `/dashboard/admin/suppliers/details/${restock.supplier}`
                });
                await notif.save();
            } catch (notifErr) {
                console.error('Error creating restock status notification:', notifErr);
            }
        }

        // Lógica de Recurrencia Automática
        if (status === 'completed' && restock.isRecurring && restock.recurrence !== 'none') {
            const nextDate = new Date(restock.expectedDate);
            if (restock.recurrence === 'daily') {
                nextDate.setDate(nextDate.getDate() + 1);
            } else if (restock.recurrence === 'weekly') {
                nextDate.setDate(nextDate.getDate() + 7);
            } else if (restock.recurrence === 'monthly') {
                nextDate.setMonth(nextDate.getMonth() + 1);
            } else if (restock.recurrenceDays) {
                nextDate.setDate(nextDate.getDate() + restock.recurrenceDays);
            }

            const nextRestock = new SupplierRestock({
                company: restock.company,
                supplier: restock.supplier,
                branch: restock.branch,
                expectedDate: nextDate,
                itemsSummary: restock.itemsSummary,
                status: 'pending',
                notes: restock.notes,
                isRecurring: true,
                recurrence: restock.recurrence,
                recurrenceDays: restock.recurrenceDays
            });
            await nextRestock.save();
        }

        return res.status(200).json({ ok: true, restock });
    } catch (error) {
        return res.status(400).json({ ok: false, message: error });
    }
};

// Eliminar recordatorio
export const deleteRestockSchedule = async (req: Request, res: Response) => {
    try {
        const restock = await SupplierRestock.findByIdAndDelete(req.params.id);
        if (!restock) return res.status(404).json({ ok: false, message: 'Reabastecimiento no encontrado' });
        return res.status(200).json({ ok: true, message: 'Reabastecimiento eliminado' });
    } catch (error) {
        return res.status(500).json({ ok: false, message: error });
    }
};

export default {
    createSupplier,
    getAllSuppliers,
    getSupplierById,
    updateSupplier,
    deleteSupplier,
    createRestockSchedule,
    getCompanyRestockSchedules,
    updateRestockStatus,
    deleteRestockSchedule
};
