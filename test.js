const http = require('http');
const data = JSON.stringify({email:'test@example.com', password:'password123'});
const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/users/login',
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'Content-Length': data.length}
}, res => {
  let body = '';
  res.on('data', d => body+=d);
  res.on('end', () => console.log("Response:", body));
});
req.on('error', error => console.error("HTTP Error:", error));
req.write(data);
req.end();
