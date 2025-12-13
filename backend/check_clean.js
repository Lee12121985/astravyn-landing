const ExcelJS = require('exceljs');
const path = require('path');

const run = async () => {
    const wb = new ExcelJS.Workbook();
    const p = path.join(__dirname, 'templates', 'CLEAN_SKP_TEMPLATE.xlsx');
    console.log('Reading:', p);
    await wb.xlsx.readFile(p);
    const sheet = wb.getWorksheet(1);

    // Check Row 2
    for (let i = 2; i <= 15; i++) {
        const cell = sheet.getRow(2).getCell(i);
        console.log(`Col ${i} Val=${cell.value} Fill=${JSON.stringify(cell.fill)}`);
    }

    // Check Conditional Formatting
    console.log('CFs:', sheet.conditionalFormattings);
};

run();
