# Sheet Audit — "Microregistrar moodlecloud" Google Sheet

Source: `https://docs.google.com/spreadsheets/d/1XzlEPyzUM3ljxjzMrxpXLH-Pu_xTlWGC8AtrlRzp5Zw/edit`

This audit was produced by reading the sheet through its **public, anonymous, read-only export endpoints** (no edits were made to the source document; see "Access limitations" below).

## 1. Sheet tabs (16 total)

| # | Tab name | Rows (incl. header) | Real (non-template) records | Nature |
|---|----------|----------------------|------------------------------|--------|
| 1 | `INDEX` | 37 | 82 (normalized) | Hand-laid-out navigation/bookmark grid |
| 2 | `Search` | 3 | n/a | Apps-Script-powered search utility, not tabular data |
| 3 | `Interactive HYN` | 1017 | 98 | Flat link library (Group / Topic / URL / Date / checkbox) |
| 4 | `Infection` | 124 | 124 | Outline-style revision checklist |
| 5 | `Antibiotic` | 127 | 127 | Outline-style revision checklist |
| 6 | `Bacteria` | 106 | 106 | Outline-style revision checklist |
| 7 | `Mycology` | 32 | 32 | Outline-style revision checklist |
| 8 | `Virology` | 85 | 85 | Outline-style revision checklist |
| 9 | `Parasitology` | 37 | 37 | Outline-style revision checklist |
| 10 | `Lab` | 67 | 65 | Outline-style revision checklist |
| 11 | `Transplant` | 48 | 48 | Outline-style revision checklist |
| 12 | `IPC` | 53 | 53 | Outline-style revision checklist |
| 13 | `Vaccine` | 52 | 52 | Outline-style revision checklist |
| 14 | `Statistics` | 40 | 40 | Outline-style revision checklist |
| 15 | `HYN` | 101 | 101 | Outline-style revision checklist |
| 16 | `Curriculum` | 0 | 0 | **Empty** — no header, no rows |

Tab order and names were read from the rendered `docs-sheet-tab-caption` DOM nodes of the editor page (16 tabs, matching the tab strip at the bottom of the sheet).

## 2. Per-tab structure

### 2.1 Outline / revision-checklist tabs (12 tabs: Infection, Antibiotic, Bacteria, Mycology, Virology, Parasitology, Lab, Transplant, IPC, Vaccine, Statistics, HYN)

These 12 tabs share one design pattern: a numbered topic outline (e.g. `2. CNS and eye infection` → `2.1. Viral meningoencephalitis`) with up to 3 tracking columns:

- **Topic text** — column position sometimes encodes outline depth (level 1 heading vs. level 2 sub-topic sit in *different* columns — confirmed in `Infection`, `Antibiotic`, `Bacteria`, `Mycology`, `Virology`, `IPC`, `HYN`), and sometimes both levels share one column and depth is only encoded by the numeric prefix (confirmed in `Transplant`, `Vaccine`, `Statistics`, `Parasitology`, `Lab`).
- **Date** — free-text `dd/mm/yyyy`, present in `Infection`, `Antibiotic`, `Bacteria`, `Mycology`, `Virology` (labelled), and present-but-unlabelled in `Parasitology` (column E has real dates like `12/1/26` despite a blank header). Absent entirely in `Lab`, `Transplant`, `IPC`, `Vaccine`, `Statistics`, `HYN`.
- **Gap analysis / Revision 1 / Revision 2** — three boolean columns rendered in the sheet as **checkboxes** (Google Sheets `BOOLEAN` data-validation cells serialising to the literal text `TRUE`/`FALSE`). Present in all 12 tabs, always in that order, always the last 2–3 populated columns.
- Every tab also carries **10–20 additional blank trailing columns** auto-labelled `Column N` by the export (no header text, no data) — almost certainly leftover formatting/width from copying a template across tabs. Treated as unused/hidden in the app.
- Row count per tab is inflated by **hundreds of blank template rows** pre-formatted with a default `FALSE` checkbox value but no topic text (e.g. `Interactive HYN` has 1017 raw rows but only 98 carry real content). The importer filters these out using "does the topic-designated column have text?".
- Alternating row shading (`#f0f0f0` / `#ffffff`) is used throughout for readability — reproduced in the app as zebra-striped tables.
- No native Google Sheets formulas were observed via the accessible export layer (see limitations) other than implied checkbox validation; topic cells are suspected to carry `HYPERLINK()` formulas (see §2.4) but the anonymous export path used here cannot confirm formula syntax.

### 2.2 `INDEX` tab

Not a data table — it is a **hand-built navigation page inside the spreadsheet itself**: multiple independent lists laid out side-by-side in columns B, D, F+G, and I, each acting as a labelled bookmark list:

- Col B: "Moodlecloud sections" (links to the other 12 outline tabs) + sub-lists for "AI models" and "Other documents"
- Col D: "Questions and mock exams" links + "External websites" + "Social media"
- Col F+G: a two-column **dated changelog** ("What's new?"), 26 dated entries from 02/03/2026 to 11/09/2026
- Col I: "Exam guide" quick links

