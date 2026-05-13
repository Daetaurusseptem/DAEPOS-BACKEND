import express from 'express';
import { getSalesStatistics, getItemsStatistics, getIngredientsStatistics, getTopSellingProductsByWeek, getIngredientsStatisticsByWeek } from '../controllers/statisticsController';

const router = express.Router();

router.get('/saleController', getSalesStatistics);
router.get('/items', getItemsStatistics);
router.get('/ingredients', getIngredientsStatistics);
router.get('/top-selling-products', getTopSellingProductsByWeek);
router.get('/ingredients-statistics', getIngredientsStatisticsByWeek);

export default router;
