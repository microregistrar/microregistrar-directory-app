#!/usr/bin/env python3
"""
Export the Microregistrar Google Sheet into normalized JSON seed data
for the web app (assets/data.js).

The sheet is read via its public XLSX export URL (read-only; the original
spreadsheet is never modified). Each content tab is normalized into records:

    { id, section, isSection, topic, url, date, gap, rev1, rev2, group }

Column positions differ per tab in the sheet, so a per-tab mapping below
documents exactly how each sheet column maps to a record field. This keeps
the original schema intact conceptually while making CRUD uniform.

Usage:
    pip install openpyxl requests
    python3 scripts/export_sheet.py [output.js]
"""

import io
import json
import re
import sys
import urllib.request
from datetime import datetime, date, timezone

SPREADSHEET_ID = "1XzlEPyzUM3ljxjzMrxpXLH-Pu_xTlWGC8AtrlRzp5Zw"
EXPORT_URL = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=xlsx"

GAP_OPTIONS = ["Not confident", "need more revision", "Exam ready"]
IHYN_GROUPS = [
    "Generic infection", "Generic antibiotic", "Generic bacteriology",
    "General Virology", "General Mycology", "General parasitology",
    "Laboratory", "Misc", "Bacteria", "Virus", "Parasitology", "IPC revision",
]

# Per-tab column mapping (1-indexed sheet columns).
# section: column holding section headers (None => detect top-level "N. " rows in topic col)
# topic:   column holding the topic text (hyperlink usually attached to this cell)
# link:    extra column holding an explicit link (Interactive HYN only)
# date / gap / rev1 / rev2: as labelled in the sheet header row
TAB_CONFIG = {
    "Infection":       dict(section=1, topic=2, date=3, gap=4, rev1=5, rev2=6),
    "Antibiotic":      dict(section=1, topic=2, date=3, gap=4, rev1=5, rev2=6),
    "Bacteria":        dict(section=1, topic=2, date=3, gap=4, rev1=5, rev2=6),
    "Mycology":        dict(section=1, topic=2, date=3, gap=4, rev1=5, rev2=6),
    "Virology":        dict(section=2, topic=3, date=4, gap=5, rev1=6, rev2=7),
    "Parasitology":    dict(section=None, topic=2, date=5, gap=6, rev1=7, rev2=8),
    "Lab":             dict(section=None, topic=2, date=5, gap=6, rev1=7, rev2=8),
    "Transplant":      dict(section=None, topic=2, date=4, gap=5, rev1=6, rev2=7),
    "IPC":             dict(section=2, topic=3, date=5, gap=6, rev1=7, rev2=8),
    "Vaccine":         dict(section=None, topic=2, date=4, gap=5, rev1=6, rev2=7),
    "Statistics":      dict(section=None, topic=2, date=5, gap=6, rev1=7, rev2=8),
    "HYN":             dict(section=1, topic=2, date=5, gap=6, rev1=7, rev2=8),
    "Interactive HYN": dict(group=1, topic=2, link=3, date=4),
}

TAB_META = {
    "Infection":       dict(key="infection",    icon="virus",    desc="Clinical infection syndromes by system"),
    "Antibiotic":      dict(key="antibiotic",   icon="pill",     desc="Antimicrobial agents and stewardship"),
    "Bacteria":        dict(key="bacteria",     icon="cell",     desc="Bacteriology by organism"),
    "Mycology":        dict(key="mycology",     icon="spore",    desc="Fungal pathogens and antifungals"),
    "Virology":        dict(key="virology",     icon="dna",      desc="Viruses, hepatitis, HIV and antivirals"),
    "Parasitology":    dict(key="parasitology", icon="bug",      desc="Protozoa, helminths and ectoparasites"),
    "Lab":             dict(key="lab",          icon="flask",    desc="Laboratory identification and methods"),
    "Transplant":      dict(key="transplant",   icon="heart",    desc="Transplant infectious diseases"),
    "IPC":             dict(key="ipc",          icon="shield",   desc="Infection prevention and control"),
    "Vaccine":         dict(key="vaccine",      icon="syringe",  desc="Vaccines by Green Book chapter"),
    "Statistics":      dict(key="statistics",   icon="chart",    desc="Epidemiology and statistics"),
    "HYN":             dict(key="hyn",          icon="star",     desc="High-yield notes by discipline"),
    "Interactive HYN": dict(key="interactive-hyn", icon="sparkle", desc="Interactive high-yield note modules"),
}

TOP_LEVEL_RE = re.compile(r"^\d+\.\s")


def cell_text(v):
    if v is None:
        return ""
    if isinstance(v, (datetime, date)):
        return v.strftime("%Y-%m-%d")
    return str(v).strip()