The app normalizes this into one CRUD-able table (`section`, `title`, `date`, `link`) grouped by section, and also uses its content (the 12 outline-tab names) to help build the Home dashboard's card grid.

### 2.3 `Search` tab

Columns: `Sheet Name`, `Row`, `Column`, `Cell Content`, `Open topic` (a link), plus a wall of instructional text in a later cell explaining how to use the bound Apps Script ("File → Make a copy… type your search term… give it ~10 seconds"). This is a **utility/demo tab**, not a data table — it holds 1–2 example search results, not real records. The app represents it as a read-only "Search & Help" page and points users at the app's own instant client-side global search instead.

### 2.4 Hyperlinks

Multiple signals indicate the sheet makes heavy use of hyperlinks:

- `Interactive HYN`'s `Link` column contains **literal, plain-text URLs** (e.g. `https://microregistrar.moodlecloud.com/mod/resource/view.php?id=837`) — these came through cleanly in the CSV/HTML export because they are plain text, not a rich-text/formula hyperlink.
- The 12 outline tabs' topic cells (e.g. "TB meningitis", "Zoliflodacin") strongly appear to be **rich-text hyperlinks or `=HYPERLINK()` formulas** pointing at the same Moodlecloud resource IDs (topic names correspond 1:1 with `Interactive HYN` entries) — but the **display text only** is exposed by anonymous CSV/HTML/gviz export; the underlying URL is stripped. This is the single biggest data-fidelity gap in this audit (see §4).
- `INDEX` cells like "Antibiotic", "TB meningitis" almost certainly link internally to the corresponding tab/cell (`#gid=…&range=…`) — again, target unrecoverable anonymously.

### 2.5 Merged cells / hidden columns / formatting

- No `colspan`/`rowspan` markers were present in the gviz HTML export, but this export path is known to flatten merged cells rather than reliably reporting them — so merge presence could not be confirmed or ruled out anonymously. Visually, `INDEX` row 1's multi-sentence header text is consistent with a merged header band.
- Every outline tab has a large trailing block of headerless, valueless columns (see §2.1) — functionally "hidden" even though no explicit hide flag is exposed by the export.
- Zebra banding (`#f0f0f0`/`#ffffff`) and bold section-heading rows are the two consistent formatting patterns; reproduced in the UI.

### 2.6 Data validation

- `Gap analysis`, `Revision 1`, `Revision 2` (all 12 outline tabs) and the review checkbox in `Interactive HYN` are Google Sheets **checkbox (boolean) data validation** cells. Reproduced in the app as real `<input type="checkbox">` fields.
- No dropdown/list validation was observed on any text column.

## 3. Suitability for direct CRUD

**Verdict: normalization was required; a straight 1:1 "spreadsheet grid = database table" mapping would not have produced a usable app.** Reasons:

1. Outline depth is encoded inconsistently (sometimes column offset, sometimes numeric prefix only) — a generic CRUD grid needs one normalized `level` field, not spreadsheet-column position.
2. Several tabs have **no header text at all** in populated columns (auto-labelled `Column N`), and one tab (`Parasitology`) has real data in a column with a blank header — headers alone can't drive a schema.
3. `INDEX` is not one table; it's four-plus independent lists sharing a sheet by column position. It was normalized into one `{section, title, date, link}` table.
4. `Search` isn't data at all — it's a UI utility bolted onto the sheet; modeled as a static help page instead of a fake CRUD table.
5. Hundreds of blank template rows per tab needed filtering so the app doesn't display/CRUD hundreds of empty placeholder records.

Net result: **12 tabs normalize cleanly to one shared "outline record" schema, 1 tab to a "link record" schema, 1 tab to a "reference/bookmark" schema, 1 tab to a static help page, and 1 tab is legitimately empty.** All original columns are preserved conceptually (title, date, gap analysis, revision 1, revision 2, link) — see `webapp/README.md` → "Schema mapping" for the exact field-by-field mapping kept in the app.

## 4. Access limitations for reading/writing from Cursor

- The sheet is shared as **"Anyone with the link can view"**, so it was readable anonymously via Google's public export endpoints: `.../gviz/tq?tqx=out:csv&sheet=<name>` and `.../gviz/tq?tqx=out:html&sheet=<name>` (per-tab CSV/HTML) — no OAuth token, API key, or service account was needed or used.
- **No write access is available or was attempted.** Writing to a Google Sheet always requires an authenticated call (OAuth user consent or a service account with edit rights) via the Sheets API v4 (`spreadsheets.values.update`, etc.) or Apps Script; anonymous export endpoints are read-only by design. The instruction "do not overwrite or alter the original Google Sheet" was followed — only read (export) requests were made.
- **Hyperlink targets, cell formulas, and merge/validation metadata are not exposed** by the anonymous CSV/HTML/gviz export paths used. Retrieving those requires the authenticated Sheets API v4 with `valueRenderOption=FORMULA` and `includeGridData=true`, which needs credentials this environment does not have.
- **No Google Sheets API key or OAuth client was available in this environment**, and none should be embedded in a static frontend regardless (browser-delivered JS is public). This is why the app ships with a local data layer today and a clearly separated, swappable provider interface for later — see `webapp/README.md` → "Connecting live Google Sheets later".
