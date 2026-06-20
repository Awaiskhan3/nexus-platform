const { exec } = require('child_process');
exec('nslookup -type=SRV cluster0.yaeh7ur.mongodb.net', { timeout: 10000 }, (err, stdout, stderr) => {
  if (err) {
    console.error('ERR', err.message);
    console.error(stderr);
    process.exit(1);
  }
  console.log('--- STDOUT START ---');
  console.log(stdout);
  console.log('--- STDOUT END ---');
});
