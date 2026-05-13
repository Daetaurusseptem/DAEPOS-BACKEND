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
      PhysicalRegister.deleteMany({}), CashRegister.deleteMany({}), Sale.deleteMany({})
    ]);

    const hashedPassword = await bcrypt.hash('admin123', 10);

    // 1. Sysadmin
    const sysadmin = await new User({
      username: 'sysadmin', email: 'sysadmin@daepoint.com', password: hashedPassword,
      name: 'System Administrator', role: 'sysadmin'
    }).save();

    // 2. Company
    const demoCompany = await new Company({
      name: 'Super Mercado Premium', description: 'Tienda de prueba con volumen masivo',
      address: 'Av. Tech 404', tel: '555-9000', email: 'contacto@superpremium.com',
      adminId: sysadmin._id, maxActiveRegisters: 10, maxCashLimit: 5000 
    }).save();

    // 3. Admin & Usuarios
    const adminUser = await new User({
      username: 'admin', email: 'admin@demo.com', password: hashedPassword,
      name: 'Gerente General', role: 'admin', companyId: demoCompany._id
    }).save();
    
    await Company.findByIdAndUpdate(demoCompany._id, { adminId: adminUser._id });

    const users = [];
    for (let i = 1; i <= 8; i++) {
      users.push(await new User({
        username: `cajero${i}`, email: `cajero${i}@demo.com`, password: hashedPassword,
        name: `Cajero Auxiliar ${i}`, role: 'user', companyId: demoCompany._id
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

    // 6. Cajas
    const registers: any[] = [];
    for (let i = 1; i <= 4; i++) {
      registers.push(await new PhysicalRegister({ name: `Caja ${i}`, company: demoCompany._id }).save());
    }

    const openSession: any = await new CashRegister({
      user: users[0]._id, physicalRegister: registers[0]._id, company: demoCompany._id,
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

      await new InventoryItem({
        name: p.name, company: demoCompany._id, product: p._id,
        stock: Math.floor(Math.random() * 150),
        costPrice: type.price * 0.6, sellingPrice: type.price + (i % 10),
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

    console.log('✅ Super Seed completado con éxito!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
