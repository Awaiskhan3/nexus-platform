require('dotenv').config();
const mongoose = require('mongoose');

const user = process.env.MONGODB_USERNAME;
const pass = process.env.MONGODB_PASSWORD;
const dbName = process.env.MONGODB_DBNAME || 'nexus';

// Use one shard host (resolved earlier)
const host = 'ac-pyiqyeu-shard-00-00.yaeh7ur.mongodb.net';
const port = 27017;

const uri = `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${dbName}?authSource=admin&tls=true&directConnection=true`;
console.log('Trying direct URI:', uri.replace(/:[^:@]+@/, ':*****@'));

(async () => {
  try {
    await mongoose.connect(uri, { connectTimeoutMS: 10000, serverSelectionTimeoutMS: 10000 });
    console.log('✅ Direct connected to MongoDB host');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Direct connection error:');
    console.error(err && err.message ? err.message : err);
    if (err && err.stack) console.error(err.stack.split('\n').slice(0,6).join('\n'));
    process.exit(1);
  }
})();
