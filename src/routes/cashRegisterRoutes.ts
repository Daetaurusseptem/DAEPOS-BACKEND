
import express from 'express';
import { openCashRegister, closeCashRegister, getCashRegisters, hasOpenCashRegister, getOpenCashRegister, getOpenCashRegisterWithSales, getUserCashRegistersByStartDate, getUserCajasByDate, getCajaDetailsById, addExpense, getActiveRegistersByBranch, getCashRegistersHistory } from '../controllers/cashRegisterController';
import { validarUserCompany, verifyToken } from '../middleware/jwtMiddleware';

const router = express.Router();

//ABRIR CAJA
router.post('/open', verifyToken, openCashRegister);

//REGISTRAR GASTO
router.post('/expense/:id', verifyToken, addExpense);

//CERRAR CAJA
router.post('/close/:id', verifyToken, closeCashRegister);

// MONITOREO Y AUDITORÍA POR SUCURSAL
router.get('/active/branch/:branchId', verifyToken, getActiveRegistersByBranch);
router.get('/history/branch/:branchId', verifyToken, getCashRegistersHistory);

//OBTENER CAJAS CAJA
router.get('/', getCashRegisters);

//OBTENER CAJAS CAJA
router.get('/has-open/:userId', hasOpenCashRegister);


router.get('/open/:userId', getOpenCashRegister);

// Obtener la caja abierta con ventas
router.get('/open-with-sales/:userId', verifyToken, getOpenCashRegisterWithSales);


// Ruta para obtener las cajas abiertas de un usuario filtradas por fecha
router.get('/user/:userId', getUserCashRegistersByStartDate);


// Ruta para obtener todas las cajas de un usuario agrupadas por fechas
router.get('/user/:userId/cajas', verifyToken, getUserCajasByDate);

// Ruta para obtener cajas específicas de un usuario en una fecha específica
router.get('/user/:userId/cajas/:startDate', verifyToken, getUserCashRegistersByStartDate);

// Ruta para obtener los detalles de una caja específica
router.get('/cajas/:cajaId', verifyToken, getCajaDetailsById    );


export default router;
