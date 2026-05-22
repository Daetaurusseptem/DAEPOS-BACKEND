import express, { Application } from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import SystemError from '../models-mongoose/SystemError';
import User from '../models-mongoose/User';
import demoBlocker from '../middleware/demoMiddleware';

import productRoutes from '../routes/productRoutes';
import saleRoutes from '../routes/saleRoutes';
import userRoutes from '../routes/userRoutes';
import authRoutes from '../routes/authRoutes';
import companyRoutes from '../routes/companyRoutes';
import fileUploadRoutes from '../routes/fileUploadRoutes';
import subscriptionRoutes from '../routes/subscriptionRoutes';
import suppliersRoutes from '../routes/suppliersRoutes';
import categoriesRoutes from '../routes/categoryRoutes';
import cashRegisterRoutes from '../routes/cashRegisterRoutes';
import dailySalesRoutes from '../routes/dailySaleRoutes';
import inventoryRoutes from '../routes/inventoryRoutes';
import recipeRoutes from '../routes/recipeRoutes';
import rawMaterialRoutes from '../routes/rawMaterialRoutes';

import statisticsRoutes from '../routes/statisticsRoutes';
import physicalRegisterRoutes from '../routes/physicalRegisterRoutes';
import branchRoutes from '../routes/branchRoutes';
import stockTransferRoutes from '../routes/stockTransferRoutes';
import notificationRoutes from '../routes/notificationRoutes';
import customerRoutes from '../routes/customerRoutes';
import promotionRoutes from '../routes/promotionRoutes';
import sysadminRoutes from '../routes/sysadminRoutes';

export class Server {
  private app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.connectToDatabase();
    this.port = parseInt(process.env.PORT || '3000', 10);

    this.config();
    this.routes();
    this.start();
  }

  private config(): void {
    // Configuración de middlewares
    this.app.use(bodyParser.json({ limit: '50mb' }));
    this.app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
    this.app.use(cors());

    // Servir archivos estáticos del frontend (Producción Monorepo en Render)
    const frontendDist = path.join(__dirname, '../../../frontend/dist/daepoint-pos-frontend');
    const localPublic = path.join(__dirname, '../public');
    this.app.use(express.static(frontendDist));
    this.app.use(express.static(localPublic));
  }

  private routes(): void {
    // Global Demo Blocker Guard to protect write operations from demo accounts
    this.app.use(demoBlocker);

    this.app.use('/api/auth', authRoutes); // Autenticación
    this.app.use('/api/products', productRoutes); // Rutas para productos
    this.app.use('/api/categories', categoriesRoutes); // Rutas para categorias
    this.app.use('/api/sales', saleRoutes); // Rutas para ventas
    this.app.use('/api/users', userRoutes); // Rutas para usuarios
    this.app.use('/api/companies', companyRoutes); // Rutas para compañias
    this.app.use('/api/uploads', fileUploadRoutes); // Rutas para fileUploads
    this.app.use('/api/subs', subscriptionRoutes); // Rutas para stripe subscriptions
    this.app.use('/api/suppliers', suppliersRoutes); // Rutas para proveedores
    this.app.use('/api/cash-registers', cashRegisterRoutes); // Rutas para caja
    this.app.use('/api', dailySalesRoutes); // Añade la nueva ruta
    this.app.use('/api/inventory', inventoryRoutes);

    this.app.use('/api/recipes', recipeRoutes);
    this.app.use('/api/raw-materials', rawMaterialRoutes);
    this.app.use('/api/statistics', statisticsRoutes);
    this.app.use('/api/physical-registers', physicalRegisterRoutes);
    this.app.use('/api/branches', branchRoutes);
    this.app.use('/api/stock-transfers', stockTransferRoutes);
    this.app.use('/api/notifications', notificationRoutes);
    this.app.use('/api/customers', customerRoutes);
    this.app.use('/api/promotions', promotionRoutes);
    this.app.use('/api/sysadmin', sysadminRoutes);

    // SPA routing fallback - serve index.html for non-api routes in production
    this.app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      
      const frontendDist = path.join(__dirname, '../../../frontend/dist/daepoint-pos-frontend');
      const localPublic = path.join(__dirname, '../public');
      const frontendIndex = path.join(frontendDist, 'index.html');
      const localPublicIndex = path.join(localPublic, 'index.html');
      
      res.sendFile(frontendIndex, (err) => {
        if (err) {
          res.sendFile(localPublicIndex, (err2) => {
            if (err2) {
              next();
            }
          });
        }
      });
    });

    // Middleware global de manejo y registro de errores
    this.app.use(async (err: any, req: any, res: any, next: any) => {
      console.error('--- EXCEPCIÓN NO CONTROLADA ---');
      console.error(err);

      try {
        let companyIdObj = undefined;
        if (req.uid) {
          const userObj = await User.findById(req.uid);
          if (userObj && userObj.companyId) {
            companyIdObj = userObj.companyId;
          }
        }

        const newError = new SystemError({
          companyId: companyIdObj,
          route: req.originalUrl || req.url,
          method: req.method,
          errorMessage: err.message || String(err),
          stackTrace: err.stack || 'No stack trace available',
          status: err.status || 500
        });

        await newError.save();
      } catch (logError) {
        console.error('Error al registrar logs en MongoDB:', logError);
      }

      res.status(err.status || 500).json({
        ok: false,
        msg: 'Ha ocurrido un error interno en el servidor.',
        error: err.message || String(err)
      });
    });
  }


  private async connectToDatabase(): Promise<void> {
    try { 
      require('../config/db');
      
    } catch (error) {
      console.error('Unable to connect to the database:', error); 
    }
  }

  private start(): void {
    this.app.listen(this.port, '0.0.0.0', () => {
      console.log(`Server is running on port ${this.port}`);
    });
  }
}
