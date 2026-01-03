# Firestore Users, Template Export, Global Loaders

## What we'll do
- Save users into Firestore (`users` collection) with fields: email, name, uid, company, employeeId, timezone; ensure creation on signup/login and when saving timesheets if missing.
- Align Excel export to the provided colored template (status fills, legend colors, comments, remarks) and ensure Save Timesheet prints comments into export.
- Add page-level loading buffers/spinners for initial load and save flows across pages to avoid flashing on slow networks; keep auth guard hidden state smooth.

## Files to touch
- [auth/signup.html](auth/signup.html), [auth/login.html](auth/login.html) — hook user creation/upsert to Firestore after auth.
- [timesheet/index.html](timesheet/index.html) — save users if missing on save, integrate template-style Excel export (colors/comments), add load/save buffers.
- [shared/auth-guard.js](shared/auth-guard.js) — support global page loading state.
- (If needed) [firebase.json]/Firestore rules guidance (no code change unless rules file exists).

## Implementation outline
- Add a helper to upsert Firestore `users/{uid}` with {email, name, uid, company, employeeId, timezone, createdAt/updatedAt} after signup/login and before saving timesheets.
- Update timesheet save flow to include comments/remarks, ensure permission errors surface via modal; confirm writes target `timesheets/{empId_year_monthIndex}` with auth required.
- Replace Excel export with xlsx-populate to clone the template: apply status color fills (P/C/L/H/ST/SU), remarks/comments, employee/company/month/year, and keep the existing template file as source.
- Implement global loader overlay (CSS + JS) triggered on auth guard init, page load, and save/redirect actions; keep ARIA-friendly text and no flashing on fast loads.

