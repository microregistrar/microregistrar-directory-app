# Connecting live Google Sheets later

The static app talks only to a **data adapter**. Swap `LocalSnapshotAdapter` for a network adapter without changing table/form code.

Do **not** put API keys, OAuth client secrets, or service-account JSON in `index.html` or any committed frontend file.

## Recommended (safest) options, in order

### 1. Google Apps Script web app (best for this workbook)

Bound script on a **copy** of the spreadsheet (never the public original unless you intend shared writes).

1. File → Make a copy of the spreadsheet.
2. Extensions → Apps Script.
3. Implement `doGet` / `doPost` that read/write named tabs using `SpreadsheetApp`.
4. Deploy as Web App: execute as you, access **anyone with the link** (if the data is already public) or **only you**.
5. In the frontend, set `window.APP_CONFIG.apiBase` to the `/exec` URL.
6. Adapter: `GET ?tab=Infection` returns JSON rows; `POST` with `{action, tab, id, record}` mutates rows.

Preserve:

- Hyperlinks via `RichTextValue` / `setFormula('=HYPERLINK(...)')` rather than plain text when writing links.
- Gap analysis and Group lists via `requireValueInList`.
- Checkboxes via `insertCheckboxes`.

Apps Script stays on Google’s servers; the browser never sees a Google secret.

### 2. Backend proxy + Sheets API

A small server (Cloud Functions, Cloud Run, Worker) holds OAuth or a service account.

- Frontend → `https://your-api.example.com/tabs/:id`
- Backend → `spreadsheets.values.get` / `batchUpdate`
- Restrict CORS to your app origin
- Store credentials in environment secrets, not git

Use this if you need proper user login (Google Sign-In) so each registrar edits their own copy.

### 3. Cursor Google Drive MCP (agent only)

Useful for operators/agents inspecting the sheet. It is **not** an end-user backend: it requires IDE auth and cannot be shipped as the public app’s database.

## Frontend config (no secrets)

```js
window.APP_CONFIG = {
  dataSource: "local",          // "local" | "remote"
  spreadsheetId: "1XzlEPyzUM3ljxjzMrxpXLH-Pu_xTlWGC8AtrlRzp5Zw",
  apiBase: ""                   // Apps Script or proxy URL only
};
```

When `dataSource` is `remote`, `assets/data-layer.js` uses `RemoteSheetsAdapter`. Leave `apiBase` empty until the backend exists.

## Import/export without an API

Until a backend exists:

1. In Google Sheets: File → Download → CSV (per tab) or XLSX.
2. In the app: **Import JSON** (`data/workbook.json` shape) or **Import CSV** on a tab.
3. **Export JSON / CSV** to copy edits back manually.

Column headers in CSV should match the tab field labels (see schema in `data/workbook.json`).

## Permissions reminder

The published sheet is currently world-readable. Live **writes** should target a private copy. Do not point a write-enabled adapter at the original ID unless you explicitly want a shared mutable directory.
