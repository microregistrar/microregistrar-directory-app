(function () {
  "use strict";

  var store = null;
  var state = {
    route: { name: "home" },
    query: "",
    tabQuery: "",
    sortKey: "",
    sortDir: "asc",
    filterSection: "",
    filterGap: "",
    filterGroup: "",
    modal: null,
    toast: "",
    loading: true,
    error: "",
    theme: localStorage.getItem("mr-theme") || "light",
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sanitizeUrl(value) {
    if (!value || typeof value !== "string") return null;
    var trimmed = value.trim();
    try {
      var url = new URL(trimmed);
      if (url.protocol === "http:" || url.protocol === "https:") return url.href;
    } catch (err) {
      return null;
    }
    return null;
  }

  function extLink(url, label) {
    var href = sanitizeUrl(url);
    if (!href) return escapeHtml(label || url || "");
    var text = label || href;
    return (
      '<a class="ext-link" href="' +
      escapeHtml(href) +
      '" target="_blank" rel="noopener noreferrer">' +
      escapeHtml(text) +
      "</a>"
    );
  }

  function tabHref(tabId) {
    return "#/tab/" + encodeURIComponent(tabId);
  }

  function parseHash() {
    var hash = (location.hash || "#/").replace(/^#/, "");
    var parts = hash.split("?")[0].split("/").filter(Boolean);
    var params = new URLSearchParams(hash.split("?")[1] || "");
    if (!parts.length || parts[0] === "home") return { name: "home", q: params.get("q") || "" };
    if (parts[0] === "search") return { name: "search", q: params.get("q") || "" };
    if (parts[0] === "tab" && parts[1]) return { name: "tab", id: decodeURIComponent(parts[1]), q: params.get("q") || "" };
    return { name: "home" };
  }

  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("mr-theme", theme);
  }

  function toast(message) {
    state.toast = message;
    renderToast();
    setTimeout(function () {
      if (state.toast === message) {
        state.toast = "";
        renderToast();
      }
    }, 2600);
  }

  function renderToast() {
    var el = $("toast");
    if (!state.toast) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.textContent = state.toast;
  }

  function fieldOptions(tab, field) {
    if (field.options) return field.options;
    var validation = store.validation();
    if (field.optionsRef && validation[field.optionsRef]) return validation[field.optionsRef];
    return [];
  }

  function compare(a, b, key, dir) {
    var av = a[key];
    var bv = b[key];
    if (typeof av === "boolean" || typeof bv === "boolean") {
      av = av ? 1 : 0;
      bv = bv ? 1 : 0;
    }
    av = av == null ? "" : av;
    bv = bv == null ? "" : bv;
    var res = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
    return dir === "desc" ? -res : res;
  }

  function visibleRecords(tab) {
    var rows = tab.records.slice();
    var q = (state.tabQuery || "").trim().toLowerCase();
    if (q) {
      rows = rows.filter(function (row) {
        return JSON.stringify(row).toLowerCase().indexOf(q) !== -1;
      });
    }
    if (tab.kind === "outline" && state.filterSection) {
      rows = rows.filter(function (row) {
        return row.section === state.filterSection;
      });
    }
    if (tab.kind === "outline" && state.filterGap) {
      rows = rows.filter(function (row) {
        return row.gapAnalysis === state.filterGap;
      });
    }
    if (tab.kind === "catalog" && state.filterGroup) {
      rows = rows.filter(function (row) {
        return row.group === state.filterGroup;
      });
    }
    if (state.sortKey) {
      rows.sort(function (a, b) {
        return compare(a, b, state.sortKey, state.sortDir);
      });
    }
    return rows;
  }

  function unique(tab, key) {
    var set = {};
    tab.records.forEach(function (row) {
      if (row[key]) set[row[key]] = true;
    });
    return Object.keys(set).sort();
  }

  function recordTitle(tab, rec) {
    return rec.topic || rec.title || rec.cellContent || rec.group || rec.id;
  }

  function navHtml() {
    var route = state.route;
    var tabs = store.listTabs();
    return tabs
      .map(function (tab) {
        var active = route.name === "tab" && route.id === tab.id ? "active" : "";
        return (
          '<a class="' +
          active +
          '" href="' +
          tabHref(tab.id) +
          '"><span style="display:flex;align-items:center;min-width:0"><span class="dot" style="background:' +
          escapeHtml(tab.color) +
          '"></span>' +
          escapeHtml(tab.title || tab.name) +
          '</span><span class="count">' +
          tab.recordCount +
          "</span></a>"
        );
      })
      .join("");
  }

  function renderShell() {
    if (store && store.workbook) {
      $("nav").innerHTML = navHtml();
      $("source-label").textContent = store.sourceLabel;
    }
    $("global-search").value = state.query;
    $("theme-btn").textContent = state.theme === "dark" ? "Light" : "Dark";
    document.querySelectorAll(".sidebar > .nav a").forEach(function (a) {
      var href = a.getAttribute("href");
      a.classList.toggle("active", (state.route.name === "home" && href === "#/") || (state.route.name === "search" && href === "#/search"));
    });
  }

  function dashboardHtml() {
    var tabs = store.listTabs();
    var indexTab = store.getTab("index");
    var groups = {};
    indexTab.records.forEach(function (rec) {
      if (rec.role === "heading") return;
      var cat = rec.category || "Other";
      groups[cat] = groups[cat] || [];
      groups[cat].push(rec);
    });
        var cards = tabs
      .map(function (tab) {
        var href = tabHref(tab.id);
        return (
          '<a class="card" href="' +
          href +
          '"><h3>' +
          escapeHtml(tab.title) +
          "</h3><p>" +
          escapeHtml(tab.blurb) +
          '</p><div class="meta"><span>' +
          escapeHtml(tab.name) +
          "</span><span>" +
          tab.recordCount +
          " records</span></div></a>"
        );
      })
      .join("");
    var sections = Object.keys(groups)
      .map(function (cat) {
        var items = groups[cat]
          .map(function (rec) {
            var href = sanitizeUrl(rec.url);
            var inner;
            if (rec.internalTab) {
              var dest = store.listTabs().find(function (t) {
                return t.name === rec.internalTab || t.id === rec.internalTab.toLowerCase().replace(/\s+/g, "-");
              });
              inner =
                '<a class="title" href="' +
                (dest ? (dest.id === "index" ? "#/" : dest.id === "search" ? "#/search" : tabHref(dest.id)) : "#/") +
                '">' +
                escapeHtml(rec.title) +
                "</a>";
            } else if (href) {
              inner = extLink(href, rec.title);
            } else {
              inner = '<span class="title">' + escapeHtml(rec.title) + "</span>";
            }
            return (
              '<div class="link-row">' +
              inner +
              '<span class="small muted">' +
              escapeHtml(rec.date || "") +
              "</span></div>"
            );
          })
          .join("");
        return '<h3 class="section-title">' + escapeHtml(cat) + "</h3><div class='link-list'>" + items + "</div>";
      })
      .join("");
    return (
      '<div class="page-head"><p class="crumb">Home</p><h2>Microregistrar directory</h2><p class="lede">Index of every spreadsheet tab, plus the INDEX launchpad (Moodlecloud sections, exams, what’s new, and external resources). Edits stay in this browser until you export.</p></div>' +
      '<div class="banner warn">Data source: snapshot of the public workbook. Original Google Sheet is read-only from this app. ' +
      extLink(store.workbook.meta.sourceUrl, "Open source spreadsheet") +
      ".</div>" +
      '<h3 class="section-title">Spreadsheet tabs</h3><div class="grid-cards">' +
      cards +
      "</div>" +
      sections
    );
  }

  function toolbarHtml(tab, rows) {
    var extras = "";
    if (tab.kind === "outline") {
      extras +=
        '<select id="filter-section"><option value="">All sections</option>' +
        unique(tab, "section")
          .map(function (s) {
            return '<option' + (state.filterSection === s ? " selected" : "") + ">" + escapeHtml(s) + "</option>";
          })
          .join("") +
        "</select>";
      extras +=
        '<select id="filter-gap"><option value="">All gap analysis</option>' +
        (store.validation().gapAnalysis || [])
          .map(function (s) {
            return '<option' + (state.filterGap === s ? " selected" : "") + ">" + escapeHtml(s) + "</option>";
          })
          .join("") +
        "</select>";
    }
    if (tab.kind === "catalog") {
      extras +=
        '<select id="filter-group"><option value="">All groups</option>' +
        (store.validation().hynGroups || [])
          .map(function (s) {
            return '<option' + (state.filterGroup === s ? " selected" : "") + ">" + escapeHtml(s) + "</option>";
          })
          .join("") +
        "</select>";
    }
    return (
      '<div class="toolbar">' +
      '<input id="tab-search" type="search" placeholder="Filter this tab…" value="' +
      escapeHtml(state.tabQuery) +
      '">' +
      extras +
      '<button class="btn btn-primary" data-action="add">Add record</button>' +
      '<button class="btn" data-action="export-csv">Export CSV</button>' +
      '<button class="btn" data-action="import-csv">Import CSV</button>' +
      '<span class="small muted">' +
      rows.length +
      " shown / " +
      tab.records.length +
      " total</span></div>"
    );
  }

  function cellHtml(tab, field, rec) {
    var value = rec[field.key];
    if (field.type === "boolean") {
      return (
        '<label class="check"><input type="checkbox" data-inline="1" data-id="' +
        escapeHtml(rec.id) +
        '" data-key="' +
        escapeHtml(field.key) +
        '"' +
        (value ? " checked" : "") +
        "></label>"
      );
    }
    if (field.type === "url" || /url|link/i.test(field.key)) {
      return extLink(value, value);
    }
    if (field.key === "title" && rec.url) return extLink(rec.url, rec.title);
    if (field.key === "topic" && rec.topicUrl) return extLink(rec.topicUrl, rec.topic || "Open");
    if (field.key === "section" && rec.sectionUrl) return extLink(rec.sectionUrl, rec.section);
    if (field.key === "internalTab" && value) {
      var dest = store.listTabs().find(function (t) {
        return t.name === value || t.id === String(value).toLowerCase().replace(/\s+/g, "-");
      });
      if (dest) return '<a href="' + (dest.id === "search" ? "#/search" : dest.id === "index" ? "#/" : tabHref(dest.id)) + '">' + escapeHtml(value) + "</a>";
    }
    if (field.key === "cellContent" && rec.openTopicUrl) return extLink(rec.openTopicUrl, rec.cellContent);
    return escapeHtml(value == null ? "" : value);
  }

  function tableHtml(tab, rows) {
    if (tab.kind === "search") {
      return (
        '<div class="banner warn">The spreadsheet Search tab is an Apps Script UI. This page searches live app records instead. Sample “chronic” result rows from the sheet are kept below for reference.</div>' +
        genericTable(tab, rows)
      );
    }
    if (!tab.records.length) {
      return (
        '<div class="state"><h3>No records yet</h3><p>This tab is empty in the source workbook. Add the first record to begin.</p><button class="btn btn-primary" data-action="add">Add record</button></div>'
      );
    }
    if (!rows.length) {
      return '<div class="state"><h3>No matching records</h3><p>Try clearing search or filters.</p></div>';
    }
    return genericTable(tab, rows);
  }

  function genericTable(tab, rows) {
    var fields = (tab.fields || []).filter(function (f) {
      return f.key !== "sheetRow";
    });
    var head = fields
      .map(function (f) {
        var mark = state.sortKey === f.key ? (state.sortDir === "asc" ? " ↑" : " ↓") : "";
        return '<th data-sort="' + escapeHtml(f.key) + '">' + escapeHtml(f.label) + mark + "</th>";
      })
      .join("");
    var body = rows
      .map(function (rec) {
        var cls = rec.rowType === "section" ? ' class="section-row"' : "";
        var tds = fields
          .map(function (f) {
            return "<td>" + cellHtml(tab, f, rec) + "</td>";
          })
          .join("");
        return (
          "<tr" +
          cls +
          ">" +
          tds +
          '<td class="actions"><button class="btn" data-edit="' +
          escapeHtml(rec.id) +
          '">Edit</button><button class="btn btn-danger" data-del="' +
          escapeHtml(rec.id) +
          '">Delete</button></td></tr>'
        );
      })
      .join("");
    return (
      '<div class="table-wrap"><table><thead><tr>' +
      head +
      "<th>Actions</th></tr></thead><tbody>" +
      body +
      "</tbody></table></div>"
    );
  }

  function tabPageHtml() {
    var tab;
    try {
      tab = store.getTab(state.route.id);
    } catch (err) {
      return '<div class="banner error">Unknown tab. <a href="#/">Return home</a>.</div>';
    }
    var rows = visibleRecords(tab);
    return (
      '<div class="page-head"><p class="crumb"><a href="#/">Home</a> / ' +
      escapeHtml(tab.name) +
      "</p><h2>" +
      escapeHtml(tab.title) +
      "</h2><p class=\"lede\">" +
      escapeHtml(tab.blurb) +
      "</p></div>" +
      toolbarHtml(tab, rows) +
      tableHtml(tab, rows)
    );
  }

  function searchPageHtml() {
    var q = state.query || state.route.q || "";
    var hits = q ? store.search(q) : [];
    var list;
    if (!q) {
      list = '<div class="state"><h3>Search the directory</h3><p>Type a topic, organism, or URL in the bar above.</p></div>';
    } else if (!hits.length) {
      list = '<div class="state"><h3>No results for “' + escapeHtml(q) + '”</h3><p>Try another keyword.</p></div>';
    } else {
      list = hits
        .slice(0, 200)
        .map(function (hit) {
          var rec = hit.record;
          var label = recordTitle(hit.tabId === "index" ? store.getTab("index") : store.getTab(hit.tabId), rec);
          var url = rec.topicUrl || rec.link || rec.url || rec.openTopicUrl || rec.sectionUrl;
          return (
            '<div class="link-row"><div><a class="title" href="' +
            tabHref(hit.tabId) +
            '">' +
            escapeHtml(hit.tabName) +
            " · " +
            escapeHtml(label) +
            "</a><div class='small muted'>" +
            escapeHtml(rec.section || rec.group || rec.category || "") +
            "</div></div><div>" +
            (url ? extLink(url, "Open") : "") +
            "</div></div>"
          );
        })
        .join("");
      list = '<div class="link-list">' + list + "</div>";
    }
    return (
      '<div class="page-head"><p class="crumb"><a href="#/">Home</a> / Search</p><h2>Search</h2><p class="lede">Replaces the spreadsheet Apps Script search. Looks through every tab currently loaded in the app (snapshot + local edits).</p></div>' +
      list
    );
  }

  function renderModal() {
    var root = $("modal-root");
    if (!state.modal) {
      root.innerHTML = "";
      return;
    }
    var modal = state.modal;
    if (modal.type === "confirm") {
      root.innerHTML =
        '<div class="modal-backdrop" data-close="1"><div class="modal" role="dialog"><h3>Delete record</h3><p>This cannot be undone unless you re-import the snapshot.</p><div class="modal-actions"><button class="btn" data-close="1">Cancel</button><button class="btn btn-danger" id="confirm-del">Delete</button></div></div></div>';
      return;
    }
    var tab = store.getTab(modal.tabId);
    var rec = modal.record || {};
    var fields = tab.fields || [];
    var html = fields
      .map(function (field) {
        var value = rec[field.key];
        if (value == null) value = field.type === "boolean" ? false : "";
        var label = "<span>" + escapeHtml(field.label) + "</span>";
        if (field.type === "boolean") {
          return (
            "<label class='check'>" +
            '<input type="checkbox" name="' +
            escapeHtml(field.key) +
            '"' +
            (value ? " checked" : "") +
            ">" +
            escapeHtml(field.label) +
            "</label>"
          );
        }
        if (field.type === "enum") {
          var opts = ['<option value=""></option>'].concat(
            fieldOptions(tab, field).map(function (opt) {
              return '<option' + (String(value) === String(opt) ? " selected" : "") + ">" + escapeHtml(opt) + "</option>";
            })
          );
          return "<label>" + label + '<select name="' + escapeHtml(field.key) + '">' + opts.join("") + "</select></label>";
        }
        if (field.type === "date") {
          return (
            "<label>" +
            label +
            '<input type="date" name="' +
            escapeHtml(field.key) +
            '" value="' +
            escapeHtml(value) +
            '"></label>'
          );
        }
        if (field.type === "url") {
          return (
            "<label>" +
            label +
            '<input type="url" name="' +
            escapeHtml(field.key) +
            '" placeholder="https://" value="' +
            escapeHtml(value) +
            '"></label>'
          );
        }
        if (field.type === "number") {
          return (
            "<label>" +
            label +
            '<input type="text" inputmode="numeric" name="' +
            escapeHtml(field.key) +
            '" value="' +
            escapeHtml(value) +
            '"></label>'
          );
        }
        return (
          "<label>" +
          label +
          '<input type="text" name="' +
          escapeHtml(field.key) +
          '" value="' +
          escapeHtml(value) +
          '"></label>'
        );
      })
      .join("");
    root.innerHTML =
      '<div class="modal-backdrop" data-close="1"><form class="modal" id="edit-form"><h3>' +
      (modal.record && modal.record.id ? "Edit record" : "Add record") +
      " · " +
      escapeHtml(tab.name) +
      '</h3><div class="form-grid">' +
      html +
      '</div><p class="small muted">Hyperlink fields accept http(s) URLs. They open in a new tab with rel=noopener noreferrer.</p><div class="modal-actions"><button type="button" class="btn" data-close="1">Cancel</button><button class="btn btn-primary" type="submit">Save</button></div></form></div>';
  }

  function readForm(form, tab) {
    var data = {};
    (tab.fields || []).forEach(function (field) {
      var el = form.elements[field.key];
      if (!el) return;
      if (field.type === "boolean") data[field.key] = !!el.checked;
      else data[field.key] = el.value;
    });
    return data;
  }

  function render() {
    renderShell();
    var view = $("view");
    if (state.loading) {
      view.innerHTML = '<div class="state"><h3>Loading directory…</h3><p>Reading the local workbook snapshot.</p></div>';
      return;
    }
    if (state.error) {
      view.innerHTML =
        '<div class="banner error"><strong>Could not load data.</strong> ' +
        escapeHtml(state.error) +
        "</div>";
      return;
    }
    if (state.route.name === "search") view.innerHTML = searchPageHtml();
    else if (state.route.name === "tab") view.innerHTML = tabPageHtml();
    else view.innerHTML = dashboardHtml();
    renderModal();
    bindView();
  }

  function bindView() {
    var filterSection = $("filter-section");
    if (filterSection) {
      filterSection.onchange = function () {
        state.filterSection = filterSection.value;
        render();
      };
    }
    var filterGap = $("filter-gap");
    if (filterGap) {
      filterGap.onchange = function () {
        state.filterGap = filterGap.value;
        render();
      };
    }
    var filterGroup = $("filter-group");
    if (filterGroup) {
      filterGroup.onchange = function () {
        state.filterGroup = filterGroup.value;
        render();
      };
    }
    var tabSearch = $("tab-search");
    if (tabSearch) {
      tabSearch.oninput = function () {
        state.tabQuery = tabSearch.value;
        var pos = tabSearch.selectionStart;
        render();
        var again = $("tab-search");
        if (again) {
          again.focus();
          try {
            again.setSelectionRange(pos, pos);
          } catch (err) {}
        }
      };
    }
  }

  function openAdd() {
    if (state.route.name !== "tab") {
      location.hash = "#/tab/index";
      return;
    }
    var tabId = state.route.id;
    var tab = store.getTab(tabId);
    var blank = {};
    (tab.fields || []).forEach(function (f) {
      blank[f.key] = f.type === "boolean" ? false : "";
    });
    if (tab.kind === "outline") blank.rowType = "topic";
    state.modal = { type: "edit", tabId: tabId, record: blank };
    renderModal();
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "text/plain" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function onClick(ev) {
    var t = ev.target.closest("[data-action], [data-edit], [data-del], [data-sort], [data-close], #confirm-del, #menu-btn, #theme-btn");
    if (!t) return;
    if (t.id === "menu-btn") {
      $("sidebar").classList.toggle("open");
      $("nav-overlay").classList.toggle("show");
      return;
    }
    if (t.id === "theme-btn") {
      setTheme(state.theme === "dark" ? "light" : "dark");
      render();
      return;
    }
    if (t.classList.contains("modal-backdrop")) {
      if (ev.target !== t) return;
      state.modal = null;
      renderModal();
      return;
    }
    if (t.getAttribute("data-close")) {
      state.modal = null;
      renderModal();
      return;
    }
    if (t.getAttribute("data-sort")) {
      var key = t.getAttribute("data-sort");
      if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      else {
        state.sortKey = key;
        state.sortDir = "asc";
      }
      render();
      return;
    }
    if (t.getAttribute("data-action") === "add") {
      openAdd();
      return;
    }
    if (t.getAttribute("data-action") === "export-csv") {
      var tab = store.getTab(state.route.id);
      download(tab.id + ".csv", store.exportCSV(tab.id), "text/csv");
      toast("CSV exported");
      return;
    }
    if (t.getAttribute("data-action") === "import-csv") {
      $("file-csv").click();
      return;
    }
    if (t.getAttribute("data-edit")) {
      var rec = store.get(state.route.id, t.getAttribute("data-edit"));
      state.modal = { type: "edit", tabId: state.route.id, record: rec };
      renderModal();
      return;
    }
    if (t.getAttribute("data-del")) {
      state.modal = { type: "confirm", tabId: state.route.id, id: t.getAttribute("data-del") };
      renderModal();
      return;
    }
    if (t.id === "confirm-del") {
      store.remove(state.modal.tabId, state.modal.id);
      state.modal = null;
      toast("Record deleted");
      render();
    }
  }

  function onChange(ev) {
    var el = ev.target;
    if (el && el.getAttribute("data-inline")) {
      var patch = {};
      patch[el.getAttribute("data-key")] = el.checked;
      store.update(state.route.id, el.getAttribute("data-id"), patch);
      toast("Saved");
    }
  }

  function onSubmit(ev) {
    if (ev.target.id !== "edit-form") return;
    ev.preventDefault();
    var tab = store.getTab(state.modal.tabId);
    var data = readForm(ev.target, tab);
    var invalidUrl = ["url", "link", "topicUrl", "sectionUrl", "openTopicUrl"].some(function (key) {
      return data[key] && !sanitizeUrl(data[key]);
    });
    if (invalidUrl) {
      toast("URLs must start with http:// or https://");
      return;
    }
    if (state.modal.record && state.modal.record.id) {
      store.update(tab.id, state.modal.record.id, data);
      toast("Record updated");
    } else {
      store.create(tab.id, data);
      toast("Record added");
    }
    state.modal = null;
    render();
  }

  function routeFromLocation() {
    state.route = parseHash();
    if (state.route.q) state.query = state.route.q;
    state.sortKey = "";
    state.filterGap = "";
    state.filterGroup = "";
    state.filterSection = "";
    state.tabQuery = "";
    $("sidebar").classList.remove("open");
    $("nav-overlay").classList.remove("show");
    render();
  }

  function boot() {
    setTheme(state.theme);
    store = MicroData.createAdapter(window.APP_CONFIG || { dataSource: "local" });
    store
      .load()
      .then(function () {
        state.loading = false;
        routeFromLocation();
      })
      .catch(function (err) {
        state.loading = false;
        state.error = err.message || String(err);
        render();
      });

    window.addEventListener("hashchange", routeFromLocation);
    document.addEventListener("click", onClick);
    document.addEventListener("change", onChange);
    document.addEventListener("submit", onSubmit);
    $("nav-overlay").addEventListener("click", function () {
      $("sidebar").classList.remove("open");
      $("nav-overlay").classList.remove("show");
    });
    $("global-search").addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        state.query = ev.target.value;
        location.hash = "#/search?q=" + encodeURIComponent(state.query);
      }
    });
    $("export-json").addEventListener("click", function () {
      download("microregistrar-workbook.json", store.exportJSON(), "application/json");
      toast("JSON exported");
    });
    $("import-json").addEventListener("click", function () {
      $("file-json").click();
    });
    $("reset-data").addEventListener("click", function () {
      if (confirm("Reset local edits and reload the original snapshot?")) {
        store.reset().then(function () {
          toast("Snapshot restored");
          render();
        });
      }
    });
    $("file-json").addEventListener("change", function (ev) {
      var file = ev.target.files[0];
      if (!file) return;
      file.text().then(function (text) {
        try {
          store.importJSON(text);
          toast("JSON imported");
          render();
        } catch (err) {
          toast(err.message || "Import failed");
        }
      });
      ev.target.value = "";
    });
    $("file-csv").addEventListener("change", function (ev) {
      var file = ev.target.files[0];
      if (!file || state.route.name !== "tab") return;
      file.text().then(function (text) {
        try {
          var n = store.importCSV(state.route.id, text);
          toast("Imported " + n + " rows");
          render();
        } catch (err) {
          toast(err.message || "CSV import failed");
        }
      });
      ev.target.value = "";
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
