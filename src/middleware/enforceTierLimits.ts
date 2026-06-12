import { Request, Response, NextFunction } from 'express';
import User from '../models-mongoose/User';
import Company from '../models-mongoose/Company';
import SubscriptionPlan from '../models-mongoose/SubscriptionPlan';
import Branch from '../models-mongoose/Branch';

export const checkBranchLimit = async (req: any, res: Response, next: NextFunction) => {
    try {
        const uid = req.uid;
        const usuarioDB = await User.findById(uid);
        if (!usuarioDB || !usuarioDB.companyId) {
            return res.status(403).json({ ok: false, msg: 'Usuario no tiene empresa asignada' });
        }

        const companyId = usuarioDB.companyId;
        const company = await Company.findById(companyId).populate('planId');
        if (!company) {
            return res.status(404).json({ ok: false, msg: 'Empresa no encontrada' });
        }

        // Obtener límite del plan, snapshot o custom overrides
        let maxBranches = 1; // Default
        
        if (company.customLimitsOverrides && typeof company.customLimitsOverrides.maxBranches === 'number') {
            maxBranches = company.customLimitsOverrides.maxBranches;
        } 
        else if (company.currentLimits && typeof company.currentLimits.maxBranches === 'number' && 
                (!company.snapshotExpirationDate || new Date() < new Date(company.snapshotExpirationDate))) {
            maxBranches = company.currentLimits.maxBranches;
        } 
        else {
            const plan: any = company.planId;
            if (plan && typeof plan.maxBranches === 'number') {
                maxBranches = plan.maxBranches;
            }
        }

        if (maxBranches === -1) {
            return next(); // Ilimitado
        }

        const currentBranchesCount = await Branch.countDocuments({ company: companyId });
        if (currentBranchesCount >= maxBranches) {
            return res.status(403).json({ 
                ok: false, 
                msg: `Límite alcanzado. Tu plan permite máximo ${maxBranches} sucursal(es). Mejora tu plan para añadir más.` 
            });
        }

        next();
    } catch (error) {
        res.status(500).json({ ok: false, msg: 'Error al verificar límites de sucursales' });
    }
};

export const checkUserLimit = async (req: any, res: Response, next: NextFunction) => {
    try {
        const uid = req.uid;
        const usuarioDB = await User.findById(uid);
        if (!usuarioDB || !usuarioDB.companyId) {
            return res.status(403).json({ ok: false, msg: 'Usuario no tiene empresa asignada' });
        }

        const companyId = usuarioDB.companyId;
        const company = await Company.findById(companyId).populate('planId');
        if (!company) {
            return res.status(404).json({ ok: false, msg: 'Empresa no encontrada' });
        }

        let maxUsers = 3; // Default
        
        if (company.customLimitsOverrides && typeof company.customLimitsOverrides.maxUsers === 'number') {
            maxUsers = company.customLimitsOverrides.maxUsers;
        } 
        else if (company.currentLimits && typeof company.currentLimits.maxUsers === 'number' && 
                (!company.snapshotExpirationDate || new Date() < new Date(company.snapshotExpirationDate))) {
            maxUsers = company.currentLimits.maxUsers;
        } 
        else {
            const plan: any = company.planId;
            if (plan && typeof plan.maxUsers === 'number') {
                maxUsers = plan.maxUsers;
            }
        }

        if (maxUsers === -1) {
            return next();
        }

        const currentUsersCount = await User.countDocuments({ companyId: companyId });
        if (currentUsersCount >= maxUsers) {
            return res.status(403).json({ 
                ok: false, 
                msg: `Límite alcanzado. Tu plan permite máximo ${maxUsers} usuario(s). Mejora tu plan para añadir más.` 
            });
        }

        next();
    } catch (error) {
        res.status(500).json({ ok: false, msg: 'Error al verificar límites de usuarios' });
    }
};

export const checkActiveRegistersLimit = async (req: any, res: Response, next: NextFunction) => {
    try {
        const uid = req.uid;
        const usuarioDB = await User.findById(uid);
        if (!usuarioDB || !usuarioDB.companyId) {
            return res.status(403).json({ ok: false, msg: 'Usuario no tiene empresa asignada' });
        }

        const companyId = usuarioDB.companyId;
        const company = await Company.findById(companyId).populate('planId');
        if (!company) {
            return res.status(404).json({ ok: false, msg: 'Empresa no encontrada' });
        }

        let maxActiveRegisters = 1; // Default
        
        if (company.customLimitsOverrides && typeof company.customLimitsOverrides.maxActiveRegisters === 'number') {
            maxActiveRegisters = company.customLimitsOverrides.maxActiveRegisters;
        } 
        else if (company.currentLimits && typeof company.currentLimits.maxActiveRegisters === 'number' && 
                (!company.snapshotExpirationDate || new Date() < new Date(company.snapshotExpirationDate))) {
            maxActiveRegisters = company.currentLimits.maxActiveRegisters;
        } 
        else {
            const plan: any = company.planId;
            if (plan && typeof plan.maxActiveRegisters === 'number') {
                maxActiveRegisters = plan.maxActiveRegisters;
            } else if (typeof company.maxActiveRegisters === 'number') {
                maxActiveRegisters = company.maxActiveRegisters; // Legacy fallback
            }
        }

        if (maxActiveRegisters === -1) {
            return next();
        }

        const mongoose = require('mongoose');
        const currentActiveRegistersCount = await mongoose.model('CashRegister').countDocuments({ company: companyId, closed: false });
        
        if (currentActiveRegistersCount >= maxActiveRegisters) {
            return res.status(403).json({ 
                ok: false, 
                message: `Límite de cajas alcanzado. Tu plan permite un máximo de ${maxActiveRegisters} caja(s) activa(s) simultáneamente. Cierra un turno para abrir otro.` 
            });
        }

        next();
    } catch (error) {
        res.status(500).json({ ok: false, msg: 'Error al verificar límites de cajas' });
    }
};
