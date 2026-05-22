import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
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

export async function runSeed(alreadyConnected: boolean = true): Promise<void> {
  try {
    console.log('🚀 Iniciando Super Seed corregido...');
    if (!alreadyConnected) {
      const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/DaePoint';
      await mongoose.connect(MONGO_URI);
    }

    console.log('Sweep old data...');
    await Promise.all([
      User.deleteMany({}), Company.deleteMany({}), Category.deleteMany({}),
      Product.deleteMany({}), InventoryItem.deleteMany({}), Supplier.deleteMany({}),
      PhysicalRegister.deleteMany({}), CashRegister.deleteMany({}), Sale.deleteMany({}),
      Branch.deleteMany({}), StockTransfer.deleteMany({}), RawMaterial.deleteMany({}),
      Recipe.deleteMany({})
    ]);

    const hashedPassword = await bcrypt.hash('admin123', 10);

    // 1. Sysadmin (Main Platform Admin)
    const sysadmin = await new User({
      username: 'sysadmin', email: 'sysadmin@daepoint.com', password: hashedPassword,
      name: 'System Administrator', role: 'sysadmin', isDemo: false
    }).save();

    // 2. Company
    const demoCompany = await new Company({
      name: 'Super Mercado Premium', description: 'Empresa Multi-sucursal Corporativa',
      address: 'Av. Corporativa 101', tel: '555-9000', email: 'owner@superpremium.com',
      adminId: sysadmin._id, maxActiveRegisters: 10, maxCashLimit: 5000 
    }).save();

    // 3. Company Admin (The Owner) - Marked as Demo!
    const companyAdmin = await new User({
      username: 'companyowner', email: 'owner@superpremium.com', password: hashedPassword,
      name: 'Jaime (Dueño)', role: 'companyAdmin', companyId: demoCompany._id, isDemo: true
    }).save();
    
    // Link company to its owner
    await Company.findByIdAndUpdate(demoCompany._id, { adminId: companyAdmin._id });

    // 4. Branches
    const branch1 = await new Branch({
      name: 'Sucursal Centro', address: 'Calle Principal 123', tel: '555-0001',
      email: 'centro@superpremium.com', company: demoCompany._id, saleType: 'retail'
    }).save();

    const branch2 = await new Branch({
      name: 'Sucursal Norte', address: 'Plaza Norte L4', tel: '555-0002',
      email: 'norte@superpremium.com', company: demoCompany._id, saleType: 'hospitality'
    }).save();

    // 5. Branch Admins (Managers) - Marked as Demo!
    const branchAdmin = await new User({
      username: 'admin', email: 'admin@centro.com', password: hashedPassword,
      name: 'Gerente Centro', role: 'admin', companyId: demoCompany._id, branch: branch1._id, isDemo: true
    }).save();

    await Branch.findByIdAndUpdate(branch1._id, { manager: branchAdmin._id });

    const branchAdmin2 = await new User({
      username: 'admin2', email: 'admin2@norte.com', password: hashedPassword,
      name: 'Gerente Norte', role: 'admin', companyId: demoCompany._id, branch: branch2._id, isDemo: true
    }).save();

    await Branch.findByIdAndUpdate(branch2._id, { manager: branchAdmin2._id });

    // 6. Cashiers - Marked as Demo!
    const users = [];
    // Cajeros de Sucursal Centro
    for (let i = 1; i <= 4; i++) {
      users.push(await new User({
        username: `cajero${i}`, email: `cajero${i}@centro.com`, password: hashedPassword,
        name: `Cajero Centro ${i}`, role: 'user', companyId: demoCompany._id, branch: branch1._id,
        permissions: i === 1 ? ['inventory_management'] : [], isDemo: true
      }).save());
    }

    // Cajeros de Sucursal Norte
    for (let i = 1; i <= 3; i++) {
      users.push(await new User({
        username: `cajero_norte${i}`, email: `cajero_norte${i}@norte.com`, password: hashedPassword,
        name: `Cajero Norte ${i}`, role: 'user', companyId: demoCompany._id, branch: branch2._id, isDemo: true
      }).save());
    }

    // 4. Categorías
    const catNames = ['Bebidas', 'Snacks', 'Limpieza', 'Frutas', 'Carnes', 'Lácteos', 'Panadería', 'Hogar', 'Mascotas', 'Cuidado Personal'];
    const categories: any[] = [];
    for (const name of catNames) {
      categories.push(await new Category({ name, company: demoCompany._id }).save());
    }

    // 5. Proveedores
    const suppliers: any[] = [];
    for (let i = 1; i <= 15; i++) {
      suppliers.push(await new Supplier({
        name: `Distribuidora Logística ${i}`, company: demoCompany._id,
        description: `Proveedor nivel ${i}`,
        contactInfo: { email: `ventas${i}@dist.com`, phone: `555-00${i}`, address: `Calle ${i}` }
      }).save());
    }

    // 7. Cajas Físicas
    const registers: any[] = [];
    for (let i = 1; i <= 3; i++) {
      registers.push(await new PhysicalRegister({ name: `Caja ${i} Centro`, company: demoCompany._id, branch: branch1._id }).save());
    }
    for (let i = 1; i <= 2; i++) {
      registers.push(await new PhysicalRegister({ name: `Caja ${i} Norte`, company: demoCompany._id, branch: branch2._id }).save());
    }

    console.log('💸 Generando sesiones de caja y arqueos...');
    
    // Sesión abierta normal (Cajero Centro 1)
    const openSession = await new CashRegister({
      user: users[0]._id, physicalRegister: registers[0]._id, company: demoCompany._id, branch: branch1._id,
      initialAmount: 2000, expectedAmount: 2000, closed: false, startDate: new Date(),
      payments: { cash: 0, credit: 0, debit: 0 }, expenses: [], sales: []
    }).save();

    // Sesión abierta SATURADA (Cajero Centro 2) - Para probar alertas de sobrellenado en tiempo real
    const saturatedSession = await new CashRegister({
      user: users[1]._id, physicalRegister: registers[1]._id, company: demoCompany._id, branch: branch1._id,
      initialAmount: 2000, expectedAmount: 12500, closed: false, startDate: new Date(Date.now() - 3600000 * 4), // 4 horas abierta
      payments: { cash: 8500, credit: 1500, debit: 500 }, 
      expenses: [
        { amount: 500, reason: 'Pago de gas a proveedor externo', type: 'expense', timestamp: new Date(Date.now() - 3600000 * 2) }
      ],
      sales: []
    }).save();

    // Sesión cerrada CUADRADA (Cajero Centro 3)
    const squaredSession = await new CashRegister({
      user: users[2]._id, physicalRegister: registers[2]._id, company: demoCompany._id, branch: branch1._id,
      initialAmount: 1500, expectedAmount: 4800, actualAmount: 4800, difference: 0, closed: true,
      startDate: new Date(Date.now() - 86400000 * 2), endDate: new Date(Date.now() - 86400000 * 2 + 3600000 * 8), // Hace 2 días, duró 8 horas
      payments: { cash: 2300, credit: 600, debit: 400 },
      expenses: [], sales: [], notes: 'Caja entregada en perfecto orden sin novedades.'
    }).save();

    // Sesión cerrada con FALTANTE (Cajero Centro 4)
    const deficitSession = await new CashRegister({
      user: users[3]._id, physicalRegister: registers[0]._id, company: demoCompany._id, branch: branch1._id,
      initialAmount: 2000, expectedAmount: 5650, actualAmount: 5450, difference: -200, closed: true,
      startDate: new Date(Date.now() - 86400000 * 3), endDate: new Date(Date.now() - 86400000 * 3 + 3600000 * 7),
      payments: { cash: 3150, credit: 300, debit: 200 },
      expenses: [], sales: [], notes: 'Descuadre de $200 pesos al final del turno. Probable error al dar cambio.'
    }).save();

    // Sesión cerrada con SOBRANTE (Cajero Centro 1, día anterior)
    const surplusSession = await new CashRegister({
      user: users[0]._id, physicalRegister: registers[1]._id, company: demoCompany._id, branch: branch1._id,
      initialAmount: 1500, expectedAmount: 3200, actualAmount: 3320, difference: 120, closed: true,
      startDate: new Date(Date.now() - 86400000 * 1), endDate: new Date(Date.now() - 86400000 * 1 + 3600000 * 6),
      payments: { cash: 1400, credit: 200, debit: 100 },
      expenses: [], sales: [], notes: 'Sobraron $120 pesos en propinas que un cliente dejó en el mesón.'
    }).save();

    // Sesión cerrada con egresos y retiros timeline (Cajero Centro 2, día anterior)
    const expensesSession = await new CashRegister({
      user: users[1]._id, physicalRegister: registers[2]._id, company: demoCompany._id, branch: branch1._id,
      initialAmount: 2000, expectedAmount: 2500, actualAmount: 2500, difference: 0, closed: true,
      startDate: new Date(Date.now() - 86400000 * 4), endDate: new Date(Date.now() - 86400000 * 4 + 3600000 * 9),
      payments: { cash: 3000, credit: 300, debit: 200 },
      expenses: [
        { amount: 1500, reason: 'Retiro parcial preventivo por supervisor', type: 'withdrawal', timestamp: new Date(Date.now() - 86400000 * 4 + 3600000 * 3) },
        { amount: 500, reason: 'Compra urgente de bolsas de hielo', type: 'expense', timestamp: new Date(Date.now() - 86400000 * 4 + 3600000 * 6) }
      ],
      sales: [], notes: 'Turno finalizado. Se ejecutaron retiros por seguridad del efectivo acumulado.'
    }).save();

    // 7. Productos e Inventario (60 items)
    console.log('📦 Generando catálogo...');
    const products: any[] = [];
    const productTypes = [
      { name: 'Refresco', brand: 'MegaCola', price: 25, catIdx: 0 },
      { name: 'Papas', brand: 'Crunchy', price: 18, catIdx: 1 },
      { name: 'Detergente', brand: 'Limpio', price: 45, catIdx: 2 },
      { name: 'Manzana', brand: 'Campo', price: 12, catIdx: 3 },
      { name: 'Leche', brand: 'Vaca', price: 22, catIdx: 5 },
      { name: 'Pan', brand: 'BakeIt', price: 35, catIdx: 6 }
    ];

    for (let i = 1; i <= 60; i++) {
      const type = productTypes[i % productTypes.length];
      const p = await new Product({
        name: `${type.name} #${i}`, brand: type.brand, isComposite: false,
        description: `Producto de prueba volumen #${i} para verificar el diseño premium.`,
        supplier: suppliers[i % suppliers.length]._id,
        categories: [categories[type.catIdx]._id],
        company: demoCompany._id
      }).save();
      products.push(p);

      // Inventory for Branch 1
      await new InventoryItem({
        name: p.name, company: demoCompany._id, branch: branch1._id, product: p._id,
        stock: Math.floor(Math.random() * 150),
        costPrice: type.price * 0.6, sellingPrice: type.price + (i % 5),
        measurement: 'unit', supplier: suppliers[i % suppliers.length]._id,
        receivedDate: new Date()
      }).save();

      // Inventory for Branch 2 (Different stock/price)
      await new InventoryItem({
        name: p.name, company: demoCompany._id, branch: branch2._id, product: p._id,
        stock: Math.floor(Math.random() * 50),
        costPrice: type.price * 0.6, sellingPrice: type.price + 10,
        measurement: 'unit', supplier: suppliers[i % suppliers.length]._id,
        receivedDate: new Date()
      }).save();
    }

    console.log('🌾 Generando insumos maestros y recetas...');
    
    // Crear Insumos Maestros
    const lecheRM = await new RawMaterial({
      name: 'Leche Entera', description: 'Leche entera pasteurizada premium',
      company: demoCompany._id, measurementUnit: 'ml'
    }).save();

    const cafeRM = await new RawMaterial({
      name: 'Café en Grano', description: 'Café de especialidad en grano tostado',
      company: demoCompany._id, measurementUnit: 'g'
    }).save();

    // Crear existencias físicas de insumos en Branch 1 (Centro)
    await new InventoryItem({
      name: lecheRM.name, company: demoCompany._id, branch: branch1._id,
      rawMaterial: lecheRM._id, stock: 10000, costPrice: 0.02,
      measurement: 'ml', supplier: suppliers[0]._id, receivedDate: new Date()
    }).save();

    await new InventoryItem({
      name: cafeRM.name, company: demoCompany._id, branch: branch1._id,
      rawMaterial: cafeRM._id, stock: 5000, costPrice: 0.15,
      measurement: 'g', supplier: suppliers[0]._id, receivedDate: new Date()
    }).save();

    // Crear existencias físicas de insumos en Branch 2 (Norte)
    await new InventoryItem({
      name: lecheRM.name, company: demoCompany._id, branch: branch2._id,
      rawMaterial: lecheRM._id, stock: 8000, costPrice: 0.02,
      measurement: 'ml', supplier: suppliers[0]._id, receivedDate: new Date()
    }).save();

    await new InventoryItem({
      name: cafeRM.name, company: demoCompany._id, branch: branch2._id,
      rawMaterial: cafeRM._id, stock: 3000, costPrice: 0.15,
      measurement: 'g', supplier: suppliers[0]._id, receivedDate: new Date()
    }).save();

    // Crear Receta de Capuccino (Usando insumos maestros)
    const capuccinoRecipe = await new Recipe({
      name: 'Receta de Capuccino', description: 'Capuccino tradicional 8oz',
      company: demoCompany._id,
      ingredients: [
        { ingredient: lecheRM._id, quantity: 250 },
        { ingredient: cafeRM._id, quantity: 15 }
      ]
    }).save();

    // Crear el Producto Compuesto (Vendible)
    const capuccinoProduct = await new Product({
      name: 'Café Capuccino', brand: 'DaePoint Cafe', isComposite: true,
      description: 'Capuccino caliente con espuma de leche sedosa y espresso premium',
      supplier: suppliers[0]._id,
      categories: [categories[0]._id], // Bebidas
      company: demoCompany._id,
      recipe: capuccinoRecipe._id
    }).save();

    products.push(capuccinoProduct);

    // Crear existencias en inventario del Capuccino
    await new InventoryItem({
      name: capuccinoProduct.name, company: demoCompany._id, branch: branch1._id,
      product: capuccinoProduct._id, stock: 0, costPrice: 5, sellingPrice: 45,
      measurement: 'unit', supplier: suppliers[0]._id, receivedDate: new Date()
    }).save();

    await new InventoryItem({
      name: capuccinoProduct.name, company: demoCompany._id, branch: branch2._id,
      product: capuccinoProduct._id, stock: 0, costPrice: 5, sellingPrice: 50,
      measurement: 'unit', supplier: suppliers[0]._id, receivedDate: new Date()
    }).save();

    // 8. Ventas (150 ventas distribuidas)
    console.log('💰 Generando y distribuyendo ventas...');
    const allSessions = [openSession, saturatedSession, squaredSession, deficitSession, surplusSession, expensesSession];
    
    const sessionData: { [key: string]: { cash: number, credit: number, debit: number, sales: string[] } } = {};
    allSessions.forEach(s => {
      sessionData[s._id.toString()] = { cash: 0, credit: 0, debit: 0, sales: [] };
    });

    for (let i = 1; i <= 150; i++) {
      const p = products[Math.floor(Math.random() * products.length)];
      const qty = Math.floor(Math.random() * 4) + 1;
      const price = 30;
      const subtotal = price * qty;
      
      const session = allSessions[i % allSessions.length];
      const method = Math.random() > 0.4 ? 'cash' : 'credit';

      const sale = await new Sale({
        user: session.user,
        cashRegister: session._id, total: subtotal, discount: 0,
        paymentMethod: method,
        company: demoCompany._id,
        branch: branch1._id,
        productsSold: [{ product: p._id, quantity: qty, unitPrice: price, subtotal, modifications: [] }],
        date: new Date(session.startDate.getTime() + Math.random() * 3600000 * 4)
      }).save();

      const sData = sessionData[session._id.toString()];
      sData.sales.push(sale._id);
      if (method === 'cash') sData.cash += subtotal;
      else sData.credit += subtotal;
    }

    for (const session of allSessions) {
      const sData = sessionData[session._id.toString()];
      const totalExpenses = session.expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
      const expected = session.initialAmount + sData.cash - totalExpenses;
      
      const updateObj: any = {
        sales: sData.sales,
        'payments.cash': sData.cash,
        'payments.credit': sData.credit,
        'payments.debit': sData.debit,
        expectedAmount: expected
      };

      if (session.closed) {
        updateObj.actualAmount = expected + (session.difference || 0);
      }

      await CashRegister.findByIdAndUpdate(session._id, { $set: updateObj });
    }

    // 9. Usuarios Corporativos
    console.log('🏢 Generando personal corporativo...');
    const corporateUsers = [];
    for (let i = 1; i <= 2; i++) {
      corporateUsers.push(await new User({
        username: `corp${i}`, email: `corp${i}@superpremium.com`, password: hashedPassword,
        name: `Admin Corp ${i}`, role: 'admin', companyId: demoCompany._id, branch: null, isDemo: true
      }).save());
    }

    // 10. Traspasos de Stock
    console.log('🔄 Generando traspasos de ejemplo...');
    for (let i = 0; i < 5; i++) {
      const p = products[i];
      await new StockTransfer({
        company: demoCompany._id,
        product: p._id,
        fromBranch: branch1._id,
        toBranch: branch2._id,
        quantity: 5,
        status: 'completed',
        createdBy: companyAdmin._id,
        notes: 'Reabastecimiento semanal automático'
      }).save();
    }

    console.log('✅ Super Seed completado con éxito!');
  } catch (error) {
    console.error('❌ Error en el proceso de seeding:', error);
    throw error;
  } finally {
    if (!alreadyConnected) {
      await mongoose.disconnect();
    }
  }
}
