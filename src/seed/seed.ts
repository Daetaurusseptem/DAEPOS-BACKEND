import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
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

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/DaePoint';

async function seed() {
  try {
    console.log('🚀 Iniciando Super Seed corregido...');
    await mongoose.connect(MONGO_URI);

    console.log('Sweep old data...');
    await Promise.all([
      User.deleteMany({}), Company.deleteMany({}), Category.deleteMany({}),
      Product.deleteMany({}), InventoryItem.deleteMany({}), Supplier.deleteMany({}),
      PhysicalRegister.deleteMany({}), CashRegister.deleteMany({}), Sale.deleteMany({}),
      Branch.deleteMany({}), StockTransfer.deleteMany({})
    ]);

    const hashedPassword = await bcrypt.hash('admin123', 10);

    // 1. Sysadmin
    const sysadmin = await new User({
      username: 'sysadmin', email: 'sysadmin@daepoint.com', password: hashedPassword,
      name: 'System Administrator', role: 'sysadmin'
    }).save();

    // 2. Company
    const demoCompany = await new Company({
      name: 'Super Mercado Premium', description: 'Empresa Multi-sucursal Corporativa',
      address: 'Av. Corporativa 101', tel: '555-9000', email: 'owner@superpremium.com',
      adminId: sysadmin._id, maxActiveRegisters: 10, maxCashLimit: 5000 
    }).save();

    // 3. Company Admin (The Owner)
    const companyAdmin = await new User({
      username: 'companyowner', email: 'owner@superpremium.com', password: hashedPassword,
      name: 'Jaime (Dueño)', role: 'companyAdmin', companyId: demoCompany._id
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

    // 5. Branch Admins (Managers)
    const branchAdmin = await new User({
      username: 'admin', email: 'admin@centro.com', password: hashedPassword,
      name: 'Gerente Centro', role: 'admin', companyId: demoCompany._id, branch: branch1._id
    }).save();

    await Branch.findByIdAndUpdate(branch1._id, { manager: branchAdmin._id });

    const branchAdmin2 = await new User({
      username: 'admin2', email: 'admin2@norte.com', password: hashedPassword,
      name: 'Gerente Norte', role: 'admin', companyId: demoCompany._id, branch: branch2._id
    }).save();

    await Branch.findByIdAndUpdate(branch2._id, { manager: branchAdmin2._id });

    // 6. Cashiers
    const users = [];
    // Cajeros de Sucursal Centro
    for (let i = 1; i <= 4; i++) {
      users.push(await new User({
        username: `cajero${i}`, email: `cajero${i}@centro.com`, password: hashedPassword,
        name: `Cajero Centro ${i}`, role: 'user', companyId: demoCompany._id, branch: branch1._id,
        permissions: i === 1 ? ['inventory_management'] : []
      }).save());
    }

    // Cajeros de Sucursal Norte
    for (let i = 1; i <= 3; i++) {
      users.push(await new User({
        username: `cajero_norte${i}`, email: `cajero_norte${i}@norte.com`, password: hashedPassword,
        name: `Cajero Norte ${i}`, role: 'user', companyId: demoCompany._id, branch: branch2._id
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

    // 7. Cajas
    const registers: any[] = [];
    for (let i = 1; i <= 2; i++) {
      registers.push(await new PhysicalRegister({ name: `Caja ${i} Centro`, company: demoCompany._id, branch: branch1._id }).save());
    }

    const openSession: any = await new CashRegister({
      user: users[0]._id, physicalRegister: registers[0]._id, company: demoCompany._id, branch: branch1._id,
      initialAmount: 2000, expectedAmount: 2000, closed: false, startDate: new Date(),
      payments: { cash: 0, credit: 0, debit: 0 }
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

    // 8. Ventas (150 ventas)
    console.log('💰 Generando ventas...');
    let totalCash = 0;
    const saleIds = [];
    for (let i = 1; i <= 150; i++) {
      const p = products[Math.floor(Math.random() * products.length)];
      const qty = Math.floor(Math.random() * 4) + 1;
      const price = 30; // Hardcoded for simplicity
      const subtotal = price * qty;
      
      const sale = await new Sale({
        user: users[Math.floor(Math.random() * users.length)]._id,
        cashRegister: openSession._id, total: subtotal, discount: 0,
        paymentMethod: Math.random() > 0.2 ? 'cash' : 'credit',
        company: demoCompany._id,
        branch: branch1._id,
        productsSold: [{ product: p._id, quantity: qty, unitPrice: price, subtotal }],
        date: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 15)) // Last 15 days
      }).save();

      if (sale.paymentMethod === 'cash') totalCash += subtotal;
      saleIds.push(sale._id);
    }

    await CashRegister.findByIdAndUpdate(openSession._id, {
      $set: { 'payments.cash': totalCash },
      $push: { sales: { $each: saleIds } },
      expectedAmount: 2000 + totalCash
    });

    // 9. Usuarios Corporativos (Sin sucursal)
    console.log('🏢 Generando personal corporativo...');
    const corporateUsers = [];
    for (let i = 1; i <= 2; i++) {
      corporateUsers.push(await new User({
        username: `corp${i}`, email: `corp${i}@superpremium.com`, password: hashedPassword,
        name: `Admin Corp ${i}`, role: 'admin', companyId: demoCompany._id, branch: null
      }).save());
    }

    // 10. Traspasos de Stock (Ejemplos)
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
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
