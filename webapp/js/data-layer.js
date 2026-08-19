// ---------------------------------------------------------------------------
// DATA ACCESS LAYER
// ---------------------------------------------------------------------------
// This is the ONLY file that knows where records physically live. The UI
// (app.js) never touches localStorage or window.SEED_DATA directly - it
// only calls methods on `DataLayer`. That separation is what will let a
// future `GoogleSheetsProvider` (or an MCP-backed provider) be dropped in
// without touching a single view/render function.
//
// Every provider must implement this async interface:
//   init()                                 -> Promise<void>
//   listTabs()                             -> string[]                 (tab ids)
//   getRecords(tabId)                      -> Promise<Record[]>
//   getRecord(tabId, recordId)             -> Promise<Record|null>
//   addRecord(tabId, data)                 -> Promise<Record>
//   updateRecord(tabId, recordId, patch)   -> Promise<Record>
//   deleteRecord(tabId, recordId)          -> Promise<void>
//   searchAll(query, limit)                -> Promise<{tabId, record}[]>
//   exportTabJSON(tabId)                   -> Promise<string>
//   exportTabCSV(tabId)                    -> Promise<string>
//   importTabJSON(tabId, jsonText, mode)   -> Promise<{imported:number}>
//   resetTabToSeed(tabId)                  -> Promise<void>
//   isReadOnly()                           -> boolean
// ---------------------------------------------------------------------------

(function (global) {
  "use strict";

  const STORAGE_KEY = "microregistrar_app_data_v2";

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * LocalStorageProvider
   * Default provider used by the shipped app. Seeds itself once from
   * window.SEED_DATA (generated offline from the sheet's CSV export, see
   * scripts/convert_csv_to_seed.py) and thereafter persists all
   * add/edit/delete operations to the browser's localStorage so the demo
   * is fully usable offline with no backend.
   */
  class LocalStorageProvider {
    constructor() {
      this._store = null;
    }

    async init() {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          this._store = JSON.parse(raw);
          return;
        } catch (e) {
          console.warn("Corrupt local data, reseeding from sheet export.", e);
        }
      }
      this._store = deepClone(window.SEED_DATA || { tabs: {} });
      this._persist();
    }

    _persist() {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this._store));
    }

    isReadOnly() {
      return false;
    }

    listTabs() {
      return Object.keys(this._store.tabs);
    }

    async getRecords(tabId) {
      return deepClone(this._store.tabs[tabId] || []);
    }

    async getRecord(tabId, recordId) {
      const rows = this._store.tabs[tabId] || [];
      const found = rows.find((r) => r.id === recordId);
      return found ? deepClone(found) : null;
    }

    async addRecord(tabId, data) {
      if (!this._store.tabs[tabId]) this._store.tabs[tabId] = [];
      const record = { ...data, id: data.id || uid(tabId) };
      this._store.tabs[tabId].push(record);
      this._persist();
      return deepClone(record);
    }

    async updateRecord(tabId, recordId, patch) {
      const rows = this._store.tabs[tabId] || [];
      const idx = rows.findIndex((r) => r.id === recordId);
      if (idx === -1) throw new Error(`Record ${recordId} not found in ${tabId}`);
      rows[idx] = { ...rows[idx], ...patch, id: recordId };
      this._persist();
      return deepClone(rows[idx]);
    }

    async deleteRecord(tabId, recordId) {
      const rows = this._store.tabs[tabId] || [];
      this._store.tabs[tabId] = rows.filter((r) => r.id !== recordId);
      this._persist();
    }

    async searchAll(query, limit) {
      const q = (query || "").trim().toLowerCase();
      if (!q) return [];
      const results = [];
      for (const tabId of Object.keys(this._store.tabs)) {
        for (const record of this._store.tabs[tabId]) {
          const haystack = Object.values(record)
            .filter((v) => typeof v === "string" || typeof v === "number")
            .join(" \u00a0 ")
            .toLowerCase();
          if (haystack.includes(q)) {
            results.push({ tabId, record: deepClone(record) });
            if (limit && results.length >= limit) return results;
          }
        }
      }
      return results;
    }

    async exportTabJSON(tabId) {
      return JSON.stringify(this._store.tabs[tabId] || [], null, 2);
    }

    async exportTabCSV(tabId) {
      const rows = this._store.tabs[tabId] || [];
      if (!rows.length) return "";
      const headers = Array.from(
        rows.reduce((set, r) => {
          Object.keys(r).forEach((k) => set.add(k));
          return set;
        }, new Set())
      );
      const escape = (v) => {
        if (v === null || v === undefined) return "";
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [headers.join(",")];
      for (const row of rows) {
        lines.push(headers.map((h) => escape(row[h])).join(","));
      }
      return lines.join("\n");
    }

    async importTabJSON(tabId, jsonText, mode) {
      const incoming = JSON.parse(jsonText);
      if (!Array.isArray(incoming)) throw new Error("Expected a JSON array of records.");
      const withIds = incoming.map((r) => ({ ...r, id: r.id || uid(tabId) }));
      if (mode === "replace") {
        this._store.tabs[tabId] = withIds;
      } else {
        if (!this._store.tabs[tabId]) this._store.tabs[tabId] = [];
        this._store.tabs[tabId].push(...withIds);
      }
      this._persist();
      return { imported: withIds.length };
    }

    async resetTabToSeed(tabId) {
      const seedRows = (window.SEED_DATA && window.SEED_DATA.tabs[tabId]) || [];
      this._store.tabs[tabId] = deepClone(seedRows);
      this._persist();
    }

    async resetAllToSeed() {
      this._store = deepClone(window.SEED_DATA || { tabs: {} });
      this._persist();
    }
  }

  /**
   * GoogleSheetsProvider (stub)
   * -------------------------------------------------------------------
   * Not wired up in this build - included so the swap-in point is
   * literal, visible code rather than just documentation. To activate:
   *   1. Stand up a small backend (Apps Script Web App, Cloud Function,
   *      or Node/Express) that holds the Google OAuth/service-account
   *      credentials. NEVER put a Sheets API key/OAuth secret in this
   *      frontend bundle - the browser console is public.
   *   2. Implement the methods below to call that backend's REST
   *      endpoints (e.g. GET /api/tabs/:id, POST /api/tabs/:id/records).
   *   3. In app.js, change `new LocalStorageProvider()` to
   *      `new GoogleSheetsProvider('/api')` and reload.
   * Every method signature below matches LocalStorageProvider exactly,
   * so no other file needs to change.
   */
  class GoogleSheetsProvider {
    constructor(apiBaseUrl) {
      this.apiBaseUrl = apiBaseUrl;
    }
    async init() {
      throw new Error(
        "GoogleSheetsProvider is a stub. Connect a backend proxy first - see webapp/README.md \u00a7 Connecting live Google Sheets."
      );
    }
    listTabs() { throw new Error("Not implemented."); }
    async getRecords() { throw new Error("Not implemented."); }
    async getRecord() { throw new Error("Not implemented."); }
    async addRecord() { throw new Error("Not implemented."); }
    async updateRecord() { throw new Error("Not implemented."); }
    async deleteRecord() { throw new Error("Not implemented."); }
    async searchAll() { throw new Error("Not implemented."); }
    async exportTabJSON() { throw new Error("Not implemented."); }
    async exportTabCSV() { throw new Error("Not implemented."); }
    async importTabJSON() { throw new Error("Not implemented."); }
    async resetTabToSeed() { throw new Error("Not implemented."); }
    isReadOnly() { return false; }
  }

  global.DataLayer = { LocalStorageProvider, GoogleSheetsProvider };
})(window);