def cell_date(v):
    if isinstance(v, (datetime, date)):
        return v.strftime("%Y-%m-%d")
    s = cell_text(v)
    return s if re.match(r"^\d{4}-\d{2}-\d{2}", s) else ""


def cell_bool(v):
    if isinstance(v, bool):
        return v
    return cell_text(v).lower() == "true"


def cell_link(cell):
    if cell.hyperlink and cell.hyperlink.target:
        return cell.hyperlink.target
    return ""


def export_content_tab(ws, name, cfg):
    records = []
    current_section = ""
    for r in range(2, ws.max_row + 1):
        row_cells = {k: ws.cell(row=r, column=c) for k, c in cfg.items() if c}
        texts = {k: cell_text(c.value) for k, c in row_cells.items()}

        group = texts.get("group", "")
        section_text = texts.get("section", "")
        topic_text = texts.get("topic", "")

        has_content = bool(group or section_text or topic_text)
        if not has_content:
            continue  # skip empty rows and checkbox-residue rows

        is_section = False
        if cfg.get("section") and section_text and not topic_text:
            is_section = True
            current_section = section_text
            topic_text = section_text
        elif cfg.get("section") is None and topic_text and TOP_LEVEL_RE.match(topic_text):
            is_section = True
            current_section = topic_text
        elif cfg.get("section") and section_text and topic_text:
            # both filled on one row: treat section col as the grouping label
            current_section = section_text

        url = ""
        for key in ("link", "topic", "section"):
            if key in row_cells:
                url = cell_link(row_cells[key])
                if url:
                    break

        rec = {
            "id": f"{TAB_META[name]['key']}-r{r}",
            "section": group or (current_section if not is_section else topic_text),
            "isSection": is_section,
            "topic": topic_text,
            "url": url,
            "date": cell_date(row_cells["date"].value) if "date" in row_cells else "",
            "gap": texts.get("gap", "") if texts.get("gap", "") in GAP_OPTIONS else "",
            "rev1": cell_bool(row_cells["rev1"].value) if "rev1" in row_cells else False,
            "rev2": cell_bool(row_cells["rev2"].value) if "rev2" in row_cells else False,
        }
        records.append(rec)
    return records


def export_index_tab(ws):
    """INDEX is a layout page: harvest labelled hyperlinks into groups."""
    col_groups = {
        2: "Site",                     # column B
        4: "Questions & mock exams",   # column D
        7: "What's new",               # column G
        9: "Guides & other contents",  # column I
    }
    quick_links, whats_new = [], []
    seen = set()
    for row in ws.iter_rows():
        for cell in row:
            if not cell.hyperlink:
                continue
            target = cell.hyperlink.target
            label = cell_text(cell.value)
            if not target or not label or target in seen:
                continue  # internal #Tab links are handled natively by the app
            seen.add(target)
            group = col_groups.get(cell.column, "Site")
            if group == "What's new":
                date_cell = ws.cell(row=cell.row, column=6)  # column F holds the date
                whats_new.append({
                    "date": cell_date(date_cell.value),
                    "label": label,
                    "url": target,
                })
            else:
                quick_links.append({"label": label, "url": target, "group": group})
    return {"quickLinks": quick_links, "whatsNew": whats_new}


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else "assets/data.js"
    print(f"Downloading {EXPORT_URL} ...")
    req = urllib.request.Request(EXPORT_URL, headers={"User-Agent": "Mozilla/5.0"})
    data = urllib.request.urlopen(req).read()

    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True)

    tabs = []
    for name, cfg in TAB_CONFIG.items():
        ws = wb[name]
        records = export_content_tab(ws, name, cfg)
        meta = TAB_META[name]
        tabs.append({
            "key": meta["key"],
            "name": name,
            "description": meta["desc"],
            "icon": meta["icon"],
            "hasGroup": "group" in cfg,
            "records": records,
        })
        print(f"  {name}: {len(records)} records")

    index_data = export_index_tab(wb["INDEX"])
    print(f"  INDEX: {len(index_data['quickLinks'])} quick links, "
          f"{len(index_data['whatsNew'])} what's-new items")

    payload = {
        "meta": {
            "title": "Microregistrar",
            "spreadsheetId": SPREADSHEET_ID,
            "spreadsheetUrl": f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit",
            "exportedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "gapOptions": GAP_OPTIONS,
            "interactiveGroups": IHYN_GROUPS,
        },
        "index": index_data,
        "tabs": tabs,
    }

    js = ("// Generated by scripts/export_sheet.py — do not edit by hand.\n"
          "// Re-run the script to refresh from the live Google Sheet.\n"
          "window.SEED_DATA = "
          + json.dumps(payload, ensure_ascii=False, indent=1) + ";\n")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(js)
    total = sum(len(t["records"]) for t in tabs)
    print(f"Wrote {out_path} ({total} records across {len(tabs)} tabs)")


if __name__ == "__main__":
    main()
