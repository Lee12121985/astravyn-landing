// Simple Express server providing POST /api/export-template
// - Reads template at ../public/template/TIMESHEET_NOVEMBER-SKP.xlsx
// - Populates header fields and attendance rows
// - Returns filled workbook as attachment (preserves original template)

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const ExcelJS = require('exceljs');
const os = require('os');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Optional: serve static files from the public folder so front-end and backend run together
app.use('/', express.static(path.join(__dirname, '..', 'public')));

// Multer config: store uploads to OS temp dir
const upload = multer({ dest: os.tmpdir() });

// POST accepts optional uploaded file field named 'template'. If present, server will use uploaded file.
app.post('/api/export-template', upload.single('template'), async (req, res) => {
  try{
    // If multipart/form-data with a file, multer places file info on req.file and fields on req.body (strings)
    // Determine which template to use: uploaded file (req.file.path) or built-in templatePath
    let usedTemplatePath = path.join(__dirname, '..', 'public', 'template', 'TIMESHEET_NOVEMBER-SKP.xlsx');
    let uploadedTempPath = null;
    if(req.file && req.file.path){
      uploadedTempPath = req.file.path; // will be cleaned up later
      usedTemplatePath = uploadedTempPath;
    }

    // Parse payload fields. For multipart, req.body fields may be strings and arrays encoded as JSON strings.
    const rawBody = req.body || {};
    const body = {};
    for(const k of Object.keys(rawBody)){
      try{ body[k] = JSON.parse(rawBody[k]); } catch(e){ body[k] = rawBody[k]; }
    }
    const company = body.company || '';
    const employeeName = body.employeeName || '';
    const employeeId = body.employeeId || '';
    const month = body.month || '';
    const year = body.year || '';
    const attendanceRows = Array.isArray(body.attendanceRows) ? body.attendanceRows : [];
    const summary = body.summary || {};
    if(!fs.existsSync(usedTemplatePath)){
      // Clean up uploaded file if present
      if(uploadedTempPath){ try{ fs.unlinkSync(uploadedTempPath); }catch(e){} }
      return res.status(500).json({ error: 'Template not found on server: ' + usedTemplatePath });
    }

    const workbook = new ExcelJS.Workbook();
    // Read template into memory (preserves styles/formulas where possible)
    await workbook.xlsx.readFile(usedTemplatePath);
    const sheet = workbook.worksheets[0]; // first sheet
    // Populate header fields using best-effort detection:
    // 1) Look for placeholder tokens like {{company}} in any cell and write there.
    // 2) Otherwise look for label cells (e.g., 'Company', 'Employee Name') and write to adjacent cell (next column).
    // 3) Fallback to B2..B5 (legacy) if nothing detected.
    const headerMap = {
      company: company,
      employeeName: employeeName,
      employeeId: employeeId,
      monthYear: `${month} ${year}`
    };

    // Helper: normalize string
    const norm = s => (s || '').toString().trim().toLowerCase();

    // Find cells by placeholder or label
    const placed = { company:false, employeeName:false, employeeId:false, monthYear:false };
    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        try{
          const v = cell.value;
          if(!v) return;
          const text = (typeof v === 'object' && v.richText) ? v.richText.map(t=>t.text).join('') : String(v);
          const low = norm(text);

          // Placeholder tokens
          if(!placed.company && (low.includes('{{company}}') || low === '{{company}}')){ cell.value = headerMap.company; placed.company = true; return; }
          if(!placed.employeeName && (low.includes('{{employeename}}') || low.includes('{{employee_name}}') || low === '{{employeename}}')){ cell.value = headerMap.employeeName; placed.employeeName = true; return; }
          if(!placed.employeeId && (low.includes('{{employeeid}}') || low.includes('{{employee_id}}') || low === '{{employeeid}}')){ cell.value = headerMap.employeeId; placed.employeeId = true; return; }
          if(!placed.monthYear && (low.includes('{{month}}') || low.includes('{{monthyear}}') || low.includes('{{period}}'))){ cell.value = headerMap.monthYear; placed.monthYear = true; return; }

          // Label detection: look for label words and write to next column
          if(!placed.company && (low.includes('company') || low.includes('company name'))){ sheet.getCell(rowNumber, colNumber+1).value = headerMap.company; placed.company = true; }
          if(!placed.employeeName && (low.includes('employee name') || (low.includes('employee') && low.includes('name')) || low === 'name')){ sheet.getCell(rowNumber, colNumber+1).value = headerMap.employeeName; placed.employeeName = true; }
          if(!placed.employeeId && (low.includes('employee id') || low.includes('employeeid') || low.includes('id'))){ sheet.getCell(rowNumber, colNumber+1).value = headerMap.employeeId; placed.employeeId = true; }
          if(!placed.monthYear && (low.includes('month') || low.includes('period') || low.includes('date range'))){ sheet.getCell(rowNumber, colNumber+1).value = headerMap.monthYear; placed.monthYear = true; }
        }catch(e){}
      });
    });

    // Fallback to previous basic addresses if still not placed
    try{ if(!placed.company) sheet.getCell('B2').value = headerMap.company; } catch(e){}
    try{ if(!placed.employeeName) sheet.getCell('B3').value = headerMap.employeeName; } catch(e){}
    try{ if(!placed.employeeId) sheet.getCell('B4').value = headerMap.employeeId; } catch(e){}
    try{ if(!placed.monthYear) sheet.getCell('B5').value = headerMap.monthYear; } catch(e){}

    // Find where to insert attendance rows. Prefer a row that has a 'Date' header.
    // Fallback to row 10 if not found.
    let startRow = 10;
    for(let r = 1; r <= sheet.rowCount; r++){
      const row = sheet.getRow(r);
      for(let c = 1; c <= row.cellCount; c++){
        const v = (row.getCell(c).value || '').toString().toLowerCase();
        if(v === 'date' || v === 'day' || v === 'status'){
          startRow = r + 1; // write starting next row
          break;
        }
      }
      if(startRow !== 10) break;
    }

    // Write attendance rows into columns A (Date), B (Day), C (Status)
    // First try to detect header row if possible (look for 'Date' or 'Day' headers)
    let detectedHeaderRow = null;
    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        try{
          const v = cell.value;
          if(!v) return;
          const text = (typeof v === 'object' && v.richText) ? v.richText.map(t=>t.text).join('') : String(v || '');
          const low = text.toLowerCase();
          if(low.includes('date') || low.includes('day')){ detectedHeaderRow = rowNumber; }
        }catch(e){}
      });
    });
    if(detectedHeaderRow){
      startRow = detectedHeaderRow + 1;
    }
    for(let i = 0; i < attendanceRows.length; i++){
      const r = startRow + i;
      const rowData = attendanceRows[i] || {};
      try{ sheet.getCell('A' + r).value = rowData.date || ''; } catch(e){}
      try{ sheet.getCell('B' + r).value = rowData.day || ''; } catch(e){}
      try{ sheet.getCell('C' + r).value = rowData.status || ''; } catch(e){}
    }

    // Populate summary cells using best-effort detection similar to headers.
    // Look for label cells like 'Total Present' and write adjacent cell.
    const summaryMap = {
      totalPresent: summary.totalPresent || 0,
      totalLeave: summary.totalLeave || 0,
      totalHoliday: summary.totalHoliday || 0,
      attendancePercent: summary.attendancePercent || 0
    };
    const placedSummary = { totalPresent:false, totalLeave:false, totalHoliday:false, attendancePercent:false };
    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        try{
          const v = cell.value;
          if(!v) return;
          const text = (typeof v === 'object' && v.richText) ? v.richText.map(t=>t.text).join('') : String(v);
          const low = (text || '').toLowerCase();
          if(!placedSummary.totalPresent && low.includes('total present')){ sheet.getCell(rowNumber, colNumber+1).value = summaryMap.totalPresent; placedSummary.totalPresent = true; }
          if(!placedSummary.totalLeave && low.includes('total leave')){ sheet.getCell(rowNumber, colNumber+1).value = summaryMap.totalLeave; placedSummary.totalLeave = true; }
          if(!placedSummary.totalHoliday && (low.includes('total holiday') || low.includes('total holidays') || low.includes('holiday'))){ sheet.getCell(rowNumber, colNumber+1).value = summaryMap.totalHoliday; placedSummary.totalHoliday = true; }
          if(!placedSummary.attendancePercent && (low.includes('attendance') && low.includes('%'))){ sheet.getCell(rowNumber, colNumber+1).value = summaryMap.attendancePercent; placedSummary.attendancePercent = true; }
        }catch(e){}
      });
    });
    // Fallback addresses
    try{ if(!placedSummary.totalPresent) sheet.getCell('D2').value = summaryMap.totalPresent; } catch(e){}
    try{ if(!placedSummary.totalLeave) sheet.getCell('D3').value = summaryMap.totalLeave; } catch(e){}
    try{ if(!placedSummary.totalHoliday) sheet.getCell('D4').value = summaryMap.totalHoliday; } catch(e){}
    try{ if(!placedSummary.attendancePercent) sheet.getCell('D5').value = summaryMap.attendancePercent; } catch(e){}

    // Prepare filename
    const safeCompany = (company || 'Company').replace(/[^a-z0-9_\-]/ig, '_');
    const safeName = (employeeName || 'Employee').replace(/[^a-z0-9_\-]/ig, '_');
    const filename = `${safeCompany}_${safeName}_${month}${year}_Timesheet.xlsx`;

    // Write to a temporary file to serve (keeps original template untouched)
    const tmpName = `timesheet_${Date.now()}_${Math.floor(Math.random()*10000)}.xlsx`;
    const tmpPath = path.join(os.tmpdir(), tmpName);
    await workbook.xlsx.writeFile(tmpPath);

    // Send file as attachment then clean up both generated and uploaded (if any)
    res.download(tmpPath, filename, (err) => {
      // Remove generated temp file
      fs.unlink(tmpPath, (unlinkErr) => { if(unlinkErr) console.warn('Failed to delete temp file:', tmpPath, unlinkErr); });
      // Remove uploaded template file if present (multer-generated)
      if(uploadedTempPath){ fs.unlink(uploadedTempPath, (e)=>{ if(e) console.warn('Failed to delete uploaded file:', uploadedTempPath, e); }); }
      if(err){
        console.error('Error sending file:', err);
        if(!res.headersSent) res.status(500).json({ error: 'Failed to send generated file.' });
      }
    });
  }catch(err){
    console.error('export-template error:', err);
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

app.listen(PORT, ()=>{
  console.log(`Export-template server listening on http://localhost:${PORT}`);
  console.log('POST /api/export-template');
});
