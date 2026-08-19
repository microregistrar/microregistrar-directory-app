# Microregistrar Moodlecloud — Web App

A production-ready static web app built from the [Microregistrar moodlecloud Google Sheet](https://docs.google.com/spreadsheets/d/1XzlEPyzUM3ljxjzMrxpXLH-Pu_xTlWGC8AtrlRzp5Zw).

## Quick Start

```bash
# Serve locally (any static server works)
cd microregistrar-app
python3 -m http.server 8080
# Open http://localhost:8080
```

No build step required. The app loads seed data from `data/seed-data.json` and persists changes in browser LocalStorage.

## File Structure

```
microregistrar-app/
├── index.html          # Single entry point
├── css/
│   └── styles.css      # Admin UI styles (light/dark)
├── js/
│   ├── data-store.js   # Data access layer (provider pattern)
│   └── app.js          # UI controller (routing, CRUD, search)
├── data/
│   └── seed-data.json  # Exported spreadsheet data (1,013 records)
└── SETUP.md            # Google Sheets integration guide
```

## Features

- **Dashboard** — card index for all 16 spreadsheet tabs
- **Hash routing** — `#dashboard`, `#sheet/Infection`, `#search/query`
- **CRUD** — add, edit, delete records per tab with modal forms
- **Search** — global search across all sections
- **Hyperlinks** — preserved and clickable; URL fields in forms
- **Sorting & filtering** — column sort, text filter, gap-analysis filter
- **Import/Export** — JSON full export, per-tab CSV export
- **Dark mode** — toggle in top bar
- **Responsive** — mobile sidebar, desktop table views
- **States** — loading, empty, and error states

## Architecture

The UI (`app.js`) never touches storage directly. All data flows through `DataStore` (`data-store.js`), which implements a provider interface:

| Provider | Status | Description |
|----------|--------|-------------|
| `local` | Active | LocalStorage + seed JSON fallback |
| `googleSheets` | Stub | Ready for backend proxy connection |

To connect Google Sheets later, see [SETUP.md](SETUP.md).

## Data Model

Each spreadsheet tab maps to a sheet with a schema:

| Tab | Type | Records | Key Fields |
|-----|------|---------|------------|
| INDEX | navigation | 41 | section, link, category, date, what's new |
| Search | search_results | 2 | sheet_name, row, column, cell_content, link |
| Interactive HYN | topic_list | 99 | group, topic, link, date_updated |
| Infection–HYN (12 tabs) | topic_list | 871 | section, topic, link, gap_analysis, revision_1/2 |
| Curriculum | empty | 0 | — |

## License

Data © Microregistrar. App code is provided as-is for educational use.
