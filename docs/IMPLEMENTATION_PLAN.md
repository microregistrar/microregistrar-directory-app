# Implementation Plan

## Goal
Turn the Microregistrar Google Sheet into a single-entry static web app with hash routing, per-tab views, CRUD, search, and a swappable data layer for future Google Sheets API / MCP connectivity — without modifying the original spreadsheet.

## Architecture

```
app/
  index.html          # Shell + modals
  css/styles.css      # Admin UI + dark mode
  js/data-access.js   # DataAccess interface + LocalJsonStore
  js/app.js           # Routing, tables, forms, search
  data/mock-data.json # Snapshot mapped from the sheet
docs/
  SHEET_AUDIT.md
  IMPLEMENTATION_PLAN.md
  GOOGLE_SHEETS_SETUP.md
scripts/
  refresh-mock-data.py  # Re-export public sheet → mock-data.json
```

**Why multiple files (not one giant HTML):** mock data is ~400KB; separating CSS/JS/data keeps the UI layer independent from the data-access layer and makes a future Sheets adapter a drop-in.

## Data strategy
1. **Now:** `LocalJsonStore` loads `mock-data.json`, overlays edits in `localStorage`, supports JSON/CSV import & export.
2. **Later:** implement `GoogleSheetsStore` behind the same interface; secrets stay server-side only.

## UI plan
- Home dashboard (`#/`) indexes every tab as cards (mirrors INDEX hub).
- Hash routes: `#/tab/<name>`, `#/search`.
- Per-tab table with search, sort, gap filter, add/edit/delete modal.
- Safe external links; internal sheet links become in-app routes.
- Loading / empty / error states; dark mode toggle.

## Steps
1. Audit sheet (done) → normalize lightly into mock JSON.
2. Implement data-access + persistence.
3. Build shell UI, dashboard, tab tables, CRUD modals.
4. Document Sheets connection path.
5. Manual verify: navigate all tabs, CRUD, search, links, import/export.
