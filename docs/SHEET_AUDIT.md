# Google Sheet Audit

**Source:** [Microregistrar Moodlecloud Index](https://docs.google.com/spreadsheets/d/1XzlEPyzUM3ljxjzMrxpXLH-Pu_xTlWGC8AtrlRzp5Zw/edit?gid=1285796030#gid=1285796030)  
**Spreadsheet ID:** `1XzlEPyzUM3ljxjzMrxpXLH-Pu_xTlWGC8AtrlRzp5Zw`  
**Audit method:** Public XLSX/CSV export (read-only). Google Drive MCP was not authenticated in this environment.  
**Original sheet was not modified.**

---

## All sheet tabs (16)

| # | Tab | Role | Est. data rows | Hyperlinks | Validations | Merges | Formulas |
|---|-----|------|----------------|------------|-------------|--------|----------|
| 1 | INDEX | Hub / dashboard | ~41 content cells | 76 | 0 | 6 | 0 |
| 2 | Search | Sheet-native search UI | sample results only | 2 (via formula) | 0 | 3 | 2 `HYPERLINK` |
| 3 | Interactive HYN | Flat CRUD table | 99 | 98 | Group list | 0 | 0 |
| 4 | Infection | Topic outline | 125 | 122 | Gap analysis list | 0 | 0 |
| 5 | Antibiotic | Topic outline | 127 | 126 | Gap analysis list | 0 | 0 |
| 6 | Bacteria | Topic outline | 106 | 105 | Gap analysis list | 0 | 0 |
| 7 | Mycology | Topic outline | 32 | 31 | Gap analysis list | 0 | 0 |
| 8 | Virology | Topic outline (3-level cols) | 85 | 84 | Gap analysis list | 0 | 0 |
| 9 | Parasitology | Topic outline | 37 | 36 | Gap analysis list | 0 | 0 |
| 10 | Lab | Topic outline | 65 | 65 | Gap analysis list | 0 | 0 |
| 11 | Transplant | Topic outline | 48 | 47 | none in export | 0 | 0 |
| 12 | IPC | Topic outline | 53 | 50 | none in export | 0 | 0 |
| 13 | Vaccine | Topic outline | 52 | 50 | none in export | 0 | 0 |
| 14 | Statistics | Topic outline | 40 | 39 | none in export | 0 | 0 |
| 15 | HYN | Topic outline | 101 | 100 | none in export | 0 | 0 |
| 16 | Curriculum | Empty placeholder | 0 | 0 | 0 | 0 | 0 |

**Hidden columns:** none detected.  
**Hidden rows:** none detected.  
**Custom date formats:** `dd/mm/yyyy`, `d/m/yyyy`, `d/m/yy`, `dd/MM/yyyy`, `dd/mm/yy`, `mmm d`.  
**Named range:** `_xlnm._FilterDatabase` on `'Interactive HYN'!$A$1:$Z$1018` (auto-filter).

---

## Per-tab detail

### 1. INDEX
- **Structure:** Presentation layout (not a table). Columns B–I used as marketing/hub sections.
- **Sections:** Moodlecloud section links, Questions & mock exams, What’s new feed, Exam guides, Additional materials / external websites, AI models, Social.
- **Headers:** No single header row; section titles act as labels.
- **Example:** `Infection` → internal link `Infection!A1`; `Microregistrar.moodlecloud.com` → external URL.
- **Types:** Text labels, Excel date serials in What’s new column, hyperlinks (external + internal sheet locations).
- **Formulas:** none.
- **Validation:** none.
- **Merged cells:** `B2:G2`, `F4:G4`, `B5:B6`, `D18:D20`, `B22:D23`, `I23:I24`.
- **Formatting intent:** Title hub, multi-column link directory, dated “what’s new” list.

### 2. Search
- **Headers (row 4):** Sheet Name | Row | Column | Cell Content | (Open topic link)
- **Example rows:** Infection / 83 / B / `12.1. Chronic Granulomatous disease (CGD)` / Open topic.
- **Types:** Text, number (row), letter (column), URL via `HYPERLINK(...)`.
- **Formulas:** `=HYPERLINK("https://...","Open topic")` on result link cells.
- **Validation / merges:** instructional merges around yellow keyword box (`B2`).
- **Note:** Export only contains cached sample results for keyword `chronic`. Live FILTER/QUERY behavior is not fully preserved in XLSX values.

### 3. Interactive HYN
- **Headers:** Group | Topic | Link | Date updated (+ unused placeholder columns).
- **Example:** `Generic infection` | `Ulcer DD` | Moodle resource URL | (optional date).
- **Types:** enum/text, text, URL, date.
- **Validation:** list on `A2:A1018`:
  `Generic infection, Generic antibiotic, Generic bacteriology, General Virology, General Mycology, General parasitology, Laboratory, Misc, Bacteria, Virus, Parasitology, IPC revision`.
- **Best candidate for direct row CRUD.**

### 4–15. Topic outline tabs (Infection … HYN)
Common conceptual schema (column positions vary slightly by tab):

| Field | Type | Notes |
|-------|------|-------|
| Section | text | Numbered headers e.g. `2. CNS and eye infection` |
| Topic | text | Child topics e.g. `Viral meningoencephalitis` |
| Date | date | Excel serial; often blank |
| Gap analysis | enum | `Not confident`, `need more revision`, `Exam ready` |
| Revision 1 / 2 | boolean | checkbox cells |
| Link | URL | Hyperlink on section/topic cell → Moodle book chapter |

**Example (Infection):** section `2. CNS and eye infection` links to Moodle; child topic `TB meningitis` may carry a date.  
**Virology / IPC / Statistics:** use an extra nesting column (section in B, topic in C).  
**Parasitology / Lab / Transplant / Vaccine:** topics primarily in column B; gap/revision columns shifted right.  
**Sparse unused columns:** many sheets reserve columns through ~Z with placeholder headers (`Column 1`…). Ignored in the app schema.

### 16. Curriculum
- Empty sheet (no cells with content in export). Kept as an empty CRUD tab for parity.

---

## CRUD suitability vs normalization

**Not suitable for naive “every tab = one flat table” CRUD without light normalization.**

| Tab class | Suitability | Approach in app |
|-----------|-------------|-----------------|
| Interactive HYN | Direct CRUD | Flat records |
| Topic outlines | Near-direct CRUD after flattening hierarchy | Records with `section`, `topic`, `rowType` |
| INDEX | Not a data table | Dashboard of navigational + external links |
| Search | Computed view | Replaced by in-app global/tab search |
| Curriculum | Empty | Empty-state CRUD shell |

**Normalization choices (schema preserved conceptually):**
1. Drop unused placeholder columns (`Column N`).
2. Represent hierarchy as fields on each row (no separate sections table) to keep mapping 1:1 with sheet rows.
3. Treat INDEX as dashboard content, not editable grid rows (link cards remain clickable).
4. Implement Search in the app rather than mirroring the sheet’s yellow-box FILTER UI.

---

## Access limitations (Cursor / this environment)

| Capability | Status |
|------------|--------|
| Public CSV/XLSX export read | Available (sheet is link-accessible) |
| Google Drive MCP | **Needs user authentication** (server status `needsAuth`) |
| Live write to original sheet | **Not available** without Google Sheets API OAuth / service account on a backend |
| Frontend-only Sheets write with secrets | **Unsafe / disallowed** — do not embed API keys or refresh tokens in static JS |
| Altering the original sheet | **Out of scope** — explicitly not done |

**Safest live integration path (proposed):**
1. Keep this static app’s `DataAccess` interface.
2. Add a thin backend (Cloud Function / Apps Script web app / small Node server) that holds OAuth or a service account.
3. Prefer a **dedicated copy** of the spreadsheet for write operations, or Apps Script `doGet`/`doPost` with restricted scopes.
4. Until then: localStorage + JSON/CSV import/export.

---

## Formatting / validation intent to preserve in the app

- Gap analysis dropdown with the three sheet values.
- Interactive HYN group dropdown with the sheet’s list.
- Revision 1 / Revision 2 as checkboxes.
- Dates displayed in a clear ISO/`YYYY-MM-DD` form (source used UK-style formats).
- All hyperlinks open with `target="_blank"` and `rel="noopener noreferrer"`.
- Section vs topic visual hierarchy in outline tabs.
