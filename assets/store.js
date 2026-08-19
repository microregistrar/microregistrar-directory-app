/*
 * Data access layer (no UI code here).
 *
 * The UI only talks to `window.MicroStore`, whose methods are all async.
 * The default adapter persists to localStorage, seeded from the snapshot in
 * assets/data.js (generated from the Google Sheet by scripts/export_sheet.py).
 *
 * To connect a live backend later (Google Sheets API, Apps Script endpoint,
 * or an MCP-backed proxy), implement the same adapter interface and swap it
 * in at the bottom of this file:
 *
 *   class SheetsApiAdapter {
 *     async init() {}
 *     async getMeta() {}            // -> { title, gapOptions, ... }
 *     async getIndex() {}           // -> { quickLinks, whatsNew }
 *     async listTabs() {}           // -> [{ key, name, description, ... }]
 *     async getRecords(tabKey) {}   // -> [record]
 *     async createRecord(tabKey, fields) {}
 *     async updateRecord(tabKey, id, patch) {}
 *     async deleteRecord(tabKey, id) {}
 *   }
 *
 * Record shape: { id, section, isSection, topic, url, date, gap, rev1, rev2 }
 * No secrets or tokens belong in this file: a live integration must go
 * through a server-side endpoint (see README.md).
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'microregistrar-data-v2';

  class LocalStorageAdapter {
    constructor(seed) {
      this.seed = seed;
      this.data = null;
    }

    async init() {
      if (!this.seed || !Array.isArray(this.seed.tabs)) {
        throw new Error('Seed data missing: assets/data.js failed to load.');
      }
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.tabs)) {
            this.data = parsed;
            return;
          }
        }
      } catch (e) {
        console.warn('Stored data unreadable, reseeding.', e);
      }
      this.data = JSON.parse(JSON.stringify(this.seed));
      this._save();
    }

    _save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    }

    _tab(tabKey) {
      const tab = this.data.tabs.find((t) => t.key === tabKey);
      if (!tab) throw new Error('Unknown tab: ' + tabKey);
      return tab;
    }

    async getMeta() { return this.data.meta; }
    async getIndex() { return this.data.index; }

    async listTabs() {
      return this.data.tabs.map(({ key, name, description, icon, hasGroup, records }) => ({
        key, name, description, icon, hasGroup, recordCount: records.length,
      }));
    }

    async getRecords(tabKey) {
      return this._tab(tabKey).records.map((r) => Object.assign({}, r));
    }

    async createRecord(tabKey, fields) {
      const tab = this._tab(tabKey);
      const rec = {
        id: tabKey + '-u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        section: fields.section || '',
        isSection: !!fields.isSection,
        topic: fields.topic || '',
        url: fields.url || '',
        date: fields.date || '',
        gap: fields.gap || '',
        rev1: !!fields.rev1,
        rev2: !!fields.rev2,
      };
      // Insert after the last record of the same section to keep sheet order.
      let insertAt = tab.records.length;
      if (rec.section) {
        for (let i = tab.records.length - 1; i >= 0; i--) {
          if (tab.records[i].section === rec.section) { insertAt = i + 1; break; }
        }
      }
      tab.records.splice(insertAt, 0, rec);
      this._save();
      return Object.assign({}, rec);
    }

    async updateRecord(tabKey, id, patch) {
      const tab = this._tab(tabKey);
      const rec = tab.records.find((r) => r.id === id);
      if (!rec) throw new Error('Record not found: ' + id);
      ['section', 'topic', 'url', 'date', 'gap'].forEach((k) => {
        if (patch[k] !== undefined) rec[k] = patch[k];
      });
      ['rev1', 'rev2', 'isSection'].forEach((k) => {
        if (patch[k] !== undefined) rec[k] = !!patch[k];
      });
      this._save();
      return Object.assign({}, rec);
    }

    async deleteRecord(tabKey, id) {
      const tab = this._tab(tabKey);
      const idx = tab.records.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error('Record not found: ' + id);
      tab.records.splice(idx, 1);
      this._save();
    }

    async resetToSeed() {
      this.data = JSON.parse(JSON.stringify(this.seed));
      this._save();
    }

    async exportJSON() {
      return JSON.stringify(this.data, null, 2);
    }

    async importJSON(text) {
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.tabs) || !parsed.meta) {
        throw new Error('Invalid file: expected an export of this app.');
      }
      this.data = parsed;
      this._save();
    }

    async exportTabCSV(tabKey) {
      const tab = this._tab(tabKey);
      const esc = (v) => {
        const s = String(v == null ? '' : v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      const header = ['section', 'topic', 'url', 'date', 'gap', 'revision1', 'revision2'];
      const lines = [header.join(',')];
      tab.records.forEach((r) => {
        lines.push([r.section, r.topic, r.url, r.date, r.gap, r.rev1, r.rev2].map(esc).join(','));
      });
      return lines.join('\r\n');
    }
  }

  // Cross-tab search lives in the store so a future backend can push it server-side.
  async function searchAll(adapter, query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const tabs = await adapter.listTabs();
    const results = [];
    for (const tab of tabs) {
      const records = await adapter.getRecords(tab.key);
      for (const r of records) {
        const hay = (r.topic + ' ' + r.section + ' ' + r.url).toLowerCase();
        if (hay.includes(q)) results.push({ tab, record: r });
      }
    }
    return results;
  }

  const adapter = new LocalStorageAdapter(window.SEED_DATA);

  window.MicroStore = {
    init: () => adapter.init(),
    getMeta: () => adapter.getMeta(),
    getIndex: () => adapter.getIndex(),
    listTabs: () => adapter.listTabs(),
    getRecords: (tabKey) => adapter.getRecords(tabKey),
    createRecord: (tabKey, fields) => adapter.createRecord(tabKey, fields),
    updateRecord: (tabKey, id, patch) => adapter.updateRecord(tabKey, id, patch),
    deleteRecord: (tabKey, id) => adapter.deleteRecord(tabKey, id),
    searchAll: (query) => searchAll(adapter, query),
    resetToSeed: () => adapter.resetToSeed(),
    exportJSON: () => adapter.exportJSON(),
    importJSON: (text) => adapter.importJSON(text),
    exportTabCSV: (tabKey) => adapter.exportTabCSV(tabKey),
  };
})();
