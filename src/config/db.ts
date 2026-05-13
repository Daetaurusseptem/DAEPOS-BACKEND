// backend/config/database.ts
import mongoose from 'mongoose';

// URL de conexión a la base de datos MongoDB
const dbURL = process.env.MONGO_URI || 'mongodb://localhost:27017/DaePoint';

// Conexión a la base de datos MongoDB 
const connection = mongoose.connect(dbURL)
.then(() => {
    console.log("Mongo database connection established");
})
.catch(err => {
    console.error("Mongo database connection error:", err);
});

export default connection;
  
