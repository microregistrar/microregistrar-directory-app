# Implementation plan

## Goal

Turn the public Microregistrar Moodlecloud spreadsheet into a single-entry static admin app: dashboard index, one view per tab, CRUD, search, clickable hyperlinks, and a swappable data layer for Google Sheets later.

## Constraints applied

- Do not write to the original Google Sheet.
- No secrets in frontend code.
- Plain HTML/CSS/JS. No framework.
- Hash routing so every tab is reachable from one `index.html`.
- Preserve schema conceptually; normalize only where the grid is not a table.

## Why more than one file

A true single HTML file would mix a ~500 KB data snapshot with UI code and make the data layer hard to replace. Split is:

| File | Why |
|------|-----|
| `index.html` | Single entry point / shell |
| `assets/app.css` | Responsive admin chrome |
| `assets/data-layer.js` | Storage adapter (UI must not talk to Google directly) |
| `assets/app.js` | Routing, tables, forms |
| `data/workbook.json` | Canonical snapshot + import/export format |
| `data/workbook.js` | Same snapshot as a script so the app runs without a bundler |

## Data strategy

1. **Now:** `LocalSnapshotAdapter` loads `workbook.js`, applies a `localStorage` overlay for creates/updates/deletes, import/export JSON and per-tab CSV.
2. **Later (safest live path):** a tiny **Google Apps Script web app** or server proxy that uses the Sheets API. The frontend only calls that origin. See `docs/GOOGLE_SHEETS_SETUP.md`.
3. Direct browser → Sheets API with an API key is rejected: keys leak, and API keys cannot write private user copies safely.

## UI map

| Route | View |
|-------|------|
| `#/` | Home dashboard (INDEX + tab cards) |
| `#/tab/{id}` | Tab table / catalog / empty state |
| `#/search` | Global search |

Every spreadsheet tab is a sidebar link and a home card.

## Record models

- **index:** category, title, url, internalTab, date
- **catalog (Interactive HYN):** group, topic, link, dateUpdated
- **outline:** rowType, section, sectionUrl, topic, topicUrl, date, gapAnalysis, revision1, revision2
- **search sample:** kept as imported rows; live search uses all tabs
- **curriculum:** title, url, notes

Validation from the sheet: Group enum, Gap analysis enum, URL fields, boolean revisions, dates.

## Build steps

1. Audit workbook (done).
2. Export snapshot JSON.
3. Implement data layer + local persistence.
4. Implement shell, dashboard, tables, modal CRUD, search, dark mode.
5. Verify load, navigate, CRUD, hyperlinks, import/export.
