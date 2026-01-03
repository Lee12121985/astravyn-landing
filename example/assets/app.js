// timesheet-app.js
// Single-file self-contained client behavior. Requires SheetJS loaded (xlsx.full.min.js)

(function () {
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function isoDate(y, m, d) { return `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
  function formatDayName(y, m, d) { return new Date(y, m, d).toLocaleDateString(undefined, { weekday: 'short' }); }
  function formatMDY(y, m, d) { return `${m + 1}/${d}/${y}`; }

  const state = {
    year: new Date().getFullYear(),
    monthIndex: new Date().getMonth(),
    company: 'NovaEdge Technologies',
    name: 'Aarav Kiran',
    empId: 'NE-2047',
    statusMap: {},
    showWeekendColors: false
  };

  const el = id => document.getElementById(id);
  const selectMonth = el('selectMonth'), selectYear = el('selectYear'), headingMonth = el('headingMonth'), calendarEl = el('calendar');
  const inputName = el('inputName'), inputCompany = el('inputCompany'), inputEmpId = el('inputEmpId');
  const summaryCompany = el('summaryCompany'), summaryName = el('summaryName'), summaryEmpId = el('summaryEmpId'), summaryMonth = el('summaryMonth');
  const summaryPresent = el('summaryPresent'), summaryLeave = el('summaryLeave'), summaryComp = el('summaryComp'), summaryHoliday = el('summaryHoliday');
  const summaryPercent = el('summaryPercent'), summaryCompOfHoliday = el('summaryCompOfHoliday'); const reportBody = el('reportBody');
  const btnExport = el('btnExport'), btnExportCSV = el('btnExportCSV'), btnMarkWeekends = el('btnMarkWeekends'), btnClearMonth = el('btnClearMonth'), btnSendTop = el('btnSendTop');
  const selectTemplate = el('selectTemplate'), fileTemplate = el('fileTemplate');
  const btnPrevMonth = el('btnPrevMonth'), btnNextMonth = el('btnNextMonth'), btnToggleWeekendColor = el('btnToggleWeekendColor');

  // init
  if (selectMonth) { selectMonth.innerHTML = monthNames.map((m, i) => `<option value="${i}">${m}</option>`).join(''); selectMonth.value = state.monthIndex; }
  if (selectYear) { const cur = new Date().getFullYear(); selectYear.innerHTML = Array.from({ length: 12 }, (_, i) => cur - 6 + i).map(y => `<option value="${y}">${y}</option>`).join(''); selectYear.value = state.year; }

  function renderHeading() {
    headingMonth.textContent = `${monthNames[state.monthIndex]} ${state.year}`;
    summaryCompany.textContent = state.company; summaryName.textContent = state.name; summaryEmpId.textContent = state.empId; summaryMonth.textContent = `${monthNames[state.monthIndex]} ${state.year}`;
  }

  const CYCLE = ['', 'P', 'C', 'L', 'H'];

  function updatePill(wrapper, status) {
    wrapper.innerHTML = ''; if (!status) return;
    const sp = document.createElement('span'); sp.className = 'pill ' + status; sp.textContent = status; wrapper.appendChild(sp);
  }

  function createDayCell(y, m, d) {
    const iso = isoDate(y, m, d);
    const cell = document.createElement('div'); cell.className = 'day'; cell.tabIndex = 0; cell.setAttribute('role', 'gridcell'); cell.setAttribute('aria-label', `${monthNames[m]} ${d}, ${y}`); cell.dataset.date = iso;
    const dow = new Date(y, m, d).getDay();
    if (dow === 6) cell.classList.add('saturday'); else if (dow === 0) cell.classList.add('sunday'); else cell.classList.add('workday');
    if (state.showWeekendColors) { if (dow === 6) cell.style.background = 'linear-gradient(180deg, rgba(16,185,129,0.06), #fff)'; if (dow === 0) cell.style.background = 'linear-gradient(180deg, rgba(249,115,22,0.05), #fff)'; }
    const num = document.createElement('div'); num.className = 'num'; num.textContent = d; cell.appendChild(num);
    const pillWrap = document.createElement('div'); pillWrap.className = 'pillWrap'; updatePill(pillWrap, state.statusMap[iso] || ''); cell.appendChild(pillWrap);
    cell.addEventListener('click', () => {
      const cur = state.statusMap[iso] || ''; const normCur = (cur === 'ST' || cur === 'SU') ? 'H' : cur; let idx = CYCLE.indexOf(normCur); if (idx === -1) idx = 0; idx = (idx + 1) % CYCLE.length; let next = CYCLE[idx];
      if (next === 'H') { if (dow === 6) next = 'ST'; else if (dow === 0) next = 'SU'; }
      if (next === '') delete state.statusMap[iso]; else state.statusMap[iso] = next;
      updatePill(pillWrap, state.statusMap[iso] || ''); cell.setAttribute('aria-current-status', next || 'Empty'); updateSummaryAndReport();
    });
    cell.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cell.click(); } });
    return cell;
  }

  function renderCalendar() {
    calendarEl.innerHTML = ''; const y = state.year, m = state.monthIndex; const total = daysInMonth(y, m); const firstDow = new Date(y, m, 1).getDay(); const offset = (firstDow + 6) % 7;
    for (let i = 0; i < offset; i++) { const blank = document.createElement('div'); blank.className = 'day hidden'; calendarEl.appendChild(blank); }
    for (let d = 1; d <= total; d++) calendarEl.appendChild(createDayCell(y, m, d));
    updateSummaryAndReport();
  }

  function updateSummaryAndReport() {
    const y = state.year, m = state.monthIndex, total = daysInMonth(y, m);
    let present = 0, leave = 0, comp = 0, hol = 0; reportBody.innerHTML = '';
    for (let d = 1; d <= total; d++) {
      const iso = isoDate(y, m, d); const st = state.statusMap[iso] || '';
      if (st === 'P') present++; if (st === 'L') leave++; if (st === 'C') comp++; if (st === 'H' || st === 'ST' || st === 'SU') hol++;
      const tr = document.createElement('tr'); const td1 = document.createElement('td'); td1.textContent = formatMDY(y, m, d);
      const td2 = document.createElement('td'); td2.textContent = st || '—'; td2.style.textAlign = 'center'; td2.className = 'status-cell' + (st ? (' ' + st) : '');
      tr.appendChild(td1); tr.appendChild(td2); reportBody.appendChild(tr);
    }
    summaryPresent.textContent = present; summaryLeave.textContent = leave; summaryComp.textContent = comp; summaryHoliday.textContent = hol;
    const workingDays = Math.max(0, total - hol); const attendancePercent = workingDays > 0 ? (present / workingDays) * 100 : 0; const compOffPercent = hol > 0 ? (comp / hol) * 100 : 0;
    summaryPercent.textContent = `${attendancePercent.toFixed(1)}%`; summaryCompOfHoliday.textContent = `${comp} / ${hol} (${compOffPercent.toFixed(1)}%)`;
  }

  // CSV / Excel (Date + Status only)
  function exportCSV() {
    const y = state.year, m = state.monthIndex, total = daysInMonth(y, m);
    let present = 0, leave = 0, comp = 0, hol = 0; const rows = [];
    rows.push([`Company Name: ${state.company}`]); rows.push([`Employee Name: ${state.name}`]); rows.push([`Employee ID: ${state.empId}`]); rows.push([`Month: ${monthNames[m]} ${y}`]); rows.push([]);
    rows.push(['Summary', 'Value']);
    for (let d = 1; d <= total; d++) { const st = state.statusMap[isoDate(y, m, d)] || ''; if (st === 'P') present++; if (st === 'L') leave++; if (st === 'C') comp++; if (st === 'H' || st === 'ST' || st === 'SU') hol++; }
    const workingDays = Math.max(0, total - hol); const attendancePercent = workingDays > 0 ? (present / workingDays) * 100 : 0;
    rows.push(['Total Days in Month', total]); rows.push(['Total Present', present]); rows.push(['Total Leave', leave]); rows.push(['Total Comp-off', comp]); rows.push(['Total Holiday', hol]); rows.push(['Working Days', workingDays]); rows.push(['Attendance %', `${attendancePercent.toFixed(1)}%`]); rows.push([]);
    rows.push(['Date', 'Status']);
    for (let d = 1; d <= total; d++) { const st = state.statusMap[isoDate(y, m, d)] || ''; rows.push([formatMDY(y, m, d), st]); }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(["\uFEFF", csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${state.name.replace(/\s+/g, '_')}_${monthNames[m]}_${y}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  // --- sheet style helpers (same as previous improved version)
  const DEFAULT_STYLE_MAP = {
    'P': { fill: { fgColor: { rgb: "92D050" } }, font: { bold: true, color: { rgb: "006100" } } },
    'C': { fill: { fgColor: { rgb: "00B0F0" } }, font: { bold: true, color: { rgb: "000000" } } },
    'L': { fill: { fgColor: { rgb: "FFC000" } }, font: { bold: true, color: { rgb: "9C0006" } } },
    'H': { fill: { fgColor: { rgb: "FFEB9C" } }, font: { bold: true, color: { rgb: "9C6500" } } },
    'A': { fill: { fgColor: { rgb: "FF7C80" } }, font: { bold: true, color: { rgb: "630006" } } },
    'HD': { fill: { fgColor: { rgb: "D8E4BC" } }, font: { bold: true, color: { rgb: "3F3F3F" } } },
    'ST': { fill: { fgColor: { rgb: "BFBFBF" } }, font: { bold: true, color: { rgb: "000000" } } },
    'SU': { fill: { fgColor: { rgb: "BFBFBF" } }, font: { bold: true, color: { rgb: "000000" } } },
    'SAT': { fill: { fgColor: { rgb: "BFBFBF" } }, font: { bold: true, color: { rgb: "000000" } } },
    'SUN': { fill: { fgColor: { rgb: "BFBFBF" } }, font: { bold: true, color: { rgb: "000000" } } }
  };
  function toSheetStyle(s) { const out = {}; if (!s) return out; if (s.fill && s.fill.fgColor) { out.fill = { patternType: "solid", fgColor: { rgb: String(s.fill.fgColor.rgb).toUpperCase() } }; } if (s.font) { out.font = {}; if (s.font.bold) out.font.bold = true; if (s.font.color && s.font.color.rgb) out.font.color = { rgb: String(s.font.color.rgb).toUpperCase() }; if (s.font.sz) out.font.sz = s.font.sz; } if (s.alignment) out.alignment = s.alignment; if (s.border) out.border = s.border; return out; }
  function cloneStyleObj(styleObj) { if (!styleObj) return null; return JSON.parse(JSON.stringify(styleObj)); }
  function inferStyleMapFromTemplate(ws) {
    const map = {};
    try {
      if (!ws['!ref']) return null;
      
      // Read color legend from AF3-AF8 and AG3-AG8
      // AF column contains status letters with their fill colors
      // AG column contains descriptions (optional, for reference)
      for (let row = 3; row <= 8; row++) {
        const afCell = ws['AF' + row]; // Status letter cell with color
        const agCell = ws['AG' + row]; // Description cell (optional, for reference)
        
        if (afCell && afCell.v) {
          const statusLetter = String(afCell.v).trim().toUpperCase();
          
          // Extract style from AF cell (which contains the letter with color fill)
          // Only process valid status letters
          if (afCell.s && (statusLetter === 'P' || statusLetter === 'C' || 
              statusLetter === 'L' || statusLetter === 'H' || 
              statusLetter === 'ST' || statusLetter === 'SU')) {
            // Map ST and SU to 'H' for consistency with existing logic
            // But also keep them separate if needed
            const key = (statusLetter === 'ST' || statusLetter === 'SU') ? 'H' : statusLetter;
            if (!map[key]) {
              map[key] = cloneStyleObj(afCell.s);
            }
            // Also store ST and SU separately if they exist
            if (statusLetter === 'ST' && !map['ST']) {
              map['ST'] = cloneStyleObj(afCell.s);
            }
            if (statusLetter === 'SU' && !map['SU']) {
              map['SU'] = cloneStyleObj(afCell.s);
            }
          }
        }
      }
      
      // Fallback: If no legend found in AF3-AF8, try the old method as backup
      if (Object.keys(map).length === 0) {
        console.log('No legend found in AF3-AF8, trying fallback method');
        for (const addr in ws) {
          if (addr[0] === '!') continue;
          const cell = ws[addr];
          const v = (cell.v || '').toString().trim();
          if (v === 'P' || v === 'C' || v === 'L' || v === 'H' || v === 'ST' || v === 'SU') {
            if (cell.s) {
              const key = (v === 'ST' || v === 'SU') ? 'H' : v;
              if (!map[key]) map[key] = cloneStyleObj(cell.s);
            }
          }
        }
      }
      
      return Object.keys(map).length > 0 ? map : null;
    } catch (e) {
      console.warn('inferStyleMapFromTemplate failed', e);
      return null;
    }
  }

  function writeWorkbookWithStyles(wb, filename) {
    try { XLSX.writeFile(wb, filename, { bookType: 'xlsx', bookSST: false }); } catch (err) { const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }); const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); downloadBlob(blob, filename); }
  }

  async function exportExcelColored(useTemplate = false, templateWorkbook = null, templateStyleMap = null, templateRef = null) {
    if (typeof XLSX === 'undefined') throw new Error('Excel library not loaded.');
    const y = state.year, m = state.monthIndex, total = daysInMonth(y, m);
    const data = []; data.push(['Company Name', state.company]); data.push(['Employee Name', state.name]); data.push(['Employee ID', state.empId]); data.push(['Month', `${monthNames[m]} ${y}`]); data.push([]); data.push(['Summary', 'Value']);
    let present = 0, leave = 0, comp = 0, hol = 0;
    for (let d = 1; d <= total; d++) { const st = state.statusMap[isoDate(y, m, d)] || ''; if (st === 'P') present++; if (st === 'L') leave++; if (st === 'C') comp++; if (st === 'H' || st === 'ST' || st === 'SU') hol++; }
    const workingDays = Math.max(0, total - hol); const attendancePercent = workingDays > 0 ? (present / workingDays) * 100 : 0;
    data.push(['Total Days in Month', total]); data.push(['Total Present', present]); data.push(['Total Leave', leave]); data.push(['Total Comp-off', comp]); data.push(['Total Holiday', hol]); data.push(['Working Days', workingDays]); data.push(['Attendance %', `${attendancePercent.toFixed(1)}%`]); data.push([]); data.push(['Date', 'Status']);
    for (let d = 1; d <= total; d++) { const iso = isoDate(y, m, d); const st = state.statusMap[iso] || ''; data.push([formatMDY(y, m, d), st]); }

    let wb, ws;
    if (useTemplate && templateWorkbook) { wb = templateWorkbook; ws = wb.Sheets[wb.SheetNames[0]]; } else { wb = XLSX.utils.book_new(); ws = XLSX.utils.aoa_to_sheet(data); XLSX.utils.book_append_sheet(wb, ws, "Attendance"); }

    let styleMap = null;
    if (templateStyleMap) styleMap = templateStyleMap;
    else if (useTemplate && templateWorkbook) { try { const inferred = inferStyleMapFromTemplate(templateWorkbook.Sheets[templateWorkbook.SheetNames[0]]); if (inferred) styleMap = inferred; } catch (e) { } }
    if (!styleMap) { styleMap = {}; for (const k in DEFAULT_STYLE_MAP) styleMap[k] = toSheetStyle(DEFAULT_STYLE_MAP[k]); } else { for (const k in styleMap) styleMap[k] = cloneStyleObj(styleMap[k]); }
    
    // CRITICAL: Ensure 'P' (Present) always has green color for all months and years
    // If template legend doesn't have 'P' or has different color, override with default green
    if (!styleMap['P'] || !styleMap['P'].fill || !styleMap['P'].fill.fgColor || styleMap['P'].fill.fgColor.rgb !== '92D050') {
      styleMap['P'] = toSheetStyle(DEFAULT_STYLE_MAP['P']); // Green: #92D050
      console.log('Ensuring P status always has green color (92D050)');
    }

    if (!useTemplate || !templateWorkbook) { ws = XLSX.utils.aoa_to_sheet(data); wb.Sheets["Attendance"] = ws; if (!wb.SheetNames.includes("Attendance")) XLSX.utils.book_append_sheet(wb, ws, "Attendance"); }
    else {
      // IMPORTANT: Only write to data columns (A and B). Do NOT modify legend region (AF3-AF8, AG3-AG8)
      // The legend region must remain intact for color reference
      const sheetJson = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      let headerRowIdx = -1;
      for (let r = 0; r < sheetJson.length; r++) { const row = sheetJson[r].map(c => (c || '').toString().toLowerCase()); if (row.includes('date') && row.includes('status')) { headerRowIdx = r + 1; break; } }
      if (headerRowIdx === -1) headerRowIdx = 10;
      for (let i = 0; i < total; i++) {
        const r = headerRowIdx + 1 + i;
        const ar = { date: formatMDY(y, m, i + 1), status: state.statusMap[isoDate(y, m, i + 1)] || '' };
        // Only write to columns A (date) and B (status) - preserve legend in AF/AG columns
        ws['A' + r] = { t: 's', v: ar.date };
        ws['B' + r] = { t: 's', v: ar.status };
        // Apply style - ensure 'P' always gets green color for all months/years
        let sty = styleMap[ar.status] || null;
        if (ar.status === 'P' && (!sty || !sty.fill || !sty.fill.fgColor || sty.fill.fgColor.rgb !== '92D050')) {
          sty = toSheetStyle(DEFAULT_STYLE_MAP['P']); // Force green for P
        }
        if (sty) ws['B' + r].s = sty;
      }
    }

    // apply final styles to status column (B)
    // NOTE: Only modifies column B - legend region (AF3-AF8, AG3-AG8) remains untouched
    try {
      const finalJson = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      let hdrIdx = -1;
      for (let r = 0; r < finalJson.length; r++) { const row = finalJson[r].map(c => (c || '').toString().toLowerCase()); if (row.includes('date') && row.includes('status')) { hdrIdx = r; break; } }
      const start = (hdrIdx >= 0) ? hdrIdx + 1 : 10;
      for (let i = 0; i < total; i++) {
        const r = start + i + 1;
        const status = state.statusMap[isoDate(y, m, i + 1)] || '';
        if (!status) continue;
        const addr = 'B' + r; // Only column B - never touch AF/AG legend columns
        if (!ws[addr]) ws[addr] = { t: 's', v: status };
        // Apply style - ensure 'P' always gets green color
        let sty = styleMap[status] || null;
        if (status === 'P' && (!sty || !sty.fill || !sty.fill.fgColor || sty.fill.fgColor.rgb !== '92D050')) {
          sty = toSheetStyle(DEFAULT_STYLE_MAP['P']); // Force green for P
        }
        if (sty) ws[addr].s = sty;
      }
    } catch (e) { console.warn('Applying styles failed', e); }

    // header style
    try {
      const finalJson2 = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      for (let r = 0; r < Math.min(finalJson2.length, 12); r++) {
        const row = finalJson2[r].map(c => (c || '').toString().toLowerCase());
        if (row.includes('date') && row.includes('status')) {
          const rr = r + 1;
          ['A', 'B'].forEach(col => {
            const a = col + rr;
            if (!ws[a]) ws[a] = { t: 's', v: finalJson2[r][('AB'.indexOf(col))] || '' };
            ws[a].s = { font: { bold: true }, fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } } };
          });
          break;
        }
      }
    } catch (e) { }

    // Generate appropriate filename based on template
    let filenameSuffix = 'colored';
    if (templateRef === 'skp-default') {
      filenameSuffix = 'SKP';
    } else if (templateRef && templateRef !== 'default') {
      filenameSuffix = 'Template';
    }
    const filename = `${state.name.replace(/\s+/g, '_')}_${monthNames[m]}_${y}_${filenameSuffix}.xlsx`;
    writeWorkbookWithStyles(wb, filename);
  }

  // Helper to dynamically find legend row for a status code
  // Legend can be in different rows (AF3-AF8 or AF5-AF10 depending on template)
  function findLegendRow(sheet, summaryColIndex, statusCode) {
    // Try common legend positions
    for (let row = 3; row <= 11; row++) {
      const cell = sheet.cell(row, summaryColIndex);
      const cellValue = (cell.value() || "").toString().trim().toUpperCase();
      if (cellValue === statusCode.toUpperCase()) {
        return row;
      }
    }
    // Default fallback positions based on common patterns
    const defaultRows = { 'P': 3, 'C': 4, 'L': 5, 'H': 6, 'ST': 7, 'SU': 8 };
    return defaultRows[statusCode.toUpperCase()] || 3;
  }

  // Helper to copy styles using xlsx-populate
  // skipFill: if true, don't copy fill color (preserve conditional formatting)
  function copyStyleXlsxPopulate(source, target, skipFill = false) {
    // Copy Fill - skip if preserving conditional formatting
    if (!skipFill) {
      const fill = source.style("fill");
      if (fill) target.style("fill", fill);
    }

    // Copy Font components (color, bold, etc)
    target.style("fontColor", source.style("fontColor"));
    target.style("bold", source.style("bold"));
    target.style("italic", source.style("italic"));
    target.style("fontFamily", source.style("fontFamily"));
    target.style("fontSize", source.style("fontSize"));
    target.style("underline", source.style("underline"));
    target.style("strikethrough", source.style("strikethrough"));

    // Copy Borders - Essential for maintaining the grid look
    const border = source.style("border");
    if (border) target.style("border", border);

    // Copy Alignment
    target.style("horizontalAlignment", source.style("horizontalAlignment"));
    target.style("verticalAlignment", source.style("verticalAlignment"));
    target.style("textRotation", source.style("textRotation"));
    target.style("wrapText", source.style("wrapText"));
  }

  // Export function using xlsx-populate for better style preservation
  async function exportWithTemplateXlsxPopulate(state, templatePath = 'template/TIMESHEET_NOVEMBER-SKP.xlsx') {
    if (typeof XlsxPopulate === 'undefined') {
      throw new Error('xlsx-populate library not loaded. Please ensure the script is included.');
    }

    try {
      // 1. Fetch Template
      const response = await fetch(templatePath + '?v=' + Date.now());
      if (!response.ok) throw new Error("Could not load SKP template. Please ensure file exists.");
      const buffer = await response.arrayBuffer();

      // 2. Open Workbook
      // xlsx-populate automatically preserves conditional formatting rules from the template
      // We avoid setting fill colors directly on cells with CF to let the CF rules handle coloring
      const workbook = await XlsxPopulate.fromDataAsync(buffer);
      const sheet = workbook.sheet(0);
      
      // Conditional formatting rules are preserved automatically by xlsx-populate
      // We don't need to explicitly preserve them - they remain in the workbook

      // 3. Prepare Data
      let { year, monthIndex, statusMap, name, company, empId } = state;

      // Ensure year/monthIndex are numbers
      year = parseInt(year, 10);
      if (typeof monthIndex === 'string') {
        if (/^\d+$/.test(monthIndex)) {
          monthIndex = parseInt(monthIndex, 10);
        } else {
          const mLower = monthIndex.toLowerCase();
          const mNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
          const idx = mNames.findIndex(m => m === mLower);
          if (idx !== -1) monthIndex = idx;
        }
      }

      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
      const currentMonthName = monthNames[monthIndex] || "UNKNOWN";

      // 4. Update Header - check actual template structure
      // Try A1 first (common), then A2
      const headerCell = sheet.cell("A1");
      if (headerCell.value() && headerCell.value().toString().includes("Details")) {
        sheet.cell("A1").value(`Attentence Details for ${currentMonthName} -${year}`);
      } else {
        sheet.cell("A2").value(`Attentence Details for ${currentMonthName} -${year}`);
      }

      // 5. Update Name - check actual template structure (could be A2, A3, or A4)
      // Based on images: name is typically in A2 or A3
      const nameCellA2 = sheet.cell("A2");
      const nameCellA3 = sheet.cell("A3");
      if (nameCellA3.value() && nameCellA3.value().toString().trim().length > 0) {
        sheet.cell("A3").value(name || "Unknown Employee");
      } else if (nameCellA2.value() && nameCellA2.value().toString().trim().length > 0 && !nameCellA2.value().toString().includes("Details")) {
        sheet.cell("A2").value(name || "Unknown Employee");
      } else {
        // Default to A3 if can't determine
        sheet.cell("A3").value(name || "Unknown Employee");
      }

      // 6. Define Style Sources from Template (Row 1 for date headers)
      const styleSunHeader = sheet.cell("B1");
      const styleMonHeader = sheet.cell("C1");
      const styleSatHeader = sheet.cell("H1");

      // Handle 31-day shift - determine summary column index
      const summaryColIndex = daysInMonth === 31 ? 33 : 32; // AG (33) for 31-day, AF (32) for others

      if (daysInMonth === 31) {
        // 1. Re-create Summary Header in AG (33) - row 1 or 2 (check template)
        const summaryHeaderRow = sheet.cell(1, 32).value() ? 1 : 2;
        sheet.cell(summaryHeaderRow, 33).value("No.of days");
        copyStyleXlsxPopulate(sheet.cell(summaryHeaderRow, 32), sheet.cell(summaryHeaderRow, 33), false);

        // 2. Re-create Summary Value placeholder in AG (33) - row 2 (status row)
        // Only copy style structure, but ensure no fill color (row 2 should have no fill)
        const af2Cell = sheet.cell(2, 32);
        const ag2Cell = sheet.cell(2, 33);
        if (af2Cell.value()) {
          ag2Cell.value(af2Cell.value());
          // Copy styles but skip fill to preserve no-fill for row 2
          copyStyleXlsxPopulate(af2Cell, ag2Cell, true); // skipFill = true
          ag2Cell.style("fill", null); // Explicitly no fill
        }

        // 3. Move Legend - dynamically find legend rows and shift them
        // Legend can be in rows 3-8 or 5-10 depending on template
        const legendStartRow = findLegendRow(sheet, 32, 'P');
        const legendEndRow = Math.max(legendStartRow + 5, 10); // At least 6 legend items
        
        // IMPORTANT: DO NOT MODIFY AF/AG COLUMNS - preserve legend colors exactly as they are
        // For 31-day months, we only shift summary header/value, NOT the legend
        // The legend in AF/AG columns must remain completely untouched
        // Note: We're not shifting legend anymore - keep AF/AG columns intact
      }

      // IMPORTANT: Read legend colors from AF column (column 32) - DO NOT MODIFY AF/AG
      // Always read from AF column regardless of 31-day shift, to preserve original colors
      const legendColIndex = 32; // Always use AF column for reading legend colors
      
      // Dynamically find legend rows - legend can be in different positions (AF4-AF9 typically)
      const legendRowP = findLegendRow(sheet, legendColIndex, 'P');
      const legendRowC = findLegendRow(sheet, legendColIndex, 'C');
      const legendRowL = findLegendRow(sheet, legendColIndex, 'L');
      const legendRowH = findLegendRow(sheet, legendColIndex, 'H');
      const legendRowST = findLegendRow(sheet, legendColIndex, 'ST');
      const legendRowSU = findLegendRow(sheet, legendColIndex, 'SU');
      
      // Legend/Status Styles - READ ONLY from AF column (preserve original colors)
      // These are reference colors - we read them but NEVER modify AF/AG columns
      // AF/AG legend cells are completely untouched - only read for color reference
      const styleLegendP = sheet.cell(legendRowP, legendColIndex); // Read from AF - DO NOT MODIFY
      const styleLegendC = sheet.cell(legendRowC, legendColIndex); // Read from AF - DO NOT MODIFY
      const styleLegendL = sheet.cell(legendRowL, legendColIndex); // Read from AF - DO NOT MODIFY
      const styleLegendH = sheet.cell(legendRowH, legendColIndex); // Read from AF - DO NOT MODIFY
      const styleSatBase = sheet.cell(legendRowST, legendColIndex); // Read from AF (ST) - DO NOT MODIFY
      const styleSunBase = sheet.cell(legendRowSU, legendColIndex); // Read from AF (SU) - DO NOT MODIFY
      const styleWeekdayBase = sheet.cell("C2"); // Weekday base from row 2 (status row)

      let presentCount = 0;

      // 7. Process each day (1-31)
      for (let d = 1; d <= 31; d++) {
        const colIndex = d + 1; // 1=B(2)... 30=AE(31), 31=AF(32)
        const dateCell = sheet.row(1).cell(colIndex);  // Row 1 for dates
        const statusCell = sheet.row(2).cell(colIndex); // Row 2 for status

        if (d <= daysInMonth) {
          const dateObj = new Date(year, monthIndex, d);
          const dayOfWeek = dateObj.getDay(); // 0=Sun, 6=Sat

          // Construct ISO Key
          const isoKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

          // A. Update Date Header (Row 1)
          dateCell.value(dateObj);
          dateCell.style("numberFormat", "d-mmm-yy");
          dateCell.style("textRotation", 90);
          dateCell.style("horizontalAlignment", "center");
          dateCell.style("verticalAlignment", "center");

          // Header Color (Sat vs Sun vs Weekday)
          // Apply styles - conditional formatting will work alongside direct fills
          if (dayOfWeek === 0) copyStyleXlsxPopulate(styleSunHeader, dateCell, false);
          else if (dayOfWeek === 6) copyStyleXlsxPopulate(styleSatHeader, dateCell, false);
          else copyStyleXlsxPopulate(styleMonHeader, dateCell, false);

          // B. Status Styling & Value
          let rawStatus = (statusMap[isoKey] || "").toString().trim();
          const isWeekendCode = (rawStatus === 'ST' || rawStatus === 'SU');
          const isEmptyWeekend = (!rawStatus && (dayOfWeek === 0 || dayOfWeek === 6));
          const isVisualWeekend = (dayOfWeek === 0 || dayOfWeek === 6) && (isEmptyWeekend || isWeekendCode);

          // IMPORTANT: NO FILL COLOR for Row 2 - only apply text, font, border, alignment
          // Do NOT apply fill colors to status cells in row 2
          // Let conditional formatting handle colors if present, otherwise leave white
          
          if (isVisualWeekend) {
            // Weekend Visual (Vertical SAT/SUN)
            const displayValue = dayOfWeek === 0 ? "SUN" : "SAT";
            // Apply styles but SKIP fill color for row 2
            copyStyleXlsxPopulate(styleSunBase, statusCell, true); // skipFill = true
            statusCell.value(displayValue);
            statusCell.style("textRotation", 90);
            statusCell.style("bold", true);
            // Explicitly ensure no fill color
            statusCell.style("fill", null);
          } else if (rawStatus === 'P') {
            // P (Present) - MUST have GREEN fill color from legend
            // Apply base style first
            if (dayOfWeek === 0) copyStyleXlsxPopulate(styleSunBase, statusCell, false);
            else if (dayOfWeek === 6) copyStyleXlsxPopulate(styleSatBase, statusCell, false);
            else copyStyleXlsxPopulate(styleWeekdayBase, statusCell, false);

            // Apply P legend style with green fill color
            copyStyleXlsxPopulate(styleLegendP, statusCell, false);
            
            // Explicitly ensure green fill is applied (read from AF column legend)
            const pFill = styleLegendP.style("fill");
            if (pFill) {
              statusCell.style("fill", pFill); // Force green fill for all P cells
            } else {
              // Fallback: if legend doesn't have fill, use green directly
              statusCell.style("fill", "00FF00"); // Green color
            }

            statusCell.value("P");
            statusCell.style("textRotation", 0);
            statusCell.style("bold", true);
            presentCount++;
          } else if (['C', 'L', 'H'].includes(rawStatus)) {
            // Other statuses (C, L, H) - no fill color for row 2
            if (dayOfWeek === 0) copyStyleXlsxPopulate(styleSunBase, statusCell, true); // skipFill = true
            else if (dayOfWeek === 6) copyStyleXlsxPopulate(styleSatBase, statusCell, true); // skipFill = true
            else copyStyleXlsxPopulate(styleWeekdayBase, statusCell, true); // skipFill = true

            // Apply font styles only (no fill)
            const legendStyle = rawStatus === 'C' ? styleLegendC :
                               rawStatus === 'L' ? styleLegendL : styleLegendH;
            
            statusCell.style("fontColor", legendStyle.style("fontColor"));
            statusCell.style("bold", legendStyle.style("bold") || true);
            statusCell.style("fontFamily", legendStyle.style("fontFamily"));
            statusCell.style("fontSize", legendStyle.style("fontSize"));
            
            // No fill color for C, L, H
            statusCell.style("fill", null);

            statusCell.value(rawStatus);
            statusCell.style("textRotation", 0);
          } else {
            // Empty Weekday or Unknown Code - no fill color
            copyStyleXlsxPopulate(styleWeekdayBase, statusCell, true); // skipFill = true
            statusCell.value(rawStatus);
            statusCell.style("textRotation", 0);
            // Explicitly ensure no fill color
            statusCell.style("fill", null);
          }

          // Ensure alignment
          statusCell.style("horizontalAlignment", "center");
          statusCell.style("verticalAlignment", "center");

        } else {
          // Clear extra days (31st day in 30-day month)
          if (colIndex !== summaryColIndex) {
            dateCell.value("");
            statusCell.value("");
            statusCell.style("fill", null);
            statusCell.style("border", null);
          }
        }
      }

      // 8. Update Summary Counts (Row 2, same row as status data)
      // IMPORTANT: Row 2 should have NO FILL COLOR - only update the value
      const summaryCell = sheet.row(2).cell(summaryColIndex);
      summaryCell.value(presentCount);
      // Ensure no fill color for row 2
      summaryCell.style("fill", null);

      // 9. Download
      const blob = await workbook.outputAsync();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Timesheet_${(name || 'Employee').replace(/\s+/g, '_')}_${currentMonthName}_${year}_SKP.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      return true;
    } catch (err) {
      console.error('Export with xlsx-populate failed:', err);
      throw err;
    }
  }

  function exportExcel() {
    if (typeof XLSX === 'undefined') throw new Error('Excel library not loaded.');
    const y = state.year, m = state.monthIndex, total = daysInMonth(y, m);
    let present = 0, leave = 0, comp = 0, hol = 0;
    for (let d = 1; d <= total; d++) { const st = state.statusMap[isoDate(y, m, d)] || ''; if (st === 'P') present++; if (st === 'L') leave++; if (st === 'C') comp++; if (st === 'H' || st === 'ST' || st === 'SU') hol++; }
    const workingDays = Math.max(0, total - hol);
    const attendancePercent = workingDays > 0 ? (present / workingDays) * 100 : 0;
    const compOffPercent = hol > 0 ? (comp / hol) * 100 : 0;
    const data = [];
    data.push(['Company Name', state.company]); data.push(['Employee Name', state.name]); data.push(['Employee ID', state.empId]); data.push(['Month', `${monthNames[m]} ${y}`]); data.push([]); data.push(['Summary', 'Value']);
    data.push(['Total Days in Month', total]); data.push(['Total Present', present]); data.push(['Total Leave', leave]); data.push(['Total Comp-off', comp]); data.push(['Total Holiday', hol]); data.push(['Working Days', workingDays]); data.push(['Attendance %', `${attendancePercent.toFixed(1)}%`]); data.push(['Comp-off of Holiday', `${comp} / ${hol} (${compOffPercent.toFixed(1)}%)`]); data.push([]); data.push(['Date', 'Status']);
    for (let d = 1; d <= total; d++) { const iso = isoDate(y, m, d); const st = state.statusMap[iso] || ''; data.push([formatMDY(y, m, d), st]); }
    const ws = XLSX.utils.aoa_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Attendance"); XLSX.writeFile(wb, `${state.name.replace(/\s+/g, '_')}_${monthNames[m]}_${y}.xlsx`);
  }

  function exportExcelSafe() { try { exportExcel(); } catch (e) { console.error('Export Excel failed', e); alert('Export Excel failed: ' + (e && e.message)); } }

  function markWeekendsAsHoliday() { const y = state.year, m = state.monthIndex, total = daysInMonth(y, m); for (let d = 1; d <= total; d++) { const dow = new Date(y, m, d).getDay(); if (dow === 6) state.statusMap[isoDate(y, m, d)] = 'ST'; if (dow === 0) state.statusMap[isoDate(y, m, d)] = 'SU'; } renderCalendar(); }
  function clearMonth() { const y = state.year, m = state.monthIndex; Object.keys(state.statusMap).forEach(k => { const dt = new Date(k); if (dt.getFullYear() === y && dt.getMonth() === m) delete state.statusMap[k]; }); renderCalendar(); }

  // Template payload
  function buildTemplatePayload() {
    const y = state.year, m = state.monthIndex, total = daysInMonth(y, m);
    const attendanceRows = [];
    for (let d = 1; d <= total; d++) { const iso = isoDate(y, m, d); let isWeekend = null; const dow = new Date(y, m, d).getDay(); if (dow === 6) isWeekend = 'sat'; if (dow === 0) isWeekend = 'sun'; attendanceRows.push({ date: iso, status: state.statusMap[iso] || '', isWeekend }); }
    let present = 0, leave = 0, comp = 0, hol = 0; attendanceRows.forEach(r => { if (r.status === 'P') present++; if (r.status === 'L') leave++; if (r.status === 'C') comp++; if (r.status === 'H' || r.status === 'ST' || r.status === 'SU') hol++; });
    const workingDays = Math.max(0, total - hol); const attendancePercent = workingDays > 0 ? (present / workingDays) * 100 : 0;
    return { company: state.company, employeeName: state.name, employeeId: state.empId, month: monthNames[m], year: state.year, attendanceRows, summary: { totalPresent: present, totalLeave: leave, totalHoliday: hol, attendancePercent: Number(attendancePercent.toFixed(1)) } };
  }

  function createExcelBlobForSend() {
    if (typeof XLSX === 'undefined') throw new Error('XLSX not loaded');
    const payload = buildTemplatePayload();
    const data = [];
    data.push(['Company Name', payload.company]); data.push(['Employee Name', payload.employeeName]); data.push(['Employee ID', payload.employeeId]); data.push(['Month', `${payload.month} ${payload.year}`]); data.push([]); data.push(['Summary', 'Value']);
    data.push(['Total Days in Month', payload.attendanceRows.length]); data.push(['Total Present', payload.summary.totalPresent]); data.push(['Total Leave', payload.summary.totalLeave]); data.push(['Total Comp-off', 0]); data.push(['Total Holiday', payload.summary.totalHoliday]); data.push([]); data.push(['Date', 'Status']);
    payload.attendanceRows.forEach(r => data.push([r.date, r.status]));
    const ws = XLSX.utils.aoa_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Attendance"); const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }); return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 15000); }

  // --- server-side template export attempt then client fallback
  async function exportTemplate() {
    if (!selectTemplate) { alert('Export UI not ready'); return; }
    const templateId = selectTemplate.value;
    const payload = buildTemplatePayload();
    payload.templateId = templateId;
    // Try server
    try {
      const resp = await fetch('/api/export-template', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (resp.ok) {
        const blob = await resp.blob();
        const cd = resp.headers.get('Content-Disposition') || '';
        let filename = '';
        const m = /filename="?([^";]+)"?/.exec(cd);
        if (m && m[1]) filename = m[1];
        if (!filename) filename = `${payload.company.replace(/\s+/g, '_')}_${payload.employeeName.replace(/\s+/g, '')}_Template.xlsx`;
        downloadBlob(blob, filename);
        return;
      } else {
        console.warn('Server export-template failed status:', resp.status);
      }
    } catch (err) { console.warn('Server export-template not available.', err); }

    // client fallback
    try {
      await clientSideExportTemplate(payload, templateId);
    } catch (err) {
      console.error('Client side template export failed', err);
      alert('Template export failed: ' + (err && err.message));
    }
  }

  // load templates endpoint - robust against HTML fallback
  async function loadTemplates() {
    if (!selectTemplate) return;
    selectTemplate.innerHTML = `<option value="default">Normal Export</option><option value="skp-default">SKP Format (Clean)</option>`;
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        // ensure JSON content type
        const ct = (res.headers.get('Content-Type') || '').toLowerCase();
        if (ct.includes('application/json')) {
          const list = await res.json();
          list.forEach(t => {
            const opt = document.createElement('option'); opt.value = t.filename || t.id || t.name; opt.textContent = t.name || t.filename || t.id; selectTemplate.appendChild(opt);
          });
          return;
        } else {
          // server returned HTML (maybe static page) — ignore and fallback to reading local templates folder
          console.warn('templates endpoint returned non-json, skipping parsing');
        }
      }
    } catch (e) { console.warn('Failed to load /api/templates', e); }

    // fallback: attempt to fetch /templates/templates.json or static listing
    try {
      const res2 = await fetch('/templates/templates.json');
      if (res2.ok) {
        const j = await res2.json();
        j.forEach(t => { const opt = document.createElement('option'); opt.value = t.filename || t.id || t.name; opt.textContent = t.name || t.filename || t.id; selectTemplate.appendChild(opt); });
        return;
      }
    } catch (e) { /* ignore */ }

    // final fallback: attempt to probe common filenames (non-blocking)
    const fallbackList = ['TIMESHEET_NOVEMBER-SKP.xlsx'];
    fallbackList.forEach(fn => {
      const opt = document.createElement('option'); opt.value = fn; opt.textContent = fn; selectTemplate.appendChild(opt);
    });
  }

  // upload handler - do not assume JSON response (fixes Unexpected token '<' error)
  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData(); fd.append('template', file);
    try {
      const res = await fetch('/api/templates/upload', { method: 'POST', body: fd });
      // check content-type - only parse JSON if server returned JSON
      const ct = (res.headers.get('Content-Type') || '').toLowerCase();
      if (res.ok) {
        if (ct.includes('application/json')) {
          const d = await res.json();
          alert('Template uploaded successfully!');
          loadTemplates();
        } else {
          // server responded with HTML or text - treat as success if status OK
          alert('Template upload returned non-JSON response but completed (status OK).');
          loadTemplates();
        }
      } else {
        // try to parse JSON error safely
        if (ct.includes('application/json')) {
          const d = await res.json();
          alert('Upload failed: ' + (d && d.error ? d.error : res.statusText));
        } else {
          const text = await res.text();
          alert('Upload failed: ' + res.status + ' - server returned: ' + (text.slice(0, 200)));
        }
      }
    } catch (err) {
      alert('Upload error: ' + (err && err.message));
    } finally {
      e.target.value = '';
    }
  }

  // client-side template fill with style-preservation attempts
  async function clientSideExportTemplate(payload, templateRef = null) {
    if (typeof XLSX === 'undefined') throw new Error('SheetJS (XLSX) not loaded for client-side template export.');
    let workbook = null, templateStyleMap = null;

    // Try fetching the template from /template/<ref> or /templates/<ref>
    if (templateRef && templateRef !== 'default') {
      // Handle skp-default as a special case to load the SKP template
      let actualTemplateFile = templateRef;
      if (templateRef === 'skp-default') {
        actualTemplateFile = 'TIMESHEET_NOVEMBER-SKP.xlsx';
      }
      
      const tryUrls = [
        `/template/${encodeURIComponent(actualTemplateFile)}`, 
        `/templates/${encodeURIComponent(actualTemplateFile)}`,
        `/timesheet/template/${encodeURIComponent(actualTemplateFile)}`
      ];
      for (const url of tryUrls) {
        try {
          const resp = await fetch(url);
          if (resp.ok) {
            const ab = await resp.arrayBuffer();
            workbook = XLSX.read(ab, { type: 'array', cellStyles: true });
            templateStyleMap = inferStyleMapFromTemplate(workbook.Sheets[workbook.SheetNames[0]]);
            break;
          }
        } catch (e) { console.warn('Failed to fetch template', url, e); }
      }
    }

    // If workbook present use colored exporter which will try to preserve styles
    if (workbook) {
      await exportExcelColored(true, workbook, templateStyleMap, templateRef);
      return;
    }

    // fallback: generate workbook ourselves (Date + Status)
    const wb = XLSX.utils.book_new();
    const hdr = [
      ['Company Name', payload.company],
      ['Employee Name', payload.employeeName],
      ['Employee ID', payload.employeeId],
      ['Month', `${payload.month} ${payload.year}`],
      [],
      ['Date', 'Status']
    ];
    const rows = hdr.concat(payload.attendanceRows.map(r => [r.date, r.status]));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");

    // apply default styles to status column (B)
    for (let i = 0; i < payload.attendanceRows.length; i++) {
      const r = hdr.length + i + 1; // 1-based
      const st = payload.attendanceRows[i].status || '';
      if (!st) continue;
      const addr = 'B' + r;
      if (!ws[addr]) ws[addr] = { t: 's', v: st };
      const s = toSheetStyle(DEFAULT_STYLE_MAP[st] || DEFAULT_STYLE_MAP['H']);
      ws[addr].s = s;
    }

    // header styling (row = hdr.length)
    try {
      const rr = hdr.length;
      ['A', 'B'].forEach(col => {
        const a = col + rr;
        if (!ws[a]) ws[a] = { t: 's', v: ws[a] ? ws[a].v : '' };
        ws[a].s = { font: { bold: true }, fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } } };
      });
    } catch (e) { }

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Generate appropriate filename based on template
    let filenameSuffix = 'Timesheet';
    if (templateRef === 'skp-default') {
      filenameSuffix = 'SKP';
    }
    const filename = `${payload.company.replace(/\s+/g, '_')}_${payload.employeeName.replace(/\s+/g, '')}_${payload.month}${payload.year}_${filenameSuffix}.xlsx`;
    downloadBlob(blob, filename);
  }

  // small send modal (same behavior but downloads date+status)
  function createSendModal(prefill = {}) {
    if (document.getElementById('sendModal')) return document.getElementById('sendModal');
    const modal = document.createElement('div'); modal.id = 'sendModal'; modal.style.position = 'fixed'; modal.style.inset = '0'; modal.style.display = 'flex'; modal.style.alignItems = 'center'; modal.style.justifyContent = 'center'; modal.style.zIndex = '1400'; modal.style.background = 'rgba(6,11,15,0.4)';
    modal.innerHTML = `
      <div style="background:var(--card);border-radius:12px;padding:18px;max-width:720px;width:100%;box-shadow:0 16px 48px rgba(11,15,25,0.35);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-weight:700;font-size:16px">Send Timesheet</div>
          <button id="sendModalClose" style="border:none;background:transparent;font-size:18px;cursor:pointer">✕</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <label style="font-size:13px;color:var(--muted)">To (company email)<input id="modalTo" type="email" style="width:100%;margin-top:6px;padding:8px;border-radius:8px;border:1px solid #d1d5db" /></label>
          <label style="font-size:13px;color:var(--muted)">Subject<input id="modalSubject" type="text" style="width:100%;margin-top:6px;padding:8px;border-radius:8px;border:1px solid #d1d5db" /></label>
          <label style="font-size:13px;color:var(--muted)">Sender name<input id="modalSenderName" type="text" style="width:100%;margin-top:6px;padding:8px;border-radius:8px;border:1px solid #d1d5db" /></label>
          <label style="font-size:13px;color:var(--muted)">Sender email / phone
            <div style="display:flex;gap:8px">
              <input id="modalSenderEmail" type="email" style="flex:1;margin-top:6px;padding:8px;border-radius:8px;border:1px solid #d1d5db" />
              <input id="modalSenderPhone" type="text" style="width:140px;margin-top:6px;padding:8px;border-radius:8px;border:1px solid #d1d5db" />
            </div>
          </label>
        </div>
        <label style="font-size:13px;color:var(--muted);display:block;margin-bottom:8px">Message (editable)</label>
        <textarea id="modalBody" rows="7" style="width:100%;padding:10px;border-radius:8px;border:1px solid #d1d5db;resize:vertical"></textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
          <button id="modalDownloadOnly" class="btn-3d btn-flat">Download Only</button>
          <button id="modalGmail" class="btn-3d btn-accent">Download & Gmail</button>
          <button id="modalOutlook" class="btn-3d btn-flat">Download & Outlook</button>
          <button id="modalMailto" class="btn-control btn-clear">Download & Mail App</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const modalTo = modal.querySelector('#modalTo');
    const modalSubject = modal.querySelector('#modalSubject');
    const modalSenderName = modal.querySelector('#modalSenderName');
    const modalSenderEmail = modal.querySelector('#modalSenderEmail');
    const modalSenderPhone = modal.querySelector('#modalSenderPhone');
    const modalBody = modal.querySelector('#modalBody');
    modal.querySelector('#sendModalClose').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    modalTo.value = prefill.to || '';
    modalSenderName.value = prefill.senderName || '';
    modalSenderEmail.value = prefill.senderEmail || '';
    modalSenderPhone.value = prefill.senderPhone || '';
    modalSubject.value = prefill.subject || `Timesheet - ${state.name} - ${monthNames[state.monthIndex]} ${state.year}`;
    modalBody.value = prefill.body || `Hi,\n\nI have attached the timesheet for ${monthNames[state.monthIndex]} ${state.year} for ${state.name}.\n\nBest regards,\n${state.name}\n${prefill.senderPhone || ''}\n${prefill.senderEmail || ''}`;
    modal.querySelector('#modalDownloadOnly').addEventListener('click', () => {
      const blob = createExcelBlobForSend(); const filename = `${state.name.replace(/\s+/g, '_')}_${monthNames[state.monthIndex]}_${state.year}.xlsx`; downloadBlob(blob, filename); alert('Timesheet downloaded. Attach it to your email client when composing.'); modal.remove();
    });
    modal.querySelector('#modalGmail').addEventListener('click', () => {
      const to = modalTo.value.trim(); if (!to) { alert('Please enter recipient email'); return; } const subject = modalSubject.value.trim(); const body = modalBody.value; const blob = createExcelBlobForSend(); downloadBlob(blob, `${state.name.replace(/\s+/g, '_')}_${monthNames[state.monthIndex]}_${state.year}.xlsx`); openGmailCompose(to, subject, body); modal.remove();
    });
    modal.querySelector('#modalOutlook').addEventListener('click', () => {
      const to = modalTo.value.trim(); if (!to) { alert('Please enter recipient email'); return; } const subject = modalSubject.value.trim(); const body = modalBody.value; const blob = createExcelBlobForSend(); downloadBlob(blob, `${state.name.replace(/\s+/g, '_')}_${monthNames[state.monthIndex]}_${state.year}.xlsx`); openOutlookCompose(to, subject, body); modal.remove();
    });
    modal.querySelector('#modalMailto').addEventListener('click', () => {
      const to = modalTo.value.trim(); if (!to) { alert('Please enter recipient email'); return; } const subject = modalSubject.value.trim(); const body = modalBody.value; const blob = createExcelBlobForSend(); downloadBlob(blob, `${state.name.replace(/\s+/g, '_')}_${monthNames[state.monthIndex]}_${state.year}.xlsx`); openMailtoCompose(to, subject, body); modal.remove();
    });
    return modal;
  }

  function openSendDialog() { const prefill = { to: '', subject: `Timesheet - ${state.name} - ${monthNames[state.monthIndex]} ${state.year}`, senderName: state.name || '', senderEmail: '', senderPhone: '', body: '' }; createSendModal(prefill); }
  function openGmailCompose(to, subject, body) { const base = 'https://mail.google.com/mail/?view=cm&fs=1'; const params = `&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; window.open(base + params, '_blank'); }
  function openOutlookCompose(to, subject, body) { const base = 'https://outlook.office.com/mail/deeplink/compose'; const params = `?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; window.open(base + params, '_blank'); }
  function openMailtoCompose(to, subject, body) { const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; window.location.href = mailto; }

  // event wiring
  if (selectMonth) selectMonth.addEventListener('change', () => { state.monthIndex = Number(selectMonth.value); renderHeading(); renderCalendar(); });
  if (selectYear) selectYear.addEventListener('change', () => { state.year = Number(selectYear.value); renderHeading(); renderCalendar(); });
  if (inputName) inputName.addEventListener('input', () => { state.name = inputName.value || 'Unnamed'; renderHeading(); });
  if (inputCompany) inputCompany.addEventListener('input', () => { state.company = inputCompany.value || ''; renderHeading(); });
  if (inputEmpId) inputEmpId.addEventListener('input', () => { state.empId = inputEmpId.value || ''; renderHeading(); });

  if (btnExport) btnExport.addEventListener('click', async () => { if (selectTemplate && selectTemplate.value && selectTemplate.value !== 'default') { await exportTemplate(); } else { try { await exportExcelColored(false, null, null); } catch (e) { console.warn('Colored export failed, falling back to basic export', e); exportExcelSafe(); } } });
  if (btnExportCSV) btnExportCSV.addEventListener('click', exportCSV);
  if (btnMarkWeekends) btnMarkWeekends.addEventListener('click', () => { markWeekendsAsHoliday(); });
  if (btnClearMonth) btnClearMonth.addEventListener('click', () => { if (confirm('Clear statuses for this month?')) clearMonth(); });
  if (btnSendTop) btnSendTop.addEventListener('click', openSendDialog);
  if (fileTemplate) fileTemplate.addEventListener('change', handleUpload);

  if (btnPrevMonth) btnPrevMonth.addEventListener('click', () => { state.monthIndex = (state.monthIndex + 11) % 12; if (state.monthIndex === 11) state.year = state.year - 1; renderHeading(); renderCalendar(); if (selectMonth) selectMonth.value = state.monthIndex; if (selectYear) selectYear.value = state.year; });
  if (btnNextMonth) btnNextMonth.addEventListener('click', () => { state.monthIndex = (state.monthIndex + 1) % 12; if (state.monthIndex === 0) state.year = state.year + 1; renderHeading(); renderCalendar(); if (selectMonth) selectMonth.value = state.monthIndex; if (selectYear) selectYear.value = state.year; });
  if (btnToggleWeekendColor) btnToggleWeekendColor.addEventListener('click', () => { state.showWeekendColors = !state.showWeekendColors; renderCalendar(); btnToggleWeekendColor.style.opacity = state.showWeekendColors ? '1' : '0.7'; });

  // init
  renderHeading(); loadTemplates(); renderCalendar();

  // debug
  window.__timesheetState = state;
  window.__renderCalendar = renderCalendar;
  window.exportWithTemplateXlsxPopulate = exportWithTemplateXlsxPopulate;

})();
