# Spreadsheet audit

Source: [Microregistrar moodlecloud](https://docs.google.com/spreadsheets/d/1XzlEPyzUM3ljxjzMrxpXLH-Pu_xTlWGC8AtrlRzp5Zw/edit?gid=1285796030#gid=1285796030)

Inspected from a public XLSX export on 19 Aug 2026. The original Google Sheet was **not** modified. Google Drive MCP in this environment is unauthenticated, so formula/Apps Script internals that do not survive XLSX export (named ranges, Apps Script projects) may be incomplete.

Spreadsheet ID: `1XzlEPyzUM3ljxjzMrxpXLH-Pu_xTlWGC8AtrlRzp5Zw`

## Tabs (16, all visible)

| # | Tab | Used rows | Hyperlinks | Formulas | Validations | Frozen | Tab color |
|---|-----|-----------|------------|----------|-------------|--------|-----------|
| 1 | INDEX | 44 | 76 | 0 | none | none | none |
| 2 | Search | 6 | 0 (2 HYPERLINK formulas) | 2 | none | none | none |
| 3 | Interactive HYN | 99 data + table to 1018 | 98 | 0 | list on Group | A2 | none |
| 4 | Infection | 126 | 122 | 0 | Gap analysis list | A2 | red |
| 5 | Antibiotic | 128 | 126 | 0 | Gap analysis list | A2 | green |
| 6 | Bacteria | 107 | 105 | 0 | Gap analysis list | A2 | blue |
| 7 | Mycology | 33 | 31 | 0 | Gap analysis list | A2 | gold |
| 8 | Virology | 86 | 84 | 0 | Gap analysis list | A2 | lime |
| 9 | Parasitology | 38 | 36 | 0 | Gap analysis list | A2 | magenta |
| 10 | Lab | 68 | 65 | 0 | Gap analysis list | A2 | fuchsia |
| 11 | Transplant | 49 | 47 | 0 | none | A2 | black |
| 12 | IPC | 56 | 50 | 0 | none | A2 | pink |
| 13 | Vaccine | 53 | 50 | 0 | none | A2 | teal |
| 14 | Statistics | 41 | 39 | 0 | none | none | blue |
| 15 | HYN | 102 | 100 | 0 | none | A2 | orange |
| 16 | Curriculum | empty | 0 | 0 | none | none | none |

No hidden columns or hidden rows. No comments. No conditional formatting exported. Named ranges: none. Gridlines hidden on INDEX.

---

## INDEX

**Layout, not a table.** Merged cells: `B2:G2`, `F4:G4`, `B5:B6`, `B22:D23`, `I23:I24`, `D18:D20`. Gridlines off. Arial 10–13pt. Hyperlinks are blue/underlined; section banners use filled headers (orange `#980000`, rose `#E6B8AF`, red `#F4CCCC`, grey `#F3F3F3`).

| Area | Columns | Example | Types | Links |
|------|---------|---------|-------|-------|
| Site title | B2 | Microregistrar.moodlecloud.com | string | http://microregistrar.moodlecloud.com/ |
| Moodlecloud sections | B4, B7–B19 | Infection, Antibiotic, … Guideline summary | string | **Internal** sheet jumps (`Infection!A1`) plus some external Moodle/forum URLs |
| Questions and mock exams | D4–D18 | MCQ Module, Exam planner Part 1, Part 2 Mock | string | Moodle courses, other Google Sheets, forums |
| What's new | F (dates) + G (titles) | 11/09/2026 + TB meningitis | date + string | Moodle book chapters |
| Exam guide | I4, I7–I8 | Part 1 / Part 2 Q analysis | string | Moodle book |
| AI models | B25–B31 | ChatGPT Statistics Coach | string | chatgpt.com custom GPTs |
| Other documents | B33–B39 | Greenbook MCQ, Oxford handbook index | string | Drive files / Sheets |
| External websites | D25–D37 | UK SMI, EUCAST, NICE, BNF | string | official sites |
| Social media | D39–D44 | Facebook, YouTube, WhatsApp, LinkedIn | string | mixed; WhatsApp has **no URL** |

Internal vs external on INDEX: 15 in-workbook jumps, 61 external URLs.

---

## Search

Apps Script search UI, not a data table.

- A1 title: “Search the spreadsheet” (dark `#20124D`, white text).
- A2 instruction + **B2 yellow input** (`#FFFF00`) — sample value `chronic`.
- Result headers (row 4, `#4A4E69`): Sheet Name, Row, Column, Cell Content, plus HYPERLINK “Open topic”.
- Example rows: Infection / 83 / B / `12.1. Chronic Granulomatous disease (CGD)`; Mycology / 16 / B / `2.3. Chronic pulmonary aspergillosis (CPA)`.
- Formulas: `=HYPERLINK("https://microregistrar.moodlecloud.com/mod/book/view.php?id=681&chapterid=3373","Open topic")`.
- H5 merged help text tells users to **File → Make a copy** because search is a bound script.

---

## Interactive HYN (catalog)

Excel Table `Table1` `A1:Z1018`. Freeze `A2`. Row height 22.5.

| Column | Header | Type | Notes |
|--------|--------|------|-------|
| A | Group | enum | Data validation list |
| B | Topic | string | e.g. Ulcer DD, Diarrhoea cause |
| C | Link | URL | Moodle `mod/resource/view.php?id=…` |
| D | Date updated | date | sparsely filled |
| E | Column 1 | boolean | unused checkbox column (all false) |
| F–Z | Column 2–22 | empty | table padding |

**Validation (A2:A1018):**  
`Generic infection, Generic antibiotic, Generic bacteriology, General Virology, General Mycology, General parasitology, Laboratory, Misc, Bacteria, Virus, Parasitology, IPC revision`

---

## Outline tabs (Infection → HYN)

Same conceptual model: a **hierarchical syllabus**, not a flat database.

Typical pattern:

1. Header row (white on coloured fill).
2. **Section** rows (e.g. `1. Candida`, `2. CNS and eye infection`) — often unlinked or linking to a Moodle book index.
3. **Topic** rows (e.g. `1.1. Introduction`, `Bacterial meningitis`) — display text is a hyperlink to a Moodle book chapter.
4. Optional **Date** when a topic was updated.
5. **Gap analysis** dropdown (often empty).
6. **Revision 1 / Revision 2** checkboxes (exported as booleans, almost all `false`).

### Shared validation

Where present: list on Gap analysis — `"Not confident,need more revision,Exam ready"` (allow blank). Applied on Infection, Antibiotic, Bacteria, Mycology, Virology, Parasitology, Lab. Not present on Transplant, IPC, Vaccine, Statistics, HYN (columns exist, no rule).

### Per-tab headers and examples

**Infection** (headers in row 1; Calibri bold): `Column 1` | `List of topics` | `Date` | `Gap analysis` | `Revision 1` | `Revision 2` | unused `Column 4–24`.  
Example: A3 `2. CNS and eye infection` → Moodle book; B7 `TB meningitis` + date 2026-08-11.

**Antibiotic:** `List of topics` | `List of topics 2` | `Date` | `Gap analysis` | `Revision 1–2`.  
Example: A3 `2. New antibiotics`; B4 `Zoliflodacin` dated 2026-08-01.

**Bacteria:** `Topics` | `List of topics` | `Date` | `Gap analysis` | revisions.  
Example: A2 `1. Staphylococcus introduction`; B3 `1.1. Staphylococcus aureus`.

**Mycology:** `List of topics` | `List of topics2` | `Date` | `Gap analysis` | revisions. Calibri 12pt.  
Example: A2 `1. Candida`; B4 `1.2. Oropharyngeal candidiasis`.

**Virology:** unused `Column 1` | `List of topics` | `Column 2` (topics) | `Date updated` | `Gap analysis` | revisions. Gap list is on **E**, not D.  
Example: B2 `1. Virology introduction`; C3 `1.1. Baltimore classification`.

**Parasitology:** header fill `#990000`. Topics live in **B** (sections and items mixed). Dates in E (sparse). Gap on F.

**Lab:** header fill `#34A853`, Comfortaa 12pt. Header: `List of topics (being revised)`. Mostly a single topic column (B). Dates in D. Gap on F.

**Transplant:** header `#351C75`. Single topic column B. Gap on E (no validation). No dates filled.

**IPC:** header `#134F5C`. Section titles in B, child topics in C. Gap on F (no validation).

**Vaccine:** header `#741B47`. Green Book-style titles in B (`2. Ch 14: Cholera`). Sparse dates in C.

**Statistics:** header `#741B47`. Single list in B (`2. Types of studies`). No freeze pane.

**HYN:** header `#351C75`. Sections in A (`1. Virology`), topics in B. Legacy notes; INDEX points users at Interactive HYN for updates.

Unused `Column N` fields (often through column Z/AA) come from Google Sheets **Table** objects that reserve ~1000 rows. They hold no real data.

---

## Curriculum

Empty sheet. No headers, no data. Kept as a placeholder tab.

---

## Formatting patterns

- Header bars: solid brand colours + white text (Comfortaa / Calibri / Arial depending on tab).
- Topic hyperlinks: underline, blue `#0000FF` or near-black `#1D2125`.
- Zebra / white row fills `#FFFFFF` / `#F3F3F3`.
- Checkboxes exported as booleans.
- Dates stored as datetime, displayed `dd/mm/yyyy` in the live sheet.
- INDEX uses merged title blocks and mixed internal/external hyperlinks.

---

## Formulas

Only Search uses formulas (`HYPERLINK`). No computed columns, no `IMPORTRANGE`, no totals. Revision columns are values, not formulas.

---

## Direct CRUD vs normalization

**Not suitable for naive cell-level CRUD** across the whole workbook.

| Tab | Verdict |
|-----|---------|
| Interactive HYN | Closest to a real table. Direct CRUD on Group / Topic / Link / Date is appropriate. Drop unused Column 1–22. |
| Outline tabs | **Need light normalization.** Hierarchy is encoded by *which column* a value sits in, plus numbering (`1.` vs `1.1.`). App records: `rowType`, `section`, `sectionUrl`, `topic`, `topicUrl`, `date`, `gapAnalysis`, `revision1`, `revision2`. |
| INDEX | Dashboard layout. Model as categorized link records, not a spreadsheet grid. |
| Search | Replace with application search; do not CRUD the Apps Script result grid. |
| Curriculum | Empty; allow CRUD on a simple title/url/notes schema. |

Preserved conceptually: dropdowns, checkboxes, hyperlink fields, freeze-header intent, tab colours, and “what’s new” dates. Unused placeholder columns are omitted from the UI (they are empty table padding).

---

## Access limitations (Cursor / this environment)

1. **Google Drive MCP** is not authenticated (`needsAuth`). Live read/write via MCP is blocked until the user signs in. Even then, MCP is for the agent, not the public web app.
2. **Public XLSX export works** (the sheet is world-readable). That gives values, hyperlinks, data validation, merges, and tables. It does **not** give Apps Script source, protected ranges, or live collaboration.
3. **Must not write back** to the original spreadsheet from this task (user constraint). The snapshot is read-only relative to Google.
4. **Browser apps cannot safely hold Google API secrets.** A static frontend must not embed OAuth client secrets, service-account keys, or API keys. Live write access later needs a backend or Apps Script web app.
5. **Search tab depends on a bound Apps Script.** That script is not in the XLSX. In-app search replaces it.
6. **Hyperlink targets** that are internal (`Infection!A1`) must be mapped to in-app hash routes; raw A1 notation is meaningless in HTML.
