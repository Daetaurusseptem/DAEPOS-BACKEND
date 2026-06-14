import { Request, Response } from 'express';
import Branch from '../models-mongoose/Branch';
import Company from '../models-mongoose/Company';
import User from '../models-mongoose/User';

export const createBranch = async (req: Request, res: Response) => {
  try {
    const companyId = req.body.company;
    if (companyId) {
      const company = await Company.findById(companyId);
      if (
        company &&
        company.currentLimits &&
        company.currentLimits.maxBranches !== undefined &&
        company.currentLimits.maxBranches !== -1
      ) {
        // Verificar si se creará activa (por defecto true si no se envía)
        const willBeActive = req.body.isActive !== false;
        if (willBeActive) {
          const activeBranchesCount = await Branch.countDocuments({ company: companyId, isActive: true });
          if (activeBranchesCount >= company.currentLimits.maxBranches) {
            return res.status(403).json({
              ok: false,
              msg: `Has alcanzado el límite de sucursales activas (${company.currentLimits.maxBranches}) de tu plan. No puedes crear más.`,
            });
          }
        }
      }
    }

    const branch = new Branch(req.body);
    await branch.save();
    res.status(201).json({ ok: true, branch });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Error creating branch', error });
  }
};

export const getBranchesByCompany = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const reqWithUid = req as any;
    const uid = reqWithUid.uid;

    const query: any = { company: companyId };

    if (uid) {
      const user = await User.findById(uid);
      // Hard Lock Visibility: Si el usuario es operativo (no administrador dueño), ocultarle las inactivas
      if (user && user.role !== 'companyAdmin' && user.role !== 'sysadmin') {
        query.isActive = true;
      }
    }

    const branches = await Branch.find(query).populate('manager', 'name email');
    res.status(200).json({ ok: true, branches });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Error fetching branches', error });
  }
};

export const getBranchById = async (req: Request, res: Response) => {
  try {
    const branch = await Branch.findById(req.params.id).populate('company').populate('manager');
    if (!branch) return res.status(404).json({ ok: false, message: 'Branch not found' });
    res.status(200).json({ ok: true, branch });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Error fetching branch', error });
  }
};

export const updateBranch = async (req: Request, res: Response) => {
  try {
    const branchToUpdate = await Branch.findById(req.params.id);
    if (!branchToUpdate) return res.status(404).json({ ok: false, message: 'Branch not found' });

    // Si se intenta reactivar una sucursal inactiva
    if (req.body.isActive === true && branchToUpdate.isActive === false) {
      const company = await Company.findById(branchToUpdate.company);
      if (
        company &&
        company.currentLimits &&
        company.currentLimits.maxBranches !== undefined &&
        company.currentLimits.maxBranches !== -1
      ) {
        const activeBranchesCount = await Branch.countDocuments({ company: branchToUpdate.company, isActive: true });
        if (activeBranchesCount >= company.currentLimits.maxBranches) {
          return res.status(403).json({
            ok: false,
            msg: `No puedes reactivar esta sucursal. Has alcanzado el límite de sucursales activas (${company.currentLimits.maxBranches}) de tu plan.`,
          });
        }
      }
    }

    const branch = await Branch.findByIdAndUpdate(req.params.id, req.body, { new: true });

    // Lógica en cascada: Activar/Desactivar usuarios de la sucursal
    if (req.body.isActive === true && branchToUpdate.isActive === false) {
      // Reactivar usuarios de esta sucursal
      const company = await Company.findById(branchToUpdate.company);
      if (
        company &&
        company.currentLimits &&
        company.currentLimits.maxUsers !== undefined &&
        company.currentLimits.maxUsers !== -1
      ) {
        const activeUsersCount = await User.countDocuments({ companyId: branchToUpdate.company, active: true });
        const usersToReactivate = await User.find({
          branch: req.params.id,
          active: false,
          deactivationReason: 'Sucursal desactivada',
        });
        const roomAvailable = company.currentLimits.maxUsers - activeUsersCount;

        if (usersToReactivate.length > roomAvailable) {
          // Reactiva solo los que quepan en el plan
          const usersToActivateIds = usersToReactivate.slice(0, Math.max(0, roomAvailable)).map((u) => u._id);
          if (usersToActivateIds.length > 0) {
            await User.updateMany({ _id: { $in: usersToActivateIds } }, { active: true, deactivationReason: '' });
          }
        } else {
          await User.updateMany(
            { branch: req.params.id, active: false, deactivationReason: 'Sucursal desactivada' },
            { active: true, deactivationReason: '' },
          );
        }
      } else {
        await User.updateMany(
          { branch: req.params.id, active: false, deactivationReason: 'Sucursal desactivada' },
          { active: true, deactivationReason: '' },
        );
      }
    } else if (req.body.isActive === false && branchToUpdate.isActive === true) {
      // Desactivar usuarios de esta sucursal (solo los que están activos)
      await User.updateMany(
        { branch: req.params.id, active: true },
        { active: false, deactivationReason: 'Sucursal desactivada' },
      );
    }

    res.status(200).json({ ok: true, branch });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Error updating branch', error });
  }
};

export const deleteBranch = async (req: Request, res: Response) => {
  try {
    const branch = await Branch.findByIdAndDelete(req.params.id);
    if (!branch) return res.status(404).json({ ok: false, message: 'Branch not found' });
    res.status(200).json({ ok: true, message: 'Branch deleted' });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Error deleting branch', error });
  }
};
