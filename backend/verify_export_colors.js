const http = require('http');

const data = JSON.stringify({
    company: 'Test Co',
    employeeName: 'Test Emp',
    month: 'November',
    year: 2025,
    attendanceRows: [
        { date: '2025-11-01', status: 'P', day: 'Sat', isWeekend: 'sat' },
        { date: '2025-11-02', status: 'SU', day: 'Sun', isWeekend: 'sun' },
        { date: '2025-11-03', status: 'P', day: 'Mon' },
        { date: '2025-11-04', status: 'A', day: 'Tue' },
        { date: '2025-11-05', status: 'H', day: 'Wed' }
    ],
    templateId: 'skp-default' // Use a template ID that triggers the complex logic
});

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/export-template',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.on('data', (d) => {
        // just consume data
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.write(data);
req.end();
