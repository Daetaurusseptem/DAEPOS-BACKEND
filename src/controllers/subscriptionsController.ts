import { Request, Response } from 'express';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_DEV_KEY!, { apiVersion: '2023-10-16' });

import SubscriptionPlan from '../models-mongoose/SubscriptionPlan';

// Obtener todos los productos (suscripciones) de Stripe activos
export const obtenerProductos = async(req:any, res:any) =>{
    try {
        const stripeResponse = await stripe.products.list({ active: true, expand: ['data.default_price'] });
        const dbPlans = await SubscriptionPlan.find({ isActive: true });

        const productosConLimites = stripeResponse.data.map((prod: any) => {
            const dbPlan = dbPlans.find(p => p.stripeProductId === prod.id);
            if (dbPlan) {
                prod.metadata = {
                    ...prod.metadata,
                    maxBranches: dbPlan.maxBranches.toString(),
                    maxUsers: dbPlan.maxUsers.toString(),
                    maxActiveRegisters: dbPlan.maxActiveRegisters.toString()
                };
            }
            return prod;
        });

        res.status(200).json({
            ok:true,
            productos: productosConLimites
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


import Company from '../models-mongoose/Company';
import User from '../models-mongoose/User';

export const createCheckoutSession = async (req: any, res: Response) => {
  try {
    const { priceId } = req.body;
    const companyId = req.uid ? (await User.findById(req.uid))?.companyId : req.body.companyId;
    const company = await Company.findById(companyId);

    if (!company) return res.status(404).json({ ok: false, msg: 'Empresa no encontrada' });

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: company._id.toString(),
      success_url: `${process.env.FRONTEND_URL}/dashboard/admin/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard/admin/billing?canceled=true`
    };

    if (company.stripeCustomerId) {
      sessionConfig.customer = company.stripeCustomerId;
    } else {
      sessionConfig.customer_email = company.email;
    }

    // Crear session de Stripe
    const session = await stripe.checkout.sessions.create(sessionConfig);

    res.status(200).json({ ok: true, url: session.url });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al crear la sesión de pago', error });
  }
};

export const createCustomerPortalSession = async (req: any, res: Response) => {
  try {
    const companyId = req.uid ? (await User.findById(req.uid))?.companyId : req.body.companyId;
    const company = await Company.findById(companyId);

    if (!company) return res.status(404).json({ ok: false, msg: 'Empresa no encontrada' });
    if (!company.stripeCustomerId) {
      return res.status(400).json({ ok: false, msg: 'La empresa no tiene un cliente de Stripe asociado' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: company.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/dashboard/admin/billing`
    });

    res.status(200).json({ ok: true, url: session.url });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al crear la sesión del portal', error });
  }
};

import { enforceDowngradeLimits } from '../helpers/enforceDowngradeLimits';

export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Helper local para sincronizar el Snapshot del Plan
  const syncPlanSnapshot = async (companyId: string, subscriptionId: string) => {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const stripeProductId = sub.items.data[0]?.price.product as string;
      if (stripeProductId) {
        const plan = await SubscriptionPlan.findOne({ stripeProductId });
        if (plan) {
          const company = await Company.findById(companyId);
          if (company) {
            company.planId = plan._id.toString();
            company.currentLimits = {
              maxBranches: plan.maxBranches,
              maxUsers: plan.maxUsers,
              maxActiveRegisters: plan.maxActiveRegisters,
              features: plan.features
            };
            await company.save();
            await enforceDowngradeLimits(companyId);
          }
        }
      }
    } catch (error) {
      console.error('[SaaS] Error sincronizando snapshot en webhook:', error);
    }
  };

  // Manejar el evento
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = session.client_reference_id;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (companyId) {
        await Company.findByIdAndUpdate(companyId, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: 'active'
        });
        await syncPlanSnapshot(companyId, subscriptionId);
      }
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const company = await Company.findOne({ stripeSubscriptionId: sub.id });
      if (company) {
        await syncPlanSnapshot(company._id.toString(), sub.id);
      }
      break;
    }
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      await Company.findOneAndUpdate(
        { stripeSubscriptionId: subscriptionId },
        { 
          subscriptionStatus: 'active',
          currentPeriodEnd: new Date(sub.current_period_end * 1000)
        }
      );
      break;
    }
    case 'invoice.payment_failed':
    case 'customer.subscription.deleted': {
      const invoiceOrSub = event.data.object as any;
      const subscriptionId = invoiceOrSub.subscription || invoiceOrSub.id;
      await Company.findOneAndUpdate(
        { stripeSubscriptionId: subscriptionId },
        { subscriptionStatus: event.type === 'invoice.payment_failed' ? 'past_due' : 'canceled' }
      );
      break;
    }
  }

  res.json({ received: true });
};

export const obtenerFacturasEmpresa = async (req: any, res: Response) => {
  try {
    const { companyId } = req.params;
    const company = await Company.findById(companyId);

    if (!company) return res.status(404).json({ ok: false, msg: 'Empresa no encontrada' });

    if (!company.stripeCustomerId) {
      return res.status(200).json({ ok: true, invoices: [] });
    }

    const invoices = await stripe.invoices.list({ customer: company.stripeCustomerId, limit: 20 });
    res.status(200).json({ ok: true, invoices: invoices.data });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al obtener facturas de Stripe', error });
  }
};
