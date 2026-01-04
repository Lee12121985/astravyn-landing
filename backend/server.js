// Simple Express server providing POST /api/export-template
// Supports:
// 1. Normal Export (Legacy/Default logic)
// 2. Custom Template Export (Preserves styles, clones rows, applies colors)
// 3. Template Management (Upload/List)

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const ExcelJS = require('exceljs');
const os = require('os');
const multer = require('multer');
// const { v4: uuidv4 } = require('uuid'); // Removed to avoid dependency

// Helper for simple ID generation if uuid fails (fallback)
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Static files
app.use('/', express.static(path.join(__dirname, '..'), { extensions: ['html'] }));
app.use('/timesheet', express.static(path.join(__dirname, '..', 'timesheet'), { extensions: ['html'] }));
app.use('/template', express.static(path.join(__dirname, 'public', 'template')));
app.use('/dating', express.static(path.join(__dirname, '..', 'dating'), { extensions: ['html'] }));

// Config
const TEMPLATE_DIR = path.join(__dirname, 'templates');
const TEMPLATE_INDEX = path.join(TEMPLATE_DIR, 'templates.json');
const UPLOAD_DIR = path.join(TEMPLATE_DIR, 'uploads');

// Ensure directories exist
if (!fs.existsSync(TEMPLATE_DIR)) fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(TEMPLATE_INDEX)) {
  fs.writeFileSync(TEMPLATE_INDEX, JSON.stringify([], null, 2));
}

// Multer for Template Upload
const uploadTemplate = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.endsWith('.xlsx')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx files are allowed'));
    }
  }
});
const uploadLegacy = multer({ dest: path.join(__dirname, 'public', 'template') }); // Keep legacy

// --- TEMPLATE MANAGEMENT ENDPOINTS ---

// GET /api/templates - List available templates
app.get('/api/templates', (req, res) => {
  try {
    const templates = JSON.parse(fs.readFileSync(TEMPLATE_INDEX, 'utf8') || '[]');
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load template list' });
  }
});

