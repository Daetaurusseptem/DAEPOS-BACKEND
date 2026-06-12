import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Company, { CompanyDocument } from '../models-mongoose/Company';
import User from '../models-mongoose/User';
import Branch from '../models-mongoose/Branch';


// Crear una nueva Company
export const createEmpresa = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { adminId } = req.body;
        const userExists = await User.findById(adminId);
        const userAlreadyAdmin = await Company.findOne({ adminId });


        if (!userExists) {
            return res.status(500).json({ error: `Error, el usuario ${adminId} No existe` });
        }
        if (userAlreadyAdmin) {
            return res.status(500).json({ error: `Error, el usuario ${adminId} Ya es administrador de una Company` });

        }
        const newEmpresa: CompanyDocument = new Company(req.body);


        const savedEmpresa: CompanyDocument = await newEmpresa.save();
        return res.status(201).json(savedEmpresa);
    } catch (error) {
        console.error('Error al crear la Company:', error);
        return res.status(500).json({ error: 'Error al crear la Company' });
    }
};

// Obtener todas las companies
export const getAllEmpresas = async (req: Request, res: Response): Promise<Response> => {
    try {
        const companies: CompanyDocument[] = await Company.find({ isActive: true });
        return res.status(200).json({
            ok: true,
            companies
        });
    } catch (error) {
        console.error('Error al obtener las companies:', error);
        return res.status(500).json({ error: 'Error al obtener las companies' });
    }
};
export const getNumberCompanies = async (req: Request, res: Response): Promise<Response> => {
    try {
        const numberOfCompanies = await Company.count();
        return res.status(200).json({
            ok: true,
            numberOfCompanies
        });
    } catch (error) {
        console.error('Error al obtener las companies:', error);
        return res.status(500).json({ error: 'Error al obtener las companies' });
    }
};

export const getCompaniesPages = async (req: Request, res: Response): Promise<Response> => {
    try {
        // Parámetros de paginación con valores por defecto
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 5;

        // Calcular el desplazamiento
        const skip = (page - 1) * limit;

        // Obtener datos paginados
        const companies: CompanyDocument[] = await Company.find({ isActive: true }).skip(skip).limit(limit);

        // Contar el total de documentos para calcular el total de páginas
        const total = await Company.countDocuments({ isActive: true });
        const totalPages = Math.ceil(total / limit);

        // Devolver resultados paginados
        return res.status(200).json({
            totalPages,
            page,
            limit,
            companies
        });
    } catch (error) {
        console.error('Error al obtener las companies:', error);
        return res.status(500).json({ error: 'Error al obtener las companies' });
    }
};

// Obtener una Company por su ID
export const getEmpresaById = async (req: Request, res: Response) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) {
            return res.status(404).json({ message: 'Company no encontrada' });
        }

        return res.status(200).json(
            {
                ok: true,
                company: company
            }
        );
    } catch (error) {
        console.error('Error al obtener la Company:', error);
        return res.status(500).json({ error: 'Error al obtener la Company' });
    }
};

// Actualizar una Company
export const updateEmpresa = async (req: Request, res: Response) => {
    try {

        const company = await Company.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!company) {
            return res.status(404).json({ message: 'Company no encontrada' });
        }
        return res.status(200).json(
            company
        );
    } catch (error) {
        console.error('Error al actualizar la Company:', error);
        return res.status(500).json({ error: 'Error al actualizar la Company' });
    }
};

// Eliminar una Company (Soft Delete en cascada)
export const deleteEmpresa = async (req: Request, res: Response) => {
    const isProd = process.env.NODE_ENV === 'production';
    const session = isProd ? await mongoose.startSession() : null;
    if (session) session.startTransaction();

    try {
        const companyId = req.params.id;
        
        // 1. Desactivar Empresa
        const company = await Company.findByIdAndUpdate(
            companyId,
            { isActive: false },
            { new: true, session: session || undefined }
        );

        if (!company) {
            if (session) {
                await session.abortTransaction();
                session.endSession();
            }
            return res.status(404).json({ message: 'Company no encontrada' });
        }

        // 2. Desactivar Sucursales asociadas
        await Branch.updateMany(
            { company: companyId },
            { isActive: false },
            session ? { session } : undefined
        );

        // 3. Desactivar Usuarios asociados
        await User.updateMany(
            { companyId: companyId },
            { state: false }, // User model uses 'state' for active status
            session ? { session } : undefined
        );

        if (session) {
            await session.commitTransaction();
            session.endSession();
        }

        return res.status(200).json({ ok: true, message: 'Company y dependencias desactivadas (Soft Delete)' });
    } catch (error) {
        if (session) {
            await session.abortTransaction();
            session.endSession();
        }
        console.error('Error al eliminar la Company:', error);
        return res.status(500).json({ error: 'Error al desactivar la Company' });
    }
};
