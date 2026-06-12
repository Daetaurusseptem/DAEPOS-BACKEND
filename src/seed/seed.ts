import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

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

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/DaePoint';

async function seed() {
  try {
    console.log('🚀 Iniciando Super Seed V2 (Cobertura Total)...');
    await mongoose.connect(MONGO_URI);

    console.log('🧹 Limpiando base de datos antigua...');
    await Promise.all([
      User.deleteMany({}), Company.deleteMany({}), Category.deleteMany({}),
      Product.deleteMany({}), InventoryItem.deleteMany({}), Supplier.deleteMany({}),
      PhysicalRegister.deleteMany({}), CashRegister.deleteMany({}), Sale.deleteMany({}),
      Branch.deleteMany({}), StockTransfer.deleteMany({}), RawMaterial.deleteMany({}),
      Recipe.deleteMany({}), Customer.deleteMany({}), Promotion.deleteMany({}),
      PendingOrder.deleteMany({})
    ]);

    const hashedPassword = await bcrypt.hash('admin123', 10);

    // ==========================================
    // 1. ORGANIZACIÓN Y USUARIOS
    // ==========================================
    console.log('🏢 Creando estructura corporativa...');

    const sysadmin = await new User({
      username: 'sysadmin', email: 'sysadmin@daepoint.com', password: hashedPassword,
      name: 'System Administrator', role: 'sysadmin'
    }).save();

    const corpCompany = await new Company({
      name: 'Grupo Gastronómico y Retail S.A.', description: 'Consorcio Multigiro (Retail + Hospitality)',
      address: 'Torre Mayor Piso 42', tel: '555-1000', email: 'contacto@grupogr.com',
      adminId: sysadmin._id, maxActiveRegisters: 20, maxCashLimit: 10000 
    }).save();

    const companyAdmin = await new User({
      username: 'ceo_grupogr', email: 'ceo@grupogr.com', password: hashedPassword,
      name: 'Arturo (CEO)', role: 'companyAdmin', companyId: corpCompany._id
    }).save();
    
    await Company.findByIdAndUpdate(corpCompany._id, { adminId: companyAdmin._id });

    // SUCURSALES (1 Retail, 1 Hospitality Híbrida)
    const branchRetail = await new Branch({
      name: 'SuperMercado Express', address: 'Av. Las Palmas 12', tel: '555-2001',
      email: 'express@grupogr.com', company: corpCompany._id, saleType: 'retail'
    }).save();

    const branchHospitality = await new Branch({
      name: 'Café & Deli Fast-Casual', address: 'Plaza Central Local 5', tel: '555-2002',
      email: 'deli@grupogr.com', company: corpCompany._id, saleType: 'hospitality',
      kitchenSettings: { enableKitchenModule: true, bypassKitchenDoubleCheck: false },
      loyaltySettings: { enabled: true, pointsEarnRate: 10, pointsRedeemRate: 1 } // 10 pesos = 1 punto = 1 peso
    }).save();

    // GERENTES
    const managerRetail = await new User({
      username: 'gerente_retail', email: 'gretail@grupogr.com', password: hashedPassword,
      name: 'Gerente Retail', role: 'admin', companyId: corpCompany._id, branch: branchRetail._id
    }).save();
    await Branch.findByIdAndUpdate(branchRetail._id, { manager: managerRetail._id });

    const managerHospitality = await new User({
      username: 'gerente_hosp', email: 'ghosp@grupogr.com', password: hashedPassword,
      name: 'Gerente Hospitality', role: 'admin', companyId: corpCompany._id, branch: branchHospitality._id
    }).save();
    await Branch.findByIdAndUpdate(branchHospitality._id, { manager: managerHospitality._id });

    // CAJEROS Y COCINEROS
    const cashierRetail = await new User({
      username: 'cajero_retail', email: 'cajero1@express.com', password: hashedPassword,
      name: 'Cajero Retail (Escáner)', role: 'user', companyId: corpCompany._id, branch: branchRetail._id
    }).save();

    const cashierHosp = await new User({
      username: 'cajero_hosp', email: 'cajero1@deli.com', password: hashedPassword,
      name: 'Cajero Hospitality (Touch)', role: 'user', companyId: corpCompany._id, branch: branchHospitality._id
    }).save();

    const chefHosp = await new User({
      username: 'chef_hosp', email: 'chef@deli.com', password: hashedPassword,
      name: 'Chef Ejecutivo (KDS)', role: 'kitchen', companyId: corpCompany._id, branch: branchHospitality._id
    }).save();


    // ==========================================
    // 2. CRM Y PROMOCIONES
    // ==========================================
    console.log('👥 Generando CRM de Clientes...');
    const customerBronze = await new Customer({
      company: corpCompany._id, name: 'Juan Pérez', email: 'juan@mail.com', phone: '5550001111',
      loyaltyPoints: 50, tier: 'bronze', totalSpent: 800, salesCount: 3
    }).save();

    const customerSilver = await new Customer({
      company: corpCompany._id, name: 'María Gómez', email: 'maria@mail.com', phone: '5550002222',
      loyaltyPoints: 350, tier: 'silver', totalSpent: 3500, salesCount: 12
    }).save();

    const customerGold = await new Customer({
      company: corpCompany._id, name: 'Roberto Díaz', email: 'roberto@mail.com', phone: '5550003333',
      loyaltyPoints: 1200, tier: 'gold', totalSpent: 15000, salesCount: 45
    }).save();

    const promoSummer = await new Promotion({
      company: corpCompany._id, code: 'VERANO20', description: '20% de descuento en verano',
      type: 'percentage', value: 20, isActive: true, usageLimit: 100, usageCount: 5,
      startDate: new Date(Date.now() - 864000000), endDate: new Date(Date.now() + 864000000)
    }).save();


    // ==========================================
    // 3. CATÁLOGO Y RECETAS COMPLEJAS
    // ==========================================
    console.log('📦 Generando Catálogo Retail y Hospitality...');
    
    // Categorías
    const catBebidas = await new Category({ name: 'Bebidas Embotelladas', company: corpCompany._id }).save();
    const catSnacks = await new Category({ name: 'Snacks', company: corpCompany._id }).save();
    const catCafe = await new Category({ name: 'Cafetería', company: corpCompany._id }).save();
    const catComida = await new Category({ name: 'Comida Preparada', company: corpCompany._id }).save();

    const supplierGeneral = await new Supplier({
      name: 'Proveedor Nacional S.A.', company: corpCompany._id,
      contactInfo: { email: 'ventas@provnacional.com', phone: '555-9999', address: 'Bodega 1' }
    }).save();

    // RETAIL: Productos Simples (No compuestos)
    const pCola = await new Product({
      name: 'Coca-Cola 600ml', brand: 'Coca-Cola', isComposite: false,
      supplier: supplierGeneral._id, categories: [catBebidas._id], company: corpCompany._id
    }).save();

    const pPapas = await new Product({
      name: 'Papas Sabritas', brand: 'Sabritas', isComposite: false,
      supplier: supplierGeneral._id, categories: [catSnacks._id], company: corpCompany._id
    }).save();

    // HOSPITALITY: Insumos Maestros y Recetas
    const rmCarne = await new RawMaterial({ name: 'Carne Molida Premium', company: corpCompany._id, measurementUnit: 'g' }).save();
    const rmPan = await new RawMaterial({ name: 'Pan de Hamburguesa', company: corpCompany._id, measurementUnit: 'unit' }).save();
    const rmQueso = await new RawMaterial({ name: 'Queso Cheddar', company: corpCompany._id, measurementUnit: 'unit' }).save();
    const rmCafeG = await new RawMaterial({ name: 'Café Grano', company: corpCompany._id, measurementUnit: 'g' }).save();
    const rmLeche = await new RawMaterial({ name: 'Leche Deslactosada', company: corpCompany._id, measurementUnit: 'ml' }).save();

    const recetaBurger = await new Recipe({
      name: 'Receta Burger Doble', description: 'Hamburguesa con doble carne y pan', company: corpCompany._id,
      sizes: [
        {
          name: 'Único',
          priceModifier: 0,
          ingredients: [
            { ingredient: rmCarne._id, quantity: 300 }, // 300g carne
            { ingredient: rmPan._id, quantity: 1 },
            { ingredient: rmQueso._id, quantity: 2 }
          ]
        }
      ]
    }).save();

    const recetaCafe = await new Recipe({
      name: 'Receta Capuccino', description: 'Capuccino tradicional', company: corpCompany._id,
      sizes: [
        {
          name: 'Grande',
          priceModifier: 15,
          ingredients: [
            { ingredient: rmCafeG._id, quantity: 20 },
            { ingredient: rmLeche._id, quantity: 250 }
          ]
        },
        {
          name: 'Chico',
          priceModifier: 0,
          ingredients: [
            { ingredient: rmCafeG._id, quantity: 10 },
            { ingredient: rmLeche._id, quantity: 150 }
          ]
        }
      ]
    }).save();

    // HOSPITALITY: Productos Compuestos
    const pBurger = await new Product({
      name: 'Hamburguesa Doble Queso', brand: 'Deli House', isComposite: true,
      categories: [catComida._id], company: corpCompany._id, recipe: recetaBurger._id
    }).save();

    const pCafe = await new Product({
      name: 'Capuccino Caliente', brand: 'Deli House', isComposite: true,
      categories: [catCafe._id], company: corpCompany._id, recipe: recetaCafe._id
    }).save();


    // ==========================================
    // 4. INVENTARIOS
    // ==========================================
    console.log('📊 Asignando Inventarios (Retail y Hospitality)...');
    
    // Inventario Retail (Ambas sucursales venden refrescos)
    for (const branchId of [branchRetail._id, branchHospitality._id]) {
      await new InventoryItem({
        name: pCola.name, company: corpCompany._id, branch: branchId, product: pCola._id,
        stock: 50, costPrice: 10, sellingPrice: 20, measurement: 'unit', supplier: supplierGeneral._id
      }).save();
      await new InventoryItem({
        name: pPapas.name, company: corpCompany._id, branch: branchId, product: pPapas._id,
        stock: 40, costPrice: 8, sellingPrice: 18, measurement: 'unit', supplier: supplierGeneral._id
      }).save();
    }

    // Inventario Hospitality (Solo sucursal Hospitality tiene Insumos y Productos Compuestos)
    const branchH = branchHospitality._id;
    // Insumos
    await new InventoryItem({ name: rmCarne.name, company: corpCompany._id, branch: branchH, rawMaterial: rmCarne._id, stock: 10000, costPrice: 0.1, measurement: 'g', supplier: supplierGeneral._id }).save();
    await new InventoryItem({ name: rmPan.name, company: corpCompany._id, branch: branchH, rawMaterial: rmPan._id, stock: 100, costPrice: 5, measurement: 'unit', supplier: supplierGeneral._id }).save();
    await new InventoryItem({ name: rmQueso.name, company: corpCompany._id, branch: branchH, rawMaterial: rmQueso._id, stock: 200, costPrice: 2, measurement: 'unit', supplier: supplierGeneral._id }).save();
    await new InventoryItem({ name: rmCafeG.name, company: corpCompany._id, branch: branchH, rawMaterial: rmCafeG._id, stock: 5000, costPrice: 0.2, measurement: 'g', supplier: supplierGeneral._id }).save();
    await new InventoryItem({ name: rmLeche.name, company: corpCompany._id, branch: branchH, rawMaterial: rmLeche._id, stock: 20000, costPrice: 0.03, measurement: 'ml', supplier: supplierGeneral._id }).save();

    // Productos Compuestos (Stock virtual = 0)
    await new InventoryItem({ name: pBurger.name, company: corpCompany._id, branch: branchH, product: pBurger._id, stock: 0, costPrice: 39, sellingPrice: 120, measurement: 'unit', supplier: supplierGeneral._id }).save();
    await new InventoryItem({ name: pCafe.name, company: corpCompany._id, branch: branchH, product: pCafe._id, stock: 0, costPrice: 9, sellingPrice: 45, measurement: 'unit', supplier: supplierGeneral._id }).save();


    // ==========================================
    // 5. CAJAS FÍSICAS Y SESIONES (CASH REGISTERS)
    // ==========================================
    console.log('💸 Creando Sesiones de Caja y Arqueos...');
    const physRegRetail = await new PhysicalRegister({ name: 'Caja 1 Express', company: corpCompany._id, branch: branchRetail._id }).save();
    const physRegHosp = await new PhysicalRegister({ name: 'Caja 1 Deli', company: corpCompany._id, branch: branchHospitality._id }).save();

    // Sesión Abierta Retail
    const cashSessionRetail = await new CashRegister({
      user: cashierRetail._id, physicalRegister: physRegRetail._id, company: corpCompany._id, branch: branchRetail._id,
      initialAmount: 1000, expectedAmount: 1000, closed: false, startDate: new Date(),
      payments: { cash: 0, credit: 0, debit: 0 }, expenses: [], sales: []
    }).save();

    // Sesión Abierta Hospitality
    const cashSessionHosp = await new CashRegister({
      user: cashierHosp._id, physicalRegister: physRegHosp._id, company: corpCompany._id, branch: branchHospitality._id,
      initialAmount: 2000, expectedAmount: 2000, closed: false, startDate: new Date(),
      payments: { cash: 0, credit: 0, debit: 0 }, expenses: [], sales: []
    }).save();


    // ==========================================
    // 6. FLUJO KITCHEN (PENDING ORDERS VIVAS)
    // ==========================================
    console.log('🍳 Inyectando Comandas al KDS (Cocina Viva)...');

    // MESA 4 (En Cocina)
    await new PendingOrder({
      user: cashierHosp._id, cashRegister: cashSessionHosp._id, company: corpCompany._id, branch: branchHospitality._id,
      table: 'Mesa 4', clientName: 'Familia Gómez', guestsCount: 4, type: 'dine_in',
      kitchenStatus: 'in_kitchen', paymentStatus: 'unpaid', payments: [],
      productsSold: [
        { product: pBurger._id, quantity: 2, unitPrice: 120, subtotal: 240, status: 'sent_to_kitchen', sizeName: 'Único', modifications: [{ name: 'Sin Cebolla', extraPrice: 0 }] },
        { product: pCola._id, quantity: 2, unitPrice: 20, subtotal: 40, status: 'sent_to_kitchen', modifications: [] }
      ],
      total: 280, prepStartedAt: new Date(Date.now() - 600000) // Hace 10 mins
    }).save();

    // DRIVE-THRU (Listo para entregar)
    await new PendingOrder({
      user: cashierHosp._id, cashRegister: cashSessionHosp._id, company: corpCompany._id, branch: branchHospitality._id,
      clientName: 'Auto Rojo (Placa XYZ)', type: 'drive_thru', driveThruDetails: { lane: 1, carDescription: 'Sedan Rojo', licensePlate: 'XYZ-123' },
      kitchenStatus: 'ready', paymentStatus: 'paid', // Pagado en la primer ventanilla
      payments: [{ method: 'cash', amount: 165, date: new Date() }],
      productsSold: [
        { product: pBurger._id, quantity: 1, unitPrice: 120, subtotal: 120, status: 'sent_to_kitchen', sizeName: 'Único', modifications: [] },
        { product: pCafe._id, quantity: 1, unitPrice: 45, subtotal: 45, status: 'sent_to_kitchen', sizeName: 'Grande', modifications: [] }
      ],
      total: 165, prepStartedAt: new Date(Date.now() - 1200000), prepFinishedAt: new Date(Date.now() - 60000)
    }).save();

    // DELIVERY (Uber Eats - En Cocina)
    await new PendingOrder({
      user: cashierHosp._id, cashRegister: cashSessionHosp._id, company: corpCompany._id, branch: branchHospitality._id,
      clientName: 'Uber Eats - Orden #991', type: 'delivery', deliveryDetails: { platform: 'uber_eats', orderId: 'UBER-991', courierName: 'Repartidor Juan' },
      kitchenStatus: 'in_kitchen', paymentStatus: 'unpaid', payments: [],
      productsSold: [
        { product: pBurger._id, quantity: 3, unitPrice: 120, subtotal: 390, status: 'sent_to_kitchen', sizeName: 'Único', modifications: [{ name: 'Extra Tocino', extraPrice: 10 }] }
      ],
      total: 390, prepStartedAt: new Date()
    }).save();

    // MESA 12 (Pago Parcial / Split Check)
    await new PendingOrder({
      user: cashierHosp._id, cashRegister: cashSessionHosp._id, company: corpCompany._id, branch: branchHospitality._id,
      table: 'Mesa 12', clientName: 'Estudiantes', guestsCount: 3, type: 'dine_in',
      kitchenStatus: 'delivered', paymentStatus: 'partial', 
      payments: [
        { method: 'credit', amount: 100, date: new Date(Date.now() - 10000) } // Alguien adelantó $100
      ],
      productsSold: [
        { product: pCafe._id, quantity: 3, unitPrice: 45, subtotal: 135, status: 'sent_to_kitchen', sizeName: 'Chico', modifications: [] }
      ],
      total: 135, prepStartedAt: new Date(Date.now() - 3600000), prepFinishedAt: new Date(Date.now() - 3000000)
    }).save();


    // ==========================================
    // 7. VENTAS COMPLETADAS (SALES)
    // ==========================================
    console.log('🧾 Generando Historial de Ventas...');

    // Venta Retail Pura (Escáner)
    const saleRetail = await new Sale({
      user: cashierRetail._id, cashRegister: cashSessionRetail._id, company: corpCompany._id, branch: branchRetail._id,
      total: 56, discount: 0, paymentMethod: 'cash', receivedAmount: 100, change: 44,
      productsSold: [
        { product: pCola._id, quantity: 1, unitPrice: 20, subtotal: 20, multiplier: 1, modifications: [] },
        { product: pPapas._id, quantity: 2, unitPrice: 18, subtotal: 36, multiplier: 1, modifications: [] }
      ],
      date: new Date()
    }).save();

    // Actualizar Caja Retail
    await CashRegister.findByIdAndUpdate(cashSessionRetail._id, {
      $push: { sales: saleRetail._id },
      $inc: { 'payments.cash': 56, expectedAmount: 56 }
    });

    // Venta Hospitality Híbrida (Pagada al instante, despachó a KDS en la vida real)
    const saleHosp = await new Sale({
      user: cashierHosp._id, cashRegister: cashSessionHosp._id, company: corpCompany._id, branch: branchHospitality._id,
      customer: customerGold._id, pointsEarned: 16, // 165 / 10 = 16 puntos
      total: 165, discount: 0, paymentMethod: 'credit',
      productsSold: [
        { product: pCafe._id, quantity: 1, unitPrice: 45, subtotal: 45, multiplier: 1, sizeName: 'Grande', modifications: [] },
        { product: pBurger._id, quantity: 1, unitPrice: 120, subtotal: 120, multiplier: 1, sizeName: 'Único', modifications: [] }
      ],
      date: new Date()
    }).save();

    // Actualizar Caja Hospitality
    await CashRegister.findByIdAndUpdate(cashSessionHosp._id, {
      $push: { sales: saleHosp._id },
      $inc: { 'payments.credit': 165 } // expectedAmount no sube porque fue crédito
    });


    console.log('✅ SUPER SEED V2 FINALIZADO EXITOSAMENTE. LISTO PARA QA Y DEMOS.');
  } catch (error) {
    console.error('❌ Error fatal en el Super Seed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
