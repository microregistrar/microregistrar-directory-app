// Central registry describing every sheet tab and how it maps into the
// app: route id, display metadata, schema "type" (which drives which
// generic view/form renders it) and the field list used to build
// add/edit forms + table columns. Adding a future sheet tab means adding
// one entry here plus a matching array in data/seed-data.js.

(function (global) {
  "use strict";

  const OUTLINE_FIELDS = [
    { key: "title", label: "Topic", type: "text", required: true, primary: true },
    { key: "level", label: "Outline level", type: "select", options: [
      { value: 1, label: "1 — Section heading" },
      { value: 2, label: "2 — Sub-topic" },
    ] },
    { key: "date", label: "Last revised", type: "date" },
    { key: "gapAnalysis", label: "Gap analysis flagged", type: "checkbox" },
    { key: "revision1", label: "Revision 1 complete", type: "checkbox" },
    { key: "revision2", label: "Revision 2 complete", type: "checkbox" },
    { key: "link", label: "Reference hyperlink (URL)", type: "url" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const LINK_FIELDS = [
    { key: "title", label: "Topic", type: "text", required: true, primary: true },
    { key: "group", label: "Group", type: "text-suggest" },
    { key: "link", label: "Hyperlink (URL)", type: "url", required: true },
    { key: "date", label: "Date updated", type: "date" },
    { key: "reviewed", label: "Reviewed", type: "checkbox" },
  ];

  const INDEX_FIELDS = [
    { key: "title", label: "Label", type: "text", required: true, primary: true },
    { key: "section", label: "Section", type: "text-suggest", required: true },
    { key: "date", label: "Date", type: "date" },
    { key: "link", label: "Hyperlink (URL)", type: "url" },
  ];

  const TABS = [
    {
      id: "index",
      sheetTab: "INDEX",
      title: "Index & Resources",
      shortTitle: "Index",
      icon: "\u{1F5C2}\uFE0F",
      description: "Navigation hub, changelog, external websites, AI tools and reference documents originally laid out across the INDEX tab's columns.",
      type: "index",
      fields: INDEX_FIELDS,
      columns: ["section", "title", "date", "link"],
      groupBy: "section",
    },
    {
      id: "search",
      sheetTab: "Search",
      title: "Search & Help",
      shortTitle: "Search",
      icon: "\u{1F50D}",
      description: "The original tab used a bound Apps Script to search sheet contents. In this app, the global search bar above replaces it instantly, client-side.",
      type: "about",
    },
    {
      id: "interactiveHYN",
      sheetTab: "Interactive HYN",
      title: "Interactive HYN \u2014 Link Library",
      shortTitle: "Interactive HYN",
      icon: "\u{1F517}",
      description: "A flat library of high-yield-note links grouped by topic area, each pointing at a Moodlecloud resource.",
      type: "links",
      fields: LINK_FIELDS,
      columns: ["group", "title", "link", "date", "reviewed"],
      groupBy: "group",
    },
    { id: "infection", sheetTab: "Infection", title: "Infection", shortTitle: "Infection", icon: "\u{1F9A0}", description: "Infection syndromes revision checklist (by body system).", type: "outline", fields: OUTLINE_FIELDS },
    { id: "antibiotic", sheetTab: "Antibiotic", title: "Antibiotic", shortTitle: "Antibiotic", icon: "\u{1F48A}", description: "Antimicrobial classes, resistance mechanisms and stewardship revision checklist.", type: "outline", fields: OUTLINE_FIELDS },
    { id: "bacteria", sheetTab: "Bacteria", title: "Bacteria", shortTitle: "Bacteria", icon: "\u{1F9EB}", description: "Bacteriology topics by genus/species.", type: "outline", fields: OUTLINE_FIELDS },
    { id: "mycology", sheetTab: "Mycology", title: "Mycology", shortTitle: "Mycology", icon: "\u{1F344}", description: "Fungal infections and diagnostics revision checklist.", type: "outline", fields: OUTLINE_FIELDS },
    { id: "virology", sheetTab: "Virology", title: "Virology", shortTitle: "Virology", icon: "\u{1F9EC}", description: "Virology fundamentals, hepatitis, herpesviruses and more.", type: "outline", fields: OUTLINE_FIELDS },
    { id: "parasitology", sheetTab: "Parasitology", title: "Parasitology", shortTitle: "Parasitology", icon: "\u{1FAB1}", description: "Protozoa, nematodes and other parasitology topics.", type: "outline", fields: OUTLINE_FIELDS },
    { id: "lab", sheetTab: "Lab", title: "Laboratory Microbiology", shortTitle: "Lab", icon: "\u{1F52C}", description: "Lab identification schemas and organism ID revision.", type: "outline", fields: OUTLINE_FIELDS },
    { id: "transplant", sheetTab: "Transplant", title: "Transplant Microbiology", shortTitle: "Transplant", icon: "\u{1FAC1}", description: "Solid organ transplant infection risk and management.", type: "outline", fields: OUTLINE_FIELDS },
    { id: "ipc", sheetTab: "IPC", title: "Infection Control (IPC)", shortTitle: "IPC", icon: "\u{1F9F4}", description: "Infection prevention & control frameworks in the NHS.", type: "outline", fields: OUTLINE_FIELDS },
    { id: "vaccine", sheetTab: "Vaccine", title: "Vaccine", shortTitle: "Vaccine", icon: "\u{1F489}", description: "Green Book vaccination chapters revision checklist.", type: "outline", fields: OUTLINE_FIELDS },
    { id: "statistics", sheetTab: "Statistics", title: "Statistics", shortTitle: "Statistics", icon: "\u{1F4CA}", description: "Biostatistics and study-design revision checklist.", type: "outline", fields: OUTLINE_FIELDS },
    { id: "hyn", sheetTab: "HYN", title: "High Yield Notes (HYN)", shortTitle: "HYN", icon: "\u2B50", description: "Cross-topic high-yield notes and exam pearls.", type: "outline", fields: OUTLINE_FIELDS },
    { id: "curriculum", sheetTab: "Curriculum", title: "Curriculum", shortTitle: "Curriculum", icon: "\u{1F4D8}", description: "Reserved for the curriculum tab \u2014 currently empty in the source sheet.", type: "outline", fields: OUTLINE_FIELDS },
  ];

  const OUTLINE_COLUMNS = ["title", "date", "gapAnalysis", "revision1", "revision2", "link"];

  function getTab(id) {
    return TABS.find((t) => t.id === id) || null;
  }

  global.TabsConfig = {
    TABS,
    OUTLINE_COLUMNS,
    getTab,
  };
})(window);
