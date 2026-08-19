/**
 * Data access layer. UI code should call MicroData.createAdapter only.
 * Swap LocalSnapshotAdapter for RemoteSheetsAdapter when a backend exists.
 * Never place API keys, OAuth secrets, or service-account JSON here.
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "microregistrar-directory-v1";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uid() {
    return "r_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-8);
  }

  function findTab(workbook, tabId) {
    return workbook.tabs.find(function (tab) {
      return tab.id === tabId || tab.name === tabId;
    });
  }

  function csvEscape(value) {
    var text = value == null ? "" : String(value);
    if (/[",\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var cell = "";
    var inQuotes = false;
    for (var i = 0; i < text.length; i += 1) {
      var ch = text[i];
      var next = text[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') {
          cell += '"';
          i += 1;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cell += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else if (ch !== "\r") {
        cell += ch;
      }
    }
    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows.filter(function (r) {
      return r.some(function (c) {
        return String(c).trim() !== "";
      });
    });
  }

  function coerceField(field, raw) {
    if (raw == null) return field.type === "boolean" ? false : "";
    if (field.type === "boolean") {
      if (typeof raw === "boolean") return raw;
      return String(raw).toLowerCase() === "true" || raw === "1" || raw === "TRUE";
    }
    if (field.type === "number") {
      var n = Number(raw);
      return Number.isFinite(n) ? n : "";
    }
    if (field.type === "url") {
      return String(raw).trim();
    }
    return typeof raw === "string" ? raw : String(raw);
  }

  function LocalSnapshotAdapter(options) {
    options = options || {};
    this.snapshot = options.snapshot || null;
    this.storageKey = options.storageKey || STORAGE_KEY;
    this.workbook = null;
    this.status = "idle";
    this.error = null;
    this.sourceLabel = "Local snapshot + browser storage";
  }

  LocalSnapshotAdapter.prototype.load = function () {
    var self = this;
    this.status = "loading";
    this.error = null;
    return Promise.resolve()
      .then(function () {
        var base = self.snapshot || global.__WORKBOOK_SNAPSHOT__;
        if (!base || !Array.isArray(base.tabs)) {
          throw new Error("Workbook snapshot is missing. Ensure data/workbook.js loaded.");
        }
        self.workbook = clone(base);
        var overlay = self._readOverlay();
        if (overlay && Array.isArray(overlay.tabs)) {
          overlay.tabs.forEach(function (saved) {
            var tab = findTab(self.workbook, saved.id);
            if (tab && Array.isArray(saved.records)) tab.records = saved.records;
          });
          self.workbook.meta = self.workbook.meta || {};
          self.workbook.meta.localUpdatedAt = overlay.updatedAt || null;
        }
        self.status = "ready";
        return self.workbook;
      })
      .catch(function (err) {
        self.status = "error";
        self.error = err.message || String(err);
        throw err;
      });
  };

  LocalSnapshotAdapter.prototype._readOverlay = function () {
    try {
      var raw = global.localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  };

  LocalSnapshotAdapter.prototype._persist = function () {
    var payload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      tabs: this.workbook.tabs.map(function (tab) {
        return { id: tab.id, records: tab.records };
      }),
    };
    global.localStorage.setItem(this.storageKey, JSON.stringify(payload));
    this.workbook.meta.localUpdatedAt = payload.updatedAt;
  };

  LocalSnapshotAdapter.prototype.listTabs = function () {
    return this.workbook.tabs.map(function (tab) {
      return {
        id: tab.id,
        name: tab.name,
        kind: tab.kind,
        title: tab.title,
        blurb: tab.blurb,
        color: tab.color,
        recordCount: (tab.records || []).length,
      };
    });
  };

  LocalSnapshotAdapter.prototype.getTab = function (tabId) {
    var tab = findTab(this.workbook, tabId);
    if (!tab) throw new Error("Unknown tab: " + tabId);
    return tab;
  };

  LocalSnapshotAdapter.prototype.list = function (tabId) {
    return clone(this.getTab(tabId).records || []);
  };

  LocalSnapshotAdapter.prototype.get = function (tabId, id) {
    var rec = this.getTab(tabId).records.find(function (row) {
      return row.id === id;
    });
    return rec ? clone(rec) : null;
  };

  LocalSnapshotAdapter.prototype.create = function (tabId, data) {
    var tab = this.getTab(tabId);
    var record = clone(data || {});
    record.id = record.id || uid();
    record.sheetRow = record.sheetRow || null;
    tab.records.push(record);
    this._persist();
    return clone(record);
  };

  LocalSnapshotAdapter.prototype.update = function (tabId, id, data) {
    var tab = this.getTab(tabId);
    var idx = tab.records.findIndex(function (row) {
      return row.id === id;
    });
    if (idx < 0) throw new Error("Record not found");
    var next = Object.assign({}, tab.records[idx], clone(data), { id: id });
    tab.records[idx] = next;
    this._persist();
    return clone(next);
  };

  LocalSnapshotAdapter.prototype.remove = function (tabId, id) {
    var tab = this.getTab(tabId);
    var before = tab.records.length;
    tab.records = tab.records.filter(function (row) {
      return row.id !== id;
    });
    if (tab.records.length === before) throw new Error("Record not found");
    this._persist();
    return true;
  };

  LocalSnapshotAdapter.prototype.reset = function () {
    global.localStorage.removeItem(this.storageKey);
    return this.load();
  };

  LocalSnapshotAdapter.prototype.exportJSON = function () {
    return JSON.stringify(this.workbook, null, 2);
  };

  LocalSnapshotAdapter.prototype.importJSON = function (text) {
    var parsed = typeof text === "string" ? JSON.parse(text) : text;
    if (!parsed || !Array.isArray(parsed.tabs)) {
      throw new Error("JSON must include a tabs array (workbook snapshot shape).");
    }
    this.workbook = parsed;
    this._persist();
    this.status = "ready";
    return this.workbook;
  };

  LocalSnapshotAdapter.prototype.exportCSV = function (tabId) {
    var tab = this.getTab(tabId);
    var fields = tab.fields || [];
    var header = fields.map(function (f) {
      return csvEscape(f.label || f.key);
    });
    var lines = [header.join(",")];
    (tab.records || []).forEach(function (rec) {
      lines.push(
        fields
          .map(function (f) {
            var v = rec[f.key];
            if (v == null) return "";
            if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
            return csvEscape(v);
          })
          .join(",")
      );
    });
    return lines.join("\n");
  };

  LocalSnapshotAdapter.prototype.importCSV = function (tabId, text) {
    var tab = this.getTab(tabId);
    var rows = parseCsv(text);
    if (!rows.length) throw new Error("CSV is empty");
    var headers = rows[0].map(function (h) {
      return String(h).trim();
    });
    var fields = tab.fields || [];
    var index = {};
    headers.forEach(function (h, i) {
      var field = fields.find(function (f) {
        return f.key === h || f.label === h;
      });
      if (field) index[i] = field;
    });
    if (!Object.keys(index).length) {
      throw new Error("CSV headers did not match this tab’s fields.");
    }
    var records = [];
    for (var r = 1; r < rows.length; r += 1) {
      var rec = { id: uid(), sheetRow: null };
      Object.keys(index).forEach(function (i) {
        var field = index[i];
        rec[field.key] = coerceField(field, rows[r][i]);
      });
      records.push(rec);
    }
    tab.records = records;
    this._persist();
    return records.length;
  };

  LocalSnapshotAdapter.prototype.search = function (query, tabId) {
    var q = String(query || "")
      .trim()
      .toLowerCase();
    var tabs = tabId ? [this.getTab(tabId)] : this.workbook.tabs;
    if (!q) return [];
    var hits = [];
    tabs.forEach(function (tab) {
      (tab.records || []).forEach(function (rec) {
        var blob = JSON.stringify(rec).toLowerCase();
        if (blob.indexOf(q) !== -1) {
          hits.push({ tabId: tab.id, tabName: tab.name, record: clone(rec) });
        }
      });
    });
    return hits;
  };

  LocalSnapshotAdapter.prototype.validation = function () {
    return (this.workbook && this.workbook.validation) || {};
  };

  function RemoteSheetsAdapter(options) {
    options = options || {};
    this.apiBase = options.apiBase || "";
    this.status = "idle";
    this.error = null;
    this.workbook = null;
    this.sourceLabel = "Remote Google Sheets adapter";
  }

  RemoteSheetsAdapter.prototype.load = function () {
    var self = this;
    if (!this.apiBase) {
      var err = new Error(
        "Live Google Sheets is not configured. Set APP_CONFIG.apiBase to an Apps Script or backend URL. No secrets belong in the frontend."
      );
      this.status = "error";
      this.error = err.message;
      return Promise.reject(err);
    }
    this.status = "loading";
    return fetch(this.apiBase.replace(/\/$/, "") + "/workbook", { credentials: "omit" })
      .then(function (res) {
        if (!res.ok) throw new Error("Sheets backend returned HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        self.workbook = data;
        self.status = "ready";
        return data;
      })
      .catch(function (err) {
        self.status = "error";
        self.error = err.message || String(err);
        throw err;
      });
  };

  ["listTabs", "getTab", "list", "get", "create", "update", "remove", "exportJSON", "importJSON", "exportCSV", "importCSV", "search", "validation", "reset"].forEach(function (name) {
    if (!RemoteSheetsAdapter.prototype[name]) {
      RemoteSheetsAdapter.prototype[name] = LocalSnapshotAdapter.prototype[name];
    }
  });

  function createAdapter(config, snapshot) {
    config = config || {};
    if (config.dataSource === "remote") {
      return new RemoteSheetsAdapter(config);
    }
    return new LocalSnapshotAdapter({ snapshot: snapshot || global.__WORKBOOK_SNAPSHOT__ });
  }

  global.MicroData = {
    STORAGE_KEY: STORAGE_KEY,
    LocalSnapshotAdapter: LocalSnapshotAdapter,
    RemoteSheetsAdapter: RemoteSheetsAdapter,
    createAdapter: createAdapter,
    findTab: findTab,
    uid: uid,
  };
})(window);
