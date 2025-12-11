const http = require('http');
const fs = require('fs');

const payload = JSON.stringify({
  company: 'ACME',
  employeeName: 'Jane Doe',
  payPeriod: 'Dec 2025',
  attendance: [ { date: '2025-12-01', day: 'Mon', status: 'P' } ],
  summary: { totalPresent: 1, totalLeave: 0, totalHoliday: 0, attendancePercent: 100 }
});

const outPath = 'd:/anti gravity/DATING-AVIN/projects/astravyn-landing/backend/test_report_json_node.xlsx';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/export-template',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = http.request(options, (res) => {
  console.log('STATUS:', res.statusCode);
  if(res.statusCode !== 200){
    console.error('Server returned non-200 status');
  }
  const fileStream = fs.createWriteStream(outPath);
  res.pipe(fileStream);
  fileStream.on('finish', () => {
    fileStream.close();
    console.log('Saved:', outPath);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(payload);
req.end();
