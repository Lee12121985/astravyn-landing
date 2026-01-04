// timesheet-app.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.10.0/firebase-analytics.js';

const firebaseConfig = {
  apiKey: "AIzaSyDPljICCsPxIH9TtNYJ9VyIg6YvYwPis3E",
  authDomain: "astravyn-landing.firebaseapp.com",
  projectId: "astravyn-landing",
  storageBucket: "astravyn-landing.firebasestorage.app",
  messagingSenderId: "90590064470",
  appId: "1:90590064470:web:740aa9cd5213ac9f50f0f7",
  measurementId: "G-DV0M3HKV6B"
};

const firebaseApp = initializeApp(firebaseConfig);
const analytics = getAnalytics(firebaseApp);

(function () {
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  function daysInMonth(y,m){ return new Date(y,m+1,0).getDate(); }
  function isoDate(y,m,d){ return `${String(y).padStart(4,'0')}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
  function formatDayName(y,m,d){ return new Date(y,m,d).toLocaleDateString(undefined,{ weekday:'short' }); }
  function formatMDY(y,m,d){ return `${m+1}/${d}/${y}`; }

  const state = {
    year: 2025,
    monthIndex: 9,
    company: 'NovaEdge Technologies',
    name: 'Aarav Kiran',
    empId: 'NE-2047',
    statusMap: {},
    showWeekendColors: false
  };

  // DOM refs
  const selectMonth = document.getElementById('selectMonth');
  const selectYear = document.getElementById('selectYear');
  const headingMonth = document.getElementById('headingMonth');
  const calendarEl = document.getElementById('calendar');
  const inputName = document.getElementById('inputName');
  const inputCompany = document.getElementById('inputCompany');
  const inputEmpId = document.getElementById('inputEmpId');
  const summaryCompany = document.getElementById('summaryCompany');
  const summaryName = document.getElementById('summaryName');
  const summaryEmpId = document.getElementById('summaryEmpId');
  const summaryMonth = document.getElementById('summaryMonth');
  const summaryPresent = document.getElementById('summaryPresent');
  const summaryLeave = document.getElementById('summaryLeave');
  const summaryComp = document.getElementById('summaryComp');
  const summaryHoliday = document.getElementById('summaryHoliday');
  const summaryPercent = document.getElementById('summaryPercent');
  const summaryCompOfHoliday = document.getElementById('summaryCompOfHoliday');
  const reportBody = document.getElementById('reportBody');
  const btnExport = document.getElementById('btnExport');
  const btnExportCSV = document.getElementById('btnExportCSV');
  const btnMarkWeekends = document.getElementById('btnMarkWeekends');
  const btnClearMonth = document.getElementById('btnClearMonth');
  const btnSendTop = document.getElementById('btnSendTop');

  const selectTemplate = document.getElementById('selectTemplate');
  const fileTemplate = document.getElementById('fileTemplate');
  const btnPrevMonth = document.getElementById('btnPrevMonth');
  const btnNextMonth = document.getElementById('btnNextMonth');
  const btnToggleWeekendColor = document.getElementById('btnToggleWeekendColor');

  // init month/year selectors
  if (selectMonth) {
    selectMonth.innerHTML = monthNames.map((m,i)=>`<option value="${i}">${m}</option>`).join('');
    selectMonth.value = state.monthIndex;
  }
  if (selectYear) {
    const curYear = new Date().getFullYear();
    selectYear.innerHTML = Array.from({length:12},(_,i)=>curYear-6+i).map(y=>`<option value="${y}">${y}</option>`).join('');
    selectYear.value = state.year;
  }

  function renderHeading(){
    if (headingMonth) headingMonth.textContent = `${monthNames[state.monthIndex]} ${state.year}`;
    if (summaryCompany) summaryCompany.textContent = state.company;
    if (summaryName) summaryName.textContent = state.name;
    if (summaryEmpId) summaryEmpId.textContent = state.empId;
    if (summaryMonth) summaryMonth.textContent = `${monthNames[state.monthIndex]} ${state.year}`;
  }

  const CYCLE = ['', 'P', 'C', 'L', 'H'];

  function createDayCell(y,m,d){
    const iso = isoDate(y,m,d);
    const cell = document.createElement('div');
    cell.className = 'day';
    cell.tabIndex = 0;
    cell.setAttribute('role','gridcell');
    cell.setAttribute('aria-label', `${monthNames[m]} ${d}, ${y}`);
    cell.dataset.date = iso;

    const dow = new Date(y,m,d).getDay();
    if (dow === 6) cell.classList.add('saturday');
    else if (dow === 0) cell.classList.add('sunday');
    else cell.classList.add('workday');

    if (state.showWeekendColors) {
      if (dow === 6) { cell.classList.add('weekend-sat'); cell.dataset.weekend = "sat"; }
      if (dow === 0) { cell.classList.add('weekend-sun'); cell.dataset.weekend = "sun"; }
    }

    const num = document.createElement('div'); num.className = 'num'; num.textContent = d; cell.appendChild(num);

    const pillWrap = document.createElement('div'); pillWrap.className = 'pillWrap';
    updatePill(pillWrap, state.statusMap[iso] || '');
    cell.appendChild(pillWrap);

    cell.addEventListener('click', () => {
      const cur = state.statusMap[iso] || '';
      const normCur = (cur === 'ST' || cur === 'SU') ? 'H' : cur;
      let idx = CYCLE.indexOf(normCur); if (idx === -1) idx = 0;
      idx = (idx + 1) % CYCLE.length;
      let next = CYCLE[idx];

      if (next === 'H') {
        if (dow === 6) next = 'ST';
        else if (dow === 0) next = 'SU';
      }

      if (next === '') delete state.statusMap[iso]; else state.statusMap[iso] = next;
      updatePill(pillWrap, state.statusMap[iso] || '');
      cell.setAttribute('aria-current-status', next || 'Empty');
      updateSummaryAndReport();
    });

    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cell.click();
      }
    });

    return cell;
  }

  function updatePill(wrapper,status){
    wrapper.innerHTML = '';
    if (!status) return;
    const sp = document.createElement('span');
    sp.className = 'pill ' + status;
    sp.textContent = status;
    wrapper.appendChild(sp);
  }

  function renderCalendar(){
    calendarEl.innerHTML = '';
    const y = state.year, m = state.monthIndex;
    const total = daysInMonth(y,m);
    const firstDow = new Date(y,m,1).getDay();
    const offset = (firstDow + 6) % 7;
    for (let i=0;i<offset;i++){ const blank = document.createElement('div'); blank.className='day hidden'; calendarEl.appendChild(blank); }
    for (let d=1; d<=total; d++) calendarEl.appendChild(createDayCell(y,m,d));
    updateSummaryAndReport();
  }

  function updateSummaryAndReport(){
    const y = state.year, m = state.monthIndex, total = daysInMonth(y,m);
    let present=0, leave=0, comp=0, hol=0;
    reportBody.innerHTML = '';
    for (let d=1; d<=total; d++){
      const iso = isoDate(y,m,d);
      const st = state.statusMap[iso] || '';
      if (st === 'P') present++;
      if (st === 'L') leave++;
      if (st === 'C') comp++;
      if (st === 'H' || st === 'ST' || st === 'SU') hol++;
      const tr = document.createElement('tr');
      const td1 = document.createElement('td'); td1.textContent = formatMDY(y,m,d);
      const td2 = document.createElement('td'); td2.textContent = formatDayName(y,m,d);
      const td3 = document.createElement('td'); td3.textContent = st || '—'; td3.style.textAlign='center';
      td3.className = 'status-cell' + (st ? (' ' + st) : '');
      tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
      reportBody.appendChild(tr);
    }
    if (summaryPresent) summaryPresent.textContent = present;
    if (summaryLeave) summaryLeave.textContent = leave;
    if (summaryComp) summaryComp.textContent = comp;
    if (summaryHoliday) summaryHoliday.textContent = hol;

    const workingDays = Math.max(0, total - hol);
    const attendancePercent = workingDays > 0 ? (present / workingDays) * 100 : 0;
    const compOffPercent = hol > 0 ? (comp / hol) * 100 : 0;

    if (summaryPercent) summaryPercent.textContent = `${attendancePercent.toFixed(1)}%`;
    if (summaryCompOfHoliday) summaryCompOfHoliday.textContent = `${comp} / ${hol} (${compOffPercent.toFixed(1)}%)`;
  }

  /* ---------------- CSV Export (unchanged) ---------------- */
  function exportCSV(){
    const y = state.year, m = state.monthIndex, total = daysInMonth(y,m);
    let present=0, leave=0, comp=0, hol=0;
    for (let d=1; d<=total; d++){
      const st = state.statusMap[isoDate(y,m,d)] || '';
      if (st === 'P') present++;
      if (st === 'L') leave++;
      if (st === 'C') comp++;
      if (st === 'H' || st === 'ST' || st === 'SU') hol++;
    }
    const workingDays = Math.max(0, total - hol);
    const attendancePercent = workingDays > 0 ? (present / workingDays) * 100 : 0;
    const compOffPercent = hol > 0 ? (comp / hol) * 100 : 0;

    const rows = [];
    rows.push([`Company Name: ${state.company}`]);
    rows.push([`Employee Name: ${state.name}`]);
    rows.push([`Employee ID: ${state.empId}`]);
    rows.push([`Month: ${monthNames[m]} ${y}`]);
    rows.push([]);
    rows.push(['Summary','Value']);
    rows.push(['Total Days in Month', total]);
    rows.push(['Total Present', present]);
    rows.push(['Total Leave', leave]);
    rows.push(['Total Comp-off', comp]);
    rows.push(['Total Holiday', hol]);
    rows.push(['Working Days', workingDays]);
    rows.push(['Attendance %', `${attendancePercent.toFixed(1)}%`]);
    rows.push(['Comp-off of Holiday', `${comp} / ${hol} (${compOffPercent.toFixed(1)}%)`]);
    rows.push([]);
    rows.push(['Date','Day','Status']);
    for (let d=1; d<=total; d++){
      const iso = isoDate(y,m,d);
      const st = state.statusMap[iso] || '';
      rows.push([formatMDY(y,m,d), formatDayName(y,m,d), st]);
    }

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const blob = new Blob(["\uFEFF", csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${state.name.replace(/\s+/g,'_')}_${monthNames[m]}_${y}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------------- Excel colored export (best-effort styles) ---------------- */

  // default style mapping (fallback) using ARGB hex for fill (no alpha)
  const DEFAULT_STYLE_MAP = {
    'P': { fill: { fgColor: { rgb: "10B981" } }, font: { bold: true } }, // green
    'C': { fill: { fgColor: { rgb: "3B82F6" } }, font: { bold: true, color: { rgb: "FFFFFF" } } }, // blue
    'L': { fill: { fgColor: { rgb: "F59E0B" } }, font: { bold: true } }, // orange
    'H': { fill: { fgColor: { rgb: "9CA3AF" } }, font: { bold: true, color: { rgb: "FFFFFF" } } } // gray
  };

  // helper: converts our simplified style to a full SheetJS style object
  function toSheetStyle(s) {
    const out = {};
    if (!s) return out;
    if (s.fill && s.fill.fgColor) {
      out.fill = { patternType: "solid", fgColor: { rgb: String(s.fill.fgColor.rgb).toUpperCase() } };
    }
    if (s.font) {
      out.font = {};
      if (s.font.bold) out.font.bold = true;
      if (s.font.color && s.font.color.rgb) out.font.color = { rgb: String(s.font.color.rgb).toUpperCase() };
      if (s.font.sz) out.font.sz = s.font.sz;
    }
    if (s.alignment) out.alignment = s.alignment;
    if (s.border) out.border = s.border;
    return out;
  }

  // copy a style object if present from a template cell
  function cloneStyleObj(styleObj) {
    if (!styleObj) return null;
    // shallow copy is enough for common SheetJS style objects
    return JSON.parse(JSON.stringify(styleObj));
  }

  // try to infer status->style mapping from a template worksheet by searching for a 'P','C','L','H' occurrences
  function inferStyleMapFromTemplate(ws) {
    const map = {};
    try {
      const range = ws['!ref'];
      if (!range) return null;
      // iterate cells present in sheet
      for (const addr in ws) {
        if (addr[0] === '!') continue;
        const cell = ws[addr];
        const v = (cell.v || '').toString().trim();
        if (v === 'P' || v === 'C' || v === 'L' || v === 'H' || v === 'ST' || v === 'SU') {
          // prefer cell.s (style) if available
          if (cell.s) {
            // map both ST/SU to H style
            const key = (v === 'ST' || v === 'SU') ? 'H' : v;
            if (!map[key]) map[key] = cloneStyleObj(cell.s);
          }
        }
      }
      // return null if nothing found
      return (Object.keys(map).length > 0) ? map : null;
    } catch (e) {
      console.warn('inferStyleMapFromTemplate failed', e);
      return null;
    }
  }

  // write workbook to file with appropriate styles
  function writeWorkbookWithStyles(wb, filename) {
    // prefer XLSX.writeFile (client-side)
    try {
      XLSX.writeFile(wb, filename, { bookType: 'xlsx', bookSST: false });
    } catch (err) {
      // fallback: create blob
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, filename);
    }
  }

  // colored excel export using styleMap (status -> SheetJS style object)
  async function exportExcelColored(useTemplate = false, templateWorkbook = null, templateStyleMap = null) {
    if (typeof XLSX === 'undefined') { throw new Error('Excel library not loaded.'); }
    const y = state.year, m = state.monthIndex, total = daysInMonth(y, m);

    // prepare data rows (header + attendance)
    const data = [];
    data.push(['Company Name', state.company]);
    data.push(['Employee Name', state.name]);
    data.push(['Employee ID', state.empId]);
    data.push(['Month', `${monthNames[m]} ${y}`]);
    data.push([]);
    data.push(['Summary', 'Value']);
    // summary counts
    let present = 0, leave = 0, comp = 0, hol = 0;
    for (let d = 1; d <= total; d++) {
      const st = state.statusMap[isoDate(y, m, d)] || '';
      if (st === 'P') present++;
      if (st === 'L') leave++;
      if (st === 'C') comp++;
      if (st === 'H' || st === 'ST' || st === 'SU') hol++;
    }
    const workingDays = Math.max(0, total - hol);
    const attendancePercent = workingDays > 0 ? (present / workingDays) * 100 : 0;
    data.push(['Total Days in Month', total]);
    data.push(['Total Present', present]);
    data.push(['Total Leave', leave]);
    data.push(['Total Comp-off', comp]);
    data.push(['Total Holiday', hol]);
    data.push(['Working Days', workingDays]);
    data.push(['Attendance %', `${attendancePercent.toFixed(1)}%`]);
    data.push([]);
    data.push(['Date', 'Day', 'Status']);

    for (let d = 1; d <= total; d++) {
      const iso = isoDate(y, m, d);
      const st = state.statusMap[iso] || '';
      data.push([formatMDY(y, m, d), formatDayName(y, m, d), st]);
    }

    // create or copy a workbook
    let wb;
    let ws;
    if (useTemplate && templateWorkbook) {
      // clone template to new workbook to avoid mutating original if provided
      wb = templateWorkbook;
      // take first sheet (common case)
      const first = wb.SheetNames[0];
      ws = wb.Sheets[first];
      // If template had data, we'll append attendance after finding header location.
      // We'll fall back to writing our own sheet if necessary.
    } else {
      wb = XLSX.utils.book_new();
      ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    }

    // If we used a blank/new sheet above, fill styles below.
    // Build styleMap: prefer templateStyleMap, else try infer from templateWorkbook, else DEFAULT_STYLE_MAP
    let styleMap = null;
    if (templateStyleMap) {
      styleMap = templateStyleMap;
    } else if (useTemplate && templateWorkbook) {
      // infer from the first sheet
      try {
        const inferred = inferStyleMapFromTemplate(templateWorkbook.Sheets[templateWorkbook.SheetNames[0]]);
        if (inferred) {
          styleMap = inferred;
        }
      } catch (e) { /* ignore */ }
    }
    if (!styleMap) {
      // convert our simplified to sheet styles
      styleMap = {};
      for (const k in DEFAULT_STYLE_MAP) styleMap[k] = toSheetStyle(DEFAULT_STYLE_MAP[k]);
    } else {
      // ensure the detected style objects are valid sheet-style shapes
      for (const k in styleMap) styleMap[k] = cloneStyleObj(styleMap[k]);
    }

    // If ws is from our data sheet created above, we need to apply styles to column C cells where status exists.
    // Determine the starting row for our attendance table in ws (search for header 'Date' row).
    const sheetJson = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    let startRow = -1; // 0-based index into sheetJson of header row
    for (let r = 0; r < sheetJson.length; r++) {
      const row = sheetJson[r].map(c => String(c).toLowerCase ? String(c).toLowerCase() : '');
      if (row.includes('date') && row.includes('day') && row.includes('status')) {
        startRow = r;
        break;
      }
    }
    if (startRow === -1) {
      // header not present - find first blank row after metadata or just append at row 10 (1-based)
      startRow = Math.max(9, sheetJson.length - data.length); // fallback heuristic
    }

    // Write attendance rows into sheet (ensures exact structure and apply styles)
    const attendanceStartRow = startRow + 2; // write below header (1-based -> we will add +1 in cell addresses)
    // But if this ws is result of aoa_to_sheet(data) earlier (i.e., we created it), we already have the rows in sheetJson.
    // We'll iterate our `data` array to find the Date/Day/Status rows and apply styles on the Status cells.

    // Guarantee ws is up-to-date by ensuring sheetJson matches our 'data' if new sheet
    // We'll re-generate ws from `data` if it's not the template workbook case
    if (!useTemplate || !templateWorkbook) {
      // Recreate ws so coordinates are contiguous and easier to style
      ws = XLSX.utils.aoa_to_sheet(data);
      wb.Sheets["Attendance"] = ws;
      // reset sheet name if necessary
      if (!wb.SheetNames.includes("Attendance")) {
        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
      } else {
        wb.SheetNames[0] = "Attendance";
      }
    } else {
      // template workbook: attempt to find header and write attendance rows starting at attendanceStartRow
      // find header row index (1-based)
      let headerRowIdx = -1;
      for (let r = 0; r < sheetJson.length; r++) {
        const row = sheetJson[r].map(c => (c || '').toString().toLowerCase());
        if (row.includes('date') && row.includes('day') && row.includes('status')) { headerRowIdx = r + 1; break; }
      }
      if (headerRowIdx === -1) headerRowIdx = 10;
      // write rows below headerRowIdx
      for (let i = 0; i < (total); i++) {
        const r = headerRowIdx + 1 + i; // 1-based row index to write to
        const ar = { date: formatMDY(y,m,i+1), day: formatDayName(y,m,i+1), status: state.statusMap[isoDate(y,m,i+1)] || '' };
        // ensure cell addresses A/B/C
        ws['A' + r] = { t: 's', v: ar.date };
        ws['B' + r] = { t: 's', v: ar.day };
        ws['C' + r] = { t: 's', v: ar.status };
        // apply style to C cell if status present
        const sty = styleMap[ar.status] || null;
        if (sty) ws['C' + r].s = sty;
      }
    }

    // If we recreated ws with aoa_to_sheet(data), the status column will be in column C starting at last header row.
    // Apply styling for those rows
    try {
      const finalJson = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      // find header row
      let hdrIdx = -1;
      for (let r = 0; r < finalJson.length; r++) {
        const row = finalJson[r].map(c => (c || '').toString().toLowerCase());
        if (row.includes('date') && row.includes('day') && row.includes('status')) { hdrIdx = r; break; }
      }
      if (hdrIdx === -1) {
        // fallback: find first row that contains 'Date' literal in column 0
        for (let r = 0; r < finalJson.length; r++) {
          if (String(finalJson[r][0] || '').toLowerCase() === 'date') { hdrIdx = r; break; }
        }
      }
      // status rows start at hdrIdx+1
      const start = (hdrIdx >= 0) ? hdrIdx + 1 : 10;
      for (let i = 0; i < total; i++) {
        const r = start + i + 1; // 1-based address
        const status = state.statusMap[isoDate(y,m,i+1)] || '';
        if (!status) continue;
        const addr = 'C' + r;
        if (!ws[addr]) ws[addr] = { t: 's', v: status };
        const sty = styleMap[status] || null;
        if (sty) ws[addr].s = sty;
      }
    } catch (e) {
      console.warn('Applying styles failed:', e);
    }

    // Optionally style the header row and summary cells (best-effort)
    try {
      // style header row cells A?B?C? where header contains 'Date' 'Day' 'Status'
      const finalJson2 = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      for (let r = 0; r < Math.min(finalJson2.length, 12); r++) {
        const row = finalJson2[r].map(c => (c || '').toString().toLowerCase());
        if (row.includes('date') && row.includes('day') && row.includes('status')) {
          // header is at row r (0-based), address is r+1
          const rr = r + 1;
          ['A','B','C'].forEach(col => {
            const a = col + rr;
            if (!ws[a]) ws[a] = { t: 's', v: finalJson2[r][('ABC'.indexOf(col))] || '' };
            ws[a].s = { font: { bold: true }, fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } } };
          });
          break;
        }
      }
    } catch (e) { /* ignore */ }

    const filename = `${state.name.replace(/\s+/g,'_')}_${monthNames[m]}_${y}_colored.xlsx`;
    writeWorkbookWithStyles(wb, filename);
  }

  // fallback simple export (data-only)
  function exportExcel(){
    if (typeof XLSX === 'undefined') { throw new Error('Excel library not loaded.'); }
    const y = state.year, m = state.monthIndex, total = daysInMonth(y, m);
    let present = 0, leave = 0, comp = 0, hol = 0;
    for (let d = 1; d <= total; d++) {
      const st = state.statusMap[isoDate(y, m, d)] || '';
      if (st === 'P') present++;
      if (st === 'L') leave++;
      if (st === 'C') comp++;
      if (st === 'H' || st === 'ST' || st === 'SU') hol++;
    }
    const workingDays = Math.max(0, total - hol);
    const attendancePercent = workingDays > 0 ? (present / workingDays) * 100 : 0;
    const compOffPercent = hol > 0 ? (comp / hol) * 100 : 0;

    const data = [];
    data.push(['Company Name', state.company]);
    data.push(['Employee Name', state.name]);
    data.push(['Employee ID', state.empId]);
    data.push(['Month', `${monthNames[m]} ${y}`]);
    data.push([]);
    data.push(['Summary','Value']);
    data.push(['Total Days in Month', total]);
    data.push(['Total Present', present]);
    data.push(['Total Leave', leave]);
    data.push(['Total Comp-off', comp]);
    data.push(['Total Holiday', hol]);
    data.push(['Working Days', workingDays]);
    data.push(['Attendance %', `${attendancePercent.toFixed(1)}%`]);
    data.push(['Comp-off of Holiday', `${comp} / ${hol} (${compOffPercent.toFixed(1)}%)`]);
    data.push([]);
    data.push(['Date','Day','Status']);
    for (let d = 1; d <= total; d++) {
      const iso = isoDate(y, m, d);
      const st = state.statusMap[iso] || '';
      data.push([formatMDY(y, m, d), formatDayName(y, m, d), st]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `${state.name.replace(/\s+/g,'_')}_${monthNames[m]}_${y}.xlsx`);
  }

  function exportExcelSafe(){ try { exportExcel(); } catch(e){ console.error('Export Excel failed:', e); alert('Export Excel failed: ' + (e && e.message)); } }

  /* ---------------- Mark / clear ---------------- */
  function markWeekendsAsHoliday(){
    const y = state.year, m = state.monthIndex, total = daysInMonth(y,m);
    for (let d=1; d<=total; d++){
      const dow = new Date(y,m,d).getDay();
      if (dow === 6) state.statusMap[isoDate(y,m,d)] = 'ST';
      if (dow === 0) state.statusMap[isoDate(y,m,d)] = 'SU';
    }
    renderCalendar();
  }

  function clearMonth(){
    const y = state.year, m = state.monthIndex;
    Object.keys(state.statusMap).forEach(k=>{
      const dt = new Date(k);
      if (dt.getFullYear() === y && dt.getMonth() === m) delete state.statusMap[k];
    });
    renderCalendar();
  }

  /* ---------------- Template payload builder (unchanged) ---------------- */
  function buildTemplatePayload(){
    const y = state.year, m = state.monthIndex, total = daysInMonth(y,m);
    const attendanceRows = [];
    for (let d=1; d<=total; d++){
      const iso = isoDate(y,m,d);
      const dow = new Date(y,m,d).getDay();
      let isWeekend = null;
      if (dow === 6) isWeekend = 'sat';
      if (dow === 0) isWeekend = 'sun';
      attendanceRows.push({ date: iso, day: formatDayName(y,m,d), status: state.statusMap[iso] || '', isWeekend });
    }
    let present=0, leave=0, comp=0, hol=0;
    attendanceRows.forEach(r=>{
      if (r.status === 'P') present++;
      if (r.status === 'L') leave++;
      if (r.status === 'C') comp++;
      if (r.status === 'H' || r.status === 'ST' || r.status === 'SU') hol++;
    });
    const workingDays = Math.max(0, total - hol);
    const attendancePercent = workingDays > 0 ? (present / workingDays) * 100 : 0;
    return {
      company: state.company,
      employeeName: state.name,
      employeeId: state.empId,
      month: monthNames[m],
      year: state.year,
      attendanceRows,
      summary: { totalPresent: present, totalLeave: leave, totalHoliday: hol, attendancePercent: Number(attendancePercent.toFixed(1)) }
    };
  }

  /* ---------------- createExcelBlobForSend ---------------- */
  function createExcelBlobForSend(){
    if (typeof XLSX === 'undefined') throw new Error('XLSX not loaded');
    const payload = buildTemplatePayload();
    const data = [];
    data.push(['Company Name', payload.company]);
    data.push(['Employee Name', payload.employeeName]);
    data.push(['Employee ID', payload.employeeId]);
    data.push(['Month', `${payload.month} ${payload.year}`]);
    data.push([]);
    data.push(['Summary','Value']);
    data.push(['Total Days in Month', payload.attendanceRows.length]);
    data.push(['Total Present', payload.summary.totalPresent]);
    data.push(['Total Leave', payload.summary.totalLeave]);
    data.push(['Total Comp-off', 0]);
    data.push(['Total Holiday', payload.summary.totalHoliday]);
    data.push([]);
    data.push(['Date','Day','Status']);
    payload.attendanceRows.forEach(r => data.push([r.date, r.day, r.status]));
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return blob;
  }

  function downloadBlob(blob, filename){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),15000);
  }

  /* ---------------- Export Template (server POST with client-side fallback) ---------------- */
  async function exportTemplate() {
    if (!selectTemplate) { alert('Export UI not ready'); return; }
    const templateId = selectTemplate.value;
    const payload = buildTemplatePayload();
    payload.templateId = templateId; // ADDED

    // Try server first
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
      }
      console.warn('Server export-template failed status:', resp.status);
      // fallthrough to client-side
    } catch (err) {
      console.warn('Server export-template not available.', err);
    }

    // Client-side fallback: attempt to locate the template by templateId (if templateId is a filename)
    try {
      await clientSideExportTemplate(payload, templateId);
    } catch (err) {
      console.error('Client side template export failed', err);
      alert('Template export failed: ' + (err && err.message));
    }
  }

  // load templates from /api/templates (unchanged)
  async function loadTemplates(){
    if (!selectTemplate) return;
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const list = await res.json();
        selectTemplate.innerHTML = '<option value="default">Normal Export</option>';
        list.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.filename || t.id || t.name;
          opt.textContent = t.name || t.filename || t.id;
          selectTemplate.appendChild(opt);
        });
      }
    } catch (e) { console.error('Failed to load templates', e); }
  }

  /* ---------------- Upload Handler (unchanged) ---------------- */
  async function handleUpload(e){
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('template', file);
    try {
      const res = await fetch('/api/templates/upload', { method: 'POST', body: fd });
      if (res.ok) {
        alert('Template uploaded successfully!');
        loadTemplates();
      } else {
        const d = await res.json();
        alert('Upload failed: ' + (d && d.error ? d.error : res.statusText));
      }
    } catch (err) {
      alert('Upload error: ' + err.message);
    }
    e.target.value = '';
  }

  /* ---------------- clientSideExportTemplate (enhanced to copy template styles) ----------------
     payload: attendance payload
     templateRef: optional string. If provided, tries to fetch /template/<templateRef> (useful if your backend stores uploaded templates at /template/)
  */
  async function clientSideExportTemplate(payload, templateRef = null) {
    if (typeof XLSX === 'undefined') throw new Error('SheetJS (XLSX) is not loaded for client-side template export.');

    // If templateRef provided, try to fetch that file from /template/
    let workbook = null;
    let templateStyleMap = null;
    if (templateRef && templateRef !== 'default') {
      const url = `/template/${encodeURIComponent(templateRef)}`;
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const ab = await resp.arrayBuffer();
          workbook = XLSX.read(ab, { type: 'array', cellStyles: true });
          // try to infer style map
          templateStyleMap = inferStyleMapFromTemplate(workbook.Sheets[workbook.SheetNames[0]]);
        }
      } catch (e) {
        console.warn('Failed to load template from /template/', e);
      }
    }

    // If no workbook loaded, but a generic TIMESHEET_NOVEMBER-SKP template exists, try it
    if (!workbook) {
      try {
        const url2 = '/template/TIMESHEET_NOVEMBER-SKP.xlsx';
        const resp2 = await fetch(url2);
        if (resp2.ok) {
          const ab2 = await resp2.arrayBuffer();
          workbook = XLSX.read(ab2, { type: 'array', cellStyles: true });
          templateStyleMap = inferStyleMapFromTemplate(workbook.Sheets[workbook.SheetNames[0]]);
        }
      } catch (e) {
        // ignore
      }
    }

    // If we have a template workbook, attempt to populate it preserving styles
    if (workbook) {
      // Attempt to find the first sheet and write data into it (best-effort)
      try {
        // Use the enhanced colored exporter which will copy style mapping if found
        await exportExcelColored(true, workbook, templateStyleMap);
        return;
      } catch (err) {
        console.warn('Template fill via workbook failed', err);
      }
    }

    // If no template present or failed, build a simple colored workbook ourselves
    // Build a fresh workbook using payload and apply default styles
    // Create data in the same structure used by exportExcelColored
    const wb = XLSX.utils.book_new();
    const hdr = [
      ['Company Name', payload.company],
      ['Employee Name', payload.employeeName],
      ['Employee ID', payload.employeeId],
      ['Month', `${payload.month} ${payload.year}`],
      [],
      ['Date', 'Day', 'Status']
    ];
    const rows = hdr.concat(payload.attendanceRows.map(r => [r.date, r.day, r.status]));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");

    // apply default mapping styles on status column (column C)
    for (let i = 0; i < payload.attendanceRows.length; i++) {
      const r = hdr.length + i + 1; // 1-based row
      const st = payload.attendanceRows[i].status || '';
      if (!st) continue;
      const addr = 'C' + r;
      if (!ws[addr]) ws[addr] = { t: 's', v: st };
      const s = toSheetStyle(DEFAULT_STYLE_MAP[st] || DEFAULT_STYLE_MAP['H']);
      ws[addr].s = s;
    }

    // style header
    try {
      // header row is at row = hdr.length (0-based), header row index is 6 (1-based) typically
      const headerRowIdx = hdr.length;
      const rr = headerRowIdx;
      ['A','B','C'].forEach(col => {
        const a = col + rr;
        if (!ws[a]) ws[a] = { t: 's', v: ws[a] ? ws[a].v : '' };
        ws[a].s = { font: { bold: true }, fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } } };
      });
    } catch (e) {}

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const filename = `${payload.company.replace(/\s+/g,'_')}_${payload.employeeName.replace(/\s+/g,'')}_${payload.month}${payload.year}_Timesheet.xlsx`;
    downloadBlob(blob, filename);
  }

  /* ---------------- compose/open helpers (unchanged) ---------------- */
  function openGmailCompose(to,subject,body){ const base='https://mail.google.com/mail/?view=cm&fs=1'; const params=`&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; window.open(base+params,'_blank'); }
  function openOutlookCompose(to,subject,body){ const base='https://outlook.office.com/mail/deeplink/compose'; const params=`?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; window.open(base+params,'_blank'); }
  function openMailtoCompose(to,subject,body){ const mailto=`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; window.location.href = mailto; }

  /* ---------------- SEND MODAL logic (unchanged) ---------------- */
  function createSendModal(prefill = {}) {
    if (document.getElementById('sendModal')) return document.getElementById('sendModal');
    const modal = document.createElement('div');
    modal.id = 'sendModal';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '1400';
    modal.style.background = 'rgba(6,11,15,0.4)';
    modal.innerHTML = `
      <div style="background:var(--card);border-radius:12px;padding:18px;max-width:720px;width:100%;box-shadow:0 16px 48px rgba(11,15,25,0.35);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-weight:700;font-size:16px">Send Timesheet</div>
          <button id="sendModalClose" style="border:none;background:transparent;font-size:18px;cursor:pointer">✕</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <label style="font-size:13px;color:var(--muted)">To (company email)
            <input id="modalTo" type="email" style="width:100%;margin-top:6px;padding:8px;border-radius:8px;border:1px solid #d1d5db" />
          </label>
          <label style="font-size:13px;color:var(--muted)">Subject
            <input id="modalSubject" type="text" style="width:100%;margin-top:6px;padding:8px;border-radius:8px;border:1px solid #d1d5db" />
          </label>

          <label style="font-size:13px;color:var(--muted)">Sender name
            <input id="modalSenderName" type="text" style="width:100%;margin-top:6px;padding:8px;border-radius:8px;border:1px solid #d1d5db" />
          </label>
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
      </div>
    `;

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
      const blob = createExcelBlobForSend();
      const filename = `${state.name.replace(/\s+/g,'_')}_${monthNames[state.monthIndex]}_${state.year}.xlsx`;
      downloadBlob(blob, filename);
      alert('Timesheet downloaded. Attach it to your email client when composing.');
    });

    modal.querySelector('#modalGmail').addEventListener('click', () => {
      const to = modalTo.value.trim();
      if (!to) { alert('Please enter recipient email'); return; }
      const subject = modalSubject.value.trim();
      const body = modalBody.value;
      const blob = createExcelBlobForSend();
      const filename = `${state.name.replace(/\s+/g,'_')}_${monthNames[state.monthIndex]}_${state.year}.xlsx`;
      downloadBlob(blob, filename);
      openGmailCompose(to, subject, body);
      modal.remove();
    });

    modal.querySelector('#modalOutlook').addEventListener('click', () => {
      const to = modalTo.value.trim();
      if (!to) { alert('Please enter recipient email'); return; }
      const subject = modalSubject.value.trim();
      const body = modalBody.value;
      const blob = createExcelBlobForSend();
      const filename = `${state.name.replace(/\s+/g,'_')}_${monthNames[state.monthIndex]}_${state.year}.xlsx`;
      downloadBlob(blob, filename);
      openOutlookCompose(to, subject, body);
      modal.remove();
    });

    modal.querySelector('#modalMailto').addEventListener('click', () => {
      const to = modalTo.value.trim();
      if (!to) { alert('Please enter recipient email'); return; }
      const subject = modalSubject.value.trim();
      const body = modalBody.value;
      const blob = createExcelBlobForSend();
      const filename = `${state.name.replace(/\s+/g,'_')}_${monthNames[state.monthIndex]}_${state.year}.xlsx`;
      downloadBlob(blob, filename);
      openMailtoCompose(to, subject, body);
      modal.remove();
    });

    return modal;
  }

  function openSendDialog(){
    const prefill = { to:'', subject:`Timesheet - ${state.name} - ${monthNames[state.monthIndex]} ${state.year}`, senderName: state.name || '', senderEmail:'', senderPhone:'', body:'' };
    createSendModal(prefill);
  }

  /* ---------------- Event wiring ---------------- */
  if (selectMonth) selectMonth.addEventListener('change', () => { state.monthIndex = Number(selectMonth.value); renderHeading(); renderCalendar(); });
  if (selectYear) selectYear.addEventListener('change', () => { state.year = Number(selectYear.value); renderHeading(); renderCalendar(); });
  if (inputName) inputName.addEventListener('input', () => { state.name = inputName.value || 'Unnamed'; renderHeading(); });
  if (inputCompany) inputCompany.addEventListener('input', () => { state.company = inputCompany.value || ''; renderHeading(); });
  if (inputEmpId) inputEmpId.addEventListener('input', () => { state.empId = inputEmpId.value || ''; renderHeading(); });

  // EXPORT: choose template or colored export
  if (btnExport) btnExport.addEventListener('click', async () => {
    if (selectTemplate && selectTemplate.value && selectTemplate.value !== 'default') {
      // attempt template-based export
      await exportTemplate();
    } else {
      // default: colored excel (data-only but colored)
      try {
        await exportExcelColored(false, null, null);
      } catch (e) {
        console.warn('Colored export failed, falling back to basic export', e);
        exportExcelSafe();
      }
    }
  });

  if (btnExportCSV) btnExportCSV.addEventListener('click', exportCSV);

  if (btnMarkWeekends) btnMarkWeekends.addEventListener('click', () => { markWeekendsAsHoliday(); });
  if (btnClearMonth) btnClearMonth.addEventListener('click', () => { if (confirm('Clear statuses for this month?')) clearMonth(); });
  if (btnSendTop) btnSendTop.addEventListener('click', openSendDialog);

  if (fileTemplate) fileTemplate.addEventListener('change', handleUpload);

  // month nav buttons & weekend-color toggle (restore missing controls)
  if (btnPrevMonth) btnPrevMonth.addEventListener('click', () => {
    state.monthIndex = (state.monthIndex + 11) % 12;
    if (state.monthIndex === 11) state.year = state.year - 1;
    renderHeading(); renderCalendar();
    if (selectMonth) selectMonth.value = state.monthIndex;
    if (selectYear) selectYear.value = state.year;
  });
  if (btnNextMonth) btnNextMonth.addEventListener('click', () => {
    state.monthIndex = (state.monthIndex + 1) % 12;
    if (state.monthIndex === 0) state.year = state.year + 1;
    renderHeading(); renderCalendar();
    if (selectMonth) selectMonth.value = state.monthIndex;
    if (selectYear) selectYear.value = state.year;
  });
  if (btnToggleWeekendColor) btnToggleWeekendColor.addEventListener('click', () => {
    state.showWeekendColors = !state.showWeekendColors;
    renderCalendar();
    btnToggleWeekendColor.style.opacity = state.showWeekendColors ? '1' : '0.7';
  });

  // init
  renderHeading();
  loadTemplates();
  renderCalendar();

  // expose for debugging
  window.__timesheetState = state;
  window.__renderCalendar = renderCalendar;

})();
