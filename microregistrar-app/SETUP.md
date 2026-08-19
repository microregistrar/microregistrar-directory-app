# Connecting Live Google Sheets

This guide explains how to connect the app to the live spreadsheet as a backend. **No credentials go in frontend code.**

## Access Summary

| Method | Read | Write | Auth Required | Recommended |
|--------|------|-------|---------------|-------------|
| Public CSV/XLSX export | Yes (if shared) | No | None | Seed data only |
| Google Sheets API v4 | Yes | Yes | Service account or OAuth | Production |
| Google Apps Script web app | Yes | Yes | Script deployment | Simplest for small teams |
| MCP Google Drive (Cursor) | Yes | Yes | User OAuth in IDE | Agent/automation only |

The original spreadsheet is currently **publicly readable** (CSV/XLSX export works without auth). Write access requires owner permission.

## Option A: Google Apps Script Proxy (Recommended)

Create a lightweight backend that the frontend calls. No secrets in the browser.

### 1. Create the Apps Script

In the spreadsheet: **Extensions → Apps Script**, paste:

```javascript
const SPREADSHEET_ID = '1XzlEPyzUM3ljxjzMrxpXLH-Pu_xTlWGC8AtrlRzp5Zw';

function doGet(e) {
  const sheet = e.parameter.sheet;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (sheet) {
    const ws = ss.getSheetByName(sheet);
    return jsonResponse(sheetToRecords(ws));
  }
  // Return all sheets metadata
  return jsonResponse({
    sheets: ss.getSheets().map(s => ({
      name: s.getName(),
      recordCount: s.getLastRow() - 1
    }))
  });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const { action, sheetName, record } = body;
  const ws = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  // Implement add/update/delete based on action
  return jsonResponse({ success: true });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 2. Deploy

**Deploy → New deployment → Web app**
- Execute as: Me
- Who has access: Anyone (or restrict to your domain)

### 3. Configure the App

In browser console or a config UI:

```javascript
DataStore.setConfig({
  provider: 'googleSheets',
  sheetsApiUrl: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'
});
DataStore.setProvider('googleSheets');
location.reload();
```

## Option B: Google Sheets API v4 + Backend Proxy

For production with proper auth:

### 1. Google Cloud Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable **Google Sheets API**
3. Create a **Service Account** and download the JSON key
4. Share the spreadsheet with the service account email (Viewer or Editor)

### 2. Backend Proxy (Node.js example)

```javascript
// server.js — run on your server, NOT in the browser
const { google } = require('googleapis');
const express = require('express');
const app = express();

const auth = new google.auth.GoogleAuth({
  keyFile: './service-account.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID = '1XzlEPyzUM3ljxjzMrxpXLH-Pu_xTlWGC8AtrlRzp5Zw';

app.get('/api/sheets/:name', async (req, res) => {
  const sheets = google.sheets({ version: 'v4', auth });
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${req.params.name}!A:Z`,
  });
  res.json(result.data);
});

app.listen(3001);
```

### 3. Frontend Config

```javascript
DataStore.setConfig({
  provider: 'googleSheets',
  sheetsApiUrl: 'https://your-server.com/api'
});
```

## Option C: MCP Google Drive (Cursor Agents)

The Google Drive MCP server in Cursor can read/write spreadsheets when authenticated:

1. Authenticate Google Drive MCP in Cursor Desktop settings
2. Use MCP tools to read sheet data and sync to `data/seed-data.json`
3. The static app continues using LocalStorage for interactive CRUD

This is best for periodic syncs, not real-time user-facing CRUD.

## Re-exporting Seed Data

To refresh `data/seed-data.json` from the live sheet:

```bash
# Download latest xlsx
curl -sL "https://docs.google.com/spreadsheets/d/1XzlEPyzUM3ljxjzMrxpXLH-Pu_xTlWGC8AtrlRzp5Zw/export?format=xlsx" -o /tmp/sheet.xlsx

# Run the export script (requires openpyxl)
python3 scripts/export-seed.py
```

## Security Notes

- Never embed API keys, service account JSON, or OAuth tokens in `index.html` or client JS
- Use a backend proxy for all authenticated API calls
- The Apps Script approach keeps credentials server-side in Google's infrastructure
- LocalStorage data is per-browser; use export/import for backup

## Sheet GID Reference

| Tab | GID |
|-----|-----|
| INDEX | 1285796030 |
| Search | 924970146 |
| Interactive HYN | 1383627054 |
| Infection | 1758850839 |
| Antibiotic | 2085848094 |
| Bacteria | 748155008 |
| Mycology | 1781887838 |
| Virology | 375019603 |
| Parasitology | 450023874 |
| Lab | 1349102258 |
| Transplant | 604519601 |
| IPC | 107979369 |
| Vaccine | 287128757 |
| Statistics | 1118591624 |
| HYN | 886647633 |
| Curriculum | 788937892 |
