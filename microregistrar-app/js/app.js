/**
 * Microregistrar Moodlecloud — UI Controller
 */

const App = (() => {
  let currentSheet = null;
  let sortCol = null;
  let sortDir = 'asc';
  let filterGap = '';
  let filterText = '';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const SHEET_ICONS = {
    'INDEX': '🏠', 'Search': '🔍', 'Interactive HYN': '📚',
    'Infection': '🦠', 'Antibiotic': '💊', 'Bacteria': '🔬',
    'Mycology': '🍄', 'Virology': '🧬', 'Parasitology': '🪱',
    'Lab': '🧪', 'Transplant': '🫁', 'IPC': '🛡️',
    'Vaccine': '💉', 'Statistics': '📊', 'HYN': '📝',
    'Curriculum': '📋'
  };

  const SHEET_DESCRIPTIONS = {
    'INDEX': 'Navigation hub linking to all sections, external resources, and what\'s new',
    'Search': 'Cross-sheet keyword search results',
    'Interactive HYN': 'High Yield Notes — interactive topic directory grouped by subject',
    'Infection': 'Infection topics with gap analysis and revision tracking',
    'Antibiotic': 'Antibiotic topics with gap analysis and revision tracking',
    'Bacteria': 'Bacteriology topics with gap analysis and revision tracking',
    'Mycology': 'Mycology topics with gap analysis and revision tracking',
    'Virology': 'Virology topics with gap analysis and revision tracking',
    'Parasitology': 'Parasitology topics with gap analysis and revision tracking',
    'Lab': 'Laboratory microbiology topics with gap analysis',
    'Transplant': 'Transplant microbiology topics with gap analysis',
    'IPC': 'Infection prevention & control topics',
    'Vaccine': 'Vaccine topics with gap analysis',
    'Statistics': 'Statistics topics with gap analysis',
    'HYN': 'High Yield Notes — topic directory',
    'Curriculum': 'Curriculum mapping (empty)'
  };

  /* ── Init ───────────────────────────────────────────────────── */

  async function init() {
    applyTheme();
    showLoading();

    try {
      await DataStore.init();
      buildSidebar();
      bindGlobalEvents();
      route();
    } catch (err) {
      showError('Failed to load data: ' + err.message);
    }
  }

  function applyTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  }

  /* ── Routing ────────────────────────────────────────────────── */

  function route() {
    const hash = location.hash.slice(1) || 'dashboard';
    const [view, param] = hash.split('/');

    $$('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.sheet === param || (view === 'dashboard' && el.dataset.sheet === 'dashboard'));
    });

    if (view === 'dashboard') return renderDashboard();
    if (view === 'sheet' && param) return renderSheet(param);
    if (view === 'search') return renderSearchResults(param);
    renderDashboard();
  }

  window.addEventListener('hashchange', route);

  /* ── Sidebar ────────────────────────────────────────────────── */

  function buildSidebar() {
    const nav = $('#sidebar-nav');
    const sheets = DataStore.getSheets();

    let html = `<a class="nav-item" data-sheet="dashboard" href="#dashboard">
      <span>🏠</span> Dashboard
    </a>`;

    for (const s of sheets) {
      const icon = SHEET_ICONS[s.name] || '📄';
      html += `<a class="nav-item" data-sheet="${s.name}" href="#sheet/${encodeURIComponent(s.name)}">
        <span>${icon}</span> ${esc(s.name)}
        <span class="badge">${s.recordCount}</span>
      </a>`;
    }

    nav.innerHTML = html;
  }

  /* ── Dashboard ──────────────────────────────────────────────── */

  function renderDashboard() {
    currentSheet = null;
    const sheets = DataStore.getSheets();
    const totalRecords = sheets.reduce((sum, s) => sum + s.recordCount, 0);

    $('#page-content').innerHTML = `
      <div class="page-header">
        <div>
          <h1>Microregistrar Moodlecloud</h1>
          <p class="subtitle">${sheets.length} sections · ${totalRecords} records · Spreadsheet directory</p>
        </div>
      </div>
      <div class="dashboard-grid">
        ${sheets.map(s => `
          <div class="card" onclick="location.hash='#sheet/${encodeURIComponent(s.name)}'">
            <div class="card-title">${SHEET_ICONS[s.name] || '📄'} ${esc(s.name)}</div>
            <div class="card-desc">${esc(SHEET_DESCRIPTIONS[s.name] || s.schema.type)}</div>
            <div class="card-meta">
              <span>${s.recordCount} records</span>
              <span>${s.schema.type}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /* ── Sheet View ─────────────────────────────────────────────── */

  function renderSheet(name) {
    currentSheet = name;
    const sheet = DataStore.getSheet(name);
    const cols = sheet.schema.columns;

    if (!cols.length) {
      $('#page-content').innerHTML = `
        <div class="page-header"><h1>${esc(name)}</h1></div>
        <div class="empty"><div class="empty-icon">📋</div><p>This section is empty. Add your first record to get started.</p>
          <button class="btn btn-primary" style="margin-top:12px" onclick="App.openModal('add')">+ Add Record</button>
        </div>`;
      return;
    }

    let records = [...sheet.records];

    if (filterText) {
      const q = filterText.toLowerCase();
      records = records.filter(r => Object.values(r).some(v => v && String(v).toLowerCase().includes(q)));
    }
    if (filterGap) {
      records = records.filter(r => r.gap_analysis === filterGap);
    }

    if (sortCol) {
      records.sort((a, b) => {
        const av = a[sortCol], bv = b[sortCol];
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = typeof av === 'boolean' ? (av === bv ? 0 : av ? -1 : 1) : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    const hasGapFilter = cols.some(c => c.key === 'gap_analysis');

    $('#page-content').innerHTML = `
      <div class="page-header">
        <div>
          <h1>${SHEET_ICONS[name] || '📄'} ${esc(name)}</h1>
          <p class="subtitle">${records.length} of ${sheet.recordCount} records</p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn" onclick="App.exportSheet('${esc(name)}')">Export CSV</button>
          <button class="btn btn-primary" onclick="App.openModal('add')">+ Add Record</button>
        </div>
      </div>
      <div class="filters-bar">
        <input type="text" placeholder="Filter records…" value="${esc(filterText)}"
          oninput="App.setFilter(this.value)" style="min-width:200px">
        ${hasGapFilter ? `
          <select onchange="App.setGapFilter(this.value)">
            <option value="">All gap statuses</option>
            <option value="Not confident" ${filterGap === 'Not confident' ? 'selected' : ''}>Not confident</option>
            <option value="need more revision" ${filterGap === 'need more revision' ? 'selected' : ''}>Need more revision</option>
            <option value="Exam ready" ${filterGap === 'Exam ready' ? 'selected' : ''}>Exam ready</option>
          </select>
        ` : ''}
      </div>
      ${records.length === 0 ? `
        <div class="empty"><div class="empty-icon">📭</div><p>No records match your filters.</p></div>
      ` : `
        <div class="table-wrap">
          <table>
            <thead><tr>
              ${cols.map(c => `
                <th class="${sortCol === c.key ? 'sorted' : ''}" onclick="App.sort('${c.key}')">
                  ${esc(c.label)}<span class="sort-icon">${sortCol === c.key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                </th>
              `).join('')}
              <th>Actions</th>
            </tr></thead>
            <tbody>
              ${records.map(r => `<tr>
                ${cols.map(c => `<td>${renderCell(r, c)}</td>`).join('')}
                <td class="actions">
                  <button class="btn btn-sm" onclick="App.openModal('edit','${r.id}')">Edit</button>
                  <button class="btn btn-sm btn-danger" onclick="App.confirmDelete('${r.id}')">Delete</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;
  }

  function renderCell(record, col) {
    const val = record[col.key];
    if (val == null || val === '') return '<span style="opacity:.3">—</span>';

    if (col.type === 'url' && val) {
      const display = val.length > 50 ? val.slice(0, 50) + '…' : val;
      return `<span class="link-cell"><a href="${esc(val)}" target="_blank" rel="noopener noreferrer">${esc(display)}</a></span>`;
    }
    if (col.type === 'boolean') {
      return val ? '<span class="check-yes">✓</span>' : '<span class="check-no">✗</span>';
    }
    if (col.key === 'gap_analysis') {
      const cls = val === 'Exam ready' ? 'badge-exam-ready' : val === 'need more revision' ? 'badge-need-revision' : 'badge-not-confident';
      return `<span class="badge-status ${cls}">${esc(val)}</span>`;
    }
    return esc(String(val));
  }

  /* ── Search ─────────────────────────────────────────────────── */

  function renderSearchResults(query) {
    const results = DataStore.search(query);
    $('#page-content').innerHTML = `
      <div class="page-header">
        <h1>Search: "${esc(query)}"</h1>
        <p class="subtitle">${results.length} result${results.length !== 1 ? 's' : ''}</p>
      </div>
      ${results.length === 0 ? `
        <div class="empty"><div class="empty-icon">🔍</div><p>No results found for "${esc(query)}"</p></div>
      ` : `
        <div class="table-wrap search-results">
          ${results.map(r => `
            <div class="search-result-item" onclick="location.hash='#sheet/${encodeURIComponent(r.sheetName)}'">
              <div class="result-sheet">${esc(r.sheetName)}</div>
              <div class="result-text">${highlightMatch(r.record, query)}</div>
            </div>
          `).join('')}
        </div>
      `}
    `;
  }

  function highlightMatch(record, query) {
    const parts = Object.entries(record)
      .filter(([k, v]) => k !== 'id' && v != null && String(v).trim())
      .map(([k, v]) => {
        const text = String(v);
        const idx = text.toLowerCase().indexOf(query.toLowerCase());
        if (idx === -1) return `${k}: ${esc(text)}`;
        const before = esc(text.slice(0, idx));
        const match = esc(text.slice(idx, idx + query.length));
        const after = esc(text.slice(idx + query.length));
        return `${k}: ${before}<mark>${match}</mark>${after}`;
      });
    return parts.join(' · ');
  }

  /* ── Modal (Add / Edit) ─────────────────────────────────────── */

  function openModal(mode, recordId) {
    const sheet = DataStore.getSheet(currentSheet);
    const cols = sheet.schema.columns;
    const record = mode === 'edit' ? DataStore.getRecord(currentSheet, recordId) : {};

    const fields = cols.map(col => {
      const val = record[col.key];
      let input;

      if (col.type === 'enum') {
        input = `<select name="${col.key}" id="field-${col.key}">
          <option value="">— Select —</option>
          ${col.options.map(o => `<option value="${esc(o)}" ${val === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
        </select>`;
      } else if (col.type === 'boolean') {
        input = `<div class="checkbox-row">
          <input type="checkbox" name="${col.key}" id="field-${col.key}" ${val ? 'checked' : ''}>
          <label for="field-${col.key}">${esc(col.label)}</label>
        </div>`;
      } else if (col.type === 'url') {
        input = `<input type="url" name="${col.key}" id="field-${col.key}" value="${esc(val || '')}" placeholder="https://…">`;
      } else if (col.type === 'date') {
        input = `<input type="date" name="${col.key}" id="field-${col.key}" value="${esc(val || '')}">`;
      } else if (col.type === 'number') {
        input = `<input type="number" name="${col.key}" id="field-${col.key}" value="${esc(val ?? '')}">`;
      } else {
        input = `<input type="text" name="${col.key}" id="field-${col.key}" value="${esc(val || '')}">`;
      }

      if (col.type === 'boolean') {
        return `<div class="form-group">${input}</div>`;
      }
      return `<div class="form-group"><label for="field-${col.key}">${esc(col.label)}</label>${input}</div>`;
    }).join('');

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2>${mode === 'add' ? 'Add' : 'Edit'} Record — ${esc(currentSheet)}</h2>
          <button class="modal-close" onclick="App.closeModal()">&times;</button>
        </div>
        <form id="record-form" onsubmit="App.saveRecord(event, '${mode}', '${recordId || ''}')">
          <div class="modal-body">${fields}</div>
          <div class="modal-footer">
            <button type="button" class="btn" onclick="App.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">${mode === 'add' ? 'Add' : 'Save'}</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  }

  function closeModal() {
    const el = $('#modal-overlay');
    if (el) el.remove();
  }

  async function saveRecord(e, mode, recordId) {
    e.preventDefault();
    const sheet = DataStore.getSheet(currentSheet);
    const data = {};

    for (const col of sheet.schema.columns) {
      const el = $(`#field-${col.key}`);
      if (!el) continue;
      if (col.type === 'boolean') {
        data[col.key] = el.checked;
      } else {
        const v = el.value.trim();
        data[col.key] = v || null;
      }
    }

    try {
      if (mode === 'add') {
        await DataStore.addRecord(currentSheet, data);
        toast('Record added', 'success');
      } else {
        await DataStore.updateRecord(currentSheet, recordId, data);
        toast('Record updated', 'success');
      }
      closeModal();
      buildSidebar();
      renderSheet(currentSheet);
    } catch (err) {
      toast('Error: ' + err.message, 'error');
    }
  }

  async function confirmDelete(recordId) {
    const record = DataStore.getRecord(currentSheet, recordId);
    const label = record.topic || record.section || record.group || recordId;
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;

    try {
      await DataStore.deleteRecord(currentSheet, recordId);
      toast('Record deleted', 'success');
      buildSidebar();
      renderSheet(currentSheet);
    } catch (err) {
      toast('Error: ' + err.message, 'error');
    }
  }

  /* ── Import / Export ────────────────────────────────────────── */

  async function exportSheet(name) {
    const csv = await DataStore.exportCSV(name);
    downloadFile(`${name}.csv`, csv, 'text/csv');
    toast('CSV exported', 'success');
  }

  async function exportAll() {
    const json = await DataStore.exportJSON();
    downloadFile('microregistrar-data.json', json, 'application/json');
    toast('Full data exported', 'success');
  }

  function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        await DataStore.importJSON(text);
        buildSidebar();
        route();
        toast('Data imported successfully', 'success');
      } catch (err) {
        toast('Import failed: ' + err.message, 'error');
      }
    };
    input.click();
  }

  async function resetData() {
    if (!confirm('Reset all data to original spreadsheet values? Local changes will be lost.')) return;
    try {
      await DataStore.reset();
      buildSidebar();
      route();
      toast('Data reset to seed values', 'success');
    } catch (err) {
      toast('Reset failed: ' + err.message, 'error');
    }
  }

  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── Filters / Sort ─────────────────────────────────────────── */

  function setFilter(val) { filterText = val; if (currentSheet) renderSheet(currentSheet); }
  function setGapFilter(val) { filterGap = val; if (currentSheet) renderSheet(currentSheet); }

  function sort(col) {
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortCol = col;
      sortDir = 'asc';
    }
    if (currentSheet) renderSheet(currentSheet);
  }

  /* ── Global Events ──────────────────────────────────────────── */

  function bindGlobalEvents() {
    const searchInput = $('#global-search');
    let debounce;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const q = searchInput.value.trim();
        if (q.length >= 2) location.hash = `search/${encodeURIComponent(q)}`;
        else if (location.hash.startsWith('#search')) location.hash = 'dashboard';
      }, 300);
    });

    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        if (q) location.hash = `search/${encodeURIComponent(q)}`;
      }
    });

    $('#theme-toggle').addEventListener('click', toggleTheme);
    $('#menu-toggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
    $('#btn-export').addEventListener('click', exportAll);
    $('#btn-import').addEventListener('click', importData);
    $('#btn-reset').addEventListener('click', resetData);
  }

  /* ── UI Helpers ───────────────────────────────────────────────── */

  function showLoading() {
    $('#page-content').innerHTML = `<div class="loading"><div class="spinner"></div><p>Loading spreadsheet data…</p></div>`;
  }

  function showError(msg) {
    $('#page-content').innerHTML = `<div class="error"><p>⚠️ ${esc(msg)}</p><button class="btn" style="margin-top:12px" onclick="location.reload()">Retry</button></div>`;
  }

  function toast(msg, type = 'success') {
    let container = $('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function esc(str) {
    if (str == null) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  return {
    init, openModal, closeModal, saveRecord, confirmDelete,
    exportSheet, exportAll, importData, resetData,
    setFilter, setGapFilter, sort
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
