import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import moment from 'moment';

// Importar Modelos
import User from '../models-mongoose/User';
import Company from '../models-mongoose/Company';
import Category from '../models-mongoose/Category';
import Product from '../models-mongoose/Product';
import InventoryItem from '../models-mongoose/InventoryItem';
import Supplier from '../models-mongoose/Supplier';
import PhysicalRegister from '../models-mongoose/PhysicalRegister';
import CashRegister from '../models-mongoose/CashRegister';
import Sale from '../models-mongoose/Sale';
import Branch from '../models-mongoose/Branch';
import StockTransfer from '../models-mongoose/StockTransfer';
import RawMaterial from '../models-mongoose/RawMaterial';
import Recipe from '../models-mongoose/Recipe';
import Customer from '../models-mongoose/Customer';
import Promotion from '../models-mongoose/Promotion';
import PendingOrder from '../models-mongoose/PendingOrder';
import GlobalSettings from '../models-mongoose/GlobalSettings';
import SubscriptionPlan from '../models-mongoose/SubscriptionPlan';
import ManualPayment from '../models-mongoose/ManualPayment';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/DaePoint';

async function seedV3() {
  try {
    console.log('🚀 Iniciando SUPER SEED V3 (Explosión Total)...');
    await mongoose.connect(MONGO_URI);

    console.log('🧹 Limpiando base de datos antigua...');
    await Promise.all([
      User.deleteMany({}), Company.deleteMany({}), Category.deleteMany({}),
      Product.deleteMany({}), InventoryItem.deleteMany({}), Supplier.deleteMany({}),
      PhysicalRegister.deleteMany({}), CashRegister.deleteMany({}), Sale.deleteMany({}),
      Branch.deleteMany({}), StockTransfer.deleteMany({}), RawMaterial.deleteMany({}),
      Recipe.deleteMany({}), Customer.deleteMany({}), Promotion.deleteMany({}),
      PendingOrder.deleteMany({}), GlobalSettings.deleteMany({}), SubscriptionPlan.deleteMany({}),
      ManualPayment.deleteMany({})
    ]);

    const hashedPassword = await bcrypt.hash('admin123', 10);

    // ==========================================
    // 1. CONFIGURACIÓN GLOBAL (SYSADMIN)
    // ==========================================
    console.log('🌍 Generando configuraciones globales y planes de suscripción...');

    const sysadmin = await new User({
      username: 'sysadmin', email: 'sysadmin@daepoint.com', password: hashedPassword,
      name: 'Super Admin DaePoint', role: 'sysadmin'
    }).save();

    await new GlobalSettings({
      bankAccounts: [
        { bankName: 'Banco BBVA', accountNumber: '0123456789', ownerName: 'DaePoint SA de CV' },
        { bankName: 'Stripe CLABE', accountNumber: '9876543210', ownerName: 'Pagos Digitales' }
      ],
      generalNotes: 'Envía tu comprobante con el ID de tu empresa en el concepto.'
    }).save();

    const planBasic = await new SubscriptionPlan({
      name: 'Básico', stripeProductId: 'prod_basic_123',
      maxBranches: 1, maxUsers: 3, maxActiveRegisters: 1, features: ['Ventas Retail', 'Inventario Básico']
    }).save();

    const planPro = await new SubscriptionPlan({
      name: 'Pro', stripeProductId: 'prod_pro_123',
      maxBranches: 3, maxUsers: 10, maxActiveRegisters: 5, features: ['Ventas Hospitalidad', 'KDS', 'Multisucursal']
    }).save();

    const planEnterprise = await new SubscriptionPlan({
      name: 'Enterprise', stripeProductId: 'prod_enterprise_123',
      maxBranches: 10, maxUsers: 50, maxActiveRegisters: 20, features: ['Todo Incluido', 'Soporte 24/7']
    }).save();

    const planManual = await new SubscriptionPlan({
      name: 'Plan Corporativo B2B', stripeProductId: 'prod_manual_123', isCustom: true,
      maxBranches: 99, maxUsers: 99, maxActiveRegisters: 99, features: ['Custom Limits']
    }).save();

    // ==========================================
    // 2. EMPRESAS (MULTITENANT REAL)
    // ==========================================
    console.log('🏢 Generando ecosistema de 4 Empresas (Activas B2B, Stripe, Trial, Cancelada)...');

    // Empresa A: Activa B2B (Foco principal del Seed)
    const companyA = await new Company({
      name: 'Grupo Alsea B2B S.A.', description: 'Consorcio Multigiro (Retail + Hospitality)',
      address: 'Torre Mayor Piso 42', tel: '555-1000', email: 'ceo@alsea.com',
      adminId: sysadmin._id, maxActiveRegisters: 20, maxCashLimit: 50000,
      planId: planManual._id, planType: 'Plan Corporativo B2B', isActive: true,
      subscriptionStatus: 'manual', manualOverride: true, currentPeriodEnd: moment().add(1, 'month').toDate(),
      currentLimits: { maxBranches: 99, maxUsers: 99, maxActiveRegisters: 99, features: ['Todo Incluido'] }
    }).save();

    const ceoA = await new User({
      username: 'ceo_alsea', email: 'ceo@alsea.com', password: hashedPassword,
      name: 'Arturo (CEO Alsea)', role: 'companyAdmin', companyId: companyA._id
    }).save();
    await Company.findByIdAndUpdate(companyA._id, { adminId: ceoA._id });

    // Historial de Pagos Manuales (Empresa A)
    await new ManualPayment({
      company: companyA._id, uploadedBy: ceoA._id, amount: 25000, planRequested: planManual._id,
      proofImageUrl: 'https://via.placeholder.com/300?text=Transferencia+BBVA',
      status: 'approved', reviewedBy: sysadmin._id, reviewedAt: new Date(),
      adminNotes: 'Pago anual liquidado. Excelente cliente.'
    }).save();

    await new ManualPayment({
      company: companyA._id, uploadedBy: ceoA._id, amount: 5000, planRequested: planManual._id,
      proofImageUrl: 'https://via.placeholder.com/300?text=Anticipo',
      status: 'rejected', reviewedBy: sysadmin._id, reviewedAt: new Date(Date.now() - 864000000),
      adminNotes: 'El pago rebotó, se requiere nuevo comprobante.'
    }).save();

    // Empresa B: Activa Stripe
    const companyB = await new Company({
      name: 'Tiendas OXXO Lite', email: 'admin@oxxo.com', planId: planPro._id, planType: 'Pro', isActive: true,
      subscriptionStatus: 'active', stripeSubscriptionId: 'sub_stripe_123', stripeCustomerId: 'cus_stripe_123',
      currentPeriodEnd: moment().add(15, 'days').toDate(), adminId: sysadmin._id
    }).save();

    const ceoB = await new User({
      username: 'ceo_oxxo', email: 'admin@oxxo.com', password: hashedPassword, name: 'CEO Oxxo', role: 'companyAdmin', companyId: companyB._id
    }).save();
    await Company.findByIdAndUpdate(companyB._id, { adminId: ceoB._id });

    // Empresa C: Trialing
    const companyC = await new Company({
      name: 'Boutique Floral', email: 'hola@floral.com', planId: planBasic._id, planType: 'Básico', isActive: true,
      subscriptionStatus: 'trialing', currentPeriodEnd: moment().add(3, 'days').toDate(), adminId: sysadmin._id
    }).save();

    const ceoC = await new User({
      username: 'ceo_floral', email: 'hola@floral.com', password: hashedPassword, name: 'CEO Floral', role: 'companyAdmin', companyId: companyC._id
    }).save();
    await Company.findByIdAndUpdate(companyC._id, { adminId: ceoC._id });

    // Empresa D: Cancelada / Past Due
    const companyD = await new Company({
      name: 'Kiosko Fallido', email: 'adios@kiosko.com', planId: planBasic._id, planType: 'Básico', isActive: false,
      subscriptionStatus: 'past_due', currentPeriodEnd: moment().subtract(10, 'days').toDate(), adminId: sysadmin._id
    }).save();

    const ceoD = await new User({
      username: 'ceo_kiosko', email: 'adios@kiosko.com', password: hashedPassword, name: 'CEO Kiosko', role: 'companyAdmin', companyId: companyD._id
    }).save();
    await Company.findByIdAndUpdate(companyD._id, { adminId: ceoD._id });


    // ==========================================
    // 3. SUCURSALES (EMPRESA A)
    // ==========================================
    console.log('🏪 Generando Sucursales para la Empresa Principal...');

    const branchRetail = await new Branch({
      name: 'SuperMercado Express', address: 'Av. Las Palmas 12', tel: '555-2001',
      email: 'express@alsea.com', company: companyA._id, saleType: 'retail'
    }).save();

    const branchHospitality = await new Branch({
      name: 'Café & Deli Fast-Casual', address: 'Plaza Central Local 5', tel: '555-2002',
      email: 'deli@alsea.com', company: companyA._id, saleType: 'hospitality',
      kitchenSettings: { enableKitchenModule: true, bypassKitchenDoubleCheck: false },
      loyaltySettings: { enabled: true, pointsEarnRate: 10, pointsRedeemRate: 1 } 
    }).save();

    const branchMixed = await new Branch({
      name: 'Mega Hipermercado', address: 'Av. Revolución 99', tel: '555-3003',
      email: 'mega@alsea.com', company: companyA._id, saleType: 'retail',
      kitchenSettings: { enableKitchenModule: true, bypassKitchenDoubleCheck: true }
    }).save();


    // ==========================================
    // 4. USUARIOS (EMPRESA A)
    // ==========================================
    console.log('👨‍💼 Generando Personal (Gerentes, Cajeros, Cocineros)...');

    const managerHosp = await new User({
      username: 'gerente_hosp', email: 'ghosp@alsea.com', password: hashedPassword,
      name: 'Gerente Hospitality', role: 'admin', companyId: companyA._id, branch: branchHospitality._id
    }).save();
    await Branch.findByIdAndUpdate(branchHospitality._id, { manager: managerHosp._id });

    const cashierRetail = await new User({
      username: 'cajero_retail', email: 'cajero1@express.com', password: hashedPassword,
      name: 'Cajero Retail (Escáner)', role: 'user', companyId: companyA._id, branch: branchRetail._id
    }).save();

    const cashierHosp1 = await new User({
      username: 'cajero_hosp', email: 'cajero1@deli.com', password: hashedPassword,
      name: 'Cajero Hospitality (Touch)', role: 'user', companyId: companyA._id, branch: branchHospitality._id
    }).save();

    const cashierHosp2 = await new User({
      username: 'cajero_hosp2', email: 'cajero2@deli.com', password: hashedPassword,
      name: 'Cajero Secundario', role: 'user', companyId: companyA._id, branch: branchHospitality._id
    }).save();

    const chefHosp = await new User({
      username: 'chef_hosp', email: 'chef@deli.com', password: hashedPassword,
      name: 'Chef Ejecutivo (KDS)', role: 'kitchen', companyId: companyA._id, branch: branchHospitality._id
    }).save();

    // Cajero Despedido
    await new User({
      username: 'cajero_malo', email: 'ladron@alsea.com', password: hashedPassword,
      name: 'Cajero Despedido', role: 'user', companyId: companyA._id, branch: branchRetail._id,
      active: false, deactivationReason: 'Faltante constante en caja fuerte.'
    }).save();


    // ==========================================
    // 5. CRM Y PROMOCIONES (EMPRESA A)
    // ==========================================
    console.log('👥 Generando CRM de Clientes...');
    const customerBronze = await new Customer({
      company: companyA._id, name: 'Juan Pérez', email: 'juan@mail.com', phone: '5550001111',
      loyaltyPoints: 50, tier: 'bronze', totalSpent: 800, salesCount: 3
    }).save();

    const customerSilver = await new Customer({
      company: companyA._id, name: 'María Gómez', email: 'maria@mail.com', phone: '5550002222',
      loyaltyPoints: 350, tier: 'silver', totalSpent: 3500, salesCount: 12
    }).save();

    const customerGold = await new Customer({
      company: companyA._id, name: 'Roberto Díaz', email: 'roberto@mail.com', phone: '5550003333',
      loyaltyPoints: 1200, tier: 'gold', totalSpent: 15000, salesCount: 45
    }).save();

    await new Promotion({
      company: companyA._id, code: 'VERANO20', description: '20% de descuento en verano',
      type: 'percentage', value: 20, isActive: true, usageLimit: 100, usageCount: 5,
      startDate: new Date(Date.now() - 864000000), endDate: new Date(Date.now() + 864000000)
    }).save();


    // ==========================================
    // 6. CATÁLOGO MASIVO
    // ==========================================
    console.log('📦 Generando Catálogo Retail Masivo (40+ items)...');
    
    const catBebidas = await new Category({ name: 'Bebidas Embotelladas', company: companyA._id }).save();
    const catSnacks = await new Category({ name: 'Snacks', company: companyA._id }).save();
    const catLacteos = await new Category({ name: 'Lácteos', company: companyA._id }).save();
    const catLimpieza = await new Category({ name: 'Limpieza', company: companyA._id }).save();
    const catComida = await new Category({ name: 'Comida Preparada', company: companyA._id }).save();
    const catPostres = await new Category({ name: 'Postres', company: companyA._id }).save();

    const supplierNacional = await new Supplier({
      name: 'Proveedor Nacional S.A.', company: companyA._id, contactInfo: { email: 'ventas@provnacional.com', phone: '555-9999', address: 'Bodega 1' }
    }).save();

    const supplierPremium = await new Supplier({
      name: 'Alimentos Premium Corp', company: companyA._id, contactInfo: { email: 'premium@food.com', phone: '555-8888', address: 'Bodega 2' }
    }).save();

    const retailProducts: any[] = [];
    const retailNames = ['Cola', 'Agua', 'Jugo', 'Cerveza', 'Papas', 'Cacahuates', 'Galletas', 'Chocolate', 'Leche', 'Queso', 'Yogurt', 'Cloro', 'Detergente', 'Jabón'];
    
    for (let i = 0; i < 40; i++) {
      const type = retailNames[i % retailNames.length];
      const p = await new Product({
        name: `${type} Marca ${i}`, brand: `Brand${i}`, isComposite: false, sku: `SKU-${1000+i}`,
        supplier: supplierNacional._id, categories: [i % 2 === 0 ? catBebidas._id : catSnacks._id], company: companyA._id
      }).save();
      retailProducts.push(p);

      // Inventario en Retail Branch
      await new InventoryItem({
        name: p.name, company: companyA._id, branch: branchRetail._id, product: p._id,
        stock: Math.floor(Math.random() * 200) + 10, costPrice: 10 + (i % 5), sellingPrice: 20 + (i % 10), measurement: 'unit', supplier: supplierNacional._id
      }).save();

      // Inventario en Mixed Branch
      await new InventoryItem({
        name: p.name, company: companyA._id, branch: branchMixed._id, product: p._id,
        stock: Math.floor(Math.random() * 500) + 50, costPrice: 9 + (i % 5), sellingPrice: 19 + (i % 10), measurement: 'unit', supplier: supplierNacional._id
      }).save();
    }

    console.log('🥩 Generando Insumos Maestros y Recetas Complejas (Hospitality)...');
    
    const rmCarne = await new RawMaterial({ name: 'Carne Molida Premium', company: companyA._id, measurementUnit: 'g' }).save();
    const rmPan = await new RawMaterial({ name: 'Pan de Hamburguesa', company: companyA._id, measurementUnit: 'unit' }).save();
    const rmQueso = await new RawMaterial({ name: 'Queso Cheddar', company: companyA._id, measurementUnit: 'unit' }).save();
    const rmCafeG = await new RawMaterial({ name: 'Café Grano', company: companyA._id, measurementUnit: 'g' }).save();
    const rmLeche = await new RawMaterial({ name: 'Leche Deslactosada', company: companyA._id, measurementUnit: 'ml' }).save();
    const rmTomate = await new RawMaterial({ name: 'Tomate Bola', company: companyA._id, measurementUnit: 'unit' }).save();

    await new InventoryItem({ name: rmCarne.name, company: companyA._id, branch: branchHospitality._id, rawMaterial: rmCarne._id, stock: 15000, costPrice: 0.1, measurement: 'g', supplier: supplierPremium._id }).save();
    await new InventoryItem({ name: rmPan.name, company: companyA._id, branch: branchHospitality._id, rawMaterial: rmPan._id, stock: 500, costPrice: 5, measurement: 'unit', supplier: supplierPremium._id }).save();
    await new InventoryItem({ name: rmQueso.name, company: companyA._id, branch: branchHospitality._id, rawMaterial: rmQueso._id, stock: 1000, costPrice: 2, measurement: 'unit', supplier: supplierPremium._id }).save();

    const recetaBurger = await new Recipe({
      name: 'Receta Burger Doble', description: 'Hamburguesa con doble carne', company: companyA._id,
      sizes: [
        {
          name: 'Único', priceModifier: 0,
          ingredients: [{ ingredient: rmCarne._id, quantity: 300 }, { ingredient: rmPan._id, quantity: 1 }, { ingredient: rmQueso._id, quantity: 2 }, { ingredient: rmTomate._id, quantity: 0.5 }]
        }
      ]
    }).save();

    const recetaCafe = await new Recipe({
      name: 'Receta Capuccino', description: 'Capuccino tradicional', company: companyA._id,
      sizes: [
        { name: 'Grande', priceModifier: 15, ingredients: [{ ingredient: rmCafeG._id, quantity: 20 }, { ingredient: rmLeche._id, quantity: 250 }] },
        { name: 'Chico', priceModifier: 0, ingredients: [{ ingredient: rmCafeG._id, quantity: 10 }, { ingredient: rmLeche._id, quantity: 150 }] }
      ]
    }).save();

    const pBurger = await new Product({
      name: 'Hamburguesa Doble Queso', brand: 'Deli House', isComposite: true, sku: 'H-001',
      categories: [catComida._id], company: companyA._id, recipe: recetaBurger._id, price: 120
    }).save();

    const pCafe = await new Product({
      name: 'Capuccino Caliente', brand: 'Deli House', isComposite: true, sku: 'C-001',
      categories: [catBebidas._id], company: companyA._id, recipe: recetaCafe._id, price: 45
    }).save();

    await new InventoryItem({ name: pBurger.name, company: companyA._id, branch: branchHospitality._id, product: pBurger._id, stock: 0, costPrice: 39, sellingPrice: 120, measurement: 'unit', supplier: supplierPremium._id }).save();
    await new InventoryItem({ name: pCafe.name, company: companyA._id, branch: branchHospitality._id, product: pCafe._id, stock: 0, costPrice: 9, sellingPrice: 45, measurement: 'unit', supplier: supplierPremium._id }).save();


    // ==========================================
    // 7. TRASPASOS DE INVENTARIO
    // ==========================================
    console.log('🔄 Generando Traspasos...');
    await new StockTransfer({
      company: companyA._id, product: retailProducts[0]._id, fromBranch: branchMixed._id, toBranch: branchRetail._id,
      quantity: 50, status: 'completed', createdBy: ceoA._id, notes: 'Apoyo a sucursal express'
    }).save();

    await new StockTransfer({
      company: companyA._id, product: retailProducts[1]._id, fromBranch: branchRetail._id, toBranch: branchHospitality._id,
      quantity: 10, status: 'pending', createdBy: cashierRetail._id, notes: 'Falta agua embotellada en Deli'
    }).save();


    // ==========================================
    // 8. CAJAS FÍSICAS Y SESIONES
    // ==========================================
    console.log('💸 Creando Cajas Físicas y Sesiones Abiertas/Cerradas...');
    const physRegRetail = await new PhysicalRegister({ name: 'Caja 1 Express', company: companyA._id, branch: branchRetail._id }).save();
    const physRegHosp1 = await new PhysicalRegister({ name: 'Touch POS 1 Deli', company: companyA._id, branch: branchHospitality._id }).save();
    const physRegHosp2 = await new PhysicalRegister({ name: 'Touch POS 2 Deli', company: companyA._id, branch: branchHospitality._id }).save();

    const sessionOpenHosp1 = await new CashRegister({
      user: cashierHosp1._id, physicalRegister: physRegHosp1._id, company: companyA._id, branch: branchHospitality._id,
      initialAmount: 1000, expectedAmount: 1000, closed: false, startDate: new Date(Date.now() - 3600000), // Hace 1 hora
      payments: { cash: 0, credit: 0, debit: 0 }, expenses: [], sales: []
    }).save();

    const sessionOpenHosp2 = await new CashRegister({
      user: cashierHosp2._id, physicalRegister: physRegHosp2._id, company: companyA._id, branch: branchHospitality._id,
      initialAmount: 500, expectedAmount: 500, closed: false, startDate: new Date(Date.now() - 7200000), // Hace 2 horas
      payments: { cash: 0, credit: 0, debit: 0 }, expenses: [], sales: []
    }).save();

    const sessionClosedRetail = await new CashRegister({
      user: cashierRetail._id, physicalRegister: physRegRetail._id, company: companyA._id, branch: branchRetail._id,
      initialAmount: 2000, expectedAmount: 5500, actualAmount: 5500, difference: 0, closed: true,
      startDate: new Date(Date.now() - 86400000 * 2), endDate: new Date(Date.now() - 86400000 * 2 + 3600000 * 8),
      payments: { cash: 2500, credit: 1000, debit: 0 }, expenses: [], sales: [], notes: 'Caja entregada perfecta.'
    }).save();


    // ==========================================
    // 9. COMANDAS (KDS) VIVAS
    // ==========================================
    console.log('🍳 Inyectando Comandas al KDS (Cocina Viva)...');

    await new PendingOrder({
      user: cashierHosp1._id, cashRegister: sessionOpenHosp1._id, company: companyA._id, branch: branchHospitality._id,
      table: 'Mesa 4', clientName: 'Familia Gómez', guestsCount: 4, type: 'dine_in',
      kitchenStatus: 'in_kitchen', paymentStatus: 'unpaid', payments: [],
      productsSold: [
        { product: pBurger._id, quantity: 2, unitPrice: 120, subtotal: 240, status: 'sent_to_kitchen', sizeName: 'Único', modifications: [{ name: 'Sin Cebolla', extraPrice: 0 }] },
        { product: pCafe._id, quantity: 1, unitPrice: 45, subtotal: 45, status: 'sent_to_kitchen', sizeName: 'Chico', modifications: [] }
      ],
      total: 285, prepStartedAt: new Date(Date.now() - 600000) 
    }).save();

    await new PendingOrder({
      user: cashierHosp2._id, cashRegister: sessionOpenHosp2._id, company: companyA._id, branch: branchHospitality._id,
      clientName: 'Auto Rojo', type: 'drive_thru', driveThruDetails: { lane: 1, carDescription: 'Sedan Rojo', licensePlate: 'XYZ' },
      kitchenStatus: 'ready', paymentStatus: 'paid', payments: [{ method: 'cash', amount: 120, date: new Date() }],
      productsSold: [{ product: pBurger._id, quantity: 1, unitPrice: 120, subtotal: 120, status: 'sent_to_kitchen', sizeName: 'Único', modifications: [] }],
      total: 120, prepStartedAt: new Date(Date.now() - 1200000), prepFinishedAt: new Date(Date.now() - 60000)
    }).save();


    // ==========================================
    // 10. VENTAS MASIVAS (100+ VENTAS HISTÓRICAS)
    // ==========================================
    console.log('🧾 Generando Historial Masivo de Ventas para Gráficos (100 Ventas)...');

    const pastSessions: any[] = [];
    for (let i = 0; i < 5; i++) {
      pastSessions.push(await new CashRegister({
        user: cashierRetail._id, physicalRegister: physRegRetail._id, company: companyA._id, branch: branchRetail._id,
        initialAmount: 1000, expectedAmount: 1000, closed: true, startDate: new Date(Date.now() - 86400000 * (i + 1)), endDate: new Date(Date.now() - 86400000 * (i + 1) + 3600000 * 8),
        payments: { cash: 0, credit: 0, debit: 0 }, expenses: [], sales: []
      }).save());
    }

    let totalGlobalSales = 0;
    for (let i = 0; i < 100; i++) {
      const isHosp = Math.random() > 0.5;
      const targetBranch = isHosp ? branchHospitality._id : branchRetail._id;
      const targetSession = isHosp ? sessionOpenHosp1 : pastSessions[Math.floor(Math.random() * pastSessions.length)];
      
      const p = isHosp ? pBurger : retailProducts[Math.floor(Math.random() * retailProducts.length)];
      const qty = Math.floor(Math.random() * 3) + 1;
      const unitP = p.price || (isHosp ? 120 : 25);
      const subtotal = unitP * qty;
      const method = Math.random() > 0.6 ? 'cash' : 'credit';
      const saleDate = new Date(targetSession.startDate.getTime() + Math.random() * 3600000 * 4);

      const sale = await new Sale({
        user: targetSession.user, cashRegister: targetSession._id, company: companyA._id, branch: targetBranch,
        total: subtotal, discount: 0, paymentMethod: method, receivedAmount: subtotal, change: 0,
        productsSold: [{ product: p._id, quantity: qty, unitPrice: unitP, subtotal, multiplier: 1, modifications: [] }],
        date: saleDate, customer: Math.random() > 0.8 ? customerSilver._id : undefined
      }).save();

      totalGlobalSales++;

      await CashRegister.findByIdAndUpdate(targetSession._id, {
        $push: { sales: sale._id },
        $inc: {
          [`payments.${method}`]: subtotal,
          expectedAmount: method === 'cash' ? subtotal : 0,
          actualAmount: targetSession.closed && method === 'cash' ? subtotal : 0
        }
      });
    }

    console.log(`✅ SUPER SEED V3 FINALIZADO. Se insertaron ${totalGlobalSales} ventas, comandas vivas, y el entorno B2B manual completo.`);
  } catch (error) {
    console.error('❌ Error fatal en el Super Seed V3:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedV3();
