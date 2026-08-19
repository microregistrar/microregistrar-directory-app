# Microregistrar Sheet App

Static admin-style web app generated from the public [Microregistrar Moodlecloud Google Sheet](https://docs.google.com/spreadsheets/d/1XzlEPyzUM3ljxjzMrxpXLH-Pu_xTlWGC8AtrlRzp5Zw/edit). The original spreadsheet is **not** modified.

## Quick start

```bash
cd app
python3 -m http.server 8080
```

Open http://localhost:8080 — use the home dashboard, sidebar tabs, search, and add/edit/delete.

Edits persist in browser `localStorage`. Use **Export JSON** / **Import JSON** in the sidebar, or **Export CSV** on a tab. **Reset snapshot** discards local edits.

## Docs

1. [Sheet audit](docs/SHEET_AUDIT.md) — tabs, schema, CRUD suitability, access limits  
2. [Implementation plan](docs/IMPLEMENTATION_PLAN.md) — architecture  
3. [Google Sheets setup](docs/GOOGLE_SHEETS_SETUP.md) — safest live connection later  

## File structure

```
app/
  index.html
  css/styles.css
  js/data-access.js    # UI ↔ data boundary (LocalJsonStore)
  js/app.js
  data/mock-data.json  # mapped snapshot of all 16 tabs
docs/
scripts/refresh-mock-data.py
```

## Refresh mock data from the public sheet

```bash
python3 scripts/refresh-mock-data.py
```

## Live Google Sheets

Direct write from the browser is intentionally unsupported (no secrets in frontend). See `docs/GOOGLE_SHEETS_SETUP.md` for a backend + `GoogleSheetsStore` path.
