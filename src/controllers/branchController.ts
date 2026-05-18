import { Request, Response } from 'express';
import Branch from '../models-mongoose/Branch';

export const createBranch = async (req: Request, res: Response) => {
    try {
        const branch = new Branch(req.body);
        await branch.save();
        res.status(201).json({ ok: true, branch });
    } catch (error) {
        res.status(500).json({ ok: false, message: 'Error creating branch', error });
    }
};

export const getBranchesByCompany = async (req: Request, res: Response) => {
    try {
        const { companyId } = req.params;
        const branches = await Branch.find({ company: companyId }).populate('manager', 'name email');
        res.status(200).json({ ok: true, branches });
    } catch (error) {
        res.status(500).json({ ok: false, message: 'Error fetching branches', error });
    }
};

export const getBranchById = async (req: Request, res: Response) => {
    try {
        const branch = await Branch.findById(req.params.id).populate('company').populate('manager');
        if (!branch) return res.status(404).json({ ok: false, message: 'Branch not found' });
        res.status(200).json({ ok: true, branch });
    } catch (error) {
        res.status(500).json({ ok: false, message: 'Error fetching branch', error });
    }
};

export const updateBranch = async (req: Request, res: Response) => {
    try {
        const branch = await Branch.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!branch) return res.status(404).json({ ok: false, message: 'Branch not found' });
        res.status(200).json({ ok: true, branch });
    } catch (error) {
        res.status(500).json({ ok: false, message: 'Error updating branch', error });
    }
};

export const deleteBranch = async (req: Request, res: Response) => {
    try {
        const branch = await Branch.findByIdAndDelete(req.params.id);
        if (!branch) return res.status(404).json({ ok: false, message: 'Branch not found' });
        res.status(200).json({ ok: true, message: 'Branch deleted' });
    } catch (error) {
        res.status(500).json({ ok: false, message: 'Error deleting branch', error });
    }
};
