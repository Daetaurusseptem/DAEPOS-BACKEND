// src/controllers/busquedaController.ts

import { Request, Response } from 'express';
import mongoose from 'mongoose';

const models: { [key: string]: mongoose.Model<any> } = {
    users: require('../models-mongoose/User').default,
    companies: require('../models-mongoose/Company').default,
    suppliers: require('../models-mongoose/Supplier').default,
    categories: require('../models-mongoose/Category').default,
    products: require('../models-mongoose/Product').default,
    items: require('../models-mongoose/Item').default}

export const search = async (req: Request, res: Response) => {
    const collection = req.params.collection;
    const query = req.params.query;
    const companyId = req.params.companyId;
    const model = models[collection];

    if (!model) {
        return res.status(400).json({
            message: `No existe búsqueda para la colección ${collection}`
        });
    }

    let regex = new RegExp(query, 'i'); // Expresión regular para búsqueda insensible a mayúsculas

    try {
        let results;

        if (collection === 'products' || collection === 'items') {
            const additionalFilter = collection === 'products' ? { categories: req.body.categories } : { product: req.body.product };
            results = await model.find({ ...additionalFilter, companyId, name: regex });
        } else {
            results = await model.find({ companyId, name: regex });
        }

        res.status(200).json(results);
    } catch (error) {
        res.status(500).json({ message: error });
    }
};
