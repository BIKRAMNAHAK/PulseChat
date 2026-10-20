const dns = require('dns');
// Set public DNS to resolve MongoDB Atlas SRV records (fixes querySrv ECONNREFUSED)
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  console.warn('DNS server override warning:', e.message);
}

const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri =
    process.env.MONGODB_URI ||
    'mongodb+srv://bikramnahak9714:c2qKnlmErYZ0BR2q@cluster0.9n2j2.mongodb.net/mychat';

  console.log(`Connecting to MongoDB Atlas...`);

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`✅ MongoDB Atlas connected successfully: ${conn.connection.host} (DB: ${conn.connection.name})`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    console.log('🔄 Retrying MongoDB connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;