// POST /api/templates/upload - Upload new template
app.post('/api/templates/upload', uploadTemplate.single('template'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const templates = JSON.parse(fs.readFileSync(TEMPLATE_INDEX, 'utf8') || '[]');
    const id = generateId();
    // Sanitize filename to avoid weird char issues
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const finalFilename = `${id}_${safeName}`;
    const finalPath = path.join(TEMPLATE_DIR, finalFilename);

    // Move from temp upload dir to templates dir
    fs.renameSync(req.file.path, finalPath);

    const newTemplate = {
      id: id,
      name: req.body.displayName || req.file.originalname,
      filename: finalFilename,
      originalName: req.file.originalname,
      uploadDate: new Date().toISOString(),
      mappingMode: 'auto'
    };

    templates.push(newTemplate);
    fs.writeFileSync(TEMPLATE_INDEX, JSON.stringify(templates, null, 2));

    res.json({ ok: true, template: newTemplate });
  } catch (err) {
    console.error('Template upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- EXPORT logic ---

// Helper: Copy style from one cell to another
const copyStyle = (sourceNode, targetNode) => {
  if (!sourceNode) return;
  try {
    // Deep copy style object
    targetNode.style = JSON.parse(JSON.stringify(sourceNode.style));
  } catch (e) { }
};

// Helper: Parse cell value to Day Number (1-31)
const getDayNum = (val) => {
  if (!val) return null;
  // If it's a number (Excel date or plain number)
  if (typeof val === 'number') {
    return (val >= 1 && val <= 31) ? val : null;
  }
  // If ExcelJS returns a Date object
  if (val instanceof Date) {
    return val.getDate();
  }
  const s = String(val).trim();

  // Match "1", "01"
  if (/^\d{1,2}$/.test(s)) return parseInt(s, 10);

  // Match "1-Nov", "01-Nov", "SAT 1-Nov", "1-Nov-25"
  // Look for digit(s) followed by hyphen or space and a month
  const match = s.match(/(?:^|\s)(\d{1,2})[-/\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Fallback: regular date parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.getDate();

  return null;
};

// Helper: Smart Place Template Data
const fillWorkbook = async (workbook, data) => {
  const sheet = workbook.worksheets[0]; // Assume first sheet

  // CRITICAL FIX: Remove legacy Conditional Formatting which might override our colors
  // The template likely has CF rules for weekends (e.g. Sat/Sun) which persist even if we change the date.
  if (sheet.conditionalFormattings) {
    sheet.conditionalFormattings = [];
  }
  // Try to remove "PatternFills" that might be stubborn if possible, 
  // currently clearing conditionalFormattings is the standard way.

  // 1. Header Mapping (Placeholder Strategy)
  const headerMap = {
    '{{company}}': data.company,
    '{{employeename}}': data.employeeName,
    '{{employee_name}}': data.employeeName,
    '{{name}}': data.employeeName,
    '{{employeeid}}': data.employeeId,
    '{{employee_id}}': data.employeeId,
    '{{month}}': data.month,
    '{{year}}': data.year,
    '{{monthyear}}': `${data.month} ${data.year}`,
    '{{period}}': `${data.month} ${data.year}`
  };

  const normalize = s => (s || '').toString().trim().toLowerCase();

  // Track where we put the employee name to guess data row
  let nameRowIdx = -1;

  // Scan for single-cell placeholders & Replace
  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      if (cell.value && typeof cell.value === 'string') {
        const val = normalize(cell.value);
        // Check exact matches or inclusions
        for (const [key, replaceVal] of Object.entries(headerMap)) {
          if (val.includes(key)) {
            cell.value = cell.value.toString().replace(new RegExp(key, 'ig'), replaceVal || '');
            if (key.includes('name')) nameRowIdx = rowNumber;
          }
        }
      }
    });
  });

  // --- DETECT ORIENTATION ---
  // Look for a row that acts as a "Date Header" (contains 1..31)
  let horizontalHeaderRow = -1;
  let dateColMap = {}; // Maps Day 1..31 -> Column Index

  sheet.eachRow((row, rowNumber) => {
    if (horizontalHeaderRow !== -1) return; // Found already

    let validDays = 0;
    let tempMap = {};

    row.eachCell((cell, colNumber) => {
      const d = getDayNum(cell.value);
      if (d) {
        validDays++;
        tempMap[d] = colNumber;
      }
    });

    // If we found a significant number of days (e.g. > 5) in one row, assume Horizontal
    if (validDays > 5) {
      horizontalHeaderRow = rowNumber;
      dateColMap = tempMap;
    }
  });

  if (horizontalHeaderRow !== -1) {
    console.log('Detected Horizontal Template on Row', horizontalHeaderRow);

    // Horizontal Fill Strategy
    // 1. Determine Data Row: We want the row *after* the header's sub-rows.
    // Horizontal Fill Strategy
    // User Request: Status should go into Header + 1 (The existing Day Name Row), overwriting it.
    const dataRowIdx = horizontalHeaderRow + 1;

    console.log('Using Data Row for Status (Overwriting Day Names):', dataRowIdx);

    const rowsToAdd = data.attendanceRows || []; // Array of day objects
    const dataRow = sheet.getRow(dataRowIdx);

    // Calculate P count for "No.of days"
    let presentCount = 0;

    rowsToAdd.forEach(item => {
      // Parse day from item.date (e.g. "12/1/2025")
      const dayNum = new Date(item.date).getDate();
      const colIdx = dateColMap[dayNum];

      if (colIdx) {
        // 1. Update Date Header (Row 1) - e.g. "1-Nov-25"
        const dateCell = sheet.getRow(horizontalHeaderRow).getCell(colIdx);
        const dObj = new Date(item.date);
        // Ensure item.day exists for logic below
        const dayName = item.day ? item.day.toUpperCase() : dObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

        const mStr = dObj.toLocaleString('en-us', { month: 'short' });
        const yy = dObj.getFullYear().toString().slice(-2);
        // Fix: Use Data String to avoid Timezone/UTC Buffer shifts in Excel
        dateCell.value = `${dObj.getDate()}-${mStr}-${yy}`;
        // dateCell.numFmt = 'd-mmm-yy'; // Not needed if string

        // Weekend Header Coloring (Row 1)
        if (['SAT', 'SUN'].includes(dayName)) {
          // dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } }; // Removed per user request
          dateCell.font = { bold: true };
        } else {
          // Reset fill for weekdays to ensure no residual color from template
          dateCell.fill = { type: 'pattern', pattern: 'none' };
        }

        // 2. Fill Status (Row 2 - Overwriting Day Name)
        const statusCell = dataRow.getCell(colIdx);
        const s = (item.status || '').toUpperCase();
        statusCell.value = s;

        // Count P and C (Comp-off) as Present
        if (['P', 'C'].includes(s)) presentCount++;

        // Apply Status Colors (Standard Vibrant / Legend Match)
        let argb = null;
        let pFontColor = null;

        if (s === 'P') {
          argb = 'FF92D050'; // Bright Green (Excel Good)
          pFontColor = 'FF006100'; // Dark Green text for contrast
        }
        else if (s === 'L') {
          argb = 'FFFFC000'; // Orange/Gold
          pFontColor = 'FF9C0006'; // Dark Red/Brown text
        }
        else if (s === 'C') {
          argb = 'FF00B0F0'; // Bright Blue
          pFontColor = 'FF000000'; // Black text
        }
        else if (s === 'H') {
          argb = 'FFFFEB9C'; // Light Yellow for Holiday
          pFontColor = 'FF9C6500'; // Dark Yellow text
        }
        else if (s === 'A') {
          argb = 'FFFF7C80'; // Red for Absent
          pFontColor = 'FF630006'; // Dark Red text
        }
        else if (s === 'HD') {
          argb = 'FFD8E4BC'; // Light Green
          pFontColor = 'FF3F3F3F';
        }
        else if (['ST', 'SU', 'SAT', 'SUN', 'WO'].includes(s)) {
          argb = 'FFBFBFBF'; // Gray for Weekends
          pFontColor = 'FF000000';
        }



        // Apply Status Colors
        if (argb) {
          // Explicitly set the fill to overwrite correctly
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: argb }
          };
          // Preserve existing border if possible, otherwise rely on template
          statusCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: pFontColor || 'FF000000' } };
          statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          // Explicitly clear fill if no status or unknown
          statusCell.fill = {
            type: 'pattern',
            pattern: 'none'
          };
        }
      }
    });

    // dataRow.commit(); // Removed: Not needed for Document (non-streaming) API and causes issues with style persistence sometimes.

    // 4. Update "No.of days" Count
    // ... (existing code for count) ...
    let countUpdated = false;
    sheet.eachRow((row, rowNumber) => {
      // ... (existing loop)
      if (countUpdated || rowNumber > 5) return;
      row.eachCell((cell, colNumber) => {
        if (cell.value && cell.value.toString().toLowerCase().includes('no.of days')) {
          const targetCell = sheet.getRow(rowNumber + 1).getCell(colNumber);
          targetCell.value = presentCount;
          targetCell.font = { bold: true };
          targetCell.alignment = { horizontal: 'center' };
          countUpdated = true;
        }
      });
    });

    // FIX: Force Overwrite Name (A2) and Title (A1) for SKP Layout
    // Even if template has hardcoded "Likhichand.L", we overwrite it with actual data.
    // Horizontal Header usually Row 1. Name usually at Row 2, Col 1.
    if (horizontalHeaderRow === 1) {
      // Title at A1
      const titleCell = sheet.getCell('A1');
      titleCell.value = `Attendance Details for ${data.month} - ${data.year}`;

      // Name at A2 (Data Row, Col 1)
      const nameCell = sheet.getRow(dataRowIdx).getCell(1); // A2 if dataRowIdx is 2
      nameCell.value = data.employeeName;
      // Ensure styling
      nameCell.font = { bold: true };
      nameCell.alignment = { vertical: 'middle', horizontal: 'center' };
    }

  } else {
    // --- VERTICAL STRATEGY (Legacy) ---
    // 2. Table Row Insertion Strategy
    // Heuristic: Find a row containing "Date" and "Status" (Header). The row BELOW it is the start row.
    let startRow = -1;
    let headerRowIdx = -1;

    sheet.eachRow((row, rowNumber) => {
      if (headerRowIdx !== -1) return; // Found already
      let hasDate = false;
      let hasStatus = false;
      row.eachCell((cell) => {
        const v = normalize(cell.value);
        if (v.includes('date') || v.includes('day')) hasDate = true;
        if (v.includes('status') || v.includes('remark')) hasStatus = true;
      });
      if (hasDate) {
        headerRowIdx = rowNumber;
        startRow = rowNumber + 1;
      }
    });

    // Fallback if no header found: try row 10
    if (startRow === -1) startRow = 10;

    // Detect Columns based on Header Row
    let colMap = { date: 1, day: 2, status: 3 };
    if (headerRowIdx !== -1) {
      const hRow = sheet.getRow(headerRowIdx);
      hRow.eachCell((cell, colNumber) => {
        const v = normalize(cell.value);
        if (v.includes('date')) colMap.date = colNumber;
        else if (v.includes('day')) colMap.day = colNumber;
        else if (v.includes('status')) colMap.status = colNumber;
      });
    }

    const rowsToAdd = data.attendanceRows || [];
    if (rowsToAdd.length > 0) {
      // Insert empty rows if needed to make space
      if (rowsToAdd.length > 1) {
        sheet.spliceRows(startRow + 1, 0, ...new Array(rowsToAdd.length - 1).fill([]));
      }

      const templateRow = sheet.getRow(startRow);

      rowsToAdd.forEach((item, index) => {
        const currentRowIdx = startRow + index;
        const currentRow = sheet.getRow(currentRowIdx);

        // Copy styles from template row to this row
        templateRow.eachCell({ includeEmpty: true }, (templateCell, colNumber) => {
          const targetCell = currentRow.getCell(colNumber);
          copyStyle(templateCell, targetCell);
        });

        // Set Values
        const dateCell = currentRow.getCell(colMap.date);
        dateCell.value = item.date;
        const dayCell = currentRow.getCell(colMap.day);
        dayCell.value = item.day;
        const statusCell = currentRow.getCell(colMap.status);
        statusCell.value = item.status;

        // Apply Weekend Coloring
        // Saturday: #1ABC9C, Sunday: #E67E22
        if (item.isWeekend === 'sat' || item.isWeekend === 'sun') {
          const argb = item.isWeekend === 'sat' ? 'FF1ABC9C' : 'FFE67E22';
          const fillStyle = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: argb }
          };

          // Apply to Date, Day, and Status columns
          [colMap.date, colMap.day, colMap.status].forEach(c => {
            const cell = currentRow.getCell(c);
            cell.fill = fillStyle;
          });
        }

        currentRow.commit();
      });
    }
  }

  // 3. Footer / Summary Mapping
  const summaryMap = {
    '{{totalpresent}}': data.summary?.totalPresent || 0,
    '{{totalleave}}': data.summary?.totalLeave || 0,
    '{{totalholiday}}': data.summary?.totalHoliday || 0,
    '{{attendancepercent}}': (data.summary?.attendancePercent || 0) + '%'
  };

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.value && typeof cell.value === 'string') {
        const val = normalize(cell.value);
        for (const [key, replaceVal] of Object.entries(summaryMap)) {
          if (val.includes(key)) {
            cell.value = cell.value.toString().replace(new RegExp(key, 'ig'), replaceVal);
          }
        }
      }
    });
  });
};

