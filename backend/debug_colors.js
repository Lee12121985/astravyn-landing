const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const http = require('http');

// 1. Request the export
const payload = JSON.stringify({
    company: 'Debug Co',
    employeeName: 'ColorTest',
    month: 'December',
    year: 2025,
    templateId: 'mj2k11xl43mtlkyyg18',
    attendanceRows: Array.from({ length: 31 }, (_, i) => {
        const d = i + 1;
        const date = new Date(2025, 11, d); // Dec 2025
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayName = days[date.getDay()];
        // Set everything to 'P' to see if colors are consistent
        // except weekends
        let status = 'P';
        if (dayName === 'Sat') status = 'ST';
        if (dayName === 'Sun') status = 'SU';

        return {
            date: `2025-12-${String(d).padStart(2, '0')}`,
            status: status,
            day: dayName, // explicitly provide day
            isWeekend: (dayName === 'Sat' || dayName === 'Sun') ? dayName.toLowerCase() : null
        };
    })
});

const TMP_FILE = path.join(__dirname, 'debug_export.xlsx');
const file = fs.createWriteStream(TMP_FILE);

const req = http.request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/export-template',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length
    }
}, (res) => {
    res.pipe(file);
    file.on('finish', async () => {
        file.close();
        console.log('Export downloaded to', TMP_FILE);
        await inspectFile(TMP_FILE);
    });
});

req.on('error', (e) => console.error('Request Error:', e));
req.write(payload);
req.end();

// 2. Inspect the file
async function inspectFile(filePath) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    const sh = wb.worksheets[0];

    console.log('--- Header Date Check ---');
    console.log('B1 (Day 1 Header):', sh.getCell('B1').value);
    console.log('C1 (Day 2 Header):', sh.getCell('C1').value);

    console.log('--- Inspecting Styles ---');
    // Assume Row 1 is Date, Row 2 is Status
    // Find where our data is
    // We know from logs it used Horizontal logic

    // Look at Row 2, Columns for Dec 1, 2, 3...
    // Dec 1 2025 is Mon. Dec 3 is Wed.
    // In previous run, user saw gray at Dec 3.

    // Let's print the styles for first 10 columns in Row 2
    const row = sh.getRow(2);
    row.eachCell((cell, colNum) => {
        const val = cell.value;
        const fill = cell.fill;
        const argb = fill && fill.fgColor ? fill.fgColor.argb : 'NONE';
        console.log(`Col ${colNum} [${val}]: Fill=${JSON.stringify(fill)}`);
    });

    console.log('--- Metadata Check ---');
    console.log('A1 (Title):', sh.getCell('A1').value);
    console.log('A2 (Name):', sh.getCell('A2').value);

    // Check for Conditional Formatting
    // ExcelJS doesn't fully support reading CFs in a way that shows *effect*, but we can check if they exist?
    // Actually ExcelJS property is sheet.conditionalFormattings
    // It returns an array of rules.

    console.log('--- Conditional Formattings ---');
    if (sh.conditionalFormatting) {
        // ExcelJS might expose it as `conditionalFormattings` (plural) depending on version, 
        // or `sheet.getConditionalFormattingRules()`?
        // Checking implementation...
        // Since v4, accessing it might be tricky if not fully parsed.
        // But let's try commonly known accessors.
    }
}
