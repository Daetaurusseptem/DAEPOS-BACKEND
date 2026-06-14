// src/controllers/categoryController.ts

import { Request, Response } from 'express';
import Category from '../models-mongoose/Category';
import Company from '../models-mongoose/Company';

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;

    req.body.company = companyId;

    const company = await Company.findById(companyId);

    if (!company) {
      res.status(404).json({
        ok: false,
        msg: 'No se encontro la Company',
      });
    }
    const category = new Category(req.body);
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ message: 'La categoria ya existe o no es valida' });
  }
};

export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const categories = await Category.find();
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error });
  }
};
export const getAllCategoriesCompany = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company no existe' });
    }
    const categories = await Category.find({ company: companyId });
    res.status(200).json({
      ok: true,
      categories,
    });
  } catch (error) {
    res.status(500).json({ message: error });
  }
};
export const getCategoriesCompaniesPagination = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Parámetros de paginación con valores por defecto
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 5;

    // Calcular el desplazamiento
    const skip = (page - 1) * limit;
    const { companyId } = req.params;
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company no existe' });
    }
    // Obtener datos paginados
    const categories: Category[] = await Category.find({ company: companyId }).skip(skip).limit(limit);

    // Contar el total de documentos para calcular el total de páginas
    const total = await Company.countDocuments();
    const totalPages = Math.ceil(total / limit);

    // Devolver resultados paginados
    return res.status(200).json({
      totalPages,
      page,
      limit,
      categories,
    });
  } catch (error) {
    console.error('Error al obtener las companies:', error);
    return res.status(500).json({ error: 'Error al obtener las companies' });
  }
};

export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json({ ok: true, category });
  } catch (error) {
    res.status(500).json({ message: error });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.status(200).json({ ok: true, category });
  } catch (error) {
    res.status(400).json({ message: error });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ message: error });
  }
};
