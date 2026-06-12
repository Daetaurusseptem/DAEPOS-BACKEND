import { Router } from 'express';
import { 
  createInventoryItem, 
  getInventoryByCompany,
  updateInventoryItem,
  deleteInventoryItem,
  processSale,
  getInventoryByCategory,
  getInventoryItemById,
  getStockByProductAndBranch,
  getRecipeStockDetails
} from '../controllers/inventoryController';
import { verifyToken as validarJWT } from '../middleware/jwtMiddleware';

const router = Router();

router.use(validarJWT);

router.get('/by-category/:companyId', getInventoryByCategory);
router.get('/company/:companyId', getInventoryByCompany);
router.get('/:id', getInventoryItemById);
router.post('/', createInventoryItem);
router.put('/:id', updateInventoryItem);
router.delete('/:id', deleteInventoryItem);
router.post('/process-sale', processSale);
router.get('/stock/:companyId/:branchId/:productId', getStockByProductAndBranch);
router.get('/recipe-stock/:productId/:branchId', getRecipeStockDetails);

export default router;