// POST /api/export// --- API: EXPORT ---
app.post('/api/export-template', uploadLegacy.single('template'), async (req, res) => {
  console.log('--- /api/export-template called ---');
  let tempFilePath = null;

  try {
    // Parse Body
    const rawBody = req.body || {};
    const body = {};
    for (const k of Object.keys(rawBody)) {
      try { body[k] = JSON.parse(rawBody[k]); } catch (e) { body[k] = rawBody[k]; }
    }

    // 1. Determine Template Source
    let templateBuffer;
    let templatePath = null; // Declare early to avoid ReferenceError

    if (body.templateId === 'default') {
      console.log('Generating UI-Style Report (New Workbook)');
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Timesheet');

      // Add Columns
      sheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Day', key: 'day', width: 10 },
        { header: 'Status', key: 'status', width: 15 }
      ];

      // Style Header
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }; // Gray-200

      // Add Data
      if (Array.isArray(body.attendanceRows)) {
        body.attendanceRows.forEach(row => {
          const r = sheet.addRow(row);
          const st = (row.status || '').toUpperCase();
          const cell = r.getCell('status');

          let argb = 'FFFFFFFF'; // White
          if (st === 'P') argb = 'FFD1FAE5'; // Green-100
          else if (st === 'L') argb = 'FFFDE68A'; // Amber-200 (Orange-ish)
          else if (st === 'C') argb = 'FFDBEAFE'; // Blue-100
          else if (['H', 'ST', 'SU'].includes(st)) argb = 'FFF3F4F6'; // Gray-100

          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
          cell.alignment = { horizontal: 'center' };
        });
      }

      // Send Response immediately (bypass fillWorkbook)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${body.employeeName || 'Export'}.xlsx"`);
      await workbook.xlsx.write(res);
      return;

    }

    // User logic update: if "skp-default" is requested or no file provided, try to find the SKP template file on server.
    // FIX: Use generated CLEAN template to avoid corruption/conditional formatting issues
    const defaultSkpPath = path.join(__dirname, 'templates', 'CLEAN_SKP_TEMPLATE.xlsx');

    if (req.file) {
      console.log('Using uploaded template:', req.file.path);
      templateBuffer = fs.readFileSync(req.file.path);
      tempFilePath = req.file.path; // Mark for deletion
      templatePath = req.file.path; // Set path
    } else if (body.templateId === 'skp-default' && fs.existsSync(defaultSkpPath)) {
      console.log('Using Clean SKP template.');
      templateBuffer = fs.readFileSync(defaultSkpPath);
      templatePath = defaultSkpPath; // CRITICAL FIX: Set templatePath so we don't fallback to old file
    } else {
      console.log('No template found. Creating new workbook (vertical strategy fallback).');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet1');
      templateBuffer = await workbook.xlsx.writeBuffer();
    }

    // 2. Check for templateId (custom templates)
    // Only look up if we haven't already found a template (like the clean SKP one above)
    // 2. Check for templateId (custom templates)
    if (!templatePath && body.templateId && body.templateId !== 'default' && body.templateId !== 'legacy') {
      const templates = JSON.parse(fs.readFileSync(TEMPLATE_INDEX, 'utf8') || '[]');
      const t = templates.find(x => x.id === body.templateId);
      if (t) {
        // Fix: Calculate path manually as t.path doesn't exist in JSON
        const tPath = path.join(TEMPLATE_DIR, t.filename);

        // FORCE CLEAN TEMPLATE if the user selects a "SKP" styled template
        if (t.filename.includes('TIMESHEET_NOVEMBER-SKP')) {
          console.log('Intercepted Corrupt Template Selection. Enforcing Clean Template.');
          if (fs.existsSync(defaultSkpPath)) {
            templateBuffer = fs.readFileSync(defaultSkpPath);
            templatePath = defaultSkpPath;
          } else {
            console.log('Using Custom Template (Fallback):', tPath);
            if (fs.existsSync(tPath)) {
              templateBuffer = fs.readFileSync(tPath);
              templatePath = tPath;
            }
          }
        } else {
          console.log('Using Custom Template:', tPath);
          if (fs.existsSync(tPath)) {
            templateBuffer = fs.readFileSync(tPath);
            templatePath = tPath;
          }
        }
      }
    }

    // 2. Fallback: Check for legacy uploaded file (req.file)
    if (!templatePath && req.file && req.file.path) {
      templatePath = req.file.path;
    }

    // 3. Fallback: Default Local Template (Original behavior)
    if (!templatePath) {
      templatePath = path.join(__dirname, 'public', 'template', 'TIMESHEET_NOVEMBER-SKP.xlsx');
    }

    if (!fs.existsSync(templatePath)) {
      // Try fallback to just filename if path construction failed
      if (fs.existsSync('public/template/TIMESHEET_NOVEMBER-SKP.xlsx')) {
        templatePath = 'public/template/TIMESHEET_NOVEMBER-SKP.xlsx';
      } else {
        return res.status(500).json({ error: 'Template file not found' });
      }
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    // Fill Data
    await fillWorkbook(workbook, body);

    // Generate Filename
    const safeCompany = (body.company || 'Company').replace(/[^a-z0-9_\-]/ig, '_');
    const safeName = (body.employeeName || 'Employee').replace(/[^a-z0-9_\-]/ig, '_');
    // Clean month/year
    const m = String(body.month || '').replace(/[^a-zA-Z0-9]/g, '');
    const y = String(body.year || '').replace(/[^0-9]/g, '');
    const filename = `${safeCompany}_${safeName}_${m}${y}_Timesheet.xlsx`;

    // Write Temp
    const tmpName = `export_${generateId()}.xlsx`;
    const tmpPath = path.join(os.tmpdir(), tmpName);
    await workbook.xlsx.writeFile(tmpPath);

    // Download
    res.download(tmpPath, filename, (err) => {
      // Cleanup
      try { fs.unlinkSync(tmpPath); } catch (e) { }
      if (req.file && req.file.path) { try { fs.unlinkSync(req.file.path); } catch (e) { } }
    });

  } catch (err) {
    console.error('Export Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
