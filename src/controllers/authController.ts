import { Request, Response } from 'express';
import jwt, { Secret } from 'jsonwebtoken';
import User from '../models-mongoose/User';
import mongoose from 'mongoose';

import bcrypt from 'bcrypt';
import { generarJWT } from '../helpers/jwt-helper';
import { getMenuFrontEnd } from '../helpers/menu';
import Company from '../models-mongoose/Company';
import { getAllAdmins } from './userController';

export const login = async (req: Request, resp: Response) => {
  const { username, password } = req.body;

  try {
    const usuarioDB = await User.findOne({ username }).select('+password');

    if (!usuarioDB) {
      return resp.status(404).json({
        ok: false,
        msg: 'Datos no validos',
      });
    }

    // Hard Lock: Usuario Inactivo
    if (usuarioDB.active === false) {
      return resp.status(403).json({
        ok: false,
        msg: 'Usuario suspendido o inactivo. Contacta a tu administrador.',
      });
    }

    const validPassword = bcrypt.compareSync(password, usuarioDB.password);

    if (!validPassword) {
      return resp.status(400).json({
        ok: false,
        msg: 'password invalido',
      });
    }

    // Hard Lock: Sucursal Inactiva en Login Directo
    if (usuarioDB.role === 'admin' || usuarioDB.role === 'user' || usuarioDB.role === 'kitchen') {
      if (usuarioDB.branch) {
        const branchDoc = await mongoose.model('Branch').findById(usuarioDB.branch);
        if (branchDoc && branchDoc.isActive === false) {
          return resp.status(403).json({
            ok: false,
            msg: 'La sucursal a la que perteneces está inactiva o suspendida. Contacta a tu corporativo.',
          });
        }
      }
    }

    const token = await generarJWT(usuarioDB._id);

    return resp.status(200).json({
      ok: true,
      token,
      menu: getMenuFrontEnd(usuarioDB.role, usuarioDB.permissions),
    });
  } catch (error) {
    return resp.status(500).json({
      okay: false,
      msg: 'Porfavor hable con el administrador' + error,
    });
  }
};

export const validateAdmin = async (req: Request, resp: Response) => {
  const { username, password } = req.body;
  const reqCompanyId = (req as any).companyId; // Extraído por el middleware validar-jwt si es necesario, o lo mandamos en el body
  const { companyId } = req.body; 

  try {
    const usuarioDB = await User.findOne({ username }).select('+password');

    if (!usuarioDB || !usuarioDB.active) {
      return resp.status(404).json({ ok: false, msg: 'Datos no válidos o usuario inactivo.' });
    }

    const validPassword = bcrypt.compareSync(password, usuarioDB.password);
    if (!validPassword) {
      return resp.status(400).json({ ok: false, msg: 'Contraseña inválida.' });
    }

    if (usuarioDB.role !== 'admin' && usuarioDB.role !== 'companyAdmin' && usuarioDB.role !== 'sysadmin') {
      return resp.status(403).json({ ok: false, msg: 'El usuario no tiene permisos de nivel Gerencial.' });
    }

    if (usuarioDB.role !== 'sysadmin' && String(usuarioDB.companyId) !== String(companyId)) {
      return resp.status(403).json({ ok: false, msg: 'El usuario no pertenece a esta empresa.' });
    }

    return resp.status(200).json({ ok: true, msg: 'Autorización exitosa.' });
  } catch (error) {
    return resp.status(500).json({ ok: false, msg: 'Error de servidor.' });
  }
};

export const renewToken = async (req: any, resp: Response) => {
  const uid = req.uid;

  const token = await generarJWT(uid);

  //return user
  const usuario = await User.findById(uid).select('+password');

  if (!usuario) {
    return resp.status(404).json({
      ok: false,
      msg: 'No se encontro el usuario',
    });
  }

  let company;
  let branch;

  if (usuario.role === 'companyAdmin') {
    company = await Company.findOne({ adminId: uid }).populate('planId', 'name');
  } else if ((usuario.role === 'admin' || usuario.role === 'user' || usuario.role === 'kitchen') && usuario.companyId) {
    company = await Company.findById(usuario.companyId).populate('planId', 'name');
    if (usuario.branch) {
      branch = await mongoose.model('Branch').findById(usuario.branch);

      // Hard Lock: Sucursal Inactiva
      if (branch && branch.isActive === false) {
        return resp.status(403).json({
          ok: false,
          msg: 'La sucursal a la que perteneces está inactiva o suspendida. Contacta a tu corporativo.',
        });
      }
    }
  }

  return resp.status(200).json({
    ok: true,
    token,
    uid,
    usuario,
    company,
    branch,
    isGracePeriod: req.isGracePeriod || false,
    menu: getMenuFrontEnd(usuario?.role, usuario?.permissions),
  });
};

export const demoReset = async (req: Request, resp: Response) => {
  try {
    const { runSeed } = require('../seed/seed-helper');
    console.log('🔄 Restaurando base de datos para modo Demo...');
    await runSeed(true);
    return resp.status(200).json({
      ok: true,
      msg: 'Base de datos restaurada correctamente al estado inicial de demostración.',
    });
  } catch (error) {
    console.error('Error al restaurar base de datos:', error);
    return resp.status(500).json({
      ok: false,
      msg: 'No se pudo completar la restauración de la base de datos.',
      error: String(error),
    });
  }
};
