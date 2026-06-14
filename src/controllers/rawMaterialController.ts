import { Request, Response } from 'express';
import RawMaterial from '../models-mongoose/RawMaterial';
import Company from '../models-mongoose/Company';

// Crear nuevo insumo maestro
export const createRawMaterial = async (req: Request, res: Response) => {
  const { companyId } = req.params;
  try {
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ ok: false, message: 'La compañía no existe' });
    }

    const newRawMaterial = new RawMaterial({
      ...req.body,
      company: companyId,
    });

    const savedRawMaterial = await newRawMaterial.save();
    return res.status(201).json({
      ok: true,
      rawMaterial: savedRawMaterial,
    });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error });
  }
};

// Obtener todos los insumos de una compañía
export const getCompanyRawMaterials = async (req: Request, res: Response) => {
  const { companyId } = req.params;
  try {
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ ok: false, message: 'La compañía no existe' });
    }

    const rawMaterials = await RawMaterial.find({ company: companyId });
    return res.status(200).json({ ok: true, rawMaterials });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error });
  }
};

// Obtener insumo por ID
export const getRawMaterial = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const rawMaterial = await RawMaterial.findById(id);
    if (!rawMaterial) {
      return res.status(404).json({ ok: false, message: 'Insumo no encontrado' });
    }
    return res.status(200).json({ ok: true, rawMaterial });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error });
  }
};

// Actualizar insumo
export const updateRawMaterial = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const updated = await RawMaterial.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) {
      return res.status(404).json({ ok: false, message: 'Insumo no encontrado' });
    }
    return res.status(200).json({ ok: true, rawMaterial: updated });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error });
  }
};

// Eliminar insumo
export const deleteRawMaterial = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const rawMaterial = await RawMaterial.findById(id);
    if (!rawMaterial) {
      return res.status(404).json({ ok: false, message: 'Insumo no encontrado' });
    }

    await RawMaterial.findByIdAndDelete(id);
    return res.status(200).json({ ok: true, message: 'Insumo maestro eliminado con éxito' });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error });
  }
};
