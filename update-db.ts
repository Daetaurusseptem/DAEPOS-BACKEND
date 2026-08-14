import mongoose from 'mongoose';
import Category from './src/models-mongoose/Category';

const uri = 'mongodb://127.0.0.1:27017/posdb'; // URI por defecto, asumiendo db local

const run = async () => {
  try {
    await mongoose.connect(uri);
    console.log('Connected to DB');
    const result = await Category.updateMany(
      { name: 'Insumos de Limpieza y Operación' },
      { $set: { isOperational: true } }
    );
    console.log(`Updated ${result.modifiedCount} categories.`);
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
};

run();
