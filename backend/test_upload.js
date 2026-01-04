// test_upload.js — uploads existing template as custom template, then runs export
const http = require('http');
const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, 'public', 'template', 'TIMESHEET_NOVEMBER-SKP.xlsx');
const boundary = '----FormBoundary' + Date.now();

const fileData = fs.readFileSync(templatePath);
const filename = 'TIMESHEET_NOVEMBER-SKP.xlsx';

const body = [
  `--${boundary}`,
  `Content-Disposition: form-data; name="template"; filename="${filename}"`,
  'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '',
  fileData.toString('binary'),
  `--${boundary}--`,
  ''
].join('\r\n');

const binaryBody = Buffer.from(body, 'binary');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/upload-template',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': binaryBody.length
  }
};

console.log('Uploading template...');
const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', data);
    // Now run export test
    runExportTest();
  });
});
req.on('error', (e) => console.error('Upload error:', e.message));
req.write(binaryBody);
req.end();

function runExportTest() {
  const payload = JSON.stringify({
    company: 'ACME',
    employeeName: 'Jane Doe',
    employeeId: 'AC-001',
    month: 'December',
    year: '2025',
    attendanceRows: [{ date: '2025-12-01', day: 'Mon', status: 'P' }],
    summary: { totalPresent: 1, totalLeave: 0, totalHoliday: 0, attendancePercent: 100 }
  });

  const expOptions = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/export-template',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  console.log('\nExporting template...');
  const outPath = path.join(__dirname, 'test_export_custom.xlsx');
  const expReq = http.request(expOptions, (res) => {
    console.log('Export STATUS:', res.statusCode);
    const fileStream = fs.createWriteStream(outPath);
    res.pipe(fileStream);
    fileStream.on('finish', () => {
      fileStream.close();
      console.log('Saved export to:', outPath);
    });
  });
  expReq.on('error', (e) => console.error('Export error:', e.message));
  expReq.write(payload);
  expReq.end();
}
