import { Request, Response } from 'express';
import PhysicalRegister from '../models-mongoose/PhysicalRegister';

export const createPhysicalRegister = async (req: Request, res: Response) => {
  try {
    const { name, description, companyId } = req.body;
    const newRegister = new PhysicalRegister({
      name,
      description,
      company: companyId
    });
    await newRegister.save();
    res.status(201).json({ ok: true, register: newRegister });
  } catch (error) {
    res.status(500).json({ message: 'Error creating physical register', error });
  }
};

export const getPhysicalRegistersByCompany = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const registers = await PhysicalRegister.find({ company: companyId });
    res.status(200).json({ ok: true, registers });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching physical registers', error });
  }
};

export const updatePhysicalRegister = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await PhysicalRegister.findByIdAndUpdate(id, req.body, { new: true });
    res.status(200).json({ ok: true, register: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error updating physical register', error });
  }
};

export const deletePhysicalRegister = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await PhysicalRegister.findByIdAndDelete(id);
    res.status(200).json({ ok: true, message: 'Register deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting physical register', error });
  }
};
