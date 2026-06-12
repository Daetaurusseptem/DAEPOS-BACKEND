import { Request, Response } from 'express';
import mongoose from 'mongoose';
import ManualPayment from '../models-mongoose/ManualPayment';
import Company from '../models-mongoose/Company';
import SubscriptionPlan from '../models-mongoose/SubscriptionPlan';
import { enforceDowngradeLimits } from '../helpers/enforceDowngradeLimits';
import nodemailer from 'nodemailer';
import moment from 'moment';

const sendApprovalEmail = async (email: string, companyName: string, endDate: Date) => {
  if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASSWORD) return;
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      }
    });

    const formattedDate = moment(endDate).format('DD/MM/YYYY');
    await transporter.sendMail({
      from: `"DaePoint SaaS" <${process.env.NODEMAILER_EMAIL}>`,
      to: email,
      subject: '¡Tu suscripción está activa!',
      html: `
        <h2>¡Hola ${companyName}!</h2>
        <p>Tu reporte de pago ha sido revisado y <b>aprobado</b>.</p>
        <p>Tu plataforma ya cuenta con todos los accesos habilitados hasta el <b>${formattedDate}</b>.</p>
        <br>
        <p>¡Gracias por confiar en nosotros!</p>
      `
    });
  } catch (error) {
    console.error('Error enviando correo:', error);
  }
};

export const createManualPayment = async (req: any, res: Response) => {
  try {
    const { amount, planRequested } = req.body;
    const companyId = req.uidCompany;
    const userId = req.uid;

    const payment = new ManualPayment({
      company: companyId,
      uploadedBy: userId,
      amount,
      planRequested: planRequested || undefined
    });

    await payment.save();
    res.json({ ok: true, payment });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al crear reporte de pago' });
  }
};

export const getMyPayments = async (req: any, res: Response) => {
  try {
    const companyId = req.uidCompany;
    const payments = await ManualPayment.find({ company: companyId })
      .populate('planRequested', 'name')
      .sort({ createdAt: -1 });
    res.json({ ok: true, payments });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al obtener historial' });
  }
};

export const getAllPayments = async (req: any, res: Response) => {
  try {
    const status = req.query.status;
    const company = req.query.companyId;
    const filter: any = {};
    if (status) filter.status = status;
    if (company) filter.company = company;
    const payments = await ManualPayment.find(filter)
      .populate('company', 'name email')
      .populate('uploadedBy', 'name')
      .populate('planRequested', 'name')
      .sort({ createdAt: -1 });
    res.json({ ok: true, payments });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al obtener pagos' });
  }
};

export const approvePayment = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { newEndDate, assignedPlanId, adminNotes, reminderDate, customMaxBranches, customMaxUsers, customMaxRegisters } = req.body;

    const payment = await ManualPayment.findById(id).populate('company');
    if (!payment) return res.status(404).json({ ok: false, msg: 'Pago no encontrado' });

    payment.status = 'approved';
    payment.reviewedBy = new mongoose.Types.ObjectId(req.uid);
    payment.reviewedAt = new Date();
    if (adminNotes) payment.adminNotes = adminNotes;
    if (reminderDate) payment.reminderDate = new Date(reminderDate);

    const company = await Company.findById(payment.company);
    if (!company) return res.status(404).json({ ok: false, msg: 'Compañía no encontrada' });

    let limitsToApply: any = { ...company.currentLimits };
    if (assignedPlanId) {
      const plan = await SubscriptionPlan.findById(assignedPlanId);
      if (plan) {
        limitsToApply = {
          maxBranches: plan.maxBranches,
          maxUsers: plan.maxUsers,
          maxActiveRegisters: plan.maxActiveRegisters,
          features: plan.features
        };
        company.planId = plan._id;
        company.planType = plan.name;
      }
    }

    if (customMaxBranches !== undefined) limitsToApply.maxBranches = customMaxBranches;
    if (customMaxUsers !== undefined) limitsToApply.maxUsers = customMaxUsers;
    if (customMaxRegisters !== undefined) limitsToApply.maxActiveRegisters = customMaxRegisters;

    company.currentLimits = limitsToApply;
    company.customLimitsOverrides = limitsToApply;
    company.currentPeriodEnd = newEndDate ? new Date(newEndDate) : moment().add(1, 'month').toDate();
    company.isActive = true;
    company.subscriptionStatus = 'manual';
    
    if (!company.SubscriptionHistory) company.SubscriptionHistory = [];
    company.SubscriptionHistory.push({
      month: moment().format('YYYY-MM'),
      cutoffDate: company.currentPeriodEnd,
      status: 'Active',
      amountPaid: payment.amount,
      paymentMethod: 'Manual',
      paymentReference: id
    });

    await company.save();
    await payment.save();

    await enforceDowngradeLimits(company._id.toString());

    if (company.email) {
      await sendApprovalEmail(company.email, company.name, company.currentPeriodEnd);
    }

    res.json({ ok: true, payment, company });
  } catch (error) {
    console.error('Error aprobando:', error);
    res.status(500).json({ ok: false, msg: 'Error al aprobar pago', error });
  }
};

export const rejectPayment = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;

    const payment = await ManualPayment.findById(id);
    if (!payment) return res.status(404).json({ ok: false, msg: 'Pago no encontrado' });

    payment.status = 'rejected';
    payment.reviewedBy = new mongoose.Types.ObjectId(req.uid);
    payment.reviewedAt = new Date();
    payment.adminNotes = adminNotes;
    
    await payment.save();
    res.json({ ok: true, payment });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al rechazar pago' });
  }
};
