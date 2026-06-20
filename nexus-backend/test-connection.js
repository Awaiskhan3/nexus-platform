require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('Attempting initial connection...');
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log(`Initial connection failed: ${error.message}`);
    if (error.message.includes('querySrv') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      console.warn('⚠️ MongoDB connection failed due to DNS resolution issues. Retrying with Google/Cloudflare DNS...');
      try {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`✅ MongoDB Connected (via DNS fallback): ${conn.connection.host}`);
      } catch (retryError) {
        console.error('❌ MongoDB connection failed after DNS fallback:', retryError.message);
        process.exit(1);
      }
    } else {
      console.error('❌ MongoDB connection failed:', error.message);
      process.exit(1);
    }
  }
};

connectDB();
