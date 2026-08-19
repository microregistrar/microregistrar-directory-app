# Microregistrar Study Tracker

A production-ready, static admin-dashboard web app generated from the **"Microregistrar moodlecloud"** Google Sheet. See [`AUDIT.md`](./AUDIT.md) for the full sheet audit that informed this design.

## 1. Implementation plan (summary)

1. **Audit** the live sheet anonymously via Google's public per-tab CSV/HTML export endpoints (read-only, no edits) — see `AUDIT.md`.
2. **Normalize** the 16 tabs into 4 reusable schemas (`outline`, `links`, `index`, `about`) instead of one 1:1 grid-per-tab, because outline depth, headers and layout are inconsistent across tabs (see `AUDIT.md` §3).
3. **Separate concerns**: a data-access layer (`js/data-layer.js`) that owns all persistence/CRUD, and a UI layer (`js/app.js`) that only ever calls that layer's async interface — so a future Google Sheets–backed provider is a one-line swap, not a rewrite.
4. **Seed real data**: convert the sheet's CSV exports into one JSON file (`data/seed-data.js`) via a small, reusable, re-runnable script (`scripts/convert_csv_to_seed.py`) — this doubles as the "local import workflow" required when live Sheets access isn't wired up.
5. **Build the UI**: one HTML entry point, hash-based routing, a Home dashboard that indexes all 16 tabs, per-tab table views with add/edit/delete modals, global + per-tab search, sorting/filtering, hyperlink rendering/authoring, empty/loading/error states, dark mode, and a responsive layout.
6. **Persist locally**: `localStorage`-backed CRUD so the demo is fully usable, offline, with no backend — while remaining swappable (see §6).

## 2. App file structure

```
webapp/
├── index.html                 # single HTML entry point (hash-routed SPA)
├── styles.css                 # all styling (light/dark themes, responsive layout)
├── AUDIT.md                   # full sheet audit (tabs, schema, limitations)
├── README.md                  # this file
├── js/
│   ├── tabs-config.js         # single source of truth: tab metadata + field schemas
│   ├── data-layer.js          # DATA ACCESS LAYER (localStorage today, pluggable later)
│   └── app.js                 # UI LAYER: router, rendering, forms, modals, search, theme
├── data/
│   ├── seed-data.js           # generated JSON seed (window.SEED_DATA), loaded by index.html
│   └── raw-csv/               # original per-tab CSV exports (the "local import" source of truth)
│       ├── INDEX.csv, Search.csv, Interactive_HYN.csv, Infection.csv, ... (16 files)
└── scripts/
    └── convert_csv_to_seed.py # regenerates data/seed-data.js from data/raw-csv/*.csv
```

**Why more than one file, given the "prefer single-file" constraint?** The app is still a *single static entry point* with *zero build tooling* (open `index.html` directly, or serve the folder — no bundler/framework/npm install required). It's split into 4 small JS files purely to satisfy the explicit requirement to separate the UI layer from the data-access layer, plus keep the ~1,050-record tab configuration out of the app logic. This is the minimum split that meets both constraints; everything still ships and runs as static files with no server-side code.

## 3. Schema mapping (spreadsheet → app)

| Sheet tab(s) | App type | Fields kept | Notes |
|---|---|---|---|
| Infection, Antibiotic, Bacteria, Mycology, Virology, Parasitology, Lab, Transplant, IPC, Vaccine, Statistics, HYN, Curriculum | `outline` | `title`, `level` (1/2), `date`, `gapAnalysis`, `revision1`, `revision2`, `link`, `notes` | One shared schema for all 13 checklist-style tabs. `level` reconstructs outline depth from column-offset where the sheet encoded it that way, else from the numeric prefix (e.g. `2.1.` → level 2). `link` and `notes` are new optional fields — see below. |
| Interactive HYN | `links` | `title`, `group`, `link`, `date`, `reviewed` | Directly maps 1:1 to the sheet's `Topic`/`Group`/`Link`/`Date updated`/checkbox columns — this tab needed no restructuring. |
| INDEX | `index` | `section`, `title`, `date`, `link` | Normalizes 4+ side-by-side bookmark lists (by column position in the sheet) into one table, grouped/filterable by `section`. |
| Search | `about` | n/a (static page) | Not real tabular data in the source (see `AUDIT.md` §2.3) — rendered as a help page instead of a fabricated CRUD table. |

**Two intentional additions**, both explained per the "preserve schema unless you explain why" constraint:

