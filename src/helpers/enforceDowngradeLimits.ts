import Company from '../models-mongoose/Company';
import Branch from '../models-mongoose/Branch';
import User from '../models-mongoose/User';
import { forceCloseUserCashRegisters, forceCloseBranchCashRegisters } from '../controllers/cashRegisterController';

/**
 * Enforces Downgrade Limits (Option A: Auto-suspend newest excess items)
 * Se ejecuta cuando una empresa cambia de plan (via Stripe o Sysadmin)
 * y su nuevo plan tiene límites más estrictos.
 */
export const enforceDowngradeLimits = async (companyId: string) => {
    try {
        const company = await Company.findById(companyId);
        if (!company || !company.currentLimits) return;

        const { maxBranches, maxUsers } = company.currentLimits;

        // 1. Control de Sucursales
        if (maxBranches !== undefined) {
            const activeBranches = await Branch.find({ company: companyId, isActive: true }).sort({ createdAt: 1 });
            
            if (maxBranches !== -1 && activeBranches.length > maxBranches) {
                // Las ramas que superen el límite (las más nuevas) se suspenden
                const branchesToSuspend = activeBranches.slice(maxBranches);
                for (const branch of branchesToSuspend) {
                    branch.isActive = false;
                    await branch.save();
                    // Capa 3: Cerrar cajas abiertas de esta sucursal
                    await forceCloseBranchCashRegisters(branch._id);
                }
                console.log(`[SaaS] Se suspendieron ${branchesToSuspend.length} sucursales por downgrade en empresa ${companyId}`);
            } else if (maxBranches === -1 || activeBranches.length < maxBranches) {
                // Hay espacio disponible, auto-reactivar sucursales suspendidas
                const inactiveBranches = await Branch.find({ company: companyId, isActive: false }).sort({ createdAt: 1 });
                const roomAvailable = maxBranches === -1 ? inactiveBranches.length : (maxBranches - activeBranches.length);
                
                const branchesToReactivate = inactiveBranches.slice(0, roomAvailable);
                for (const branch of branchesToReactivate) {
                    branch.isActive = true;
                    await branch.save();
                }
                if (branchesToReactivate.length > 0) {
                    console.log(`[SaaS] Se reactivaron ${branchesToReactivate.length} sucursales por UPGRADE en empresa ${companyId}`);
                }
            }
        }

        // 2. Control de Usuarios
        if (maxUsers !== undefined) {
            const activeUsers = await User.find({ companyId: companyId, active: { $ne: false }, role: { $ne: 'companyAdmin' } }).sort({ createdAt: 1 });
            
            if (maxUsers !== -1 && activeUsers.length > maxUsers) {
                const usersToSuspend = activeUsers.slice(maxUsers);
                for (const user of usersToSuspend) {
                    user.active = false;
                    user.deactivationReason = 'Límite de plan excedido (Downgrade)';
                    await user.save();
                    // Capa 3: Cerrar cajas abiertas de este usuario
                    await forceCloseUserCashRegisters(user._id);
                }
                console.log(`[SaaS] Se suspendieron ${usersToSuspend.length} usuarios por downgrade en empresa ${companyId}`);
            } else if (maxUsers === -1 || activeUsers.length < maxUsers) {
                // Hay espacio disponible, auto-reactivar usuarios suspendidos
                const inactiveUsers = await User.find({ companyId: companyId, active: false, deactivationReason: 'Límite de plan excedido (Downgrade)', role: { $ne: 'companyAdmin' } }).sort({ createdAt: 1 });
                const roomAvailable = maxUsers === -1 ? inactiveUsers.length : (maxUsers - activeUsers.length);
                
                const usersToReactivate = inactiveUsers.slice(0, roomAvailable);
                for (const user of usersToReactivate) {
                    user.active = true;
                    user.deactivationReason = '';
                    await user.save();
                }
                if (usersToReactivate.length > 0) {
                    console.log(`[SaaS] Se reactivaron ${usersToReactivate.length} usuarios por UPGRADE en empresa ${companyId}`);
                }
            }
        }

    } catch (error) {
        console.error('[SaaS Error] Error aplicando límites de downgrade:', error);
    }
};
