require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('Attempting initial connection...');
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
    });

  } catch (error) {
    console.log(`Initial connection failed: ${error.message}`);
    // If SRV lookup fails (common on some Windows / network setups), attempt alternate strategies
    if (error.message.includes('querySrv') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      console.warn('⚠️ MongoDB SRV lookup failed. Trying nslookup-based fallback (build direct hosts URI)...');

      const { exec } = require('child_process');
      console.log('MONGODB_URI (debug):', process.env.MONGODB_URI);
      let srvName = null;
      try {
        const tmp = (process.env.MONGODB_URI || '').replace(/^mongodb\+srv:/, 'http:');
        const u = new URL(tmp);
        srvName = u.hostname;
      } catch (e) {
        srvName = null;
      }

      if (srvName) {
        console.log('Detected SRV name from MONGODB_URI:', srvName);
        try {
          const lookup = () => new Promise((resolve, reject) => {
            exec(`nslookup -type=SRV ${srvName}`, { timeout: 10000 }, (err, stdout) => {
              if (err) return reject(err);
              const hosts = [];
              const lines = stdout.split(/\r?\n/);
              for (const line of lines) {
                const m1 = line.match(/\s*service = \d+ \d+ (\d+) (\S+)/i);
                if (m1) {
                  hosts.push(m1[2].replace(/\.$/, ''));
                  continue;
                }
                const m2 = line.match(/svr hostname\s*=\s*(\S+)/i);
                if (m2) {
                  hosts.push(m2[1].replace(/\.$/, ''));
                }
              }
              // Fallback parsing: collect any words that look like the shard hostnames
              if (hosts.length === 0) {
                for (const l of lines) {
                  const mh = l.match(/([a-z0-9\-]+\.yaeh7ur\.mongodb\.net)\.?/i);
                  if (mh) hosts.push(mh[1].replace(/\.$/, ''));
                }
              }
              resolve(hosts.filter(Boolean));
            });
          });

          const hosts = await lookup();
          if (hosts.length === 0) {
            console.error('nslookup returned no hosts. Raw output follows (for debugging):');
            try {
              // run one more time and print stdout
              const { execSync } = require('child_process');
              const out = execSync(`nslookup -type=SRV ${srvName}`, { timeout: 10000, encoding: 'utf8' });
              console.error(out);
            } catch (e) {
              console.error('Failed to capture nslookup verbose output:', e.message || e);
            }
            throw new Error('No SRV targets discovered via nslookup');
          }

          // Build a direct mongodb:// URI using discovered hosts
          const user = process.env.MONGODB_USERNAME;
          const pass = process.env.MONGODB_PASSWORD;
          let dbName = 'nexus';
          try {
            const afterSlash = process.env.MONGODB_URI.split('/').slice(3).join('/');
            dbName = afterSlash ? afterSlash.split('?')[0] : dbName;
          } catch (_) {}
          const hostList = hosts.map(h => `${h}:27017`).join(',');
          const queryParts = ['authSource=admin', 'tls=true', 'directConnection=false'];
          if (process.env.MONGODB_REPLICASET) queryParts.push(`replicaSet=${process.env.MONGODB_REPLICASET}`);
          const directUri = `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${hostList}/${dbName}?${queryParts.join('&')}`;

          console.log('Attempting direct host connection using URI built from SRV targets...');
          const conn2 = await mongoose.connect(directUri, { connectTimeoutMS: 10000, serverSelectionTimeoutMS: 10000 });
          console.log(`✅ MongoDB Connected (direct hosts): ${conn2.connection.host}`);
          return;
        } catch (nsErr) {
          console.error('❌ nslookup-based fallback failed:', nsErr.message || nsErr);
        }
      }

      console.warn('⚠️ As a last resort, try connecting directly to a single shard host with TLS (directConnection=true).');
      console.error('❌ MongoDB connection failed after SRV fallback:', error.message);
      process.exit(1);
    } else {
      console.error('❌ MongoDB connection failed:', error.message);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