- `link` (outline tabs) — the sheet's topic cells are almost certainly hyperlinks already (see `AUDIT.md` §2.4), but anonymous export cannot recover the target URL. The field is added so the app can display/edit that link once available, and so users can attach reference links to any topic today.
- `notes` (outline tabs) — small freeform field, added to give the checklist real utility as a study tool without inventing new sheet columns; left blank on import.

## 4. Running it

No build step, no dependencies. From the `webapp/` folder:

```bash
python3 -m http.server 8765
# open http://localhost:8765/index.html
```

(Any static file server works — the app is plain HTML/CSS/JS.)

## 5. Using the app

- **Home** (`#/home`) is the index: a card per sheet tab, each linking straight into that tab's view.
- **Sidebar** lists every tab for one-click, hash-routed navigation (`#/tab/<id>`) — works from any page, deep-linkable, back-button friendly.
- **Global search** (top bar) does an instant, client-side, cross-tab search and jumps to + highlights the matching row.
- Each tab view has its own **local search box**, **column sorting** (click a header), and **status filters** (Gap analysis / Revision 1&2 / Reviewed / Group / Section, depending on tab type).
- **Add / Edit / Delete** via modal forms built from `tabs-config.js` field definitions — includes a dedicated hyperlink (`url`) field with client-side validation, rendered everywhere as `<a target="_blank" rel="noopener noreferrer">`.
- **Export CSV/JSON** and **Import JSON** (merge or replace) per tab, plus **Reset to sheet data** to discard local edits and re-seed that tab from the original export.
- **Dark mode** toggle (top-right), persisted in `localStorage`, defaults to the OS theme on first visit.
- Fully responsive: sidebar collapses behind a hamburger menu under ~900px width.

## 6. Data handling & connecting live Google Sheets later

Today: `js/data-layer.js` exports `LocalStorageProvider`, seeded once from `data/seed-data.js` and thereafter persisting all CRUD to the browser's `localStorage` (key `microregistrar_app_data_v2`). **No secrets, tokens, or credentials exist anywhere in this frontend.**

### Safest path to live Google Sheets integration (recommended, in order)

1. **Best: a thin backend proxy you control** (Google Apps Script Web App, a Cloud Function, or a small Node/Express service) that:
   - Holds a **service account key or OAuth refresh token server-side only** (never in browser JS).
   - Exposes simple REST endpoints, e.g. `GET /api/tabs/:id`, `POST /api/tabs/:id/records`, `PUT /api/tabs/:id/records/:recordId`, `DELETE /api/tabs/:id/records/:recordId`, calling the Sheets API v4 (`spreadsheets.values.get/update/append`) or `batchUpdate` under the hood.
   - This app already ships a `GoogleSheetsProvider` **stub** in `js/data-layer.js` with the exact method signatures `LocalStorageProvider` implements — point it at your proxy's base URL and it's a live app with no UI changes.
2. **Alternative for read-only "live-ish" data**: keep writes local (as today) but refresh `data/seed-data.js` periodically by re-running `scripts/convert_csv_to_seed.py` against fresh CSV exports (see §7) — no backend needed, but not truly real-time and still no in-app writes to the sheet.
3. **Not recommended**: calling the Sheets API directly from the browser with an API key or OAuth client secret embedded in the page — this exposes credentials to anyone who opens devtools, and is explicitly disallowed by this project's constraints.
4. **MCP tools**: if this app is later embedded in an environment with a Google Sheets MCP server available, implement the same `DataLayer` interface as a thin adapter that calls the MCP tool instead of REST — again, zero changes needed in `app.js`.

### Refreshing data from the sheet (local import/export workflow)

1. Export each tab you want to refresh as CSV, e.g.:
   `https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?tqx=out:csv&sheet=<Tab Name>`
2. Save it into `data/raw-csv/<Tab Name>.csv` (matching the existing filenames).
3. Re-run: `python3 scripts/convert_csv_to_seed.py`
4. Reload the app. (Note: this reseeds `data/seed-data.js`, the *default* seed — it does not touch anyone's already-saved local edits in `localStorage`. Use each tab's "Reset to sheet data" button to force a specific tab back to the refreshed seed.)

## 7. Known limitations (see `AUDIT.md` §4 for full detail)

- Real hyperlink target URLs behind the 12 outline tabs' topic cells could not be recovered anonymously (only `Interactive HYN`'s plain-text URLs came through) — the `link` field is present and editable, just empty until backfilled from an authenticated Sheets API pull.
- Cell-level formulas, merged-cell ranges, and validation metadata beyond simple checkboxes are not recoverable via anonymous export; conceptual equivalents (checkbox fields, grouped sections, zebra tables) are implemented instead.
- This build never writes back to the source spreadsheet; it is a local-first app until a backend provider (see §6) is connected.
