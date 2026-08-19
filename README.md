# Microregistrar Directory App

A single-entry, dependency-free web app built from the
[Microregistrar Google Sheet](https://docs.google.com/spreadsheets/d/1XzlEPyzUM3ljxjzMrxpXLH-Pu_xTlWGC8AtrlRzp5Zw/edit)
— a clinical microbiology exam-revision tracker. The app is plain HTML/CSS/JavaScript
with no build step and no frameworks.

## Quick start

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## What you get

- **Dashboard** (`#/`) — index cards for every spreadsheet tab with topic counts and
  exam-readiness progress, plus the sheet's INDEX-tab quick links and "What's new" feed.
- **One view per spreadsheet tab** (`#/tab/<key>`) — Infection, Antibiotic, Bacteria,
  Mycology, Virology, Parasitology, Lab, Transplant, IPC, Vaccine, Statistics, HYN,
  and Interactive HYN.
- **CRUD** — add, edit, and delete records via modal forms, including hyperlink fields
  (validated to `http(s)://` only, rendered with `target="_blank" rel="noopener noreferrer"`).
- **Search** — global search across all tabs (topbar, `/` shortcut, Enter to run) plus
  per-tab filtering, gap-analysis/section filters, and four sort orders.
- **Preserved sheet semantics** — the sheet's *Gap analysis* dropdown
  (`Not confident / need more revision / Exam ready`), *Revision 1/2* checkboxes
  (toggleable inline), section hierarchy, and the Interactive HYN *Group* validation list.
- **Data tools** — JSON backup/restore, per-tab CSV export, reset to the sheet snapshot.
- **Dark mode**, responsive layout (collapsible sidebar on mobile), loading / empty /
  error states, toast feedback.

## File structure

```
index.html            app shell (single entry point)
assets/
  styles.css          all styling, light/dark themes via CSS variables
  store.js            data access layer (localStorage adapter + adapter interface)
  app.js              UI layer: hash router, views, modals — talks only to store.js
  data.js             generated snapshot of the Google Sheet (do not edit by hand)
scripts/
  export_sheet.py     regenerates assets/data.js from the live sheet
```

## Data model

Every content tab is normalized to one record shape while preserving the original
schema conceptually (each field maps 1:1 to a sheet column; column positions vary
per tab in the sheet, documented in `scripts/export_sheet.py`):

```json
{
  "id": "infection-r7",
  "section": "2. CNS and eye infection",
  "isSection": false,
  "topic": "TB meningitis",
  "url": "https://microregistrar.moodlecloud.com/mod/book/view.php?id=681&chapterid=4351",
  "date": "2026-08-11",
  "gap": "Exam ready",
  "rev1": true,
  "rev2": false
}
```

Section-header rows from the sheet become records with `isSection: true`, so the
topic hierarchy (encoded by column indentation in the sheet) survives round trips.

Edits are stored in the browser's localStorage. **The original Google Sheet is never
modified.**

## Refreshing the snapshot from the sheet

The sheet is link-shared read-only, so no credentials are needed:

```bash
pip install openpyxl
python3 scripts/export_sheet.py        # rewrites assets/data.js
```

## Connecting live Google Sheets later

The UI never touches data directly — it calls `window.MicroStore`, whose async
interface is implemented by an adapter in `assets/store.js`. To go live, implement
the same interface against a backend and swap the adapter. **Never put API keys,
OAuth tokens, or service-account credentials in the frontend files.**

Options, safest first:

1. **Google Apps Script web app (recommended).** Attach a script to the sheet,
   expose `doGet`/`doPost` handlers for list/create/update/delete, and deploy it as
   a web app that executes as the sheet owner. The frontend calls the deployment URL —
   no secrets in the browser, and the owner controls write access. Implement a
   `SheetsApiAdapter` in `store.js` whose methods `fetch()` that URL.
2. **Small server proxy + Google Sheets API.** A minimal backend (Cloud Function,
   Cloudflare Worker, etc.) holds a service-account credential server-side and exposes
   the same CRUD endpoints. Share the sheet with the service account's email.
3. **MCP / Google Drive tooling.** The adapter interface also suits an MCP-backed
   bridge if you operate the app inside an agent environment.

Read-only live mode is even simpler: since the sheet is link-shared, an adapter can
fetch `https://docs.google.com/spreadsheets/d/<ID>/export?format=csv&gid=<gid>`
per tab with no credentials at all (writes disabled).

## Notes from the sheet audit

- The sheet's **Search** tab is a formula-driven utility, not data — it is superseded
  by the app's global search. The **INDEX** tab is a layout page and becomes the
  dashboard (its external links are harvested into Quick links / What's new).
  **Curriculum** is empty and skipped.
- The only formulas in the workbook are `HYPERLINK()` calls on the Search tab;
  there is no computational logic to preserve.
- ~950 of the 970 exported records carry hyperlinks to MoodleCloud resources.
