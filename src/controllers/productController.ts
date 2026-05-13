import { Request, Response } from 'express';
import Product from '../models-mongoose/Product';
import Company from '../models-mongoose/Company';
import { subirArchivo } from '../controllers/fileUploadController';

// Crear un nuevo producto
export const createProduct = async (req: Request, res: Response) => {
    const { companyId } = req.params;
    try {
        const companyDb = await Company.findById(companyId);
        if (!companyDb) {
            return res.status(404).json({
                ok: false,
                msg: "No existe la Company seleccionada"
            });
        }

        req.body.company = companyId;

        const newProduct = new Product(req.body);
        const savedProduct = await newProduct.save();

        // subirImg
        req.params.id = newProduct._id!;
        req.params.tipo = 'productos';

        return res.status(201).json({ ok: true, savedProduct });
    } catch (error) {
        return res.status(400).json({ message: error });
    }
};

// Obtener todos los productos
export const getAllProducts = async (req: Request, res: Response) => {
    try {
        const products = await Product.find().populate('supplier');
        res.status(200).json({ ok: true, products });
    } catch (error) { 
        res.status(500).json({ message: error });
    }
};

// Obtener todos los productos de una Company para sysadmin
export const getAllProductsOfCompanyForSysadmin = async (req: Request, res: Response) => {
    try {
        const { companyId } = req.params;
        const companyDb = await Company.findById(companyId);
        if (!companyDb) {
            return res.status(404).json({
                ok: false,
                msg: "No existe la Company seleccionada"
            });
        }

        const products = await Product.find({ company: companyId }).populate('supplier');
        res.status(200).json({ ok: true, products });
    } catch (error) {
        res.status(500).json({ message: error });
    }
};

// Obtener todos los productos de una Company
export const getAllCompanyProducts = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const products = await Product.find({ company: id }).populate('supplier');
        res.status(200).json({ ok: true, products });
    } catch (error) {
        res.status(500).json({ message: error });
    }
};

// Obtener un producto por ID
export const getProductById = async (req: Request, res: Response) => {
    try {
        const product = await Product.findById(req.params.id).populate('supplier');
        if (!product) return res.status(404).json({ message: 'Producto no encontrado' });
        res.status(200).json({ ok: true, product });
    } catch (error) {
        res.status(500).json({ message: error });
    }
};

// Actualizar un producto
export const updateProduct = async (req: Request, res: Response) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedProduct) return res.status(404).json({ message: 'Producto no encontrado' });
        res.status(200).json(updatedProduct);
    } catch (error) {
        res.status(400).json({ message: error });
    }
};

// Eliminar un producto
export const deleteProduct = async (req: Request, res: Response) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);
        if (!deletedProduct) return res.status(404).json({ message: 'Producto no encontrado' });
        res.status(200).json({ message: 'Producto eliminado' });
    } catch (error) {
        res.status(500).json({ message: error });
    }
};

// Buscar productos
export const searchProducts = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 5, search = '', companyId } = req.query;

        if (!companyId) {
            return res.status(400).json({ message: 'Company ID is required' });
        }

        const query = {
            company: companyId,
            ...(search && { name: { $regex: new RegExp(search as string, 'i') } })
        };

        const products = await Product.find(query)
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));

        const total = await Product.countDocuments(query);

        res.status(200).json({
            products,
            totalPages: Math.ceil(total / Number(limit)),
            currentPage: Number(page),
            totalItems: total
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching products', error });
    }
};
