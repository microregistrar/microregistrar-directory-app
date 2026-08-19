# Microregistrar Knowledge Portal & Production Web App

A production-ready responsive single-entry web application built from the [Microregistrar Curriculum & Study Guide Google Sheet](https://docs.google.com/spreadsheets/d/1XzlEPyzUM3ljxjzMrxpXLH-Pu_xTlWGC8AtrlRzp5Zw/edit?gid=1285796030#gid=1285796030).

---

## 🚀 Key Features

- **Central Front Page & Hub**: Index dashboard mapping all 16 original spreadsheet sheets with category cards, quick stats, and direct links to exams and tools.
- **Full In-App CRUD**: Add, edit, and delete topics, sub-specialties, and resource chapters with instant reactive updates.
- **Secure Hyperlink Engine**: Preserves and renders all original MoodleCloud, Greenbook, and NICE hyperlinks safely with `target="_blank"` and `rel="noopener noreferrer"`.
- **Add Hyperlink Values**: Integrated URL inputs in creation and edit modals allow adding or updating external links on the fly.
- **Global Instant Search**: Sub-millisecond fuzzy search querying across all 14 curriculum sheets (Infection, Antibiotic, Bacteria, Mycology, Virology, Parasitology, Lab, Transplant, IPC, Vaccine, Statistics, HYN, Interactive HYN).
- **Per-Sheet Interactive Tables**: Sortable columns, category filters, fast status toggling (Revision 1, Revision 2, Completed), and pagination-free responsive table views.
- **Export & Import**: Download any tab as clean CSV or backup the entire database to JSON. Import JSON back into the app.
- **Dark Mode Support**: One-click toggle with persisted user preference.
- **Data Layer Separation**: Clean abstraction layer (`assets/js/data_store.js`) separating the UI from storage, making it trivial to plug in live Google Sheets API or Apps Script webhooks.

---

## 📁 File Structure

```
├── index.html                  # Single-entry main HTML application
├── assets/
│   ├── css/
│   │   └── style.css           # Modern responsive admin design system (Light/Dark themes)
│   └── js/
│       ├── initial_data.js     # Sanitized & normalized data extracted from all spreadsheet tabs
│       ├── data_store.js       # Data Access Layer (DAL), LocalStorage persistence, Export/Import
│       └── app.js              # Router, View Renderers, Search, Modal CRUD Controllers
├── data/
│   └── initial_dataset.json    # Full extracted raw JSON dataset for backup/reference
└── README.md                   # Documentation & Google Sheets Integration Guide
```

---

## 🔌 Connecting Live Google Sheets (Backend Setup Guide)

The web app is architected with a decoupled Data Access Layer (`DataService` in `data_store.js`). To synchronize live with the Google Sheet, choose one of the following two safe methods:

### Method 1: Google Apps Script Webhook (Recommended — No Credentials Exposed)

1. Open your Google Sheet: [Microregistrar Sheet](https://docs.google.com/spreadsheets/d/1XzlEPyzUM3ljxjzMrxpXLH-Pu_xTlWGC8AtrlRzp5Zw/edit)
2. Go to **Extensions** > **Apps Script**.
3. Paste the following script:

```javascript
function doGet(e) {
  var action = e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'getAll') {
    var result = {};
    var sheets = ss.getSheets();
    sheets.forEach(function(sheet) {
      result[sheet.getName()] = sheet.getDataRange().getValues();
    });
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(data.sheetName);
  
  if (data.action === 'add') {
    sheet.appendRow([data.category, data.topic, data.url, new Date(), data.rev1, data.rev2]);
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

4. Click **Deploy** > **New Deployment** > Select **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the deployed Web App URL and paste it in the app under **Data & Sync** (`#settings`).

---

### Method 2: Google Sheets API v4 with Service Account (Automated Backend)

1. Enable the **Google Sheets API** in the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a Service Account and download the JSON key.
3. Share the Google Sheet with the Service Account email with **Editor** permissions.
4. Set up a lightweight proxy server (or Cloudflare Worker / AWS Lambda) that signs requests using the service account and exposes REST CRUD endpoints (`GET /api/topics`, `POST /api/topics`).
5. Configure `assets/js/data_store.js` to point to your proxy endpoint.
