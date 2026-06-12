const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Users/jaime/POS/backend/.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/DaePoint';

async function checkPendingOrders() {
  try {
    await mongoose.connect(MONGO_URI);
    const PendingOrder = require('c:/Users/jaime/POS/backend/src/models-mongoose/PendingOrder').default;
    
    const orders = await PendingOrder.find().sort({ date: -1 }).limit(5);
    console.log("LAST 5 PENDING ORDERS:");
    orders.forEach(o => {
      console.log(`- ID: ${o._id}, kitchenStatus: ${o.kitchenStatus}, paymentStatus: ${o.paymentStatus}, total: ${o.total}, items: ${o.productsSold.length}`);
    });
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    mongoose.disconnect();
  }
}

checkPendingOrders();
