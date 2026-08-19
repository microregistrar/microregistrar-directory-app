# Microregistrar directory app

Static HTML/CSS/JS admin app for the [Microregistrar moodlecloud spreadsheet](https://docs.google.com/spreadsheets/d/1XzlEPyzUM3ljxjzMrxpXLH-Pu_xTlWGC8AtrlRzp5Zw/edit). The original Google Sheet is not modified.

## Run

Serve the repo root over HTTP (required only if you prefer loading `data/workbook.json` via fetch; the default load uses `data/workbook.js`):

```bash
python3 -m http.server 8080
```

Open http://localhost:8080/

Or open `index.html` directly in a browser. Snapshot data is loaded from `data/workbook.js`.

## What you get

- Home dashboard mirroring the INDEX tab, with cards for every spreadsheet tab
- Hash routes: `#/`, `#/search`, `#/tab/infection`, …
- Add / edit / delete records
- Search across all tabs
- Sort and filter
- Clickable http(s) links (`target="_blank"` + `rel="noopener noreferrer"`)
- URL fields on create/edit
- Dark mode, empty/loading/error states
- JSON + CSV import/export
- Edits stored in `localStorage` until you export

## File structure

```
index.html
assets/app.css
assets/data-layer.js    ← data access only
assets/app.js           ← UI / routing
data/workbook.json      ← snapshot (import/export format)
data/workbook.js        ← same snapshot for script-tag load
docs/SHEET_AUDIT.md
docs/IMPLEMENTATION_PLAN.md
docs/GOOGLE_SHEETS_SETUP.md
```

## Live Google Sheets

Not connected. Google Drive MCP is unauthenticated here, and a static page must not hold API secrets. Use a local snapshot now; connect later via Apps Script or a backend proxy — see `docs/GOOGLE_SHEETS_SETUP.md`.
