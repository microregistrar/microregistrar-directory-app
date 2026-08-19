// ---------------------------------------------------------------------------
// UI LAYER — router, rendering, forms, modals, search, theme.
// Talks ONLY to `DataLayer` (via the `db` instance below), never touches
// localStorage or window.SEED_DATA directly. Swapping the backend later is
// a one-line change (see bottom of this file).
// ---------------------------------------------------------------------------
(function () {
  "use strict";

  const { TABS, getTab } = window.TabsConfig;

  // ---- Data provider (swap point) -----------------------------------------
  const db = new window.DataLayer.LocalStorageProvider();
  // To connect a live backend later:
  //   const db = new window.DataLayer.GoogleSheetsProvider('/api');

  // ---- Small state ----------------------------------------------------------
  const state = {
    tableState: {}, // tabId -> { query, sortKey, sortDir, filters }
  };

  function tableStateFor(tabId) {
    if (!state.tableState[tabId]) {
      state.tableState[tabId] = { query: "", sortKey: null, sortDir: "asc", filters: {} };
    }
    return state.tableState[tabId];
  }

  // ---- DOM refs ---------------------------------------------------------
  const $main = document.getElementById("mainContent");
  const $sidebarTabs = document.getElementById("sidebarTabs");
  const $sidebar = document.getElementById("sidebar");
  const $sidebarOverlay = document.getElementById("sidebarOverlay");
  const $modalRoot = document.getElementById("modalRoot");
  const $toastRoot = document.getElementById("toastRoot");
  const $globalSearchInput = document.getElementById("globalSearchInput");
  const $globalSearchResults = document.getElementById("globalSearchResults");

  // ---- Utilities ---------------------------------------------------------
  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isValidUrl(value) {
    if (!value) return true; // optional fields
    try {
      const u = new URL(value);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }

  function renderLink(url, text) {
    if (!url) return escapeHtml(text || "");
    return `<a class="link-chip" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text || url)}</a>`;
  }

  function fmtDate(d) {
    return d ? escapeHtml(d) : `<span style="color:var(--text-muted)">\u2014</span>`;
  }

  function boolPill(v) {
    return v
      ? `<span class="pill pill-yes">\u2713 Yes</span>`
      : `<span class="pill pill-no">No</span>`;
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function showToast(message, type = "info") {
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = message;
    $toastRoot.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity .25s ease";
      setTimeout(() => el.remove(), 260);
    }, 3200);
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ---- Modal helpers ------------------------------------------------------
  function openModal(innerHtml, { onMount } = {}) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true">${innerHtml}</div>`;
    backdrop.addEventListener("mousedown", (e) => {
      if (e.target === backdrop) closeModal();
    });
    $modalRoot.innerHTML = "";
    $modalRoot.appendChild(backdrop);
    document.addEventListener("keydown", escCloseOnce);
    if (onMount) onMount(backdrop);
    return backdrop;
  }
  function escCloseOnce(e) {
    if (e.key === "Escape") closeModal();
  }
  function closeModal() {
    $modalRoot.innerHTML = "";
    document.removeEventListener("keydown", escCloseOnce);
  }

  function confirmModal(message, { confirmLabel = "Delete", danger = true } = {}) {
    return new Promise((resolve) => {
      openModal(
        `<div class="modal-header"><h3>Please confirm</h3><button class="icon-btn" data-close>&times;</button></div>
         <div class="modal-body"><p>${escapeHtml(message)}</p></div>
         <div class="modal-footer">
           <button class="btn" data-cancel>Cancel</button>
           <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-confirm>${escapeHtml(confirmLabel)}</button>
         </div>`,
        {
          onMount(root) {
            root.querySelector("[data-close]").onclick = () => { closeModal(); resolve(false); };
            root.querySelector("[data-cancel]").onclick = () => { closeModal(); resolve(false); };
            root.querySelector("[data-confirm]").onclick = () => { closeModal(); resolve(true); };
          },
        }
      );
    });
  }

  // ---- Generic form builder ------------------------------------------------
  function fieldInputHtml(field, value, existingValues) {
    const val = value === undefined || value === null ? "" : value;
    const req = field.required ? "required" : "";
    switch (field.type) {
      case "textarea":
        return `<textarea id="f_${field.key}" ${req}>${escapeHtml(val)}</textarea>`;
      case "select":
        return `<select id="f_${field.key}" ${req}>${field.options
          .map((o) => `<option value="${o.value}" ${String(o.value) === String(val) ? "selected" : ""}>${escapeHtml(o.label)}</option>`)
          .join("")}</select>`;
      case "checkbox":
        return `<div class="checkbox-row"><input type="checkbox" id="f_${field.key}" ${val ? "checked" : ""}/><label for="f_${field.key}">Yes</label></div>`;
      case "date":
        return `<input type="text" id="f_${field.key}" placeholder="dd/mm/yyyy" value="${escapeHtml(val)}" ${req}/>`;
      case "url":
        return `<input type="url" id="f_${field.key}" placeholder="https://example.com/..." value="${escapeHtml(val)}" ${req}/>`;
      case "text-suggest": {
        const listId = `dl_${field.key}`;
        const options = (existingValues || []).map((v) => `<option value="${escapeHtml(v)}"></option>`).join("");
        return `<input type="text" id="f_${field.key}" list="${listId}" value="${escapeHtml(val)}" ${req}/><datalist id="${listId}">${options}</datalist>`;
      }
      default:
        return `<input type="text" id="f_${field.key}" value="${escapeHtml(val)}" ${req}/>`;
    }
  }

  function readFieldValue(field) {
    const el = document.getElementById(`f_${field.key}`);
    if (!el) return undefined;
    if (field.type === "checkbox") return el.checked;
    if (field.type === "select") {
      const opt = field.options.find((o) => String(o.value) === el.value);
      return opt ? opt.value : el.value;
    }
    return el.value.trim();
  }

  async function suggestValuesFor(tabId, key) {
    const records = await db.getRecords(tabId);
    return Array.from(new Set(records.map((r) => r[key]).filter(Boolean))).sort();
  }

  async function openRecordForm(tab, existingRecord) {
    const isEdit = !!existingRecord;
    const suggestCache = {};
    for (const f of tab.fields) {
      if (f.type === "text-suggest") suggestCache[f.key] = await suggestValuesFor(tab.id, f.key);
    }

    const bodyHtml = tab.fields
      .map((f) => {
        if (f.type === "checkbox") {
          return `<div class="form-field" data-field="${f.key}">${fieldInputHtml(f, existingRecord?.[f.key], suggestCache[f.key])}</div>`;
        }
        return `<div class="form-field" data-field="${f.key}">
          <label for="f_${f.key}">${escapeHtml(f.label)}${f.required ? " *" : ""}</label>
          ${fieldInputHtml(f, existingRecord?.[f.key], suggestCache[f.key])}
          ${f.type === "url" ? `<div class="hint">Opens in a new tab, rendered with target="_blank" rel="noopener noreferrer".</div>` : ""}
        </div>`;
      })
      .join("");

    return new Promise((resolve) => {
      openModal(
        `<div class="modal-header"><h3>${isEdit ? "Edit" : "Add"} \u2014 ${escapeHtml(tab.title)}</h3><button class="icon-btn" data-close>&times;</button></div>
         <div class="modal-body"><form id="recordForm">${bodyHtml}</form></div>
         <div class="modal-footer">
           <button class="btn" data-cancel>Cancel</button>
           <button class="btn btn-primary" data-save>${isEdit ? "Save changes" : "Add record"}</button>
         </div>`,
        {
          onMount(root) {
            const close = () => { closeModal(); resolve(null); };
            root.querySelector("[data-close]").onclick = close;
            root.querySelector("[data-cancel]").onclick = close;
            root.querySelector("[data-save]").onclick = () => {
              let valid = true;
              const data = {};
              for (const f of tab.fields) {
                const fieldWrap = root.querySelector(`[data-field="${f.key}"]`);
                fieldWrap.classList.remove("invalid");
                let v = readFieldValue(f);
                if (f.required && (v === "" || v === undefined)) {
                  valid = false;
                  fieldWrap.classList.add("invalid");
                }
                if (f.type === "url" && v && !isValidUrl(v)) {
                  valid = false;
                  fieldWrap.classList.add("invalid");
                  showToast(`"${f.label}" must be a valid http(s) URL`, "error");
                }
                data[f.key] = v === "" ? null : v;
              }
              if (!valid) return;
              closeModal();
              resolve(data);
            };
          },
        }
      );
    });
  }

  async function openDetailModal(tab, record) {
    const rows = tab.fields
      .map((f) => {
        let val = record[f.key];
        if (f.type === "checkbox") val = val ? "Yes" : "No";
        if (f.type === "url" && val) val = renderLink(val, "Open link");
        else val = escapeHtml(val ?? "\u2014");
        return `<div class="detail-row"><span class="dr-key">${escapeHtml(f.label)}</span><span class="dr-val">${val}</span></div>`;
      })
      .join("");
    openModal(
      `<div class="modal-header"><h3>${escapeHtml(record.title || record.id)}</h3><button class="icon-btn" data-close>&times;</button></div>
       <div class="modal-body"><div class="detail-list">${rows}</div></div>
       <div class="modal-footer">
         <button class="btn" data-close2>Close</button>
         <button class="btn btn-primary" data-edit>Edit</button>
       </div>`,
      {
        onMount(root) {
          root.querySelector("[data-close]").onclick = closeModal;
          root.querySelector("[data-close2]").onclick = closeModal;
          root.querySelector("[data-edit]").onclick = async () => {
            closeModal();
            await handleEdit(tab, record.id);
          };
        },
      }
    );
  }

  // ---- CRUD handlers --------------------------------------------------------
  async function handleAdd(tab) {
    const defaults = tab.type === "outline" ? { level: 2, gapAnalysis: false, revision1: false, revision2: false } :
      tab.type === "links" ? { reviewed: false } : {};
    const data = await openRecordForm(tab, defaults);
    if (!data) return;
    try {
      await db.addRecord(tab.id, data);
      showToast("Record added.", "success");
      renderTabView(tab.id);
    } catch (e) {
      showToast(`Failed to add: ${e.message}`, "error");
    }
  }

  async function handleEdit(tab, recordId) {
    const record = await db.getRecord(tab.id, recordId);
    if (!record) return showToast("Record not found (it may have been deleted).", "error");
    const data = await openRecordForm(tab, record);
    if (!data) return;
    try {
      await db.updateRecord(tab.id, recordId, data);
      showToast("Record updated.", "success");
      renderTabView(tab.id);
    } catch (e) {
      showToast(`Failed to update: ${e.message}`, "error");
    }
  }

  async function handleDelete(tab, recordId, title) {
    const ok = await confirmModal(`Delete "${title || recordId}"? This cannot be undone (but you can Reset to sheet data any time).`);
    if (!ok) return;
    try {
      await db.deleteRecord(tab.id, recordId);
      showToast("Record deleted.", "success");
      renderTabView(tab.id);
    } catch (e) {
      showToast(`Failed to delete: ${e.message}`, "error");
    }
  }

  async function handleView(tab, recordId) {
    const record = await db.getRecord(tab.id, recordId);
    if (!record) return showToast("Record not found.", "error");
    openDetailModal(tab, record);
  }

  // ---- Import / Export -------------------------------------------------------
  async function handleExport(tab, format) {
    const content = format === "csv" ? await db.exportTabCSV(tab.id) : await db.exportTabJSON(tab.id);
    if (!content) return showToast("Nothing to export yet \u2014 this tab has no records.", "info");
    downloadFile(`${tab.id}.${format}`, content, format === "csv" ? "text/csv" : "application/json");
    showToast(`Exported ${tab.title} as ${format.toUpperCase()}.`, "success");
  }

  function openImportModal(tab) {
    openModal(
      `<div class="modal-header"><h3>Import JSON \u2014 ${escapeHtml(tab.title)}</h3><button class="icon-btn" data-close>&times;</button></div>
       <div class="modal-body">
         <div class="form-field">
           <label>Choose a .json file (array of records)</label>
           <input type="file" id="importFile" accept="application/json" />
         </div>
         <div class="form-field">
           <label>...or paste JSON</label>
           <textarea id="importText" style="min-height:140px;" placeholder='[{"title":"Example topic","level":1}]'></textarea>
         </div>
         <div class="form-field">
           <label>Mode</label>
           <select id="importMode">
             <option value="merge">Merge (add to existing records)</option>
             <option value="replace">Replace (overwrite this tab entirely)</option>
           </select>
         </div>
       </div>
       <div class="modal-footer">
         <button class="btn" data-cancel>Cancel</button>
         <button class="btn btn-primary" data-import>Import</button>
       </div>`,
      {
        onMount(root) {
          const fileInput = root.querySelector("#importFile");
          const textArea = root.querySelector("#importText");
          fileInput.addEventListener("change", () => {
            const file = fileInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => { textArea.value = reader.result; };
            reader.readAsText(file);
          });
          root.querySelector("[data-close]").onclick = closeModal;
          root.querySelector("[data-cancel]").onclick = closeModal;
          root.querySelector("[data-import]").onclick = async () => {
            try {
              const mode = root.querySelector("#importMode").value;
              const result = await db.importTabJSON(tab.id, textArea.value, mode);
              closeModal();
              showToast(`Imported ${result.imported} record(s).`, "success");
              renderTabView(tab.id);
            } catch (e) {
              showToast(`Import failed: ${e.message}`, "error");
            }
          };
        },
      }
    );
  }

  async function handleResetSeed(tab) {
    const ok = await confirmModal(`Reset "${tab.title}" back to the original sheet-derived data? Any local edits to this tab will be lost.`, { confirmLabel: "Reset", danger: true });
    if (!ok) return;
    await db.resetTabToSeed(tab.id);
    showToast("Tab reset to sheet-derived data.", "success");
    renderTabView(tab.id);
  }

  // ---- Sorting / filtering helpers -------------------------------------------
  function applySort(records, sortKey, sortDir) {
    if (!sortKey) return records;
    const dir = sortDir === "desc" ? -1 : 1;
    return [...records].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "boolean" || typeof bv === "boolean") return (av === bv ? 0 : av ? 1 : -1) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" }) * dir;
    });
  }

  function applyTextFilter(records, query) {
    const q = (query || "").trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      Object.values(r)
        .filter((v) => typeof v === "string" || typeof v === "number")
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  // ---- View: Home dashboard ---------------------------------------------------
  async function renderHome() {
    setActiveNav("home");
    $main.innerHTML = renderLoading("Loading dashboard\u2026");
    const counts = {};
    let total = 0;
    for (const tab of TABS) {
      const records = await db.getRecords(tab.id);
      counts[tab.id] = records.length;
      total += records.length;
    }
    const cards = TABS.map((tab) => {
      return `<a class="tab-card" href="#/tab/${tab.id}">
        <div class="tc-top"><span class="tc-icon">${tab.icon}</span><span class="tc-title">${escapeHtml(tab.title)}</span></div>
        <div class="tc-desc">${escapeHtml(tab.description)}</div>
        <div class="tc-footer">
          <span>Sheet tab: <strong>${escapeHtml(tab.sheetTab)}</strong></span>
          ${tab.type !== "about" ? `<span class="tc-badge">${counts[tab.id]} record${counts[tab.id] === 1 ? "" : "s"}</span>` : `<span class="tc-badge">Guide</span>`}
        </div>
      </a>`;
    }).join("");

    $main.innerHTML = `
      <div class="home-hero">
        <h1>Microregistrar Study Tracker</h1>
        <p>A single-page admin dashboard generated from the "Microregistrar moodlecloud" Google Sheet. Every original sheet tab is one linked section below \u2014 browse, search, add, edit and delete records, and export/import per tab.</p>
        <div class="hero-stats">
          <div class="hero-stat"><div class="hs-value">${TABS.length}</div><div class="hs-label">Sheet tabs</div></div>
          <div class="hero-stat"><div class="hs-value">${total}</div><div class="hs-label">Total records</div></div>
          <div class="hero-stat"><div class="hs-value">Local</div><div class="hs-label">Storage mode (see README)</div></div>
        </div>
      </div>
      <div class="section-heading"><h2>All spreadsheet tabs</h2><span class="muted">Click a card, or use the sidebar / global search</span></div>
      <div class="card-grid">${cards}</div>
    `;
  }

  function renderLoading(msg) {
    return `<div class="state-panel"><div class="spinner"></div><div class="sp-title">${escapeHtml(msg)}</div></div>`;
  }
  function renderError(msg) {
    return `<div class="state-panel"><div class="sp-icon">\u26A0\uFE0F</div><div class="sp-title">Something went wrong</div><div class="sp-desc">${escapeHtml(msg)}</div>
      <button class="btn btn-primary" onclick="location.reload()">Reload app</button></div>`;
  }
  function renderEmpty(tab) {
    return `<div class="state-panel">
      <div class="sp-icon">${tab.icon}</div>
      <div class="sp-title">No records yet in ${escapeHtml(tab.title)}</div>
      <div class="sp-desc">${tab.id === "curriculum" ? "This tab was empty in the source spreadsheet too \u2014 it's ready for future curriculum content." : "Try clearing filters, or add the first record."}</div>
      ${tab.type !== "about" ? `<button class="btn btn-primary" data-empty-add>+ Add the first record</button>` : ""}
    </div>`;
  }

  // ---- View: page header + toolbar shared markup -------------------------
  function pageHeaderHtml(tab, recordCount) {
    return `
      <div class="breadcrumb"><a href="#/home">Home</a> / ${escapeHtml(tab.title)}</div>
      <div class="page-header">
        <div>
          <div class="ph-title"><span>${tab.icon}</span><span>${escapeHtml(tab.title)}</span></div>
          <div class="ph-desc">${escapeHtml(tab.description)} <span style="opacity:.7">(source sheet tab: <strong>${escapeHtml(tab.sheetTab)}</strong>${recordCount !== undefined ? `, ${recordCount} record${recordCount === 1 ? "" : "s"}` : ""})</span></div>
        </div>
        <div class="page-actions" id="pageActions"></div>
      </div>`;
  }

  function commonPageActionsHtml(tab) {
    return `
      <button class="btn" data-action="export-csv">\u2B07\uFE0E Export CSV</button>
      <button class="btn" data-action="export-json">\u2B07\uFE0E Export JSON</button>
      <button class="btn" data-action="import-json">\u2B06\uFE0E Import JSON</button>
      <button class="btn" data-action="reset-seed">\u21BA Reset to sheet data</button>
      <button class="btn btn-primary" data-action="add">+ Add record</button>
    `;
  }

  function wireCommonPageActions(tab) {
    document.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-action");
        if (action === "export-csv") handleExport(tab, "csv");
        if (action === "export-json") handleExport(tab, "json");
        if (action === "import-json") openImportModal(tab);
        if (action === "reset-seed") handleResetSeed(tab);
        if (action === "add") handleAdd(tab);
      });
    });
  }

  // ---- View: outline-type tab (checklist tabs) --------------------------------
  async function renderOutlineTab(tab) {
    const ts = tableStateFor(tab.id);
    $main.innerHTML = pageHeaderHtml(tab) + renderLoading(`Loading ${tab.title}\u2026`);
    let records;
    try {
      records = await db.getRecords(tab.id);
    } catch (e) {
      $main.innerHTML = pageHeaderHtml(tab) + renderError(e.message);
      return;
    }

    const total = records.length;
    let filtered = applyTextFilter(records, ts.query);
    if (ts.filters.gapAnalysis) filtered = filtered.filter((r) => String(!!r.gapAnalysis) === ts.filters.gapAnalysis);
    if (ts.filters.revision1) filtered = filtered.filter((r) => String(!!r.revision1) === ts.filters.revision1);
    if (ts.filters.revision2) filtered = filtered.filter((r) => String(!!r.revision2) === ts.filters.revision2);
    filtered = applySort(filtered, ts.sortKey, ts.sortDir);

    const toolbarHtml = `
      <div class="toolbar">
        <input type="search" id="localSearch" placeholder="Filter ${escapeHtml(tab.title)} records\u2026" value="${escapeHtml(ts.query)}" />
        <select id="filterGap"><option value="">Gap analysis: All</option><option value="true" ${ts.filters.gapAnalysis === "true" ? "selected" : ""}>Flagged</option><option value="false" ${ts.filters.gapAnalysis === "false" ? "selected" : ""}>Not flagged</option></select>
        <select id="filterRev1"><option value="">Revision 1: All</option><option value="true" ${ts.filters.revision1 === "true" ? "selected" : ""}>Complete</option><option value="false" ${ts.filters.revision1 === "false" ? "selected" : ""}>Incomplete</option></select>
        <select id="filterRev2"><option value="">Revision 2: All</option><option value="true" ${ts.filters.revision2 === "true" ? "selected" : ""}>Complete</option><option value="false" ${ts.filters.revision2 === "false" ? "selected" : ""}>Incomplete</option></select>
        <span class="toolbar-label">${filtered.length} / ${total} shown</span>
      </div>`;

    let bodyHtml;
    if (!total) {
      bodyHtml = renderEmpty(tab);
    } else if (!filtered.length) {
      bodyHtml = `<div class="state-panel"><div class="sp-icon">\u{1F50E}</div><div class="sp-title">No records match your filters</div><div class="sp-desc">Try clearing the search box or filters above.</div></div>`;
    } else {
      const sortArrow = (key) => (ts.sortKey === key ? (ts.sortDir === "asc" ? "\u25B2" : "\u25BC") : "");
      bodyHtml = `<div class="table-wrap"><table class="data-table">
        <thead><tr>
          <th class="sortable" data-sort="title">Topic <span class="sort-arrow">${sortArrow("title")}</span></th>
          <th class="sortable" data-sort="date">Last revised <span class="sort-arrow">${sortArrow("date")}</span></th>
          <th class="sortable" data-sort="gapAnalysis">Gap analysis <span class="sort-arrow">${sortArrow("gapAnalysis")}</span></th>
          <th class="sortable" data-sort="revision1">Revision 1 <span class="sort-arrow">${sortArrow("revision1")}</span></th>
          <th class="sortable" data-sort="revision2">Revision 2 <span class="sort-arrow">${sortArrow("revision2")}</span></th>
          <th>Link</th>
          <th class="col-actions">Actions</th>
        </tr></thead>
        <tbody>
          ${filtered.map((r) => `
            <tr data-id="${escapeHtml(r.id)}" class="row-level-${r.level || 1}">
              <td><div class="record-title-cell"><span class="rt-text">${escapeHtml(r.title)}</span></div></td>
              <td>${fmtDate(r.date)}</td>
              <td>${r.gapAnalysis ? `<span class="pill pill-warn">\u26A0 Flagged</span>` : `<span class="pill pill-no">\u2014</span>`}</td>
              <td>${boolPill(r.revision1)}</td>
              <td>${boolPill(r.revision2)}</td>
              <td>${r.link ? renderLink(r.link, "Open") : "\u2014"}</td>
              <td class="col-actions">
                <button class="btn btn-sm" data-view="${escapeHtml(r.id)}">View</button>
                <button class="btn btn-sm" data-edit="${escapeHtml(r.id)}">Edit</button>
                <button class="btn btn-sm btn-danger" data-del="${escapeHtml(r.id)}">Delete</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table></div>`;
    }

    $main.innerHTML = pageHeaderHtml(tab, total) + toolbarHtml + bodyHtml;
    document.getElementById("pageActions").innerHTML = commonPageActionsHtml(tab);
    wireCommonPageActions(tab);
    wireOutlineToolbar(tab, ts);
    wireRowActions(tab);
    maybeFlashHighlight();
    const emptyAddBtn = document.querySelector("[data-empty-add]");
    if (emptyAddBtn) emptyAddBtn.onclick = () => handleAdd(tab);
  }

  function wireOutlineToolbar(tab, ts) {
    const search = document.getElementById("localSearch");
    search.addEventListener("input", debounce((e) => { ts.query = e.target.value; renderOutlineTab(tab); }, 220));
    document.getElementById("filterGap").addEventListener("change", (e) => { ts.filters.gapAnalysis = e.target.value; renderOutlineTab(tab); });
    document.getElementById("filterRev1").addEventListener("change", (e) => { ts.filters.revision1 = e.target.value; renderOutlineTab(tab); });
    document.getElementById("filterRev2").addEventListener("change", (e) => { ts.filters.revision2 = e.target.value; renderOutlineTab(tab); });
    document.querySelectorAll("th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort");
        if (ts.sortKey === key) ts.sortDir = ts.sortDir === "asc" ? "desc" : "asc";
        else { ts.sortKey = key; ts.sortDir = "asc"; }
        renderOutlineTab(tab);
      });
    });
  }

  // ---- View: links-type tab (Interactive HYN) --------------------------------
  async function renderLinksTab(tab) {
    const ts = tableStateFor(tab.id);
    $main.innerHTML = pageHeaderHtml(tab) + renderLoading(`Loading ${tab.title}\u2026`);
    let records;
    try {
      records = await db.getRecords(tab.id);
    } catch (e) {
      $main.innerHTML = pageHeaderHtml(tab) + renderError(e.message);
      return;
    }
    const total = records.length;
    const groups = Array.from(new Set(records.map((r) => r.group).filter(Boolean))).sort();
    let filtered = applyTextFilter(records, ts.query);
    if (ts.filters.group) filtered = filtered.filter((r) => r.group === ts.filters.group);
    if (ts.filters.reviewed) filtered = filtered.filter((r) => String(!!r.reviewed) === ts.filters.reviewed);
    filtered = applySort(filtered, ts.sortKey || "group", ts.sortDir);

    const toolbarHtml = `
      <div class="toolbar">
        <input type="search" id="localSearch" placeholder="Filter links\u2026" value="${escapeHtml(ts.query)}" />
        <select id="filterGroup"><option value="">Group: All</option>${groups.map((g) => `<option value="${escapeHtml(g)}" ${ts.filters.group === g ? "selected" : ""}>${escapeHtml(g)}</option>`).join("")}</select>
        <select id="filterReviewed"><option value="">Reviewed: All</option><option value="true" ${ts.filters.reviewed === "true" ? "selected" : ""}>Reviewed</option><option value="false" ${ts.filters.reviewed === "false" ? "selected" : ""}>Not reviewed</option></select>
        <span class="toolbar-label">${filtered.length} / ${total} shown</span>
      </div>`;

    let bodyHtml;
    if (!total) bodyHtml = renderEmpty(tab);
    else if (!filtered.length) bodyHtml = `<div class="state-panel"><div class="sp-icon">\u{1F50E}</div><div class="sp-title">No links match your filters</div></div>`;
    else {
      const sortArrow = (key) => (ts.sortKey === key ? (ts.sortDir === "asc" ? "\u25B2" : "\u25BC") : "");
      bodyHtml = `<div class="table-wrap"><table class="data-table">
        <thead><tr>
          <th class="sortable" data-sort="group">Group ${sortArrow("group")}</th>
          <th class="sortable" data-sort="title">Topic ${sortArrow("title")}</th>
          <th>Link</th>
          <th class="sortable" data-sort="date">Date updated ${sortArrow("date")}</th>
          <th class="sortable" data-sort="reviewed">Reviewed ${sortArrow("reviewed")}</th>
          <th class="col-actions">Actions</th>
        </tr></thead>
        <tbody>
          ${filtered.map((r) => `
            <tr data-id="${escapeHtml(r.id)}">
              <td>${escapeHtml(r.group || "\u2014")}</td>
              <td>${escapeHtml(r.title)}</td>
              <td>${r.link ? renderLink(r.link, "Open resource") : "\u2014"}</td>
              <td>${fmtDate(r.date)}</td>
              <td>${boolPill(r.reviewed)}</td>
              <td class="col-actions">
                <button class="btn btn-sm" data-view="${escapeHtml(r.id)}">View</button>
                <button class="btn btn-sm" data-edit="${escapeHtml(r.id)}">Edit</button>
                <button class="btn btn-sm btn-danger" data-del="${escapeHtml(r.id)}">Delete</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table></div>`;
    }

    $main.innerHTML = pageHeaderHtml(tab, total) + toolbarHtml + bodyHtml;
    document.getElementById("pageActions").innerHTML = commonPageActionsHtml(tab);
    wireCommonPageActions(tab);
    document.getElementById("localSearch").addEventListener("input", debounce((e) => { ts.query = e.target.value; renderLinksTab(tab); }, 220));
    document.getElementById("filterGroup").addEventListener("change", (e) => { ts.filters.group = e.target.value; renderLinksTab(tab); });
    document.getElementById("filterReviewed").addEventListener("change", (e) => { ts.filters.reviewed = e.target.value; renderLinksTab(tab); });
    document.querySelectorAll("th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort");
        if (ts.sortKey === key) ts.sortDir = ts.sortDir === "asc" ? "desc" : "asc";
        else { ts.sortKey = key; ts.sortDir = "asc"; }
        renderLinksTab(tab);
      });
    });
    wireRowActions(tab);
    maybeFlashHighlight();
    const emptyAddBtn = document.querySelector("[data-empty-add]");
    if (emptyAddBtn) emptyAddBtn.onclick = () => handleAdd(tab);
  }

  // ---- View: index-type tab (INDEX sheet) -------------------------------------
  async function renderIndexTab(tab) {
    const ts = tableStateFor(tab.id);
    $main.innerHTML = pageHeaderHtml(tab) + renderLoading(`Loading ${tab.title}\u2026`);
    let records;
    try {
      records = await db.getRecords(tab.id);
    } catch (e) {
      $main.innerHTML = pageHeaderHtml(tab) + renderError(e.message);
      return;
    }
    const total = records.length;
    const sections = Array.from(new Set(records.map((r) => r.section).filter(Boolean))).sort();
    let filtered = applyTextFilter(records, ts.query);
    if (ts.filters.section) filtered = filtered.filter((r) => r.section === ts.filters.section);
    filtered = applySort(filtered, ts.sortKey || "section", ts.sortDir);

    const toolbarHtml = `
      <div class="toolbar">
        <input type="search" id="localSearch" placeholder="Filter index & resources\u2026" value="${escapeHtml(ts.query)}" />
        <select id="filterSection"><option value="">Section: All</option>${sections.map((s) => `<option value="${escapeHtml(s)}" ${ts.filters.section === s ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}</select>
        <span class="toolbar-label">${filtered.length} / ${total} shown</span>
      </div>`;

    let bodyHtml;
    if (!total) bodyHtml = renderEmpty(tab);
    else if (!filtered.length) bodyHtml = `<div class="state-panel"><div class="sp-icon">\u{1F50E}</div><div class="sp-title">No entries match your filters</div></div>`;
    else {
      const sortArrow = (key) => (ts.sortKey === key ? (ts.sortDir === "asc" ? "\u25B2" : "\u25BC") : "");
      bodyHtml = `<div class="table-wrap"><table class="data-table">
        <thead><tr>
          <th class="sortable" data-sort="section">Section ${sortArrow("section")}</th>
          <th class="sortable" data-sort="title">Label ${sortArrow("title")}</th>
          <th class="sortable" data-sort="date">Date ${sortArrow("date")}</th>
          <th>Link</th>
          <th class="col-actions">Actions</th>
        </tr></thead>
        <tbody>
          ${filtered.map((r) => `
            <tr data-id="${escapeHtml(r.id)}">
              <td>${escapeHtml(r.section || "\u2014")}</td>
              <td>${escapeHtml(r.title)}</td>
              <td>${fmtDate(r.date)}</td>
              <td>${r.link ? renderLink(r.link, "Open") : "\u2014"}</td>
              <td class="col-actions">
                <button class="btn btn-sm" data-view="${escapeHtml(r.id)}">View</button>
                <button class="btn btn-sm" data-edit="${escapeHtml(r.id)}">Edit</button>
                <button class="btn btn-sm btn-danger" data-del="${escapeHtml(r.id)}">Delete</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table></div>`;
    }

    $main.innerHTML = pageHeaderHtml(tab, total) + toolbarHtml + bodyHtml;
    document.getElementById("pageActions").innerHTML = commonPageActionsHtml(tab);
    wireCommonPageActions(tab);
    document.getElementById("localSearch").addEventListener("input", debounce((e) => { ts.query = e.target.value; renderIndexTab(tab); }, 220));
    document.getElementById("filterSection").addEventListener("change", (e) => { ts.filters.section = e.target.value; renderIndexTab(tab); });
    document.querySelectorAll("th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort");
        if (ts.sortKey === key) ts.sortDir = ts.sortDir === "asc" ? "desc" : "asc";
        else { ts.sortKey = key; ts.sortDir = "asc"; }
        renderIndexTab(tab);
      });
    });
    wireRowActions(tab);
    maybeFlashHighlight();
    const emptyAddBtn = document.querySelector("[data-empty-add]");
    if (emptyAddBtn) emptyAddBtn.onclick = () => handleAdd(tab);
  }

  // ---- View: about-type tab (Search) -----------------------------------------
  function renderAboutTab(tab) {
    $main.innerHTML = pageHeaderHtml(tab) + `
      <div class="info-card">
        <h3>What this tab used to do</h3>
        <p>In the original spreadsheet, the <strong>Search</strong> tab held a small Apps-Script-powered lookup box: you typed a keyword into a highlighted cell, waited a few seconds, and it returned matching sheet name / row / column / cell content, with an "Open topic" link back into that cell.</p>
      </div>
      <div class="info-card">
        <h3>How it works in this app instead</h3>
        <p>The search bar at the top of every page searches <strong>all ${TABS.length} tabs instantly</strong>, client-side, as you type &mdash; no script execution delay. Results show which tab each match came from and jump straight to it.</p>
        <p>Every tab view also has its own local filter box for narrowing just that table (by topic, group, section, date, link, etc.), plus column sorting and status filters (Gap analysis / Revision 1 / Revision 2 / Reviewed).</p>
      </div>
      <div class="info-card">
        <h3>Try it</h3>
        <p>Use the search box at the top of the screen now &mdash; try "meningitis", "candida" or "hepatitis".</p>
      </div>
    `;
  }

  function wireRowActions(tab) {
    document.querySelectorAll("[data-view]").forEach((btn) => btn.addEventListener("click", () => handleView(tab, btn.getAttribute("data-view"))));
    document.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => handleEdit(tab, btn.getAttribute("data-edit"))));
    document.querySelectorAll("[data-del]").forEach((btn) => btn.addEventListener("click", () => {
      const row = btn.closest("tr");
      const title = row ? row.querySelector("td")?.textContent : "";
      handleDelete(tab, btn.getAttribute("data-del"), title);
    }));
  }

  let pendingHighlightId = null;
  function maybeFlashHighlight() {
    if (!pendingHighlightId) return;
    const row = document.querySelector(`tr[data-id="${pendingHighlightId}"]`);
    if (row) {
      row.classList.add("flash-highlight");
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    pendingHighlightId = null;
  }

  // ---- Router --------------------------------------------------------------
  function renderTabView(tabId) {
    const tab = getTab(tabId);
    if (!tab) return renderNotFound();
    setActiveNav(tabId);
    if (tab.type === "outline") return renderOutlineTab(tab);
    if (tab.type === "links") return renderLinksTab(tab);
    if (tab.type === "index") return renderIndexTab(tab);
    if (tab.type === "about") return renderAboutTab(tab);
  }

  function renderNotFound() {
    $main.innerHTML = `<div class="state-panel"><div class="sp-icon">\u2753</div><div class="sp-title">Page not found</div><div class="sp-desc">That tab doesn't exist.</div><a class="btn btn-primary" href="#/home">Back to Home</a></div>`;
  }

  function setActiveNav(routeId) {
    document.querySelectorAll(".nav-link").forEach((a) => a.classList.toggle("active", a.getAttribute("data-route") === routeId));
  }

  function handleRoute() {
    closeModal();
    const hash = window.location.hash || "#/home";
    const parts = hash.replace(/^#\//, "").split("/");
    if (parts[0] === "tab" && parts[1]) {
      renderTabView(parts[1]);
    } else {
      renderHome();
    }
    closeSidebarOnMobile();
  }

  // ---- Sidebar build ----------------------------------------------------------
  function buildSidebar() {
    $sidebarTabs.innerHTML = TABS.map(
      (tab) => `<a class="nav-link" data-route="${tab.id}" href="#/tab/${tab.id}"><span class="nl-icon">${tab.icon}</span><span>${escapeHtml(tab.shortTitle)}</span></a>`
    ).join("");
  }

  function closeSidebarOnMobile() {
    $sidebar.classList.remove("open");
    $sidebarOverlay.classList.remove("open");
  }

  // ---- Global search ------------------------------------------------------
  async function runGlobalSearch(query) {
    const q = query.trim();
    if (!q) {
      $globalSearchResults.hidden = true;
      $globalSearchResults.innerHTML = "";
      return;
    }
    const results = await db.searchAll(q, 25);
    if (!results.length) {
      $globalSearchResults.innerHTML = `<div class="search-result-empty">No matches for "${escapeHtml(q)}"</div>`;
    } else {
      $globalSearchResults.innerHTML =
        `<div class="sr-meta">${results.length} match${results.length === 1 ? "" : "es"}</div>` +
        results
          .map(({ tabId, record }) => {
            const tab = getTab(tabId);
            if (!tab) return "";
            const label = record.title || record.id;
            return `<div class="search-result-item" data-goto="${tabId}" data-record="${escapeHtml(record.id)}">
              <span class="sr-icon">${tab.icon}</span>
              <div><div class="sr-title">${escapeHtml(label)}</div><div class="sr-tab">${escapeHtml(tab.title)}</div></div>
            </div>`;
          })
          .join("");
    }
    $globalSearchResults.hidden = false;
    document.querySelectorAll(".search-result-item").forEach((item) => {
      item.addEventListener("click", () => {
        pendingHighlightId = item.getAttribute("data-record");
        window.location.hash = `#/tab/${item.getAttribute("data-goto")}`;
        $globalSearchResults.hidden = true;
        $globalSearchInput.blur();
      });
    });
  }

  function wireGlobalSearch() {
    $globalSearchInput.addEventListener("input", debounce((e) => runGlobalSearch(e.target.value), 180));
    $globalSearchInput.addEventListener("focus", () => { if ($globalSearchInput.value.trim()) $globalSearchResults.hidden = false; });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".global-search")) $globalSearchResults.hidden = true;
    });
  }

  // ---- Theme + sidebar toggle ------------------------------------------------
  function initTheme() {
    const saved = window.localStorage.getItem("theme");
    const theme = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
    updateThemeButton(theme);
    document.getElementById("themeToggle").addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      window.localStorage.setItem("theme", next);
      updateThemeButton(next);
    });
  }
  function updateThemeButton(theme) {
    document.getElementById("themeToggle").textContent = theme === "dark" ? "\u2600\uFE0F" : "\u{1F319}";
  }

  function initSidebarToggle() {
    document.getElementById("sidebarToggle").addEventListener("click", () => {
      $sidebar.classList.toggle("open");
      $sidebarOverlay.classList.toggle("open");
    });
    $sidebarOverlay.addEventListener("click", closeSidebarOnMobile);
  }

  // ---- Boot ------------------------------------------------------------------
  async function boot() {
    try {
      await db.init();
    } catch (e) {
      $main.innerHTML = renderError(`Could not initialize data layer: ${e.message}`);
      return;
    }
    buildSidebar();
    initTheme();
    initSidebarToggle();
    wireGlobalSearch();
    window.addEventListener("hashchange", handleRoute);
    handleRoute();
  }

  boot();
})();
