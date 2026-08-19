# Connecting live Google Sheets later

This app talks to data only through `DataAccess` (`app/js/data-access.js`). Do **not** put OAuth client secrets, service-account keys, or API tokens in frontend code.

## Recommended (safest) approach

1. **Make a working copy** of the spreadsheet for the app (leave the public teaching sheet read-only).
2. Deploy a tiny backend that holds credentials:
   - Google Apps Script Web App, or
   - Cloud Function / small Node server using a service account or OAuth.
3. Backend exposes REST endpoints that match the store interface:
   - `GET /tabs` → tab metadata + records
   - `POST /tabs/:id/records`
   - `PUT /tabs/:id/records/:recordId`
   - `DELETE /tabs/:id/records/:recordId`
4. In the frontend, add a `GoogleSheetsStore` class implementing the same methods as `LocalJsonStore`, and switch with a config flag (e.g. `window.APP_CONFIG.dataMode = 'sheets'`).

### Apps Script sketch (server-side only)

```javascript
function doGet(e) {
  const ss = SpreadsheetApp.openById(SCRIPT_PROP_SHEET_ID);
  // read sheets, return JSON
}

function doPost(e) {
  // validate request, mutate sheet rows, return JSON
}
```

Deploy as “Execute as: Me”, “Who has access: anyone with link” only if acceptable; otherwise require Google sign-in and verify the user.

### Service account sketch

1. Create a GCP project → enable Google Sheets API.
2. Create a service account; share the **copy** spreadsheet with its email (Editor).
3. Store the JSON key in a secret manager / env var on the server.
4. Use `googleapis` (`sheets.spreadsheets.values`) for batch get/update.

## Public read-only (no write)

For refresh-only snapshots without a backend:

```bash
python3 scripts/refresh-mock-data.py
```

This downloads the public XLSX export and regenerates `app/data/mock-data.json`. Edits already in `localStorage` are separate; clear them from the app’s Data menu if you want a clean reload.

## MCP / Cursor

Once Google Drive MCP is authenticated in Cursor, agents can inspect Drive metadata. Live multi-user CRUD still needs a Sheets API backend; MCP is not a substitute for a production data API.

## Security checklist

- [ ] No secrets in `app/` static files
- [ ] Write target is a dedicated sheet copy when possible
- [ ] CORS restricted to your app origin
- [ ] Input validation mirrors sheet lists (gap analysis, HYN groups)
- [ ] Hyperlinks sanitized to `http:` / `https:` only before render
