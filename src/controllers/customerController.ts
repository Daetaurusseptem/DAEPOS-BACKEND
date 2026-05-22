import { Request, Response } from 'express';
import Customer from '../models-mongoose/Customer';
import Sale from '../models-mongoose/Sale';

// Registrar un nuevo cliente
export const createCustomer = async (req: Request, res: Response) => {
    try {
        const { companyId } = req.params;
        const { name, email, phone, cardNumber, rfc } = req.body;

        if (!name) {
            return res.status(400).json({ ok: false, message: 'El nombre es obligatorio' });
        }

        // Validar duplicados de teléfono dentro de la misma compañía
        if (phone) {
            const existingPhone = await Customer.findOne({ company: companyId, phone, isActive: true });
            if (existingPhone) {
                return res.status(400).json({ ok: false, message: 'Ya existe un cliente activo con este número de teléfono' });
            }
        }

        // Validar duplicados de tarjeta física dentro de la misma compañía
        if (cardNumber) {
            const existingCard = await Customer.findOne({ company: companyId, cardNumber, isActive: true });
            if (existingCard) {
                return res.status(400).json({ ok: false, message: 'Ya existe un cliente activo con este número de membresía o tarjeta' });
            }
        }

        const customer = new Customer({
            company: companyId,
            name,
            email,
            phone,
            cardNumber,
            rfc,
            loyaltyPoints: 0,
            tier: 'bronze'
        });

        await customer.save();
        return res.status(201).json({ ok: true, customer });
    } catch (error: any) {
        console.error('Error creating customer:', error);
        return res.status(500).json({ ok: false, message: 'Error interno del servidor', error: error.message });
    }
};

// Obtener todos los clientes de una compañía (con paginación y búsqueda)
export const getAllCustomers = async (req: Request, res: Response) => {
    try {
        const { companyId } = req.params;
        const { search = '', page = 1, limit = 10 } = req.query;

        const query: any = { company: companyId, isActive: true };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { cardNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [customers, total] = await Promise.all([
            Customer.find(query).sort({ name: 1 }).skip(skip).limit(Number(limit)),
            Customer.countDocuments(query)
        ]);

        return res.status(200).json({
            ok: true,
            customers,
            total,
            totalPages: Math.ceil(total / Number(limit)),
            currentPage: Number(page)
        });
    } catch (error: any) {
        console.error('Error getting all customers:', error);
        return res.status(500).json({ ok: false, message: 'Error interno del servidor', error: error.message });
    }
};

// Búsqueda rápida de clientes para el checkout del POS
export const searchCustomers = async (req: Request, res: Response) => {
    try {
        const { companyId } = req.params;
        const { term = '' } = req.query;

        if (!term) {
            return res.status(200).json({ ok: true, customers: [] });
        }

        // Búsqueda ágil por teléfono, membresía o coincidencia de nombre
        const customers = await Customer.find({
            company: companyId,
            isActive: true,
            $or: [
                { phone: { $regex: term, $options: 'i' } },
                { cardNumber: { $regex: term, $options: 'i' } },
                { name: { $regex: term, $options: 'i' } }
            ]
        }).limit(10);

        return res.status(200).json({ ok: true, customers });
    } catch (error: any) {
        console.error('Error searching customers:', error);
        return res.status(500).json({ ok: false, message: 'Error interno del servidor', error: error.message });
    }
};

// Detalles del cliente con su historial de compras
export const getCustomerById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const customer = await Customer.findById(id);
        if (!customer) {
            return res.status(404).json({ ok: false, message: 'Cliente no encontrado' });
        }

        // Buscar compras históricas vinculadas
        const sales = await Sale.find({ customer: id })
            .sort({ date: -1 })
            .populate('branch', 'name')
            .populate('user', 'name')
            .limit(20);

        return res.status(200).json({ ok: true, customer, sales });
    } catch (error: any) {
        console.error('Error getting customer details:', error);
        return res.status(500).json({ ok: false, message: 'Error interno del servidor', error: error.message });
    }
};

// Modificar datos del cliente y ajuste de puntos manual
export const updateCustomer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, email, phone, cardNumber, rfc, loyaltyPoints, tier } = req.body;

        const customer = await Customer.findById(id);
        if (!customer) {
            return res.status(404).json({ ok: false, message: 'Cliente no encontrado' });
        }

        if (name) customer.name = name;
        if (email !== undefined) customer.email = email;
        if (phone !== undefined) customer.phone = phone;
        if (cardNumber !== undefined) customer.cardNumber = cardNumber;
        if (rfc !== undefined) customer.rfc = rfc;
        if (loyaltyPoints !== undefined) customer.loyaltyPoints = loyaltyPoints;
        if (tier !== undefined) customer.tier = tier;

        await customer.save();
        return res.status(200).json({ ok: true, customer });
    } catch (error: any) {
        console.error('Error updating customer:', error);
        return res.status(500).json({ ok: false, message: 'Error interno del servidor', error: error.message });
    }
};

// Desactivar un cliente (eliminación lógica)
export const deleteCustomer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const customer = await Customer.findById(id);
        if (!customer) {
            return res.status(404).json({ ok: false, message: 'Cliente no encontrado' });
        }

        customer.isActive = false;
        await customer.save();

        return res.status(200).json({ ok: true, message: 'Cliente desactivado con éxito' });
    } catch (error: any) {
        console.error('Error deleting customer:', error);
        return res.status(500).json({ ok: false, message: 'Error interno del servidor', error: error.message });
    }
};
