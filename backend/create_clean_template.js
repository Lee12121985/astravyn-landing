const ExcelJS = require('exceljs');
const path = require('path');

const run = async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Sheet1');

    // Setup Columns
    // Col A: Name (Width ~20)
    // Col B-AE: Days (Width ~4)
    // Col AF: Count (Width ~10)
    // Col AG: Legend (Width ~15)

    sheet.getColumn('A').width = 25;
    for (let i = 2; i <= 32; i++) {
        sheet.getColumn(i).width = 5;
    }
    sheet.getColumn(33).width = 12; // AF
    sheet.getColumn(34).width = 15; // AG

    // Row 1: Dates
    // We'll put placeholders or just structure
    // A1: Title
    sheet.getCell('A1').value = 'Attendance Details for {{month}} - {{year}}';
    sheet.getCell('A1').font = { bold: true, size: 11 };
    sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    // A1 is NOT merged in screenshot? Looks like it takes A1 space.

    // B1-AE1 will be filled by server. set basic style.
    for (let i = 2; i <= 32; i++) {
        const cell = sheet.getRow(1).getCell(i);
        cell.value = i - 1; // 1..31 (FIX: Use numbers so getDayNum works)
        cell.font = { bold: true };
        cell.alignment = { textRotation: 90, vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }

    // Row 2: Status
    // A2: Name
    sheet.getCell('A2').value = '{{employeename}}';
    sheet.getCell('A2').font = { bold: true };
    sheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell('A2').border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    // B2-AE2: Empty status slots
    // Fill Gray for default? No, leave white.
    for (let i = 2; i <= 32; i++) {
        const cell = sheet.getRow(2).getCell(i);
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }

    // AF1: No.of days
    const af1 = sheet.getCell('AF1');
    af1.value = 'No.of days';
    af1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } }; // Light Blue
    af1.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    af1.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    // AF2: Count
    const af2 = sheet.getCell('AF2');
    af2.value = '{{totalpresent}}'; // server fills this
    af2.font = { bold: true, size: 12 };
    af2.alignment = { vertical: 'middle', horizontal: 'center' };
    af2.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    // Legend (AF3..AF6) - Screenshot shows it at AF3
    const legend = [
        { l: 'P', d: 'Present', c: 'FF92D050' },
        { l: 'C', d: 'Comp-off', c: 'FF00B0F0' }, // Screenshot shows Greenish C? Standard says Blue.
        { l: 'L', d: 'Leave', c: 'FFFFC000' },
        { l: 'H', d: 'Holiday', c: 'FFBFBFBF' } // Screenshot shows "Holly day"
    ];

    // AF3..AF6 is P column. AG3..AG6 is Description.
    // Screenshot: 
    // AF3: P (Green), AG3: Present
    for (let i = 0; i < legend.length; i++) {
        const r = 3 + i;
        const c1 = sheet.getRow(r).getCell(32); // AF
        const c2 = sheet.getRow(r).getCell(33); // AG

        c1.value = legend[i].l;
        c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: legend[i].c } };
        c1.alignment = { vertical: 'middle', horizontal: 'center' };
        c1.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        c2.value = legend[i].d;
        c2.alignment = { vertical: 'middle', horizontal: 'left' };
        c2.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }

    const outFile = path.join(__dirname, 'templates', 'CLEAN_SKP_TEMPLATE.xlsx');
    await wb.xlsx.writeFile(outFile);
    console.log('Created:', outFile);
};

run().catch(console.error);
