import { Request, Response } from 'express';
import Promotion from '../models-mongoose/Promotion';
import mongoose from 'mongoose';

// Crear una nueva promoción/cupón
export const createPromotion = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const {
      code,
      description,
      type,
      value,
      minPurchaseAmount,
      startDate,
      endDate,
      usageLimit,
      targetBranches,
      targetCategories,
    } = req.body;

    if (!code || !description || !type || value === undefined || !startDate || !endDate) {
      return res.status(400).json({ ok: false, message: 'Faltan campos obligatorios' });
    }

    const uppercaseCode = code.toUpperCase().trim();

    // Validar si ya existe el código para la misma compañía
    const existingPromo = await Promotion.findOne({ company: companyId, code: uppercaseCode });
    if (existingPromo) {
      return res
        .status(400)
        .json({ ok: false, message: 'Ya existe una promoción activa o inactiva con este código en la compañía' });
    }

    const promotion = new Promotion({
      company: companyId,
      code: uppercaseCode,
      description,
      type,
      value,
      minPurchaseAmount: minPurchaseAmount || 0,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      usageLimit,
      usageCount: 0,
      isActive: true,
      targetBranches: targetBranches || [],
      targetCategories: targetCategories || [],
    });

    await promotion.save();
    return res.status(201).json({ ok: true, promotion });
  } catch (error: any) {
    console.error('Error creating promotion:', error);
    return res.status(500).json({ ok: false, message: 'Error interno del servidor', error: error.message });
  }
};

// Obtener todas las promociones/cupones de una compañía
export const getAllPromotions = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { search = '', branchId } = req.query;

    const query: any = { company: companyId };
    const conditions: any[] = [];

    if (branchId) {
      conditions.push({
        $or: [
          { targetBranches: { $exists: false } },
          { targetBranches: { $size: 0 } },
          { targetBranches: new mongoose.Types.ObjectId(branchId as string) },
        ],
      });
    }

    if (search) {
      conditions.push({
        $or: [{ code: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }],
      });
    }

    if (conditions.length > 0) {
      query.$and = conditions;
    }

    const promotions = await Promotion.find(query).sort({ endDate: -1 });
    return res.status(200).json({ ok: true, promotions });
  } catch (error: any) {
    console.error('Error getting promotions:', error);
    return res.status(500).json({ ok: false, message: 'Error interno del servidor', error: error.message });
  }
};

// Validar un código de descuento para el checkout del POS
export const validateDiscountCode = async (req: Request, res: Response) => {
  try {
    const { companyId, code } = req.params;
    const { ticketTotal = 0, branchId } = req.query;

    if (!code) {
      return res.status(400).json({ ok: false, message: 'Código de descuento no provisto' });
    }

    const promotion = await Promotion.findOne({
      company: companyId,
      code: code.toUpperCase().trim(),
      isActive: true,
    });

    if (!promotion) {
      return res.status(404).json({ ok: false, message: 'Código de descuento inválido o inactivo' });
    }

    // Validar sucursales si aplica
    if (promotion.targetBranches && promotion.targetBranches.length > 0) {
      if (!branchId) {
        return res
          .status(400)
          .json({ ok: false, message: 'Se requiere especificar la sucursal para validar este cupón' });
      }
      const isBranchTargeted = promotion.targetBranches.some((b) => b.toString() === branchId.toString());
      if (!isBranchTargeted) {
        return res.status(400).json({ ok: false, message: 'Este cupón no es válido para esta sucursal' });
      }
    }

    const now = new Date();

    // Validar vigencia de fechas
    if (now < new Date(promotion.startDate)) {
      return res.status(400).json({ ok: false, message: 'La promoción iniciará próximamente' });
    }
    if (now > new Date(promotion.endDate)) {
      return res.status(400).json({ ok: false, message: 'El código de descuento ha expirado' });
    }

    // Validar límite de usos
    if (promotion.usageLimit && promotion.usageCount >= promotion.usageLimit) {
      return res.status(400).json({ ok: false, message: 'El código de descuento ha agotado su cupo límite de usos' });
    }

    // Validar compra mínima
    if (Number(ticketTotal) < promotion.minPurchaseAmount) {
      return res.status(400).json({
        ok: false,
        message: `Monto mínimo de compra insuficiente. Requiere al menos $${promotion.minPurchaseAmount.toFixed(2)}`,
      });
    }

    return res.status(200).json({ ok: true, promotion });
  } catch (error: any) {
    console.error('Error validating promotion code:', error);
    return res.status(500).json({ ok: false, message: 'Error interno del servidor', error: error.message });
  }
};

// Modificar una promoción
export const updatePromotion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      description,
      type,
      value,
      minPurchaseAmount,
      startDate,
      endDate,
      usageLimit,
      isActive,
      targetBranches,
      targetCategories,
    } = req.body;

    const promotion = await Promotion.findById(id);
    if (!promotion) {
      return res.status(404).json({ ok: false, message: 'Promoción no encontrada' });
    }

    if (description !== undefined) promotion.description = description;
    if (type !== undefined) promotion.type = type;
    if (value !== undefined) promotion.value = value;
    if (minPurchaseAmount !== undefined) promotion.minPurchaseAmount = minPurchaseAmount;
    if (startDate !== undefined) promotion.startDate = new Date(startDate);
    if (endDate !== undefined) promotion.endDate = new Date(endDate);
    if (usageLimit !== undefined) promotion.usageLimit = usageLimit;
    if (isActive !== undefined) promotion.isActive = isActive;
    if (targetBranches !== undefined) promotion.targetBranches = targetBranches;
    if (targetCategories !== undefined) promotion.targetCategories = targetCategories;

    await promotion.save();
    return res.status(200).json({ ok: true, promotion });
  } catch (error: any) {
    console.error('Error updating promotion:', error);
    return res.status(500).json({ ok: false, message: 'Error interno del servidor', error: error.message });
  }
};

// Eliminar una promoción físicamente
export const deletePromotion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const promotion = await Promotion.findByIdAndDelete(id);
    if (!promotion) {
      return res.status(404).json({ ok: false, message: 'Promoción no encontrada' });
    }
    return res.status(200).json({ ok: true, message: 'Promoción eliminada con éxito' });
  } catch (error: any) {
    console.error('Error deleting promotion:', error);
    return res.status(500).json({ ok: false, message: 'Error interno del servidor', error: error.message });
  }
};
