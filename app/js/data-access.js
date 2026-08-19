/**
 * Data access layer — UI must only talk to DataAccess.
 * LocalJsonStore: mock JSON + localStorage overlay + import/export.
 * Swap in GoogleSheetsStore later (see docs/GOOGLE_SHEETS_SETUP.md).
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'microregistrar-app-v1';
  const THEME_KEY = 'microregistrar-theme';

  function deepClone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function isSafeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
      const u = new URL(url.trim());
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function linkHtml(url, label) {
    if (!isSafeUrl(url)) return escapeHtml(label || '');
    const text = escapeHtml(label || url);
    return `<a href="${escapeHtml(url.trim())}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  }

  class LocalJsonStore {
    constructor(options) {
      this.mockUrl = options.mockUrl || './data/mock-data.json';
      this._base = null;
      this._state = null;
      this._ready = false;
    }

    async init() {
      const res = await fetch(this.mockUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load mock data (' + res.status + ')');
      this._base = await res.json();
      const saved = this._readStorage();
      if (saved && saved.tabs) {
        this._state = saved;
        // keep meta from base if missing
        if (!this._state.meta) this._state.meta = this._base.meta;
        if (!this._state.tabOrder) this._state.tabOrder = this._base.tabOrder;
      } else {
        this._state = deepClone(this._base);
      }
      this._ready = true;
      return this.getMeta();
    }

    _readStorage() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    }

    _persist() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state));
    }

    getMeta() {
      return deepClone(this._state.meta || {});
    }

    listTabs() {
      const order = this._state.tabOrder || Object.keys(this._state.tabs);
      return order.map((id) => {
        const t = this._state.tabs[id];
        const count =
          (t.records && t.records.length) ||
          (t.links && t.links.length) ||
          0;
        return {
          id: t.id,
          name: t.name,
          kind: t.kind,
          description: t.description || '',
          recordCount: count,
        };
      });
    }

    getTab(tabId) {
      const t = this._state.tabs[tabId];
      if (!t) throw new Error('Unknown tab: ' + tabId);
      return deepClone(t);
    }

    listRecords(tabId) {
      const t = this._state.tabs[tabId];
      if (!t) throw new Error('Unknown tab: ' + tabId);
      if (t.kind === 'dashboard') return deepClone(t.links || []);
      return deepClone(t.records || []);
    }

    createRecord(tabId, data) {
      const t = this._state.tabs[tabId];
      if (!t || !Array.isArray(t.records)) throw new Error('Tab does not support records');
      const record = this._normalizeRecord(t, data, uid(tabId.toLowerCase().replace(/\s+/g, '-')));
      t.records.push(record);
      this._persist();
      return deepClone(record);
    }

    updateRecord(tabId, recordId, data) {
      const t = this._state.tabs[tabId];
      if (!t || !Array.isArray(t.records)) throw new Error('Tab does not support records');
      const idx = t.records.findIndex((r) => r.id === recordId);
      if (idx < 0) throw new Error('Record not found');
      t.records[idx] = this._normalizeRecord(t, { ...t.records[idx], ...data }, recordId);
      this._persist();
      return deepClone(t.records[idx]);
    }

    deleteRecord(tabId, recordId) {
      const t = this._state.tabs[tabId];
      if (!t || !Array.isArray(t.records)) throw new Error('Tab does not support records');
      const before = t.records.length;
      t.records = t.records.filter((r) => r.id !== recordId);
      if (t.records.length === before) throw new Error('Record not found');
      this._persist();
      return true;
    }

    _normalizeRecord(tab, data, id) {
      if (tab.kind === 'flat_table') {
        const link = (data.link || '').trim();
        if (link && !isSafeUrl(link)) throw new Error('Link must be http(s) URL');
        const group = data.group || '';
        const allowed = (tab.validation && tab.validation.group) || [];
        if (group && allowed.length && !allowed.includes(group)) {
          // allow custom groups but prefer list values
        }
        return {
          id,
          group,
          topic: data.topic || '',
          link,
          dateUpdated: data.dateUpdated || '',
        };
      }
      if (tab.kind === 'topic_outline' || tab.kind === 'search') {
        const link = (data.link || '').trim();
        if (link && !isSafeUrl(link)) throw new Error('Link must be http(s) URL');
        const section = data.section || '';
        const topic = data.topic || data.cellContent || '';
        return {
          id,
          section,
          topic,
          date: data.date || '',
          gapAnalysis: data.gapAnalysis || '',
          revision1: !!data.revision1,
          revision2: !!data.revision2,
          link,
          rowType: data.rowType || (section && !topic ? 'section' : 'topic'),
          // search-shaped fields (optional)
          sheetName: data.sheetName || '',
          row: data.row ?? null,
          column: data.column || '',
          cellContent: data.cellContent || topic,
          linkLabel: data.linkLabel || 'Open topic',
        };
      }
      throw new Error('Unsupported tab kind for CRUD');
    }

    searchAll(query) {
      const q = (query || '').trim().toLowerCase();
      if (!q) return [];
      const hits = [];
      for (const tab of this.listTabs()) {
        const full = this.getTab(tab.id);
        if (full.kind === 'dashboard') {
          for (const link of full.links || []) {
            const hay = [link.label, link.url, link.sheetTarget].join(' ').toLowerCase();
            if (hay.includes(q)) {
              hits.push({
                tabId: tab.id,
                tabName: tab.name,
                recordId: link.id,
                title: link.label,
                snippet: link.url || link.sheetTarget || '',
                link: link.url || null,
                sheetTarget: link.sheetTarget || null,
              });
            }
          }
          continue;
        }
        for (const r of full.records || []) {
          const hay = Object.values(r).join(' ').toLowerCase();
          if (hay.includes(q)) {
            hits.push({
              tabId: tab.id,
              tabName: tab.name,
              recordId: r.id,
              title: r.topic || r.section || r.cellContent || r.group || r.id,
              snippet: [r.section, r.topic, r.group, r.gapAnalysis].filter(Boolean).join(' · '),
              link: r.link || null,
            });
          }
        }
      }
      return hits;
    }

    exportJson() {
      return JSON.stringify(this._state, null, 2);
    }

    exportCsv(tabId) {
      const t = this.getTab(tabId);
      if (!t.records) throw new Error('No tabular records on this tab');
      const headers = (t.headers || []).map((h) => (typeof h === 'string' ? h : h.key));
      const keys = headers.length
        ? headers
        : Object.keys(t.records[0] || { id: 1 }).filter((k) => k !== 'rowType');
      const lines = [keys.join(',')];
      for (const r of t.records) {
        lines.push(
          keys
            .map((k) => {
              let v = r[k];
              if (v == null) v = '';
              v = String(v);
              if (/[",\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
              return v;
            })
            .join(',')
        );
      }
      return lines.join('\n');
    }

    importJson(text) {
      const parsed = JSON.parse(text);
      if (!parsed.tabs) throw new Error('Invalid export: missing tabs');
      this._state = parsed;
      if (!this._state.tabOrder) this._state.tabOrder = Object.keys(parsed.tabs);
      this._persist();
      return this.listTabs();
    }

    resetToMock() {
      this._state = deepClone(this._base);
      localStorage.removeItem(STORAGE_KEY);
      return this.listTabs();
    }

    hasLocalEdits() {
      return !!localStorage.getItem(STORAGE_KEY);
    }
  }

  // Placeholder for future live integration — same surface as LocalJsonStore.
  class GoogleSheetsStore {
    constructor() {
      throw new Error(
        'GoogleSheetsStore is not configured. Use LocalJsonStore and see docs/GOOGLE_SHEETS_SETUP.md'
      );
    }
  }

  global.MicroData = {
    LocalJsonStore,
    GoogleSheetsStore,
    STORAGE_KEY,
    THEME_KEY,
    isSafeUrl,
    escapeHtml,
    linkHtml,
    uid,
  };
})(window);
