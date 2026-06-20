require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;
console.log('Using MONGODB_URI=', !!uri);

(async () => {
  try {
    await mongoose.connect(uri, { connectTimeoutMS: 10000, serverSelectionTimeoutMS: 10000 });
    console.log('✅ Connected to MongoDB');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ MongoDB connection error:');
    console.error('name:', err.name);
    console.error('message:', err.message);
    if (err.reason) console.error('reason:', err.reason);
    if (err.stack) console.error(err.stack.split('\n').slice(0,6).join('\n'));
    process.exit(1);
  }
})();
