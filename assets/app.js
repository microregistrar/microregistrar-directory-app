/*
 * UI layer. Talks to the data layer exclusively through window.MicroStore.
 * Hash routing: #/ (dashboard), #/tab/<key>, #/search/<query>
 */
(function () {
  'use strict';

  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const main = () => $('#main');

  let TABS = [];
  let META = null;

  /* ---------- helpers ---------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function safeUrl(url) {
    const s = String(url || '').trim();
    if (/^https?:\/\//i.test(s)) return s;
    return '';
  }

  function extLink(url, label, cls) {
    const u = safeUrl(url);
    if (!u) return esc(label || '');
    return '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer" class="' +
      (cls || 'ext-link') + '">' + esc(label || u) + ICONS.external + '</a>';
  }

  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || 'ok');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 2600);
  }

  function gapBadge(gap) {
    if (!gap) return '<span class="badge badge-none">—</span>';
    const cls = gap === 'Exam ready' ? 'badge-ready'
      : gap === 'need more revision' ? 'badge-revise' : 'badge-notconf';
    return '<span class="badge ' + cls + '">' + esc(gap) + '</span>';
  }

  const ICONS = {
    external: ' <svg class="ico-ext" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>',
    edit: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
    tab: {
      virus: '🦠', pill: '💊', cell: '🧫', spore: '🍄', dna: '🧬', bug: '🪱',
      flask: '🧪', heart: '🫀', shield: '🛡️', syringe: '💉', chart: '📊',
      star: '⭐', sparkle: '✨',
    },
  };

  /* ---------- router ---------- */

  async function route() {
    const hash = location.hash || '#/';
    const parts = hash.replace(/^#\//, '').split('/');
    $$('.nav-link').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === hash));
    $('#sidebar').classList.remove('open');
    try {
      if (parts[0] === 'tab' && parts[1]) {
        await renderTab(decodeURIComponent(parts[1]));
      } else if (parts[0] === 'search' && parts[1] !== undefined) {
        const q = decodeURIComponent(parts.slice(1).join('/'));
        $('#global-search').value = q;
        await renderSearch(q);
      } else {
        await renderDashboard();
      }
    } catch (err) {
      renderError(err);
    }
    main().scrollTop = 0;
  }

  function renderError(err) {
    console.error(err);
    main().innerHTML =
      '<div class="state-box error"><h2>Something went wrong</h2>' +
      '<p>' + esc(err.message || String(err)) + '</p>' +
      '<button class="btn" onclick="location.reload()">Reload app</button></div>';
  }

  function renderLoading(label) {
    main().innerHTML =
      '<div class="state-box"><div class="spinner"></div><p>' + esc(label || 'Loading…') + '</p></div>';
  }

  /* ---------- dashboard ---------- */

  async function renderDashboard() {
    renderLoading('Loading dashboard…');
    const [tabs, index] = await Promise.all([MicroStore.listTabs(), MicroStore.getIndex()]);
    const perTab = await Promise.all(tabs.map((t) => MicroStore.getRecords(t.key)));

    let total = 0, ready = 0, links = 0;
    const cards = tabs.map((t, i) => {
      const recs = perTab[i];
      const topics = recs.filter((r) => !r.isSection);
      const nReady = topics.filter((r) => r.gap === 'Exam ready').length;
      total += topics.length; ready += nReady;
      links += recs.filter((r) => safeUrl(r.url)).length;
      const pct = topics.length ? Math.round((nReady / topics.length) * 100) : 0;
      return (
        '<a class="tab-card" href="#/tab/' + esc(t.key) + '">' +
        '<div class="tab-card-head"><span class="tab-ico">' + (ICONS.tab[t.icon] || '📄') + '</span>' +
        '<h3>' + esc(t.name) + '</h3></div>' +
        '<p>' + esc(t.description) + '</p>' +
        '<div class="tab-card-meta"><span>' + topics.length + ' topics</span>' +
        '<span>' + nReady + ' exam ready</span></div>' +
        '<div class="progress"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
        '</a>');
    }).join('');

    const groups = {};
    index.quickLinks.forEach((l) => { (groups[l.group] = groups[l.group] || []).push(l); });
    const quickHtml = Object.keys(groups).map((g) =>
      '<div class="ql-group"><h4>' + esc(g) + '</h4><ul>' +
      groups[g].map((l) => '<li>' + extLink(l.url, l.label) + '</li>').join('') +
      '</ul></div>').join('');

    const newsHtml = index.whatsNew.length
      ? '<ul class="news-list">' + index.whatsNew.slice(0, 10).map((n) =>
        '<li><span class="news-date">' + esc(n.date || '') + '</span>' +
        extLink(n.url, n.label) + '</li>').join('') + '</ul>'
      : '<p class="muted">No recent updates.</p>';

    main().innerHTML =
      '<header class="page-head"><div><h1>' + esc(META.title) + ' dashboard</h1>' +
      '<p class="muted">Revision tracker for clinical microbiology exams · snapshot from ' +
      extLink(META.spreadsheetUrl, 'the Google Sheet') + ' (' + esc(META.exportedAt.slice(0, 10)) + ')</p></div>' +
      '<div class="page-head-actions">' +
      '<button class="btn ghost" id="btn-data">Data tools</button></div></header>' +

      '<section class="stat-row">' +
      stat(tabs.length, 'Sections') + stat(total, 'Topics') +
      stat(links, 'Linked resources') + stat(total ? Math.round((ready / total) * 100) + '%' : '0%', 'Exam ready') +
      '</section>' +

      '<h2 class="section-title">Browse sections</h2>' +
      '<section class="card-grid">' + cards + '</section>' +

      '<div class="dash-cols">' +
      '<section class="panel"><h2 class="section-title">What\u2019s new</h2>' + newsHtml + '</section>' +
      '<section class="panel"><h2 class="section-title">Quick links</h2>' + quickHtml + '</section>' +
      '</div>';

    $('#btn-data').addEventListener('click', openDataTools);
  }

  function stat(value, label) {
    return '<div class="stat"><div class="stat-value">' + value + '</div>' +
      '<div class="stat-label">' + esc(label) + '</div></div>';
  }

  /* ---------- tab view ---------- */

  const tabViewState = {}; // per tab: { q, gap, section, sort }

  async function renderTab(tabKey) {
    const tab = TABS.find((t) => t.key === tabKey);
    if (!tab) throw new Error('Unknown section "' + tabKey + '".');
    renderLoading('Loading ' + tab.name + '…');
    const records = await MicroStore.getRecords(tabKey);
    const st = tabViewState[tabKey] || (tabViewState[tabKey] = { q: '', gap: '', section: '', sort: 'sheet' });

    const sections = [...new Set(records.map((r) => r.section).filter(Boolean))];

    main().innerHTML =
      '<header class="page-head"><div>' +
      '<nav class="crumbs"><a href="#/">Dashboard</a> / ' + esc(tab.name) + '</nav>' +
      '<h1>' + (ICONS.tab[tab.icon] || '') + ' ' + esc(tab.name) + '</h1>' +
      '<p class="muted">' + esc(tab.description) + '</p></div>' +
      '<div class="page-head-actions">' +
      '<button class="btn ghost" id="btn-csv">Export CSV</button>' +
      '<button class="btn primary" id="btn-add">' + ICONS.plus + ' Add record</button>' +
      '</div></header>' +

      '<div class="toolbar">' +
      '<div class="search-wrap">' + ICONS.search +
      '<input id="tab-search" type="search" placeholder="Filter topics in ' + esc(tab.name) + '…" value="' + esc(st.q) + '"></div>' +
      '<select id="f-gap"><option value="">All statuses</option>' +
      META.gapOptions.map((g) => '<option' + (st.gap === g ? ' selected' : '') + '>' + esc(g) + '</option>').join('') +
      '<option value="__none"' + (st.gap === '__none' ? ' selected' : '') + '>No status</option></select>' +
      '<select id="f-section"><option value="">All ' + (tab.hasGroup ? 'groups' : 'sections') + '</option>' +
      sections.map((s) => '<option' + (st.section === s ? ' selected' : '') + ' value="' + esc(s) + '">' + esc(s) + '</option>').join('') +
      '</select>' +
      '<select id="f-sort">' +
      '<option value="sheet"' + (st.sort === 'sheet' ? ' selected' : '') + '>Sheet order</option>' +
      '<option value="topic"' + (st.sort === 'topic' ? ' selected' : '') + '>Topic A–Z</option>' +
      '<option value="date"' + (st.sort === 'date' ? ' selected' : '') + '>Recently updated</option>' +
      '<option value="gap"' + (st.sort === 'gap' ? ' selected' : '') + '>By status</option>' +
      '</select></div>' +

      '<div id="tab-table"></div>';

    const rerender = () => drawTable(tab, records, st);
    $('#tab-search').addEventListener('input', (e) => { st.q = e.target.value; rerender(); });
    $('#f-gap').addEventListener('change', (e) => { st.gap = e.target.value; rerender(); });
    $('#f-section').addEventListener('change', (e) => { st.section = e.target.value; rerender(); });
    $('#f-sort').addEventListener('change', (e) => { st.sort = e.target.value; rerender(); });
    $('#btn-add').addEventListener('click', () => openRecordForm(tab, null, sections));
    $('#btn-csv').addEventListener('click', async () => {
      download(tab.key + '.csv', await MicroStore.exportTabCSV(tab.key), 'text/csv');
    });
    rerender();
  }

  function drawTable(tab, records, st) {
    const q = st.q.trim().toLowerCase();
    let rows = records.filter((r) => {
      if (q && !((r.topic + ' ' + r.section + ' ' + r.url).toLowerCase().includes(q))) return false;
      if (st.gap === '__none') { if (r.gap || r.isSection) return false; }
      else if (st.gap) { if (r.gap !== st.gap) return false; }
      if (st.section && r.section !== st.section) return false;
      return true;
    });

    if (st.sort === 'topic') rows = rows.slice().sort((a, b) => a.topic.localeCompare(b.topic));
    else if (st.sort === 'date') rows = rows.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    else if (st.sort === 'gap') {
      const order = { 'Not confident': 0, 'need more revision': 1, 'Exam ready': 2, '': 3 };
      rows = rows.slice().sort((a, b) => (order[a.gap] ?? 3) - (order[b.gap] ?? 3));
    }

    const el = $('#tab-table');
    if (!records.length) {
      el.innerHTML = emptyState('This section has no records yet.', 'Add the first record with the button above.');
      return;
    }
    if (!rows.length) {
      el.innerHTML = emptyState('No records match your filters.', 'Try clearing the search or filters.');
      return;
    }

    const grouped = st.sort === 'sheet';
    let html = '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      '<th class="col-topic">Topic</th><th>Link</th><th>Updated</th><th>Gap analysis</th>' +
      '<th class="col-rev">Rev 1</th><th class="col-rev">Rev 2</th><th class="col-actions"></th>' +
      '</tr></thead><tbody>';

    let lastSection = null;
    rows.forEach((r) => {
      if (grouped && r.section !== lastSection && !r.isSection) {
        if (!rows.some((x) => x.isSection && x.topic === r.section)) {
          html += '<tr class="row-section"><td colspan="7">' + esc(r.section || 'Ungrouped') + '</td></tr>';
        }
      }
      lastSection = r.section;
      if (r.isSection) {
        html += '<tr class="row-section" data-id="' + esc(r.id) + '"><td colspan="4">' +
          (safeUrl(r.url) ? extLink(r.url, r.topic, 'section-link') : esc(r.topic)) + '</td>' +
          '<td></td><td></td>' + actionCell(r) + '</tr>';
        return;
      }
      html +=
        '<tr data-id="' + esc(r.id) + '"><td class="col-topic">' + esc(r.topic) + '</td>' +
        '<td>' + (safeUrl(r.url) ? extLink(r.url, 'Open', 'btn-link') : '<span class="muted">—</span>') + '</td>' +
        '<td class="col-date">' + (r.date ? esc(r.date) : '<span class="muted">—</span>') + '</td>' +
        '<td>' + gapBadge(r.gap) + '</td>' +
        '<td class="col-rev"><input type="checkbox" class="chk" data-field="rev1"' + (r.rev1 ? ' checked' : '') + '></td>' +
        '<td class="col-rev"><input type="checkbox" class="chk" data-field="rev2"' + (r.rev2 ? ' checked' : '') + '></td>' +
        actionCell(r) + '</tr>';
    });
    html += '</tbody></table></div><p class="muted table-count">' + rows.length + ' of ' +
      records.length + ' rows shown</p>';
    el.innerHTML = html;

    const sections = [...new Set(records.map((r) => r.section).filter(Boolean))];
    el.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      const rec = records.find((r) => r.id === tr.dataset.id);
      if (!rec) return;
      if (e.target.closest('.act-edit')) {
        openRecordForm(tab, rec, sections);
      } else if (e.target.closest('.act-del')) {
        confirmDelete(tab, rec);
      } else if (e.target.classList.contains('chk')) {
        const field = e.target.dataset.field;
        try {
          await MicroStore.updateRecord(tab.key, rec.id, { [field]: e.target.checked });
          rec[field] = e.target.checked;
        } catch (err) { e.target.checked = !e.target.checked; toast(err.message, 'err'); }
      }
    });
  }

  function actionCell(r) {
    return '<td class="col-actions"><button class="icon-btn act-edit" title="Edit">' + ICONS.edit +
      '</button><button class="icon-btn act-del" title="Delete">' + ICONS.trash + '</button></td>';
  }

  function emptyState(title, hint) {
    return '<div class="state-box"><div class="empty-art">🗂️</div><h3>' + esc(title) +
      '</h3><p class="muted">' + esc(hint) + '</p></div>';
  }

  /* ---------- global search ---------- */

  async function renderSearch(q) {
    if (!q.trim()) {
      main().innerHTML =
        '<header class="page-head"><h1>Search</h1></header>' +
        emptyState('Type a keyword in the search bar above.', 'Search covers every section, topic, and link.');
      return;
    }
    renderLoading('Searching…');
    const results = await MicroStore.searchAll(q);
    let html = '<header class="page-head"><div><h1>Search results</h1><p class="muted">' +
      results.length + ' match' + (results.length === 1 ? '' : 'es') + ' for “' + esc(q) + '”</p></div></header>';
    if (!results.length) {
      html += emptyState('No matches found.', 'Try a shorter or different keyword.');
    } else {
      const byTab = {};
      results.forEach((res) => { (byTab[res.tab.key] = byTab[res.tab.key] || { tab: res.tab, list: [] }).list.push(res.record); });
      html += Object.values(byTab).map((g) =>
        '<section class="panel search-group"><h2 class="section-title"><a href="#/tab/' + esc(g.tab.key) + '">' +
        (ICONS.tab[g.tab.icon] || '') + ' ' + esc(g.tab.name) + '</a> <span class="muted">(' + g.list.length + ')</span></h2>' +
        '<ul class="result-list">' + g.list.map((r) =>
          '<li><div class="result-topic">' + esc(r.topic) + (r.isSection ? ' <span class="badge badge-none">section</span>' : '') + '</div>' +
          '<div class="result-meta">' + (r.section && !r.isSection ? esc(r.section) + ' · ' : '') +
          (safeUrl(r.url) ? extLink(r.url, 'Open resource', 'btn-link') : '<span class="muted">no link</span>') +
          '</div></li>').join('') + '</ul></section>').join('');
    }
    main().innerHTML = html;
  }

  /* ---------- record form modal ---------- */

  function openRecordForm(tab, rec, sections) {
    const isEdit = !!rec;
    const r = rec || { section: '', topic: '', url: '', date: '', gap: '', rev1: false, rev2: false, isSection: false };
    const sectionField = tab.hasGroup
      ? '<label>Group<select name="section">' +
        META.interactiveGroups.map((g) => '<option' + (r.section === g ? ' selected' : '') + '>' + esc(g) + '</option>').join('') +
        '</select></label>'
      : '<label>Section<input name="section" list="dl-sections" value="' + esc(r.section) + '" ' +
        'placeholder="e.g. 2. CNS and eye infection"><datalist id="dl-sections">' +
        sections.map((s) => '<option value="' + esc(s) + '">').join('') + '</datalist></label>';

    openModal(
      (isEdit ? 'Edit record' : 'Add record to ' + esc(tab.name)),
      '<form id="rec-form" class="form-grid">' +
      '<label class="span2">Topic *<input name="topic" required value="' + esc(r.topic) + '" placeholder="Topic title"></label>' +
      sectionField +
      '<label>Hyperlink (https://…)<input name="url" type="url" pattern="https?://.*" value="' + esc(r.url) + '" placeholder="https://example.com/resource"></label>' +
      '<label>Date updated<input name="date" type="date" value="' + esc(r.date) + '"></label>' +
      '<label>Gap analysis<select name="gap"><option value="">— none —</option>' +
      META.gapOptions.map((g) => '<option' + (r.gap === g ? ' selected' : '') + '>' + esc(g) + '</option>').join('') +
      '</select></label>' +
      '<div class="check-row span2">' +
      '<label class="check"><input type="checkbox" name="rev1"' + (r.rev1 ? ' checked' : '') + '> Revision 1 done</label>' +
      '<label class="check"><input type="checkbox" name="rev2"' + (r.rev2 ? ' checked' : '') + '> Revision 2 done</label>' +
      (tab.hasGroup ? '' : '<label class="check"><input type="checkbox" name="isSection"' + (r.isSection ? ' checked' : '') + '> This row is a section header</label>') +
      '</div>' +
      '<div class="modal-actions span2">' +
      '<button type="button" class="btn ghost" data-close>Cancel</button>' +
      '<button type="submit" class="btn primary">' + (isEdit ? 'Save changes' : 'Add record') + '</button>' +
      '</div></form>');

    $('#rec-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const fields = {
        topic: (fd.get('topic') || '').toString().trim(),
        section: (fd.get('section') || '').toString().trim(),
        url: (fd.get('url') || '').toString().trim(),
        date: (fd.get('date') || '').toString(),
        gap: (fd.get('gap') || '').toString(),
        rev1: fd.get('rev1') === 'on',
        rev2: fd.get('rev2') === 'on',
        isSection: fd.get('isSection') === 'on',
      };
      if (!fields.topic) return;
      if (fields.url && !safeUrl(fields.url)) {
        toast('Link must start with http:// or https://', 'err');
        return;
      }
      try {
        if (isEdit) await MicroStore.updateRecord(tab.key, rec.id, fields);
        else await MicroStore.createRecord(tab.key, fields);
        closeModal();
        toast(isEdit ? 'Record updated' : 'Record added');
        route();
      } catch (err) { toast(err.message, 'err'); }
    });
  }

  function confirmDelete(tab, rec) {
    openModal('Delete record',
      '<p>Delete <strong>' + esc(rec.topic) + '</strong> from ' + esc(tab.name) + '?</p>' +
      '<p class="muted">This only affects your local copy — the original Google Sheet is never modified.</p>' +
      '<div class="modal-actions">' +
      '<button class="btn ghost" data-close>Cancel</button>' +
      '<button class="btn danger" id="btn-confirm-del">Delete</button></div>');
    $('#btn-confirm-del').addEventListener('click', async () => {
      try {
        await MicroStore.deleteRecord(tab.key, rec.id);
        closeModal();
        toast('Record deleted');
        route();
      } catch (err) { toast(err.message, 'err'); }
    });
  }

  /* ---------- data tools ---------- */

  function openDataTools() {
    openModal('Data tools',
      '<p class="muted">Your edits live in this browser (localStorage). The original Google Sheet is read-only source data.</p>' +
      '<div class="tool-list">' +
      '<button class="btn" id="dt-export">Download backup (JSON)</button>' +
      '<label class="btn" for="dt-import-file">Import backup (JSON)</label>' +
      '<input type="file" id="dt-import-file" accept=".json,application/json" hidden>' +
      '<button class="btn danger" id="dt-reset">Reset to sheet snapshot</button>' +
      '</div>');
    $('#dt-export').addEventListener('click', async () => {
      download('microregistrar-backup.json', await MicroStore.exportJSON(), 'application/json');
    });
    $('#dt-import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await MicroStore.importJSON(await file.text());
        closeModal(); toast('Backup imported'); route();
      } catch (err) { toast(err.message, 'err'); }
    });
    $('#dt-reset').addEventListener('click', async () => {
      await MicroStore.resetToSeed();
      closeModal(); toast('Data reset to sheet snapshot'); route();
    });
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ---------- modal plumbing ---------- */

  function openModal(title, bodyHtml) {
    $('#modal-title').textContent = title.replace(/<[^>]*>/g, '');
    $('#modal-body').innerHTML = bodyHtml;
    $('#modal-backdrop').classList.add('show');
    const first = $('#modal-body input, #modal-body select, #modal-body button');
    if (first) first.focus();
  }
  function closeModal() { $('#modal-backdrop').classList.remove('show'); }

  /* ---------- boot ---------- */

  function buildSidebar() {
    $('#nav-tabs').innerHTML = TABS.map((t) =>
      '<a class="nav-link" href="#/tab/' + esc(t.key) + '"><span class="nav-ico">' +
      (ICONS.tab[t.icon] || '📄') + '</span>' + esc(t.name) +
      '<span class="nav-count">' + t.recordCount + '</span></a>').join('');
  }

  function initTheme() {
    const KEY = 'microregistrar-theme';
    const saved = localStorage.getItem(KEY);
    if (saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.dataset.theme = 'dark';
    }
    $('#theme-toggle').addEventListener('click', () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      document.documentElement.dataset.theme = dark ? '' : 'dark';
      localStorage.setItem(KEY, dark ? 'light' : 'dark');
    });
  }

  async function boot() {
    renderLoading('Loading Microregistrar…');
    try {
      await MicroStore.init();
      META = await MicroStore.getMeta();
      TABS = await MicroStore.listTabs();
    } catch (err) {
      renderError(err);
      return;
    }
    buildSidebar();
    initTheme();

    $('#global-search').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') location.hash = '#/search/' + encodeURIComponent(e.target.value.trim());
    });
    $('#btn-menu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
    $('#modal-backdrop').addEventListener('click', (e) => {
      if (e.target === e.currentTarget || e.target.closest('[data-close]')) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
      if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
        e.preventDefault(); $('#global-search').focus();
      }
    });

    window.addEventListener('hashchange', route);
    route();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
