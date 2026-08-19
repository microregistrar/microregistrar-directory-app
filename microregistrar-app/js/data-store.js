/**
 * Data Access Layer — Microregistrar Moodlecloud
 *
 * Abstracts storage behind a provider interface so the UI can later
 * swap LocalStorage / Google Sheets API / MCP without changes.
 */

const DataStore = (() => {
  const STORAGE_KEY = 'microregistrar_data';
  const CONFIG_KEY = 'microregistrar_config';

  let _data = null;
  let _provider = 'local';

  /* ── Provider interface ─────────────────────────────────────── */

  const providers = {
  local: {
    async load() {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) return JSON.parse(cached);
      const res = await fetch('data/seed-data.json');
      if (!res.ok) throw new Error('Failed to load seed data');
      return res.json();
    },
    async save(data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    },
    async reset() {
      localStorage.removeItem(STORAGE_KEY);
      const res = await fetch('data/seed-data.json');
      if (!res.ok) throw new Error('Failed to load seed data');
      return res.json();
    }
  },

  // Placeholder for future Google Sheets integration
  googleSheets: {
    async load() {
      const config = DataStore.getConfig();
      if (!config.sheetsApiUrl) {
        throw new Error('Google Sheets API URL not configured. See SETUP.md');
      }
      const res = await fetch(config.sheetsApiUrl, {
        headers: { Authorization: `Bearer ${config.accessToken}` }
      });
      if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
      return res.json();
    },
    async save(data) {
      const config = DataStore.getConfig();
      const res = await fetch(config.sheetsApiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.accessToken}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`Sheets API save error: ${res.status}`);
    },
    async reset() {
      return providers.local.reset();
    }
  }
  };

  /* ── Public API ─────────────────────────────────────────────── */

  return {
    async init(provider = 'local') {
      _provider = provider;
      _data = await providers[provider].load();
      return _data;
    },

    getData() {
      if (!_data) throw new Error('DataStore not initialised');
      return _data;
    },

    getSheets() {
      return Object.entries(_data.sheets).map(([name, sheet]) => ({
        name,
        gid: sheet.gid,
        schema: sheet.schema,
        recordCount: sheet.records.length
      }));
    },

    getSheet(name) {
      const sheet = _data.sheets[name];
      if (!sheet) throw new Error(`Sheet "${name}" not found`);
      return sheet;
    },

    getRecords(sheetName) {
      return this.getSheet(sheetName).records;
    },

    getRecord(sheetName, id) {
      return this.getRecords(sheetName).find(r => r.id === id);
    },

    async addRecord(sheetName, record) {
      const sheet = this.getSheet(sheetName);
      record.id = record.id || `${sheetName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      sheet.records.push(record);
      sheet.recordCount = sheet.records.length;
      await this._persist();
      return record;
    },

    async updateRecord(sheetName, id, updates) {
      const sheet = this.getSheet(sheetName);
      const idx = sheet.records.findIndex(r => r.id === id);
      if (idx === -1) throw new Error(`Record "${id}" not found`);
      sheet.records[idx] = { ...sheet.records[idx], ...updates, id };
      await this._persist();
      return sheet.records[idx];
    },

    async deleteRecord(sheetName, id) {
      const sheet = this.getSheet(sheetName);
      const idx = sheet.records.findIndex(r => r.id === id);
      if (idx === -1) throw new Error(`Record "${id}" not found`);
      sheet.records.splice(idx, 1);
      sheet.recordCount = sheet.records.length;
      await this._persist();
    },

    search(query, sheetFilter = null) {
      const q = query.toLowerCase().trim();
      if (!q) return [];
      const results = [];
      const sheets = sheetFilter ? [sheetFilter] : Object.keys(_data.sheets);

      for (const name of sheets) {
        const sheet = _data.sheets[name];
        if (!sheet) continue;
        for (const record of sheet.records) {
          const text = Object.values(record).filter(v => v != null).join(' ').toLowerCase();
          if (text.includes(q)) {
            results.push({ sheetName: name, record });
          }
        }
      }
      return results;
    },

    async exportJSON() {
      return JSON.stringify(_data, null, 2);
    },

    async exportCSV(sheetName) {
      const sheet = this.getSheet(sheetName);
      const cols = sheet.schema.columns.map(c => c.key);
      const header = sheet.schema.columns.map(c => c.label).join(',');
      const rows = sheet.records.map(r =>
        cols.map(k => {
          const v = r[k];
          if (v == null) return '';
          const s = String(v).replace(/"/g, '""');
          return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
        }).join(',')
      );
      return [header, ...rows].join('\n');
    },

    async importJSON(jsonStr) {
      const parsed = JSON.parse(jsonStr);
      if (!parsed.sheets) throw new Error('Invalid data format: missing sheets');
      _data = parsed;
      await this._persist();
      return _data;
    },

    async reset() {
      _data = await providers[_provider].reset();
      return _data;
    },

    setProvider(name) {
      if (!providers[name]) throw new Error(`Unknown provider: ${name}`);
      _provider = name;
      this.setConfig({ provider: name });
    },

    getConfig() {
      try {
        return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
      } catch {
        return {};
      }
    },

    setConfig(updates) {
      const cfg = this.getConfig();
      localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...cfg, ...updates }));
    },

    async _persist() {
      await providers[_provider].save(_data);
    }
  };
})();
