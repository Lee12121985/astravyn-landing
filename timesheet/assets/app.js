/* assets/app.js - regenerated: calendar, summary, export CSV & Excel (with full summary) */
(function(){
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  function daysInMonth(y,m){ return new Date(y,m+1,0).getDate(); }
  function isoDate(y,m,d){ return `${String(y).padStart(4,'0')}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
  function formatDayName(y,m,d){ return new Date(y,m,d).toLocaleDateString(undefined,{weekday:'short'}); }
  function formatMDY(y,m,d){ return `${m+1}/${d}/${y}`; }

  const state = {
    year: 2025,
    monthIndex: 9, // October 2025 default
    company: 'SREE KRISNA POWER',
    name: 'LIKHICHAND L',
    empId: '50001975',
    statusMap: {} // iso -> 'P'|'C'|'L'|'H'
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

  // Initialize month/year selectors if present
  if(selectMonth){
    selectMonth.innerHTML = monthNames.map((m,i)=>`<option value="${i}">${m}</option>`).join('');
    selectMonth.value = state.monthIndex;
  }
  if(selectYear){
    const curYear = new Date().getFullYear();
    selectYear.innerHTML = Array.from({length:12},(_,i)=>curYear-6 + i).map(y=>`<option value="${y}">${y}</option>`).join('');
    selectYear.value = state.year;
  }

  function renderHeading(){
    if(headingMonth) headingMonth.textContent = `${monthNames[state.monthIndex]} ${state.year}`;
    if(summaryCompany) summaryCompany.textContent = state.company;
    if(summaryName) summaryName.textContent = state.name;
    if(summaryEmpId) summaryEmpId.textContent = state.empId;
    if(summaryMonth) summaryMonth.textContent = `${monthNames[state.monthIndex]} ${state.year}`;
  }

  const CYCLE = ['', 'P', 'C', 'L', 'H'];

  function createDayCell(y,m,d){
    const iso = isoDate(y,m,d);
    const cell = document.createElement('div');
    cell.className = 'day';
    cell.tabIndex = 0;
    cell.dataset.date = iso;

    const dow = new Date(y,m,d).getDay();
    if(dow===6) cell.classList.add('saturday');
    else if(dow===0) cell.classList.add('sunday');
    else cell.classList.add('workday');

    const num = document.createElement('div'); num.className='num'; num.textContent = d; cell.appendChild(num);

    const pillWrap = document.createElement('div'); pillWrap.className='pillWrap';
    updatePill(pillWrap, state.statusMap[iso] || '');
    cell.appendChild(pillWrap);

    cell.addEventListener('click', ()=>{
      const cur = state.statusMap[iso] || '';
      let idx = CYCLE.indexOf(cur); if(idx===-1) idx=0;
      idx = (idx + 1) % CYCLE.length;
      const next = CYCLE[idx];
      if(next === '') delete state.statusMap[iso]; else state.statusMap[iso] = next;
      updatePill(pillWrap, state.statusMap[iso] || '');
      updateSummaryAndReport();
    });

    cell.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); cell.click(); } });
    return cell;
  }

  function updatePill(wrapper, status){
    wrapper.innerHTML = '';
    if(!status) return;
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
    const offset = (firstDow + 6) % 7; // Monday-first
    for(let i=0;i<offset;i++){ const blank = document.createElement('div'); blank.className='day hidden'; calendarEl.appendChild(blank); }
    for(let d=1; d<=total; d++) calendarEl.appendChild(createDayCell(y,m,d));
    updateSummaryAndReport();
  }

  function updateSummaryAndReport(){
    const y = state.year, m = state.monthIndex, total = daysInMonth(y,m);
    let present=0, leave=0, comp=0, hol=0;
    reportBody.innerHTML = '';
    for(let d=1; d<=total; d++){
      const iso = isoDate(y,m,d);
      const st = state.statusMap[iso] || '';
      if(st==='P') present++;
      if(st==='L') leave++;
      if(st==='C') comp++;
      if(st==='H') hol++;
      const tr = document.createElement('tr');
      const td1 = document.createElement('td'); td1.textContent = formatMDY(y,m,d);
      const td2 = document.createElement('td'); td2.textContent = formatDayName(y,m,d);
      const td3 = document.createElement('td'); td3.textContent = st || '—'; td3.style.textAlign='center';
      tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
      reportBody.appendChild(tr);
    }
    if(summaryPresent) summaryPresent.textContent = present;
    if(summaryLeave) summaryLeave.textContent = leave;
    if(summaryComp) summaryComp.textContent = comp;
    if(summaryHoliday) summaryHoliday.textContent = hol;

    const workingDays = Math.max(0, total - hol);
    const attendancePercent = workingDays > 0 ? (present / workingDays) * 100 : 0;
    const compOffPercent = hol > 0 ? (comp / hol) * 100 : 0;

    if(summaryPercent) summaryPercent.textContent = `${attendancePercent.toFixed(1)}%`;
    if(summaryCompOfHoliday) summaryCompOfHoliday.textContent = `${comp} / ${hol} (${compOffPercent.toFixed(1)}%)`;
  }

  /* Export CSV (now includes full summary) */
  function exportCSV(){
    const y = state.year, m = state.monthIndex, total = daysInMonth(y,m);
    let present=0, leave=0, comp=0, hol=0;
    for(let d=1; d<=total; d++){
      const st = state.statusMap[isoDate(y,m,d)] || '';
      if(st==='P') present++;
      if(st==='L') leave++;
      if(st==='C') comp++;
      if(st==='H') hol++;
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

    // Summary block
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

    // Attendance rows
    rows.push(['Date','Day','Status']);
    for(let d=1; d<=total; d++){
      const iso = isoDate(y,m,d);
      const st = state.statusMap[iso] || '';
      rows.push([ formatMDY(y,m,d), formatDayName(y,m,d), st ]);
    }

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.name.replace(/\s+/g,'_')}_${monthNames[m]}_${y}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* Export Excel (AOA) */
  function exportExcel(){
    const y = state.year, m = state.monthIndex, total = daysInMonth(y,m);
    let present=0, leave=0, comp=0, hol=0;
    for(let d=1; d<=total; d++){
      const st = state.statusMap[isoDate(y,m,d)] || '';
      if(st==='P') present++;
      if(st==='L') leave++;
      if(st==='C') comp++;
      if(st==='H') hol++;
    }

    const workingDays = Math.max(0, total - hol);
    const attendancePercent = workingDays > 0 ? (present / workingDays) * 100 : 0;
    const compOffPercent = hol > 0 ? (comp / hol) * 100 : 0;

    const data = [];
    // Header info
    data.push(['Company Name', state.company]);
    data.push(['Employee Name', state.name]);
    data.push(['Employee ID', state.empId]);
    data.push(['Month', `${monthNames[m]} ${y}`]);
    data.push([]);

    // Summary block (INCLUDED)
    data.push(['Summary', 'Value']);
    data.push(['Total Days in Month', total]);
    data.push(['Total Present', present]);
    data.push(['Total Leave', leave]);
    data.push(['Total Comp-off', comp]);
    data.push(['Total Holiday', hol]);
    data.push(['Working Days', workingDays]);
    data.push(['Attendance %', `${attendancePercent.toFixed(1)}%`]);
    data.push(['Comp-off of Holiday', `${comp} / ${hol} (${compOffPercent.toFixed(1)}%)`]);
    data.push([]);

    // Attendance table header
    data.push(['Date','Day','Status']);
    for(let d=1; d<=total; d++){
      const iso = isoDate(y,m,d);
      const st = state.statusMap[iso] || '';
      data.push([ formatMDY(y,m,d), formatDayName(y,m,d), st ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wpx:110},{wpx:80},{wpx:70}];

    const statusStyleMap = {
      'P': { fill: { fgColor: { rgb: "C6EFCE" } }, font:{bold:true,color:{rgb:"006100"}}, alignment:{horizontal:"center",vertical:"center"} },
      'C': { fill: { fgColor: { rgb: "BDD7EE" } }, font:{bold:true,color:{rgb:"002060"}}, alignment:{horizontal:"center",vertical:"center"} },
      'L': { fill: { fgColor: { rgb: "FFE699" } }, font:{bold:true,color:{rgb:"7F6000"}}, alignment:{horizontal:"center",vertical:"center"} },
      'H': { fill: { fgColor: { rgb: "D9D9D9" } }, font:{bold:true,color:{rgb:"404040"}}, alignment:{horizontal:"center",vertical:"center"} },
      '':  { alignment:{horizontal:"center",vertical:"center"} }
    };

    const headerCellStyle = { font:{bold:true}, fill:{fgColor:{rgb:"FFF2CC"}}, alignment:{horizontal:"center",vertical:"center"} };

    if(ws['!ref']){
      const range = XLSX.utils.decode_range(ws['!ref']);
      // find header row index (where 'Date' is)
      let headerRowIndex = null;
      for(let r=range.s.r; r<=range.e.r; ++r){
        const cell = ws[XLSX.utils.encode_cell({r:r,c:0})];
        if(cell && String(cell.v).toLowerCase()==='date'){ headerRowIndex = r; break; }
      }
      if(headerRowIndex === null) headerRowIndex = range.s.r + 12;

      // style header cells
      for(let c=0;c<=2;c++){
        const hdrRef = XLSX.utils.encode_cell({r:headerRowIndex,c:c});
        if(ws[hdrRef]) ws[hdrRef].s = Object.assign({}, ws[hdrRef].s || {}, headerCellStyle);
      }

      // bold summary labels (above header)
      for(let r=0; r<headerRowIndex; r++){
        const cellRef = XLSX.utils.encode_cell({r:r,c:0});
        const cell = ws[cellRef];
        if(cell && typeof cell.v !== 'undefined' && String(cell.v).trim()!==''){
          cell.s = cell.s || {};
          cell.s.font = Object.assign({}, cell.s.font || {}, { bold: true });
        }
      }

      // style status cells
      for(let r=headerRowIndex+1; r<=range.e.r; ++r){
        const statusCellRef = XLSX.utils.encode_cell({r:r,c:2});
        const statusCell = ws[statusCellRef];
        if(statusCell){
          const st = String(statusCell.v || '');
          statusCell.s = Object.assign({}, statusCell.s || {}, statusStyleMap[st] || statusStyleMap['']);
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `${state.name.replace(/\s+/g,'_')}_${monthNames[m]}_${y}.xlsx`);
  }

  function markWeekendsAsHoliday(){
    const y = state.year, m = state.monthIndex, total = daysInMonth(y,m);
    for(let d=1; d<=total; d++){
      const dow = new Date(y,m,d).getDay();
      if(dow===0 || dow===6) state.statusMap[isoDate(y,m,d)] = 'H';
    }
    renderCalendar();
  }

  function clearMonth(){
    const y = state.year, m = state.monthIndex;
    Object.keys(state.statusMap).forEach(k=>{
      const dt = new Date(k);
      if(dt.getFullYear()===y && dt.getMonth()===m) delete state.statusMap[k];
    });
    renderCalendar();
  }

  // Events
  if(selectMonth) selectMonth.addEventListener('change', ()=>{ state.monthIndex = Number(selectMonth.value); renderHeading(); renderCalendar(); });
  if(selectYear) selectYear.addEventListener('change', ()=>{ state.year = Number(selectYear.value); renderHeading(); renderCalendar(); });
  if(inputName) inputName.addEventListener('input', ()=>{ state.name = inputName.value || 'Unnamed'; renderHeading(); });
  if(inputCompany) inputCompany.addEventListener('input', ()=>{ state.company = inputCompany.value || ''; renderHeading(); });
  if(inputEmpId) inputEmpId.addEventListener('input', ()=>{ state.empId = inputEmpId.value || ''; renderHeading(); });
  if(btnExport) btnExport.addEventListener('click', exportExcel);
  if(btnExportCSV) btnExportCSV.addEventListener('click', exportCSV);
  if(btnMarkWeekends) btnMarkWeekends.addEventListener('click', ()=>{ markWeekendsAsHoliday(); });
  if(btnClearMonth) btnClearMonth.addEventListener('click', ()=>{ if(confirm('Clear statuses for this month?')) clearMonth(); });

  // initial render
  renderHeading();
  renderCalendar();

})();
