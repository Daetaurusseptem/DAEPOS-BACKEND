import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Company from '../models-mongoose/Company';
import Category from '../models-mongoose/Category';
import Product from '../models-mongoose/Product';
import InventoryItem from '../models-mongoose/InventoryItem';
import Supplier from '../models-mongoose/Supplier';
import Branch from '../models-mongoose/Branch';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/DaePoint';

async function seedOperativos() {
  try {
    console.log('🚀 Iniciando Inyección de Insumos Operativos...');
    await mongoose.connect(MONGO_URI);

    // Buscar una compañía (Usamos la principal o la primera que encontremos)
    let company = await Company.findOne({ name: 'Grupo Alsea B2B S.A.' });
    if (!company) {
      company = await Company.findOne({});
      if (!company) {
        console.error('❌ No se encontraron empresas en la BD.');
        process.exit(1);
      }
    }

    console.log(`🏢 Inyectando en la empresa: ${company.name}`);

    // Buscar todas las sucursales de la empresa
    const branches = await Branch.find({ company: company._id });
    if (branches.length === 0) {
      console.error('❌ La empresa no tiene sucursales activas.');
      process.exit(1);
    }

    // 1. Crear Categoría de Uso Interno
    let catOperativa = await Category.findOne({ name: 'Insumos de Limpieza y Operación', company: company._id });
    if (!catOperativa) {
      catOperativa = await new Category({
        name: 'Insumos de Limpieza y Operación',
        description: 'Productos operativos como escobas, jabón, cajas, etc.',
        isOperational: true,
        company: company._id,
      }).save();
      console.log('✅ Categoría "Limpieza y Operación" creada.');
    }

    // 2. Crear Proveedor
    let supplierOp = await Supplier.findOne({ name: 'Distribuidora Insumos MX', company: company._id });
    if (!supplierOp) {
      supplierOp = await new Supplier({
        name: 'Distribuidora Insumos MX',
        description: 'Venta al por mayor de artículos de limpieza y cajas.',
        company: company._id,
        contactInfo: {
          email: 'ventas@insumosmx.com',
          phone: '555-4444',
          address: 'Central de Abastos Local 500',
        },
      }).save();
      console.log('✅ Proveedor "Distribuidora Insumos MX" creado.');
    }

    // 3. Lista de Insumos Operativos
    const operativosData = [
      { name: 'Galón de Cloro Concentrado 5L', brand: 'Cloralex', unitOfMeasure: 'unit', costPrice: 45 },
      { name: 'Escoba de Cerdas Gruesas', brand: 'Genérica', unitOfMeasure: 'unit', costPrice: 35 },
      { name: 'Trapeador de Algodón M', brand: 'Genérica', unitOfMeasure: 'unit', costPrice: 40 },
      { name: 'Líquido Limpiador Multiusos 10L', brand: 'Fabuloso', unitOfMeasure: 'unit', costPrice: 120 },
      { name: 'Rollo de Servitoallas Industriales', brand: 'Pétalo', unitOfMeasure: 'unit', costPrice: 85 },
      { name: 'Guantes de Nitrilo (Caja 100)', brand: 'Amdic', unitOfMeasure: 'unit', costPrice: 150 },
      { name: 'Bolsas de Basura Jumbo (Rollo 50)', brand: 'Costal', unitOfMeasure: 'unit', costPrice: 60 },
      { name: 'Foco LED 15W Cálida', brand: 'Philips', unitOfMeasure: 'unit', costPrice: 50 },
      { name: 'Cajas de Cartón para Llevar', brand: 'EcoPack', unitOfMeasure: 'unit', costPrice: 200 },
      { name: 'Cinta Canela Gruesa', brand: 'Tuk', unitOfMeasure: 'unit', costPrice: 25 },
    ];

    let itemsCreated = 0;

    for (const item of operativosData) {
      // Evitar duplicados por nombre
      let p = await Product.findOne({ name: item.name, company: company._id });
      if (!p) {
        // Crear Producto con isSellable: false
        p = await new Product({
          name: item.name,
          brand: item.brand,
          isComposite: false,
          isSellable: false,
          supplier: supplierOp._id,
          categories: [catOperativa._id],
          company: company._id,
        }).save();

        // Crear Inventario en CADA sucursal
        for (const branch of branches) {
          await new InventoryItem({
            name: p.name,
            company: company._id,
            branch: branch._id,
            product: p._id,
            stock: Math.floor(Math.random() * 20) + 5, // Stock aleatorio inicial
            costPrice: item.costPrice,
            sellingPrice: 0, // No se vende
            measurement: item.unitOfMeasure,
            supplier: supplierOp._id,
            barCode: `OP-${Math.floor(Math.random() * 100000)}`,
          }).save();
        }
        itemsCreated++;
      }
    }

    console.log(`🎉 Inyección Completada: Se crearon ${itemsCreated} insumos operativos nuevos.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en el seed de operativos:', error);
    process.exit(1);
  }
}

seedOperativos();
