import { Request, Response } from 'express';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_DEV_KEY!, { apiVersion: '2023-10-16' });



    // Obtener todos los productos (suscripciones) de Stripe
    export const obtenerProductos = async(req:any, res:any) =>{
        try {
            const stripeResponse = await stripe.products.list();
            res.status(200).json({
                ok:true,
                stripeResponse
            });
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener los productos', error });
        }
    }

    // Obtener los precios de un producto específico
    export const obtenerPreciosDeProducto = async(req:any, res:any) =>{
        try {
            const productId = req.params.id;            
            const precios = await stripe.prices.list({ product: productId });
            res.status(200).json({
                ok:true,
                precios
            });
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener los precios del producto', error });
        }
    }

    // Crear una nueva suscripción
    export const crearSuscripcion = async(req:any, res:any) =>{
        try {
            const { customerId, priceId } = req.body;

            const stripeSubscription = await stripe.subscriptions.create({
                customer: customerId,
                items: [{ price: priceId }],
                expand: ['latest_invoice.payment_intent'],
            });

            if (stripeSubscription.latest_invoice) {
                // Aquí puedes manejar la información de la factura si es necesario
            }

            res.status(201).json({ message: 'Suscripción creada exitosamente', stripeSubscription });
        } catch (error) {
            res.status(500).json({ message: 'Error al crear la suscripción', error });
        }
    }

    export const crearCliente = async(req:Request, res:Response) =>{
        try {
            const { email, name, description } = req.body;

            const customer = await stripe.customers.create({
                email,
                name,
                description
            });

            res.status(201).json({ message: 'Cliente creado exitosamente', customer });
        } catch (error) {
            res.status(500).json({ message: 'Error al crear el cliente', error });
        }
    }

