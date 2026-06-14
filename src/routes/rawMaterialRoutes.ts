import { Router } from 'express';
import {
  createRawMaterial,
  getCompanyRawMaterials,
  getRawMaterial,
  updateRawMaterial,
  deleteRawMaterial,
} from '../controllers/rawMaterialController';

const router = Router();

router.post('/:companyId', createRawMaterial);
router.get('/company/:companyId', getCompanyRawMaterials);
router.get('/:id', getRawMaterial);
router.put('/:id', updateRawMaterial);
router.delete('/:id', deleteRawMaterial);

export default router;
