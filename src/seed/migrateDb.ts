import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/DaePoint';

async function migrateCollections() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error('Database connection failed');
    }

    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    if (collectionNames.includes('companies')) {
      console.log('Renaming "companies" to "companies"...');
      await db.collection('companies').rename('companies');
    } else {
      console.log('"companies" collection not found or already renamed.');
    }

    if (collectionNames.includes('suppliers')) {
      console.log('Renaming "suppliers" to "suppliers"...');
      await db.collection('suppliers').rename('suppliers');
    } else {
      console.log('"suppliers" collection not found or already renamed.');
    }

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await mongoose.disconnect();
  }
}

migrateCollections();
