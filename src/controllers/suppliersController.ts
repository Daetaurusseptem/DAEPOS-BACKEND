// src/controllers/supplierController.ts

import { Request, Response } from 'express';
import Supplier from '../models-mongoose/Supplier';
import Company from '../models-mongoose/Company';
import SupplierRestock from '../models-mongoose/SupplierRestock';
import Notification from '../models-mongoose/Notification';
import InventoryItem from '../models-mongoose/InventoryItem';
import Product from '../models-mongoose/Product';
import RawMaterial from '../models-mongoose/RawMaterial';
import SupplierAgreement from '../models-mongoose/SupplierAgreement';


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
            .populate('items.itemRef')
            .sort({ expectedDate: 1 });
        return res.status(200).json({ ok: true, restocks });
    } catch (error) {
        return res.status(500).json({ ok: false, message: error });
    }
};

// Actualizar estado del reabastecimiento con lógica de auto-recurrencia
export const updateRestockStatus = async (req: Request, res: Response) => {
    try {
        const { status, expectedDate, itemsSummary, notes, items, payFromRegister } = req.body;
        const restock = await SupplierRestock.findById(req.params.id);
        if (!restock) return res.status(404).json({ ok: false, message: 'Reabastecimiento no encontrado' });

        const oldStatus = restock.status;

        // Lógica de Reabastecimiento Automático (Incrementar Inventario al completar)
        if (status === 'completed' && oldStatus !== 'completed') {
            const itemsToProcess = items || restock.items;
            if (itemsToProcess && itemsToProcess.length > 0) {
                for (const item of itemsToProcess) {
                    let inventoryItem;
                    const itemTypeLower = item.type.toLowerCase();
                    if (itemTypeLower === 'product') {
                        inventoryItem = await InventoryItem.findOne({ 
                            product: item.itemRef, 
                            branch: restock.branch 
                        });
                    } else if (itemTypeLower === 'rawmaterial' || itemTypeLower === 'raw_material') {
                        inventoryItem = await InventoryItem.findOne({ 
                            rawMaterial: item.itemRef, 
                            branch: restock.branch 
                        });
                    }

                    if (inventoryItem) {
                        const currentStock = Math.max(0, inventoryItem.stock);
                        const currentCost = inventoryItem.costPrice || 0;
                        const newQty = item.quantity || 0;
                        const newCost = item.costPrice || 0;

                        let weightedCost = newCost;
                        if (currentStock + newQty > 0) {
                            weightedCost = ((currentStock * currentCost) + (newQty * newCost)) / (currentStock + newQty);
                        }

                        inventoryItem.stock += newQty;
                        inventoryItem.costPrice = Math.round(weightedCost * 100) / 100;
                        await inventoryItem.save();
                    } else {
                        let name = 'Nuevo Artículo';
                        let measurement: any = 'unit';

                        if (itemTypeLower === 'product') {
                            const prodDoc = await Product.findById(item.itemRef);
                            if (prodDoc) {
                                name = prodDoc.name;
                            }
                        } else {
                            const rmDoc = await RawMaterial.findById(item.itemRef);
                            if (rmDoc) {
                                name = rmDoc.name;
                                measurement = rmDoc.measurementUnit;
                            }
                        }

                        const newInv = new InventoryItem({
                            name,
                            company: restock.company,
                            branch: restock.branch,
                            supplier: restock.supplier,
                            stock: item.quantity,
                            costPrice: item.costPrice,
                            measurement,
                            product: itemTypeLower === 'product' ? item.itemRef : undefined,
                            rawMaterial: (itemTypeLower === 'rawmaterial' || itemTypeLower === 'raw_material') ? item.itemRef : undefined
                        });
                        await newInv.save();
                    }
                }
            }

            // Integración de Caja Chica
            if (payFromRegister) {
                try {
                    const CashRegister = require('../models-mongoose/CashRegister').default;
                    const activeRegister = await CashRegister.findOne({ branch: restock.branch, closed: false });
                    if (activeRegister) {
                        const supplier = await Supplier.findById(restock.supplier);
                        const supplierName = supplier ? supplier.name : 'Proveedor';
                        const itemsToProcess = items || restock.items;
                        const totalCost = (itemsToProcess || []).reduce((sum: number, it: any) => sum + ((it.quantity || 0) * (it.costPrice || 0)), 0);

                        if (totalCost > 0) {
                            activeRegister.expenses.push({
                                amount: totalCost,
                                reason: `Reabastecimiento Proveedor: ${supplierName}`,
                                type: 'expense',
                                timestamp: new Date()
                            });
                            activeRegister.expectedAmount -= totalCost;
                            await activeRegister.save();
                        }
                    }
                } catch (regErr) {
                    console.error('Error registering cash register expense:', regErr);
                }
            }
        }

        if (status) restock.status = status;
        if (expectedDate) restock.expectedDate = expectedDate;
        if (itemsSummary) restock.itemsSummary = itemsSummary;
        if (items) restock.items = items;
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

// --- ACUERDOS DE PRECIOS Y PROVEEDORES ---

// Crear un acuerdo de precios
export const createSupplierAgreement = async (req: Request, res: Response) => {
    try {
        const { companyId } = req.params;
        const { supplier, product, branch, agreedCost, startDate, endDate, minimumOrderQty, notes, status } = req.body;

        const newAgreement = new SupplierAgreement({
            company: companyId,
            supplier,
            product,
            branch: branch || null,
            agreedCost,
            startDate,
            endDate,
            minimumOrderQty,
            notes,
            status: status || 'active'
        });

        await newAgreement.save();
        return res.status(201).json({ ok: true, agreement: newAgreement });
    } catch (error) {
        return res.status(400).json({ ok: false, message: error });
    }
};

// Obtener acuerdos de precios de la empresa
export const getCompanySupplierAgreements = async (req: Request, res: Response) => {
    try {
        const { companyId } = req.params;
        const { supplier, product, branch } = req.query;

        let query: any = { company: companyId };
        if (supplier) query.supplier = supplier;
        if (product) query.product = product;
        if (branch !== undefined) query.branch = branch || null;

        const agreements = await SupplierAgreement.find(query)
            .populate('supplier')
            .populate('product')
            .populate('branch');

        return res.status(200).json({ ok: true, agreements });
    } catch (error) {
        return res.status(500).json({ ok: false, message: error });
    }
};

// Resolver costo pactado en cascada
export const resolveAgreedCostEndpoint = async (req: Request, res: Response) => {
    try {
        const { companyId, product, supplier, branch, date } = req.query;

        if (!companyId || !product || !supplier) {
            return res.status(400).json({ ok: false, message: 'Faltan parámetros requeridos (companyId, product, supplier)' });
        }

        const queryDate = date ? new Date(date as string) : new Date();

        // 1. Acuerdo específico por sucursal
        if (branch) {
            const branchAgreement = await SupplierAgreement.findOne({
                company: companyId,
                product,
                supplier,
                branch,
                status: 'active',
                startDate: { $lte: queryDate },
                endDate: { $gte: queryDate }
            });

            if (branchAgreement) {
                return res.status(200).json({ ok: true, agreedCost: branchAgreement.agreedCost, level: 'branch', agreement: branchAgreement });
            }
        }

        // 2. Acuerdo general
        const generalAgreement = await SupplierAgreement.findOne({
            company: companyId,
            product,
            supplier,
            branch: null,
            status: 'active',
            startDate: { $lte: queryDate },
            endDate: { $gte: queryDate }
        });

        if (generalAgreement) {
            return res.status(200).json({ ok: true, agreedCost: generalAgreement.agreedCost, level: 'general', agreement: generalAgreement });
        }

        // 3. Sin acuerdo
        return res.status(200).json({ ok: true, agreedCost: null, level: 'default' });
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
    deleteRestockSchedule,
    createSupplierAgreement,
    getCompanySupplierAgreements,
    resolveAgreedCostEndpoint
};
