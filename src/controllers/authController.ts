import { Request, Response } from 'express';
import jwt, { Secret } from 'jsonwebtoken';
import User from '../models-mongoose/User';

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
            menu: getMenuFrontEnd(usuarioDB.role)
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

    const company = await Company.findOne({ adminId: uid })
  




    return resp.status(200).json({
        ok: true,
        token,
        uid,
        usuario,
        company,
        menu: getMenuFrontEnd(usuario?.role)

    });


}


