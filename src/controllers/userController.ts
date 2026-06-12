import { Request, Response } from 'express';
import User from '../models-mongoose/User';
import Company from '../models-mongoose/Company';
import Branch from '../models-mongoose/Branch';
import { forceCloseUserCashRegisters } from '../controllers/cashRegisterController';

import bcrypt from "bcrypt";
import mongoose from 'mongoose';




export const isCompanyAdmin=async (req: Request, res: Response)=>{

  const {companyId, adminId} = req.body;

  const empresaAdmin = await Company.find({adminId});

  if(!empresaAdmin){
    return res.status(404).json({
      ok:false,
      msg:'El usuario no tiene permisos en esta Company'
    })
  }

}

// Controlador para obtener todos los usuarios activos
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find({ role: { $in: ['admin', 'user'] }, active: { $ne: false } });
    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};
// Controlador para obtener todos los usuarios
export const getNumberUsers = async (req: Request, res: Response) => {
  try {
    const numberOfUsers = await User.count();
    res.json({
      ok:true,
      numberOfUsers
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

export const getAllNonAdminUsersOfCompany = async (req: Request, res: Response) => {
  const adminId = req.params.adminId;
  const { page = 1, limit = 10, search = '', branchId, role, status } = req.query;

  try {
    // 1. Intentar encontrar al usuario solicitante por su ID para obtener su companyId
    const requestingUser = await User.findById(adminId).exec();
    
    let company = null;
    if (requestingUser && requestingUser.companyId) {
      company = await Company.findById(requestingUser.companyId).exec();
    }

    // 2. Si no se encontró por usuario (ej: en cargas maestras), buscar por el adminId de la compañía
    if (!company) {
      company = await Company.findOne({ adminId }).exec();
    }

    if (!company) {
      return res.status(404).send('Company no encontrada.');
    }

    // Configuración de paginación y búsqueda
    const pageNumber = parseInt(page as string) > 0 ? parseInt(page as string) : 1;
    const limitNumber = parseInt(limit as string) > 0 ? parseInt(limit as string) : 10;
    const skip = (pageNumber - 1) * limitNumber;

    // Filtrar usuarios por compañía y por término de búsqueda, excluyendo al admin
    const query: any = {
      companyId: company._id,
      _id: { $ne: adminId },
      name: { $regex: search, $options: 'i' } // Buscar por nombre, insensible a mayúsculas
    };

    if (status === 'active') {
      query.active = { $ne: false };
    } else if (status === 'suspended') {
      query.active = false;
    }

    // Si el solicitante es un Gerente de Sucursal (rol 'admin'), aplicar aislamiento estricto
    if (requestingUser && requestingUser.role === 'admin') {
      query.role = 'user'; // Solo cajeros / personal operativo
      query.branch = requestingUser.branch; // Solo sucursales a las que pertenece el gerente
    } else {
      // El Company Admin o SysAdmin pueden usar los filtros dinámicos
      if (branchId === 'corporativo') {
        query.branch = null;
      } else if (branchId) {
        query.branch = branchId;
      }

      if (role) {
        query.role = role;
      }
    }

    // Obtener los usuarios paginados y contar el total
    const users = await User.find(query)
      .populate('branch', 'name')
      .skip(skip)
      .limit(limitNumber)
      .exec();
    const totalUsers = await User.countDocuments(query);

    res.status(200).json({
      ok: true,
      users,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalUsers / limitNumber),
      totalUsers
    });
  } catch (error) {
    console.error('Error al obtener usuarios de la Company:', error);
    res.status(500).json({ ok: false, message: `Error: ${error}` });
  }
};
export const getAllUsersOfCompany = async (req: Request, res: Response) => {
  const companyId = req.params.companyId;

  try {

    // Encuentra todos los usuarios de la Company, excluyendo al administrador
    const users = await User.find({ companyId }).populate('branch', 'name');
    
    res.status(200).json({ok:true,users});
  } catch (error) {
    console.error('Error al obtener usuarios de la Company:', error);
    res.status(500).json({ok:false, message:`error:${error}`});
  }
};

export const getAvailableAdmins = async (req:Request, res:Response) => {
  try {
    // Obtener todos los IDs de administradores de companies
    const companyAdminIds = await Company.find().distinct('adminId');

    // Obtener todos los usuarios que son administradores y no están en la lista de adminIds
    const availableAdmins = await User.find({
      _id: { $nin: companyAdminIds },
      role: 'admin'
    });

    res.status(200).json(availableAdmins);
  } catch (error) {
    res.status(500).json({ message: 'Hubo un error' });
  }
};
export const  getCompanyAdmin = async (req:Request, res:Response) => {
  try {
    const {adminId} = req.params
    // Obtener todos los IDs de administradores de companies
    const company = await Company.findOne({adminId:adminId})
    
    if(!company){
      return res.status(404).json({
        ok:false,
        msg:'No se encontro la Company'
      })
    }

    
    // Obtener todos los usuarios que son administradores y coinciden con los IDs validados
    return res.status(200).json({
      ok:true,
      company
    });

  } catch (error) {
    res.status(500).json({ message: 'Hubo un error' });
  }
};
export const getAllAdmins = async (req:Request, res:Response) => {
  try {
      const admins = await User.find({role:'companyAdmin'})
    res.status(200).json({
      ok:true,
      users:admins
    });
  } catch (error) {
    res.status(500).json({ message: 'Hubo un error' });
  }
};

export const getAllSysadmins = async (req:Request, res:Response) => {
  try {
      const sysadmins = await User.find({role:'sysadmin'})
    res.status(200).json({
      ok:true,
      users:sysadmins
    });
  } catch (error) {
    res.status(500).json({ message: 'Hubo un error' });
  }
};
export const getUnassignedAdmins = async (req: Request, res: Response) => {
  try {
    // Obtener todos los IDs de administradores de companies
    const companyAdminIds = await Company.find().distinct('adminId');

    // Convertir ObjectIds a cadenas para comparación
    const companyAdminIdsString = companyAdminIds.map(id => id.toString());

    // Obtener todos los usuarios que tienen el rol de 'admin'
    const allAdmins = await User.find({ role: 'admin' });

    // Filtrar administradores que no están asignados a ninguna Company
    const unassignedAdmins = allAdmins.filter(admin => !companyAdminIdsString.includes(admin._id.toString()));

    res.status(200).json({ ok: true, users: unassignedAdmins });
  } catch (error) {
    
    res.status(500).json({ message: 'Hubo un error', error});
  }
};



// Controlador para obtener un usuario por su ID
export const getUserById = async (req: Request, res: Response) => { 
  const userId = req.params.id;

  try {
    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    res.json({ok:true,user});
  } catch (error) { 

    console.error('Error al obtener el usuario:', error);
    res.status(500).json({ error: 'Error al obtener el usuario' });
  }
};
export const getUserByIdSoloAdmin = async (req: Request, res: Response) => { 
  const userId = req.params.id;

  

  try {
    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    res.json({ok:true,user});
  } catch (error) { 

    console.error('Error al obtener el usuario:', error);
    res.status(500).json({ error: 'Error al obtener el usuario' });
  }
};

export const createUser = async (req: Request, res: Response) => {
  const { username, password, name, role, email, companyId, branch, permissions } = req.body;

  const userExistsDb = await User.findOne({username:username});
  if(userExistsDb){
    return res.status(409).json({
      msg:'Usuario ya existe'
    });
  }

  // Validación de Límites de SaaS
  if (companyId && role !== 'companyAdmin' && role !== 'sysadmin') {
    const company = await Company.findById(companyId);
    if (company && company.currentLimits && company.currentLimits.maxUsers !== undefined && company.currentLimits.maxUsers !== -1) {
      const activeUsersCount = await User.countDocuments({ 
          companyId: companyId, 
          active: { $ne: false }, 
          role: { $nin: ['companyAdmin', 'sysadmin'] } 
      });
      if (activeUsersCount >= company.currentLimits.maxUsers) {
        return res.status(403).json({ 
            ok: false,
            msg: `Has alcanzado el límite de usuarios activos (${company.currentLimits.maxUsers}) de tu plan. No puedes crear más.` 
        });
      }
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10); 
  try {
      const newUser = new User({
          companyId,
          username,
          password: hashedPassword,
          name,
          role,
          email,
          branch,
          permissions,
          img:'no-image'
      });
      const savedUser = await newUser.save();
      res.json({savedUser});
  } catch (error) { 
      console.error('Error al crear el usuario:', error);
      res.status(500).json({ error: `Error al crear el usuario ${error} }`});
  }
};

// Controlador para actualizar un usuario por su ID
export const updateUser = async (req: Request, res: Response) => {
  const userId = req.params.id;
  const { username, password, name, email, role, branch, permissions } = req.body;

  try {
    const updateData: any = {
      username,
      name,
      email,
      role,
      permissions: permissions || []
    };

    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updateQuery: any = { $set: updateData };

    if (branch === '' || branch === null || branch === 'undefined' || branch === 'null') {
      updateQuery.$unset = { branch: 1 };
    } else if (branch) {
      updateQuery.$set.branch = branch;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateQuery,
      { new: true }
    );

    if (!updatedUser) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    res.json(updatedUser);
  } catch (error) {
    console.error('Error al actualizar el usuario:', error);
    res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
};

// Controlador para desactivar un usuario (Soft Delete) por su ID
export const deleteUser = async (req: Request, res: Response) => {
  const userId = req.params.id;
  const { reason = 'Desactivado por el administrador' } = req.body;
  
  const adminCompany = await Company.find({adminId:userId})
  
  if(adminCompany.length>0){
   return res.status(403).json({ok:false, msg:'El elemento tiene referencias asignadas a el, eliminalas!', adminCompany})
  }

  try {
    const deletedUser = await User.findByIdAndUpdate(
      userId,
      { active: false, deactivationReason: reason },
      { new: true }
    ); 

    if (!deletedUser) { 
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
 
    res.json({ ok: true, message: 'Usuario desactivado con éxito' });
  } catch (error) {
    console.error('Error al desactivar el usuario:', error);
    res.status(500).json({ error: 'Error al desactivar el usuario' });
  }
};

export const toggleUserBlock = async (req: Request, res: Response) => {
  const userId = req.params.id;
  const companyId = req.params.companyId;
  const { active } = req.body; // true = reactivate, false = block
  
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (companyId && user.companyId?.toString() !== companyId) {
      return res.status(403).json({ error: 'Usuario no pertenece a tu empresa' });
    }
    
    if (active) {
      // 1. Validar Sucursal
      if (user.branch) {
        const branch = await Branch.findById(user.branch);
        if (branch && branch.isActive === false) {
          return res.status(403).json({ error: 'No puedes reactivar a este usuario porque la sucursal a la que pertenece está desactivada. Edita su perfil y asígnalo a una sucursal activa primero.' });
        }
      }

      // 2. Validar Límite SaaS
      if (user.companyId) {
        const company = await Company.findById(user.companyId);
        if (company && company.currentLimits && company.currentLimits.maxUsers !== undefined && company.currentLimits.maxUsers !== -1) {
          const activeUsersCount = await User.countDocuments({ companyId: user.companyId, active: true, role: { $ne: 'companyAdmin' } });
          if (activeUsersCount >= company.currentLimits.maxUsers) {
            return res.status(403).json({ error: `Límite de usuarios (${company.currentLimits.maxUsers}) alcanzado en tu plan actual. Desactiva a otro empleado para liberar un espacio o mejora tu plan.` });
          }
        }
      }
    }
    
    user.active = active;
    if (!active) {
       user.deactivationReason = 'Desactivado manualmente por el administrador';
       // Capa 3: Cerrar cajas vivas si se suspende al usuario
       await forceCloseUserCashRegisters(user._id);
    } else {
       user.deactivationReason = '';
    }
    
    await user.save();
    
    res.json({ ok: true, user, message: active ? 'Usuario reactivado' : 'Usuario bloqueado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar estado del usuario' });
  }
};
