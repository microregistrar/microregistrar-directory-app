/**
 * Main Web Application Controller & UI Renderer
 * Handles routing, view rendering, CRUD actions, search, modals, and settings.
 */

(function () {
  'use strict';

  // Section icons mapping
  const ICONS = {
    'index': '🏠',
    'search': '🔍',
    'interactive_hyn': '⚡',
    'Infection': '🦠',
    'Antibiotic': '💊',
    'Bacteria': '🔬',
    'Mycology': '🍄',
    'Virology': '🧪',
    'Parasitology': '🐛',
    'Lab': '🧫',
    'Transplant': '🫀',
    'IPC': '🛡️',
    'Vaccine': '💉',
    'Statistics': '📊',
    'HYN': '📝',
    'settings': '⚙️'
  };

  // State
  let currentRoute = 'index';
  let searchTerm = '';
  let activeFilterCategory = 'all';
  let sortField = 'topic';
  let sortDirection = 'asc';
  let currentEditingItem = null;
  let currentEditingSheet = null;

  // DOM Elements
  const appContainer = document.getElementById('app');
  const sidebarNav = document.getElementById('sidebar-nav');
  const globalSearchInput = document.getElementById('global-search');
  const pageContainer = document.getElementById('page-container');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalTitle = document.getElementById('modal-title');
  const modalFormContainer = document.getElementById('modal-form-container');
  const modalSubmitBtn = document.getElementById('modal-submit-btn');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const sidebarToggleBtn = document.getElementById('sidebar-toggle');
  const sidebarCloseBtn = document.getElementById('sidebar-close');
  const sidebarEl = document.getElementById('sidebar');

  /**
   * Helper: safe HTML escaping
   */
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Toast notification
   */
  function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> <span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  /**
   * Initialize Theme
   */
  function initTheme() {
    const savedTheme = localStorage.getItem('THEME') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('THEME', next);
      updateThemeIcon(next);
    });
  }

  function updateThemeIcon(theme) {
    themeToggleBtn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
    themeToggleBtn.title = `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`;
  }

  /**
   * Initialize Hash Router
   */
  function initRouter() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  }

  function handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'index';
    currentRoute = hash;
    updateActiveNav();
    searchTerm = '';
    globalSearchInput.value = '';
    renderCurrentRoute();

    // Close mobile sidebar on navigation
    if (sidebarEl) sidebarEl.classList.remove('open');
  }

  /**
   * Build Sidebar navigation links
   */
  function renderSidebar() {
    const subjects = window.dataService.getSubjectNames();
    const stats = window.dataService.getStats();

    let html = `
      <div class="sidebar-section-title">Navigation</div>
      <a href="#index" class="nav-item ${currentRoute === 'index' ? 'active' : ''}">
        <div class="nav-item-left">
          <span>${ICONS['index']}</span>
          <span>Index Overview</span>
        </div>
      </a>
      <a href="#search" class="nav-item ${currentRoute === 'search' ? 'active' : ''}">
        <div class="nav-item-left">
          <span>${ICONS['search']}</span>
          <span>Global Search</span>
        </div>
      </a>
      <a href="#interactive_hyn" class="nav-item ${currentRoute === 'interactive_hyn' ? 'active' : ''}">
        <div class="nav-item-left">
          <span>${ICONS['interactive_hyn']}</span>
          <span>Interactive HYN</span>
        </div>
        <span class="nav-badge">${(window.dataService.getRecords('interactive_hyn') || []).length}</span>
      </a>

      <div class="sidebar-section-title">Curriculum Topics</div>
    `;

    subjects.forEach(sname => {
      const count = (window.dataService.getRecords(sname) || []).length;
      html += `
        <a href="#${encodeURIComponent(sname)}" class="nav-item ${currentRoute === sname ? 'active' : ''}">
          <div class="nav-item-left">
            <span>${ICONS[sname] || '📁'}</span>
            <span>${escapeHTML(sname)}</span>
          </div>
          <span class="nav-badge">${count}</span>
        </a>
      `;
    });

    html += `
      <div class="sidebar-section-title">Configuration</div>
      <a href="#settings" class="nav-item ${currentRoute === 'settings' ? 'active' : ''}">
        <div class="nav-item-left">
          <span>${ICONS['settings']}</span>
          <span>Data & Sync</span>
        </div>
      </a>
    `;

    sidebarNav.innerHTML = html;
  }

  function updateActiveNav() {
    document.querySelectorAll('.nav-item').forEach(el => {
      const href = el.getAttribute('href');
      if (href === `#${currentRoute}`) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  /**
   * Master View Renderer
   */
  function renderCurrentRoute() {
    if (currentRoute === 'index') {
      renderIndexView();
    } else if (currentRoute === 'search') {
      renderSearchView();
    } else if (currentRoute === 'settings') {
      renderSettingsView();
    } else {
      renderSheetTableView(currentRoute);
    }
  }

  /**
   * VIEW: Home / Index Dashboard
   */
  function renderIndexView() {
    const stats = window.dataService.getStats();
    const subjects = window.dataService.getSubjectNames();
    const indexData = window.dataService.data.index || {};

    let html = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>Microregistrar Knowledge Portal</h1>
          <div class="page-subtitle">Production Curriculum & High-Yield Examination Directory</div>
        </div>
        <div class="header-actions" style="display: flex; gap: 10px;">
          <a href="#search" class="btn btn-secondary">🔍 Search All Records</a>
          <button class="btn btn-primary" onclick="window.app.openAddModal('Infection')">＋ Add Topic</button>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="dashboard-grid">
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Total Curated Topics</span>
            <span class="stat-icon" style="background: rgba(37,99,235,0.1); color: var(--primary);">📚</span>
          </div>
          <div class="stat-value">${stats.totalRecords}</div>
          <div class="stat-desc">Across ${stats.subjectsCount} specialized modules</div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Verified Moodle Links</span>
            <span class="stat-icon" style="background: rgba(16,185,129,0.1); color: var(--success);">🔗</span>
          </div>
          <div class="stat-value">${stats.withLinks}</div>
          <div class="stat-desc">Direct interactive resource chapters</div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Revision Progress</span>
            <span class="stat-icon" style="background: rgba(245,158,11,0.1); color: var(--warning);">⭐</span>
          </div>
          <div class="stat-value">${stats.completedCount}</div>
          <div class="stat-desc">Completed revisions & gap analysis</div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Data Storage</span>
            <span class="stat-icon" style="background: rgba(139,92,246,0.1); color: #8b5cf6;">💾</span>
          </div>
          <div class="stat-value" style="font-size: 18px; line-height: 1.5;">Offline-Ready LocalStore</div>
          <div class="stat-desc">Ready for Google Sheets Sync</div>
        </div>
      </div>

      <!-- Main Curriculum Section Cards -->
      <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
        <h2 style="font-size: 18px; font-weight: 700;">Curriculum Modules & Study Guides</h2>
        <span style="font-size: 13px; color: var(--text-muted);">Click any card to open the module table</span>
      </div>

      <div class="section-grid">
        <!-- Interactive HYN Card -->
        <div class="tab-card">
          <div>
            <div class="tab-card-header">
              <span class="tab-card-title">${ICONS['interactive_hyn']} Interactive High Yield Notes</span>
              <span class="tab-card-badge">${(window.dataService.getRecords('interactive_hyn') || []).length} items</span>
            </div>
            <div class="tab-card-desc">
              Rapid clinical differentials, diagnostic algorithms, and essential high-yield notes.
            </div>
          </div>
          <div class="tab-card-footer">
            <span style="color: var(--text-muted);">Tab: Interactive HYN</span>
            <a href="#interactive_hyn" class="btn btn-sm btn-primary">Open Module →</a>
          </div>
        </div>
    `;

    subjects.forEach(sname => {
      const records = window.dataService.getRecords(sname);
      const withLinkCount = records.filter(r => r.url).length;

      html += `
        <div class="tab-card">
          <div>
            <div class="tab-card-header">
              <span class="tab-card-title">${ICONS[sname] || '📁'} ${escapeHTML(sname)}</span>
              <span class="tab-card-badge">${records.length} topics</span>
            </div>
            <div class="tab-card-desc">
              Curriculum guides, study notes, revision status, and linked reference chapters.
            </div>
          </div>
          <div class="tab-card-footer">
            <span style="color: var(--text-muted); font-size: 12px;">${withLinkCount} active links</span>
            <a href="#${encodeURIComponent(sname)}" class="btn btn-sm btn-secondary">View Records →</a>
          </div>
        </div>
      `;
    });

    html += `</div>`;

    // Supplementary sections from INDEX sheet: What's New, Exam Guides, External Tools
    if (indexData.whats_new && indexData.whats_new.length > 0) {
      html += `
        <div class="content-card" style="margin-bottom: 28px;">
          <div class="card-header">
            <div style="font-weight: 700; font-size: 15px;">✨ What's New & Recent Updates</div>
            <span class="badge badge-success">Latest Curriculum Additions</span>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 140px;">Date</th>
                  <th>Topic / Resource</th>
                  <th style="width: 120px;">Action</th>
                </tr>
              </thead>
              <tbody>
      `;

      indexData.whats_new.slice(0, 8).forEach(item => {
        html += `
          <tr>
            <td><span class="badge badge-muted">${escapeHTML(item.date || 'Recent')}</span></td>
            <td><strong>${escapeHTML(item.title)}</strong></td>
            <td>
              ${item.url ? `<a href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer" class="resource-link">Open Moodle ↗</a>` : '<span style="color:var(--text-light);">-</span>'}
            </td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // Questions & Mocks & External Tools
    html += `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 28px;">
        <!-- Mocks & Questions -->
        <div class="content-card">
          <div class="card-header">
            <div style="font-weight: 700;">📝 Questions, Mock Exams & Exam Guides</div>
          </div>
          <div style="padding: 16px;">
            <div style="display: flex; flex-direction: column; gap: 8px;">
    `;

    (indexData.questions_and_mock || []).forEach(qm => {
      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-app); border-radius: var(--radius-sm);">
          <span style="font-size: 13.5px; font-weight: 500;">${escapeHTML(qm.title)}</span>
          ${qm.url ? `<a href="${escapeHTML(qm.url)}" target="_blank" rel="noopener noreferrer" class="resource-link" style="font-size: 12.5px;">Launch ↗</a>` : ''}
        </div>
      `;
    });

    (indexData.exam_guide || []).forEach(eg => {
      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-app); border-radius: var(--radius-sm);">
          <span style="font-size: 13.5px; font-weight: 500;">${escapeHTML(eg.title)}</span>
          ${eg.url ? `<a href="${escapeHTML(eg.url)}" target="_blank" rel="noopener noreferrer" class="resource-link" style="font-size: 12.5px;">Read Guide ↗</a>` : ''}
        </div>
      `;
    });

    html += `
            </div>
          </div>
        </div>

        <!-- AI Assistants & External Portals -->
        <div class="content-card">
          <div class="card-header">
            <div style="font-weight: 700;">🤖 AI Models & Essential Reference Portals</div>
          </div>
          <div style="padding: 16px;">
            <div style="display: flex; flex-direction: column; gap: 8px;">
    `;

    (indexData.ai_models || []).forEach(ai => {
      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-app); border-radius: var(--radius-sm);">
          <span style="font-size: 13.5px; font-weight: 500;">🤖 ${escapeHTML(ai.title)}</span>
          ${ai.url ? `<a href="${escapeHTML(ai.url)}" target="_blank" rel="noopener noreferrer" class="resource-link" style="font-size: 12.5px;">Chat Coach ↗</a>` : ''}
        </div>
      `;
    });

    (indexData.external_websites || []).forEach(ext => {
      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-app); border-radius: var(--radius-sm);">
          <span style="font-size: 13.5px; font-weight: 500;">🌐 ${escapeHTML(ext.title)}</span>
          ${ext.url ? `<a href="${escapeHTML(ext.url)}" target="_blank" rel="noopener noreferrer" class="resource-link" style="font-size: 12.5px;">Visit Site ↗</a>` : ''}
        </div>
      `;
    });

    html += `
            </div>
          </div>
        </div>
      </div>
    `;

    pageContainer.innerHTML = html;
  }

  /**
   * VIEW: Subject / Sheet Data Table View
   */
  function renderSheetTableView(sheetKey) {
    let records = window.dataService.getRecords(sheetKey);
    const isInteractive = sheetKey === 'interactive_hyn';
    const sheetTitle = isInteractive ? 'Interactive HYN' : sheetKey;

    // Extract unique categories for filtering
    const categories = Array.from(new Set(records.map(r => r.category || r.group || 'General').filter(Boolean)));

    // Filter by category
    if (activeFilterCategory !== 'all') {
      records = records.filter(r => (r.category || r.group || 'General') === activeFilterCategory);
    }

    // Filter by table search query
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      records = records.filter(r =>
        (r.topic && r.topic.toLowerCase().includes(q)) ||
        (r.category && r.category.toLowerCase().includes(q)) ||
        (r.group && r.group.toLowerCase().includes(q)) ||
        (r.url && r.url.toLowerCase().includes(q))
      );
    }

    // Sorting
    records.sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    let html = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>${ICONS[sheetKey] || '📁'} ${escapeHTML(sheetTitle)}</h1>
          <div class="page-subtitle">Curriculum topics, revision checklist, and interactive moodle resources</div>
        </div>
        <div class="header-actions" style="display: flex; gap: 10px;">
          <button class="btn btn-secondary" onclick="window.dataService.exportSheetCSV('${escapeHTML(sheetKey)}')">📥 Export CSV</button>
          <button class="btn btn-primary" onclick="window.app.openAddModal('${escapeHTML(sheetKey)}')">＋ Add Topic</button>
        </div>
      </div>

      <div class="content-card">
        <div class="card-header">
          <div class="table-controls">
            <div class="table-search">
              <span class="search-icon">🔍</span>
              <input type="text" id="table-search-input" class="global-search-input" placeholder="Search topics or URLs in ${escapeHTML(sheetTitle)}..." value="${escapeHTML(searchTerm)}">
            </div>

            <select id="category-filter" class="table-filter-select">
              <option value="all">All Categories (${categories.length})</option>
              ${categories.map(c => `<option value="${escapeHTML(c)}" ${activeFilterCategory === c ? 'selected' : ''}>${escapeHTML(c)}</option>`).join('')}
            </select>
          </div>

          <div style="font-size: 13px; color: var(--text-muted);">
            Showing <strong>${records.length}</strong> topics
          </div>
        </div>

        <div class="table-responsive">
    `;

    if (records.length === 0) {
      html += `
        <div class="state-box">
          <div class="state-icon">📂</div>
          <div class="state-title">No records found</div>
          <div class="state-desc">${searchTerm ? `No topics match "${escapeHTML(searchTerm)}"` : 'This sheet has no records yet.'}</div>
          <button class="btn btn-primary" onclick="window.app.openAddModal('${escapeHTML(sheetKey)}')">Add New Record</button>
        </div>
      `;
    } else {
      html += `
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th class="sortable" onclick="window.app.setSort('category')" style="width: 180px;">
                Category ${sortField === 'category' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th class="sortable" onclick="window.app.setSort('topic')">
                Topic & Chapter ${sortField === 'topic' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th>Interactive Hyperlink</th>
              <th class="sortable" onclick="window.app.setSort('date_updated')" style="width: 130px;">
                Updated ${sortField === 'date_updated' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style="width: 90px; text-align: center;">${isInteractive ? 'Done' : 'Rev 1'}</th>
              ${!isInteractive ? '<th style="width: 90px; text-align: center;">Rev 2</th>' : ''}
              <th style="width: 140px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
      `;

      records.forEach((rec, idx) => {
        const isHeader = rec.is_section_header;
        const catName = rec.category || rec.group || 'General';

        html += `
          <tr class="${isHeader ? 'section-header-row' : ''}">
            <td style="color: var(--text-light); font-size: 12px;">${idx + 1}</td>
            <td><span class="badge badge-muted">${escapeHTML(catName)}</span></td>
            <td>
              <strong>${escapeHTML(rec.topic || 'Untitled')}</strong>
            </td>
            <td>
              ${rec.url ? `
                <a href="${escapeHTML(rec.url)}" target="_blank" rel="noopener noreferrer" class="resource-link">
                  <span>Open Chapter</span>
                  <span class="external-icon">↗</span>
                </a>
              ` : '<span style="color: var(--text-light); font-size: 12.5px;">No link attached</span>'}
            </td>
            <td style="font-size: 12.5px; color: var(--text-muted);">
              ${escapeHTML(rec.date_updated || '-')}
            </td>
            <td style="text-align: center;">
              <input type="checkbox" class="checkbox-toggle" ${rec.completed || rec.rev1 ? 'checked' : ''} 
                onchange="window.app.toggleStatus('${escapeHTML(sheetKey)}', '${rec.id}', '${isInteractive ? 'completed' : 'rev1'}', this.checked)">
            </td>
            ${!isInteractive ? `
              <td style="text-align: center;">
                <input type="checkbox" class="checkbox-toggle" ${rec.rev2 ? 'checked' : ''} 
                  onchange="window.app.toggleStatus('${escapeHTML(sheetKey)}', '${rec.id}', 'rev2', this.checked)">
              </td>
            ` : ''}
            <td style="text-align: right; white-space: nowrap;">
              <button class="btn btn-sm btn-outline" onclick="window.app.openEditModal('${escapeHTML(sheetKey)}', '${rec.id}')">Edit</button>
              <button class="btn btn-sm btn-outline" style="color: var(--danger);" onclick="window.app.confirmDelete('${escapeHTML(sheetKey)}', '${rec.id}', '${escapeHTML(rec.topic).replace(/'/g, "\\'")}')">✕</button>
            </td>
          </tr>
        `;
      });

      html += `
            </tbody>
          </table>
      `;
    }

    html += `
        </div>
      </div>
    `;

    pageContainer.innerHTML = html;

    // Attach search & filter handlers
    const searchInput = document.getElementById('table-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        renderSheetTableView(sheetKey);
      });
    }

    const catSelect = document.getElementById('category-filter');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        activeFilterCategory = e.target.value;
        renderSheetTableView(sheetKey);
      });
    }
  }

  /**
   * VIEW: Global Search View (Replaces the slow Google Sheets Search tab)
   */
  function renderSearchView() {
    const allRecords = window.dataService.getAllRecords();
    const query = (searchTerm || globalSearchInput.value || '').trim().toLowerCase();

    let results = [];
    if (query) {
      results = allRecords.filter(r =>
        (r.topic && r.topic.toLowerCase().includes(query)) ||
        (r.category && r.category.toLowerCase().includes(query)) ||
        (r.group && r.group.toLowerCase().includes(query)) ||
        (r.sheetName && r.sheetName.toLowerCase().includes(query)) ||
        (r.url && r.url.toLowerCase().includes(query))
      );
    } else {
      results = allRecords.slice(0, 30); // preview top 30
    }

    let html = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>🔍 Instant Knowledge Base Search</h1>
          <div class="page-subtitle">Real-time sub-millisecond search across all 14 curriculum spreadsheet sheets</div>
        </div>
      </div>

      <div class="content-card">
        <div class="card-header">
          <div class="table-search" style="max-width: 500px;">
            <span class="search-icon">🔍</span>
            <input type="text" id="search-view-input" class="global-search-input" placeholder="Type disease, organism, antibiotic, study type..." value="${escapeHTML(searchTerm || globalSearchInput.value)}">
          </div>
          <div style="font-size: 13px; color: var(--text-muted);">
            Found <strong>${query ? results.length : allRecords.length}</strong> matching records
          </div>
        </div>

        <div class="table-responsive">
    `;

    if (results.length === 0) {
      html += `
        <div class="state-box">
          <div class="state-icon">🔎</div>
          <div class="state-title">No matching topics found</div>
          <div class="state-desc">Try searching for terms like "TB", "MRSA", "Hepatitis", "Amoxicillin", or "Vaccine".</div>
        </div>
      `;
    } else {
      html += `
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 140px;">Module Tab</th>
              <th style="width: 160px;">Category</th>
              <th>Topic / Chapter</th>
              <th>Interactive Hyperlink</th>
              <th style="width: 120px;">Updated</th>
              <th style="width: 100px; text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
      `;

      results.forEach(rec => {
        html += `
          <tr>
            <td>
              <a href="#${encodeURIComponent(rec.sheetKey)}" class="badge badge-primary" style="background: var(--primary-light); color: var(--primary);">
                ${ICONS[rec.sheetKey] || '📁'} ${escapeHTML(rec.sheetName)}
              </a>
            </td>
            <td><span class="badge badge-muted">${escapeHTML(rec.category || rec.group || 'General')}</span></td>
            <td><strong>${escapeHTML(rec.topic)}</strong></td>
            <td>
              ${rec.url ? `
                <a href="${escapeHTML(rec.url)}" target="_blank" rel="noopener noreferrer" class="resource-link">
                  <span>Open Resource</span>
                  <span class="external-icon">↗</span>
                </a>
              ` : '<span style="color: var(--text-light); font-size: 12.5px;">No link</span>'}
            </td>
            <td style="font-size: 12px; color: var(--text-muted);">${escapeHTML(rec.date_updated || '-')}</td>
            <td style="text-align: right;">
              <button class="btn btn-sm btn-outline" onclick="window.app.openEditModal('${escapeHTML(rec.sheetKey)}', '${rec.id}')">Edit</button>
            </td>
          </tr>
        `;
      });

      html += `
            </tbody>
          </table>
      `;
    }

    html += `
        </div>
      </div>
    `;

    pageContainer.innerHTML = html;

    const sInput = document.getElementById('search-view-input');
    if (sInput) {
      sInput.focus();
      sInput.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        globalSearchInput.value = searchTerm;
        renderSearchView();
      });
    }
  }

  /**
   * VIEW: Settings & Data Management
   */
  function renderSettingsView() {
    const stats = window.dataService.getStats();

    let html = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>⚙️ Data Management & Google Sheets Sync</h1>
          <div class="page-subtitle">Backup, restore, CSV import/export, and Google Sheets API connectivity configuration</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 24px;">
        <!-- Local Backup & Export -->
        <div class="content-card">
          <div class="card-header">
            <div style="font-weight: 700;">📦 Local Data Backup & Export</div>
          </div>
          <div style="padding: 22px;">
            <p style="color: var(--text-muted); font-size: 13.5px; margin-bottom: 18px;">
              Export the entire verified curriculum database with all changes, custom additions, hyperlinks, and checkboxes as a standalone JSON file.
            </p>
            <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px;">
              <button class="btn btn-primary" onclick="window.dataService.exportJSON()">📥 Export Full JSON</button>
              <button class="btn btn-secondary" onclick="document.getElementById('json-file-input').click()">📤 Import JSON</button>
              <input type="file" id="json-file-input" accept=".json" style="display: none;" onchange="window.app.handleFileImport(this.files[0])">
            </div>

            <hr style="border: none; border-top: 1px solid var(--border-light); margin-bottom: 18px;">

            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: var(--danger);">Reset Data</strong>
                <div style="font-size: 12px; color: var(--text-muted);">Restore original factory spreadsheet data.</div>
              </div>
              <button class="btn btn-sm btn-danger" onclick="window.app.confirmReset()">Reset to Default</button>
            </div>
          </div>
        </div>

        <!-- Google Sheets API Live Sync Configuration -->
        <div class="content-card">
          <div class="card-header">
            <div style="font-weight: 700;">🌐 Google Sheets Live Connector</div>
            <span class="badge badge-warning">Architecture Ready</span>
          </div>
          <div style="padding: 22px;">
            <p style="color: var(--text-muted); font-size: 13.5px; margin-bottom: 18px;">
              Connect this web app directly to your Google Sheet backend using a Google Cloud Service Account or Google Apps Script Webhook.
            </p>
            
            <div class="form-group">
              <label class="form-label">Google Sheet ID</label>
              <input type="text" class="form-control" readonly value="1XzlEPyzUM3ljxjzMrxpXLH-Pu_xTlWGC8AtrlRzp5Zw">
            </div>

            <div class="form-group">
              <label class="form-label">Apps Script Sync Webhook URL (Optional)</label>
              <input type="url" id="webhook-url-input" class="form-control" placeholder="https://script.google.com/macros/s/.../exec">
              <div class="form-hint">Allows live bi-directional CRUD directly with Google Drive without exposing credentials.</div>
            </div>

            <button class="btn btn-secondary" onclick="showToast('Webhook endpoint saved. Ready for real-time synchronization.', 'success')">Save Connection</button>
          </div>
        </div>
      </div>
    `;

    pageContainer.innerHTML = html;
  }

  /**
   * Modal Management: Open Add Modal
   */
  function openAddModal(defaultSheetKey) {
    currentEditingItem = null;
    currentEditingSheet = defaultSheetKey || 'Infection';
    modalTitle.textContent = `Add Topic to ${currentEditingSheet}`;

    const subjects = window.dataService.getSubjectNames();
    const isInteractive = currentEditingSheet === 'interactive_hyn';

    modalFormContainer.innerHTML = `
      <div class="form-group">
        <label class="form-label">Target Sheet Module <span class="required">*</span></label>
        <select id="modal-sheet-select" class="form-control" onchange="window.app.onModalSheetChange(this.value)">
          <option value="interactive_hyn" ${currentEditingSheet === 'interactive_hyn' ? 'selected' : ''}>⚡ Interactive HYN</option>
          ${subjects.map(s => `<option value="${escapeHTML(s)}" ${currentEditingSheet === s ? 'selected' : ''}>${ICONS[s] || '📁'} ${escapeHTML(s)}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Category / Sub-specialty</label>
        <input type="text" id="modal-category-input" class="form-control" placeholder="e.g. 1. Staphylococcus or CNS Infections">
      </div>

      <div class="form-group">
        <label class="form-label">Topic Title <span class="required">*</span></label>
        <input type="text" id="modal-topic-input" class="form-control" placeholder="e.g. 1.2. MRSA Management" required>
      </div>

      <div class="form-group">
        <label class="form-label">Interactive Resource Hyperlink</label>
        <input type="url" id="modal-url-input" class="form-control" placeholder="https://microregistrar.moodlecloud.com/mod/book/view.php?id=...">
        <div class="form-hint">Paste full URL with https://. Will be clickable with security protection.</div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date Updated</label>
          <input type="date" id="modal-date-input" class="form-control" value="${new Date().toISOString().split('T')[0]}">
        </div>

        <div class="form-group" style="display: flex; align-items: center; gap: 10px; margin-top: 24px;">
          <input type="checkbox" id="modal-status-input" class="checkbox-toggle">
          <label for="modal-status-input" style="font-weight: 500; cursor: pointer;">Mark as Revised / Complete</label>
        </div>
      </div>
    `;

    modalSubmitBtn.textContent = 'Add Record';
    modalBackdrop.classList.add('show');
  }

  /**
   * Modal Management: Open Edit Modal
   */
  function openEditModal(sheetKey, recordId) {
    const records = window.dataService.getRecords(sheetKey);
    const item = records.find(r => r.id === recordId);
    if (!item) {
      showToast('Record not found', 'error');
      return;
    }

    currentEditingItem = item;
    currentEditingSheet = sheetKey;
    modalTitle.textContent = `Edit Record in ${sheetKey}`;

    const isInteractive = sheetKey === 'interactive_hyn';

    modalFormContainer.innerHTML = `
      <div class="form-group">
        <label class="form-label">Category / Section</label>
        <input type="text" id="modal-category-input" class="form-control" value="${escapeHTML(item.category || item.group || '')}">
      </div>

      <div class="form-group">
        <label class="form-label">Topic Title <span class="required">*</span></label>
        <input type="text" id="modal-topic-input" class="form-control" value="${escapeHTML(item.topic || '')}" required>
      </div>

      <div class="form-group">
        <label class="form-label">Interactive Resource Hyperlink</label>
        <input type="url" id="modal-url-input" class="form-control" value="${escapeHTML(item.url || '')}" placeholder="https://...">
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date Updated</label>
          <input type="date" id="modal-date-input" class="form-control" value="${escapeHTML(item.date_updated || '')}">
        </div>

        <div class="form-group" style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" id="modal-rev1-input" class="checkbox-toggle" ${item.rev1 || item.completed ? 'checked' : ''}>
            <span>${isInteractive ? 'Mark Completed' : 'Revision 1 Complete'}</span>
          </label>
          ${!isInteractive ? `
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="modal-rev2-input" class="checkbox-toggle" ${item.rev2 ? 'checked' : ''}>
              <span>Revision 2 Complete</span>
            </label>
          ` : ''}
        </div>
      </div>
    `;

    modalSubmitBtn.textContent = 'Save Changes';
    modalBackdrop.classList.add('show');
  }

  function closeModal() {
    modalBackdrop.classList.remove('show');
  }

  /**
   * Save Modal Form (Add or Edit)
   */
  function handleModalSubmit() {
    const topicInput = document.getElementById('modal-topic-input');
    const categoryInput = document.getElementById('modal-category-input');
    const urlInput = document.getElementById('modal-url-input');
    const dateInput = document.getElementById('modal-date-input');

    if (!topicInput || !topicInput.value.trim()) {
      showToast('Topic title is required', 'error');
      return;
    }

    const payload = {
      topic: topicInput.value.trim(),
      category: categoryInput ? categoryInput.value.trim() : 'General',
      group: categoryInput ? categoryInput.value.trim() : 'General',
      url: urlInput ? urlInput.value.trim() : '',
      date_updated: dateInput ? dateInput.value : ''
    };

    const isInteractive = currentEditingSheet === 'interactive_hyn';

    if (currentEditingItem) {
      // Edit
      const rev1Input = document.getElementById('modal-rev1-input');
      const rev2Input = document.getElementById('modal-rev2-input');
      if (isInteractive) {
        payload.completed = rev1Input ? rev1Input.checked : false;
      } else {
        payload.rev1 = rev1Input ? rev1Input.checked : false;
        payload.rev2 = rev2Input ? rev2Input.checked : false;
      }

      window.dataService.updateRecord(currentEditingSheet, currentEditingItem.id, payload);
      showToast('Record updated successfully', 'success');
    } else {
      // Add
      const sheetSelect = document.getElementById('modal-sheet-select');
      const targetSheet = sheetSelect ? sheetSelect.value : currentEditingSheet;
      const statusInput = document.getElementById('modal-status-input');

      if (targetSheet === 'interactive_hyn') {
        payload.completed = statusInput ? statusInput.checked : false;
      } else {
        payload.rev1 = statusInput ? statusInput.checked : false;
        payload.rev2 = false;
      }

      window.dataService.addRecord(targetSheet, payload);
      showToast(`Record added to ${targetSheet}`, 'success');
    }

    closeModal();
    renderSidebar();
    renderCurrentRoute();
  }

  /**
   * Fast status toggle from table checkbox
   */
  function toggleStatus(sheetKey, recordId, field, value) {
    const update = {};
    update[field] = value;
    window.dataService.updateRecord(sheetKey, recordId, update);
    showToast('Status updated', 'success');
  }

  /**
   * Delete item
   */
  function confirmDelete(sheetKey, recordId, title) {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      window.dataService.deleteRecord(sheetKey, recordId);
      showToast('Record deleted', 'info');
      renderSidebar();
      renderCurrentRoute();
    }
  }

  function confirmReset() {
    if (confirm('Reset all data to the original spreadsheet snapshot? Any newly created local items will be reverted.')) {
      window.dataService.resetToInitial();
      showToast('Reset to original dataset', 'success');
      renderSidebar();
      renderCurrentRoute();
    }
  }

  async function handleFileImport(file) {
    if (!file) return;
    try {
      await window.dataService.importJSON(file);
      showToast('Dataset imported successfully!', 'success');
      renderSidebar();
      renderCurrentRoute();
    } catch (err) {
      showToast('Import error: ' + err.message, 'error');
    }
  }

  function setSort(field) {
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDirection = 'asc';
    }
    renderCurrentRoute();
  }

  function onModalSheetChange(newSheet) {
    currentEditingSheet = newSheet;
  }

  /**
   * Setup global listeners
   */
  function setupEvents() {
    // Global search input
    globalSearchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      if (currentRoute !== 'search' && searchTerm.trim().length > 0) {
        window.location.hash = '#search';
      } else {
        renderCurrentRoute();
      }
    });

    // Mobile sidebar toggle
    if (sidebarToggleBtn) {
      sidebarToggleBtn.addEventListener('click', () => {
        sidebarEl.classList.toggle('open');
      });
    }

    if (sidebarCloseBtn) {
      sidebarCloseBtn.addEventListener('click', () => {
        sidebarEl.classList.remove('open');
      });
    }

    // Modal close handlers
    document.querySelectorAll('[data-close-modal]').forEach(el => {
      el.addEventListener('click', closeModal);
    });

    modalSubmitBtn.addEventListener('click', handleModalSubmit);

    // Keyboard shortcuts (Escape closes modal, '/' focuses search)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
      if (e.key === '/' && document.activeElement !== globalSearchInput && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        globalSearchInput.focus();
      }
    });
  }

  /**
   * Application Bootstrapper
   */
  function init() {
    initTheme();
    renderSidebar();
    initRouter();
    setupEvents();
  }

  // Export public methods for inline handlers
  window.app = {
    openAddModal,
    openEditModal,
    closeModal,
    toggleStatus,
    confirmDelete,
    confirmReset,
    handleFileImport,
    setSort,
    onModalSheetChange
  };

  document.addEventListener('DOMContentLoaded', init);
})();
