/**
 * Microregistrar sheet app — UI + hash routing.
 * Depends on MicroData (data-access.js).
 */
(function () {
  'use strict';

  const { LocalJsonStore, THEME_KEY, escapeHtml, linkHtml, isSafeUrl } = window.MicroData;

  const store = new LocalJsonStore({ mockUrl: './data/mock-data.json' });
  const state = {
    ready: false,
    error: null,
    route: { name: 'home' },
    tabs: [],
    currentTab: null,
    records: [],
    filtered: [],
    query: '',
    gapFilter: '',
    sortKey: null,
    sortDir: 1,
    editing: null,
  };

  const els = {};

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function toast(msg) {
    const t = els.toast;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    els.themeToggle.textContent = theme === 'dark' ? 'Light' : 'Dark';
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(saved || (prefersDark ? 'dark' : 'light'));
  }

  function parseHash() {
    const raw = (location.hash || '#/').replace(/^#/, '');
    const [pathPart, queryPart] = raw.split('?');
    const path = pathPart.replace(/^\//, '');
    const params = new URLSearchParams(queryPart || '');
    if (!path || path === 'home') return { name: 'home' };
    if (path === 'search') return { name: 'search', q: params.get('q') || '' };
    const m = path.match(/^tab\/(.+)$/);
    if (m) return { name: 'tab', tabId: decodeURIComponent(m[1]) };
    return { name: 'home' };
  }

  function navigate(hash) {
    if (!hash.startsWith('#')) hash = '#/' + hash.replace(/^\//, '');
    if (location.hash === hash) {
      onRoute();
    } else {
      location.hash = hash;
    }
  }

  function closeSidebar() {
    els.sidebar.classList.remove('open');
    els.overlay.hidden = true;
  }

  function renderNav() {
    const list = els.navList;
    list.innerHTML = '';
    const home = document.createElement('li');
    home.innerHTML = `<a class="nav-link ${state.route.name === 'home' ? 'active' : ''}" href="#/">Home dashboard</a>`;
    list.appendChild(home);

    const search = document.createElement('li');
    search.innerHTML = `<a class="nav-link ${state.route.name === 'search' ? 'active' : ''}" href="#/search">Search all</a>`;
    list.appendChild(search);

    for (const tab of state.tabs) {
      const li = document.createElement('li');
      const active = state.route.name === 'tab' && state.route.tabId === tab.id;
      li.innerHTML = `<a class="nav-link ${active ? 'active' : ''}" href="#/tab/${encodeURIComponent(tab.id)}">
        <span>${escapeHtml(tab.name)}</span>
        <span class="nav-count">${tab.recordCount}</span>
      </a>`;
      list.appendChild(li);
    }
  }

  function showLoading(msg) {
    els.content.innerHTML = `<div class="state-box"><div class="spinner"></div>${escapeHtml(msg || 'Loading…')}</div>`;
  }

  function showError(msg) {
    els.content.innerHTML = `<div class="state-box error"><p>${escapeHtml(msg)}</p>
      <button class="btn" type="button" id="retry-btn">Retry</button></div>`;
    $('#retry-btn')?.addEventListener('click', boot);
  }

  function renderHome() {
    const meta = store.getMeta();
    const cards = state.tabs
      .map(
        (t) => `<article class="card">
        <span class="card-kind">${escapeHtml(t.kind.replace(/_/g, ' '))}</span>
        <a class="card-title" href="#/tab/${encodeURIComponent(t.id)}">${escapeHtml(t.name)}</a>
        <p class="card-meta">${escapeHtml(t.description || '')}</p>
        <p class="card-meta">${t.recordCount} item${t.recordCount === 1 ? '' : 's'}</p>
      </article>`
      )
      .join('');

    let whatsNew = '';
    try {
      const index = store.getTab('INDEX');
      if (index.whatsNew && index.whatsNew.length) {
        whatsNew = `<section class="whats-new panel" style="padding:1rem">
          <h2>What’s new (from INDEX)</h2>
          ${index.whatsNew
            .slice(0, 25)
            .map(
              (w) => `<div class="whats-new-item">
              <time>${escapeHtml(w.date || '—')}</time>
              <div>${w.link ? linkHtml(w.link, w.title) : escapeHtml(w.title)}</div>
            </div>`
            )
            .join('')}
        </section>`;
      }
    } catch (_) {}

    els.content.innerHTML = `
      <header class="page-header">
        <div>
          <h1>Microregistrar index</h1>
          <p>Admin-style front page for every spreadsheet tab. Open a card or use the sidebar. Data is a local snapshot with CRUD; connect Google Sheets later via the data-access layer.</p>
        </div>
      </header>
      <div class="meta-bar">
        <span>Source snapshot: ${escapeHtml(meta.exportedAt || 'n/a')}</span>
        <span>${store.hasLocalEdits() ? 'Local edits saved in this browser' : 'Showing imported snapshot'}</span>
        <span>${state.tabs.length} tabs</span>
      </div>
      <div class="card-grid">${cards}</div>
      ${whatsNew}
    `;
  }

  function sortRecords(records, key, dir) {
    if (!key) return records;
    return records.slice().sort((a, b) => {
      let av = a[key];
      let bv = b[key];
      if (typeof av === 'boolean') av = av ? 1 : 0;
      if (typeof bv === 'boolean') bv = bv ? 1 : 0;
      av = av == null ? '' : av;
      bv = bv == null ? '' : bv;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }

  function applyFilters() {
    const q = state.query.trim().toLowerCase();
    let rows = state.records.slice();
    if (state.gapFilter) {
      rows = rows.filter((r) => (r.gapAnalysis || '') === state.gapFilter);
    }
    if (q) {
      rows = rows.filter((r) => Object.values(r).join(' ').toLowerCase().includes(q));
    }
    rows = sortRecords(rows, state.sortKey, state.sortDir);
    state.filtered = rows;
  }

  function renderDashboardTab(tab) {
    const internal = (tab.links || []).filter((l) => l.sheetTarget);
    const external = (tab.links || []).filter((l) => l.url);
    const sectionLinks = internal
      .map(
        (l) =>
          `<a class="internal" href="#/tab/${encodeURIComponent(l.sheetTarget)}">${escapeHtml(l.label)}</a>`
      )
      .join('');
    const extLinks = external
      .slice(0, 80)
      .map((l) => `<div>${linkHtml(l.url, l.label)}</div>`)
      .join('');

    els.content.innerHTML = `
      <header class="page-header">
        <div>
          <h1>${escapeHtml(tab.name)}</h1>
          <p>${escapeHtml(tab.description || '')}</p>
        </div>
      </header>
      <div class="card-grid">
        <article class="card" style="grid-column: span 1">
          <h3 style="margin:0">In-app tab links</h3>
          <div class="link-list">${sectionLinks || '<p class="card-meta">None</p>'}</div>
        </article>
        <article class="card" style="grid-column: 1 / -1">
          <h3 style="margin:0">External & resource links</h3>
          <div class="link-list">${extLinks || '<p class="card-meta">None</p>'}</div>
        </article>
      </div>
    `;
  }

  function gapBadge(v) {
    if (!v) return '<span class="badge">—</span>';
    const cls = v === 'Exam ready' ? 'badge-ok' : 'badge-warn';
    return `<span class="badge ${cls}">${escapeHtml(v)}</span>`;
  }

  function renderTableTab(tab) {
    applyFilters();
    const canCrud = tab.kind === 'flat_table' || tab.kind === 'topic_outline' || tab.kind === 'search';
    const isFlat = tab.kind === 'flat_table';
    const isSearch = tab.kind === 'search';

    let head = '';
    if (isFlat) {
      head = `
        <th data-sort="group">Group<span class="sort-ind">↕</span></th>
        <th data-sort="topic">Topic<span class="sort-ind">↕</span></th>
        <th data-sort="link">Link</th>
        <th data-sort="dateUpdated">Date updated<span class="sort-ind">↕</span></th>
        ${canCrud ? '<th>Actions</th>' : ''}`;
    } else if (isSearch) {
      head = `
        <th data-sort="sheetName">Sheet<span class="sort-ind">↕</span></th>
        <th data-sort="cellContent">Content<span class="sort-ind">↕</span></th>
        <th>Link</th>
        ${canCrud ? '<th>Actions</th>' : ''}`;
    } else {
      head = `
        <th data-sort="section">Section<span class="sort-ind">↕</span></th>
        <th data-sort="topic">Topic<span class="sort-ind">↕</span></th>
        <th data-sort="date">Date<span class="sort-ind">↕</span></th>
        <th data-sort="gapAnalysis">Gap analysis<span class="sort-ind">↕</span></th>
        <th data-sort="revision1">Rev 1</th>
        <th data-sort="revision2">Rev 2</th>
        <th>Link</th>
        ${canCrud ? '<th>Actions</th>' : ''}`;
    }

    const body =
      state.filtered.length === 0
        ? `<tr><td colspan="8"><div class="state-box">No records match. ${
            state.records.length ? 'Try clearing filters.' : 'Add a record to get started.'
          }</div></td></tr>`
        : state.filtered
            .map((r) => {
              if (isFlat) {
                return `<tr>
                  <td>${escapeHtml(r.group)}</td>
                  <td>${escapeHtml(r.topic)}</td>
                  <td>${r.link ? linkHtml(r.link, 'Open') : '—'}</td>
                  <td>${escapeHtml(r.dateUpdated || '—')}</td>
                  <td class="actions-cell">
                    <button class="btn btn-sm" data-edit="${escapeHtml(r.id)}" type="button">Edit</button>
                    <button class="btn btn-sm btn-danger" data-del="${escapeHtml(r.id)}" type="button">Delete</button>
                  </td>
                </tr>`;
              }
              if (isSearch) {
                return `<tr>
                  <td>${escapeHtml(r.sheetName || '')}</td>
                  <td>${escapeHtml(r.cellContent || r.topic || '')}</td>
                  <td>${r.link ? linkHtml(r.link, r.linkLabel || 'Open topic') : '—'}</td>
                  <td class="actions-cell">
                    <button class="btn btn-sm" data-edit="${escapeHtml(r.id)}" type="button">Edit</button>
                    <button class="btn btn-sm btn-danger" data-del="${escapeHtml(r.id)}" type="button">Delete</button>
                  </td>
                </tr>`;
              }
              const title = r.topic || r.section;
              const rowClass = r.rowType === 'section' ? 'section-row' : '';
              return `<tr class="${rowClass}">
                <td>${escapeHtml(r.section || '')}</td>
                <td>${r.link && r.topic ? linkHtml(r.link, r.topic) : escapeHtml(r.topic || '')}</td>
                <td>${escapeHtml(r.date || '—')}</td>
                <td>${gapBadge(r.gapAnalysis)}</td>
                <td>${r.revision1 ? '✓' : '—'}</td>
                <td>${r.revision2 ? '✓' : '—'}</td>
                <td>${r.link && !r.topic ? linkHtml(r.link, 'Open') : r.link && r.topic ? '' : '—'}</td>
                <td class="actions-cell">
                  <button class="btn btn-sm" data-edit="${escapeHtml(r.id)}" type="button">Edit</button>
                  <button class="btn btn-sm btn-danger" data-del="${escapeHtml(r.id)}" type="button">Delete</button>
                </td>
              </tr>`;
            })
            .join('');

    const gapOptions = ((tab.validation && tab.validation.gapAnalysis) || []).map(
      (g) => `<option value="${escapeHtml(g)}" ${state.gapFilter === g ? 'selected' : ''}>${escapeHtml(g)}</option>`
    );

    els.content.innerHTML = `
      <header class="page-header">
        <div>
          <h1>${escapeHtml(tab.name)}</h1>
          <p>${escapeHtml(tab.description || '')}</p>
        </div>
        <div class="toolbar" style="margin:0">
          ${canCrud ? '<button class="btn btn-primary" type="button" id="add-record">Add record</button>' : ''}
          <button class="btn" type="button" id="export-csv">Export CSV</button>
        </div>
      </header>
      <div class="toolbar">
        <input type="search" id="tab-search" placeholder="Filter this tab…" value="${escapeHtml(state.query)}" />
        ${
          tab.kind === 'topic_outline'
            ? `<select id="gap-filter"><option value="">All gap statuses</option>${gapOptions.join('')}</select>`
            : ''
        }
        <span class="card-meta">${state.filtered.length} / ${state.records.length} shown</span>
      </div>
      <div class="panel table-wrap">
        <table class="data">
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;

    $('#tab-search')?.addEventListener('input', (e) => {
      state.query = e.target.value;
      renderTableTab(tab);
    });
    $('#gap-filter')?.addEventListener('change', (e) => {
      state.gapFilter = e.target.value;
      renderTableTab(tab);
    });
    $('#add-record')?.addEventListener('click', () => openEditor(tab, null));
    $('#export-csv')?.addEventListener('click', () => {
      try {
        downloadText(`${tab.id}.csv`, store.exportCsv(tab.id), 'text/csv');
        toast('CSV downloaded');
      } catch (err) {
        toast(err.message);
      }
    });
    els.content.querySelectorAll('th[data-sort]').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (state.sortKey === key) state.sortDir *= -1;
        else {
          state.sortKey = key;
          state.sortDir = 1;
        }
        renderTableTab(tab);
      });
    });
    els.content.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit');
        const rec = state.records.find((r) => r.id === id);
        openEditor(tab, rec);
      });
    });
    els.content.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del');
        if (!confirm('Delete this record?')) return;
        try {
          store.deleteRecord(tab.id, id);
          toast('Deleted');
          refreshCurrentTab();
        } catch (err) {
          toast(err.message);
        }
      });
    });
  }

  function renderSearchPage() {
    const q = state.route.q || els.globalSearch.value || '';
    els.globalSearch.value = q;
    const hits = q ? store.searchAll(q) : [];
    els.content.innerHTML = `
      <header class="page-header">
        <div>
          <h1>Search all tabs</h1>
          <p>Full-text search across the local dataset (replaces the spreadsheet Search sheet FILTER UI).</p>
        </div>
      </header>
      <div class="toolbar">
        <input type="search" id="page-search" placeholder="Type a topic, organism, antibiotic…" value="${escapeHtml(q)}" style="min-width:min(100%,320px);flex:1" />
      </div>
      <div class="panel table-wrap">
        ${
          !q
            ? '<div class="state-box">Enter a keyword to search.</div>'
            : hits.length === 0
              ? '<div class="state-box">No matches.</div>'
              : `<table class="data"><thead><tr><th>Tab</th><th>Title</th><th>Snippet</th><th>Link</th></tr></thead><tbody>
              ${hits
                .map(
                  (h) => `<tr>
                  <td><a href="#/tab/${encodeURIComponent(h.tabId)}">${escapeHtml(h.tabName)}</a></td>
                  <td>${escapeHtml(h.title)}</td>
                  <td>${escapeHtml(h.snippet)}</td>
                  <td>${
                    h.link
                      ? linkHtml(h.link, 'Open')
                      : h.sheetTarget
                        ? `<a href="#/tab/${encodeURIComponent(h.sheetTarget)}">Go to tab</a>`
                        : '—'
                  }</td>
                </tr>`
                )
                .join('')}
            </tbody></table>`
        }
      </div>
    `;
    const input = $('#page-search');
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        navigate('#/search?q=' + encodeURIComponent(input.value.trim()));
      }
    });
  }

  function openEditor(tab, record) {
    state.editing = { tabId: tab.id, record };
    const isNew = !record;
    const r = record || {};
    const isFlat = tab.kind === 'flat_table';
    const isSearch = tab.kind === 'search';
    const groups = (tab.validation && tab.validation.group) || [];
    const gaps = (tab.validation && tab.validation.gapAnalysis) || [
      'Not confident',
      'need more revision',
      'Exam ready',
    ];

    let fields = '';
    if (isFlat) {
      fields = `
        <div class="form-field"><label for="f-group">Group</label>
          <select id="f-group">${groups.map((g) => `<option ${r.group === g ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}
          ${r.group && !groups.includes(r.group) ? `<option selected>${escapeHtml(r.group)}</option>` : ''}
          </select></div>
        <div class="form-field"><label for="f-topic">Topic</label><input id="f-topic" value="${escapeHtml(r.topic || '')}" /></div>
        <div class="form-field"><label for="f-link">Link (https URL)</label><input id="f-link" type="url" placeholder="https://…" value="${escapeHtml(r.link || '')}" /></div>
        <div class="form-field"><label for="f-date">Date updated</label><input id="f-date" type="date" value="${escapeHtml(r.dateUpdated || '')}" /></div>`;
    } else if (isSearch) {
      fields = `
        <div class="form-field"><label for="f-sheet">Sheet name</label><input id="f-sheet" value="${escapeHtml(r.sheetName || '')}" /></div>
        <div class="form-field"><label for="f-content">Cell content</label><input id="f-content" value="${escapeHtml(r.cellContent || '')}" /></div>
        <div class="form-field"><label for="f-link">Link</label><input id="f-link" type="url" value="${escapeHtml(r.link || '')}" /></div>`;
    } else {
      fields = `
        <div class="form-field"><label for="f-section">Section</label><input id="f-section" value="${escapeHtml(r.section || '')}" /></div>
        <div class="form-field"><label for="f-topic">Topic</label><input id="f-topic" value="${escapeHtml(r.topic || '')}" /></div>
        <div class="form-field"><label for="f-date">Date</label><input id="f-date" type="date" value="${escapeHtml(r.date || '')}" /></div>
        <div class="form-field"><label for="f-gap">Gap analysis</label>
          <select id="f-gap"><option value="">—</option>${gaps.map((g) => `<option ${r.gapAnalysis === g ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}</select></div>
        <div class="checkbox-row">
          <label><input type="checkbox" id="f-rev1" ${r.revision1 ? 'checked' : ''}/> Revision 1</label>
          <label><input type="checkbox" id="f-rev2" ${r.revision2 ? 'checked' : ''}/> Revision 2</label>
        </div>
        <div class="form-field"><label for="f-link">Link (https URL)</label><input id="f-link" type="url" placeholder="https://…" value="${escapeHtml(r.link || '')}" /></div>`;
    }

    els.modalTitle.textContent = isNew ? 'Add record' : 'Edit record';
    els.modalBody.innerHTML = `<div class="form-grid">${fields}</div><div class="form-error" id="form-error"></div>`;
    els.modalBackdrop.hidden = false;
    $('#modal-save').onclick = () => saveEditor(tab, record);
  }

  function saveEditor(tab, record) {
    const errEl = $('#form-error');
    try {
      let data;
      if (tab.kind === 'flat_table') {
        data = {
          group: $('#f-group').value,
          topic: $('#f-topic').value.trim(),
          link: $('#f-link').value.trim(),
          dateUpdated: $('#f-date').value,
        };
        if (!data.topic) throw new Error('Topic is required');
      } else if (tab.kind === 'search') {
        data = {
          sheetName: $('#f-sheet').value.trim(),
          cellContent: $('#f-content').value.trim(),
          topic: $('#f-content').value.trim(),
          link: $('#f-link').value.trim(),
        };
      } else {
        data = {
          section: $('#f-section').value.trim(),
          topic: $('#f-topic').value.trim(),
          date: $('#f-date').value,
          gapAnalysis: $('#f-gap').value,
          revision1: $('#f-rev1').checked,
          revision2: $('#f-rev2').checked,
          link: $('#f-link').value.trim(),
        };
        if (!data.section && !data.topic) throw new Error('Section or topic is required');
      }
      if (data.link && !isSafeUrl(data.link)) throw new Error('Link must be a valid http(s) URL');

      if (record) store.updateRecord(tab.id, record.id, data);
      else store.createRecord(tab.id, data);

      closeModal();
      toast(record ? 'Saved' : 'Added');
      refreshCurrentTab();
      state.tabs = store.listTabs();
      renderNav();
    } catch (err) {
      if (errEl) errEl.textContent = err.message;
      else toast(err.message);
    }
  }

  function closeModal() {
    els.modalBackdrop.hidden = true;
    state.editing = null;
  }

  function downloadText(filename, text, type) {
    const blob = new Blob([text], { type: type || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function refreshCurrentTab() {
    if (state.route.name !== 'tab') return;
    const tab = store.getTab(state.route.tabId);
    state.currentTab = tab;
    state.records = store.listRecords(tab.id);
    if (tab.kind === 'dashboard') renderDashboardTab(tab);
    else renderTableTab(tab);
  }

  function onRoute() {
    state.route = parseHash();
    state.query = '';
    state.gapFilter = '';
    state.sortKey = null;
    state.sortDir = 1;
    closeSidebar();
    renderNav();

    if (!state.ready) return;

    if (state.route.name === 'home') {
      renderHome();
      return;
    }
    if (state.route.name === 'search') {
      renderSearchPage();
      return;
    }
    if (state.route.name === 'tab') {
      try {
        const tab = store.getTab(state.route.tabId);
        state.currentTab = tab;
        state.records = store.listRecords(tab.id);
        if (tab.kind === 'dashboard') renderDashboardTab(tab);
        else renderTableTab(tab);
      } catch (err) {
        showError(err.message);
      }
    }
  }

  async function boot() {
    showLoading('Loading spreadsheet snapshot…');
    try {
      await store.init();
      state.tabs = store.listTabs();
      state.ready = true;
      state.error = null;
      onRoute();
    } catch (err) {
      state.error = err;
      showError(err.message || 'Failed to load data');
    }
  }

  function bindChrome() {
    els.sidebar = $('#sidebar');
    els.overlay = $('#nav-overlay');
    els.navList = $('#nav-list');
    els.content = $('#content');
    els.globalSearch = $('#global-search');
    els.themeToggle = $('#theme-toggle');
    els.toast = $('#toast');
    els.modalBackdrop = $('#modal-backdrop');
    els.modalTitle = $('#modal-title');
    els.modalBody = $('#modal-body');

    $('#menu-toggle').addEventListener('click', () => {
      els.sidebar.classList.add('open');
      els.overlay.hidden = false;
    });
    els.overlay.addEventListener('click', closeSidebar);

    els.themeToggle.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      setTheme(next);
    });

    els.globalSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        navigate('#/search?q=' + encodeURIComponent(els.globalSearch.value.trim()));
      }
    });

    $('#export-json').addEventListener('click', () => {
      downloadText('microregistrar-export.json', store.exportJson(), 'application/json');
      toast('JSON exported');
    });

    $('#import-json').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        store.importJson(text);
        state.tabs = store.listTabs();
        toast('Import complete');
        onRoute();
      } catch (err) {
        toast('Import failed: ' + err.message);
      }
      e.target.value = '';
    });

    $('#reset-data').addEventListener('click', () => {
      if (!confirm('Reset to the original mock snapshot and discard local edits?')) return;
      store.resetToMock();
      state.tabs = store.listTabs();
      toast('Reset to snapshot');
      onRoute();
    });

    $('#modal-cancel').addEventListener('click', closeModal);
    els.modalBackdrop.addEventListener('click', (e) => {
      if (e.target === els.modalBackdrop) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.modalBackdrop.hidden) closeModal();
    });

    window.addEventListener('hashchange', onRoute);
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindChrome();
    initTheme();
    boot();
  });
})();
