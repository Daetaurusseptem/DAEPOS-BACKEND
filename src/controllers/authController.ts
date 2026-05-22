import { Request, Response } from 'express';
import jwt, { Secret } from 'jsonwebtoken';
import User from '../models-mongoose/User';
import mongoose from 'mongoose';

import bcrypt from "bcrypt";
import { generarJWT } from '../helpers/jwt-helper';
import { getMenuFrontEnd } from '../helpers/menu';
import Company from '../models-mongoose/Company';
import { getAllAdmins } from './userController';

export const login = async (req: Request, resp: Response) => {

    const { username, password } = req.body



    try {

        const usuarioDB = await User.findOne({ username }).select('+password')

        if (!usuarioDB) {
            return resp.status(404).json({
                ok: false,
                msg: 'Datos no validos'
            })
        }

        const validPassword = bcrypt.compareSync(password, usuarioDB.password);


        if (!validPassword) {
            return resp.status(400).json({
                ok: false,
                msg: 'password invalido'
            })
        }

        const token = await generarJWT(usuarioDB._id);

        return resp.status(200).json({
            ok: true,
            token,
            menu: getMenuFrontEnd(usuarioDB.role, usuarioDB.permissions)
        })


    } catch (error) {

        return resp.status(500).json({
            okay: false,
            msg: 'Porfavor hable con el administrador' + error
        })
    }


}

export const renewToken = async (req: any, resp: Response) => {

    const uid = req.uid;


    const token = await generarJWT(uid);

    //return user
    const usuario = await User.findById(uid).select('+password');

    if (!usuario) {
        return resp.status(404).json({
            ok: false,
            msg: 'No se encontro el usuario'
        })
    }

    let company;
    let branch;

    if (usuario.role === 'companyAdmin') {
        company = await Company.findOne({ adminId: uid });
    } else if ((usuario.role === 'admin' || usuario.role === 'user') && usuario.companyId) {
        company = await Company.findById(usuario.companyId);
        if (usuario.branch) {
            branch = await mongoose.model('Branch').findById(usuario.branch);
        }
    }




    return resp.status(200).json({
        ok: true,
        token,
        uid,
        usuario,
        company,
        branch,
        menu: getMenuFrontEnd(usuario?.role, usuario?.permissions)
    });
}

export const demoReset = async (req: Request, resp: Response) => {
    try {
        const { runSeed } = require('../seed/seed-helper');
        console.log('🔄 Restaurando base de datos para modo Demo...');
        await runSeed(true);
        return resp.status(200).json({
            ok: true,
            msg: 'Base de datos restaurada correctamente al estado inicial de demostración.'
        });
    } catch (error) {
        console.error('Error al restaurar base de datos:', error);
        return resp.status(500).json({
            ok: false,
            msg: 'No se pudo completar la restauración de la base de datos.',
            error: String(error)
        });
    }
};


