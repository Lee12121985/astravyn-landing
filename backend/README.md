Export Template backend (Node + Express)
=====================================

This small server exposes a single route used by the timesheet UI:

- `POST /api/export-template` — accepts JSON payload and returns a populated Excel workbook based on the template `public/template/TIMESHEET_NOVEMBER-SKP.xlsx`.

Quick start
-----------

1. From the backend folder, install dependencies:

```powershell
cd "d:\anti gravity\DATING-AVIN\projects\astravyn-landing\backend"
npm install
```

2. Start the server:

```powershell
npm start
# server listens on http://localhost:3000 by default
```

3. Ensure the template file exists at:

```
projects/astravyn-landing/public/template/TIMESHEET_NOVEMBER-SKP.xlsx
```

Client notes
------------
- The client (timesheet UI) will POST the payload described in the UI code to `/api/export-template` and download the returned workbook.
- If the server is not running, the UI contains a client-side fallback which will attempt to fetch the template directly and populate it in-browser (best-effort).

Customization
-------------
- The server writes header fields to `B2..B5` and attendance rows to columns `A,B,C` starting near a detected 'Date' header row (default start row 10). If your template uses different cell addresses or named ranges, update `server.js` to write to the correct cells or implement named-range mapping using ExcelJS.
