import express, { Application } from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import cors from 'cors';

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

import statisticsRoutes from '../routes/statisticsRoutes';
import physicalRegisterRoutes from '../routes/physicalRegisterRoutes';
import branchRoutes from '../routes/branchRoutes';
import stockTransferRoutes from '../routes/stockTransferRoutes';
import notificationRoutes from '../routes/notificationRoutes';

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
  }

  private routes(): void {
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
    this.app.use('/api/statistics', statisticsRoutes);
    this.app.use('/api/physical-registers', physicalRegisterRoutes);
    this.app.use('/api/branches', branchRoutes);
    this.app.use('/api/stock-transfers', stockTransferRoutes);
    this.app.use('/api/notifications', notificationRoutes);
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
