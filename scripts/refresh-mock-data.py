#!/usr/bin/env python3
"""Refresh app/data/mock-data.json from the public Google Sheet export.

Does not modify the remote spreadsheet. Requires network access.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path

SHEET_ID = "1XzlEPyzUM3ljxjzMrxpXLH-Pu_xTlWGC8AtrlRzp5Zw"
EXPORT_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=xlsx"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "app" / "data" / "mock-data.json"

NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}
EPOCH = datetime(1899, 12, 30)
MAPS = {
    "Infection": dict(section=[0], topic=[1], date=[2], gap=[3], rev1=[4], rev2=[5]),
    "Antibiotic": dict(section=[0], topic=[1], date=[2], gap=[3], rev1=[4], rev2=[5]),
    "Bacteria": dict(section=[0], topic=[1], date=[2], gap=[3], rev1=[4], rev2=[5]),
    "Mycology": dict(section=[0], topic=[1], date=[2], gap=[3], rev1=[4], rev2=[5]),
    "Virology": dict(section=[1], topic=[2], date=[3], gap=[4], rev1=[5], rev2=[6]),
    "Parasitology": dict(section=[], topic=[1], date=[4], gap=[5], rev1=[6], rev2=[7]),
    "Lab": dict(section=[], topic=[1], date=[4], gap=[5], rev1=[6], rev2=[7]),
    "Transplant": dict(section=[], topic=[1], date=[3], gap=[4], rev1=[5], rev2=[6]),
    "IPC": dict(section=[1], topic=[2], date=[4], gap=[5], rev1=[6], rev2=[7]),
    "Vaccine": dict(section=[], topic=[1], date=[3], gap=[4], rev1=[5], rev2=[6]),
    "Statistics": dict(section=[1], topic=[2], date=[4], gap=[5], rev1=[6], rev2=[7]),
    "HYN": dict(section=[0], topic=[1], date=[4], gap=[5], rev1=[6], rev2=[7]),
}
GAP = ["Not confident", "need more revision", "Exam ready"]


def col_idx(col: str) -> int:
    n = 0
    for c in col:
        n = n * 26 + (ord(c) - 64)
    return n - 1


def parse_ref(ref: str):
    m = re.match(r"([A-Z]+)(\d+)", ref)
    return col_idx(m.group(1)), int(m.group(2)) - 1


def to_a1(r: int, c: int) -> str:
    s = ""
    n = c + 1
    while n:
        n, rem = divmod(n - 1, 26)
        s = chr(65 + rem) + s
    return f"{s}{r + 1}"


def excel_date(n) -> str:
    try:
        return (EPOCH + timedelta(days=float(n))).strftime("%Y-%m-%d")
    except Exception:
        return str(n)


def first_val(grid, ri, cols):
    for c in cols:
        v = grid.get((ri, c))
        if v not in (None, ""):
            return v
    return None


def main() -> int:
    print("Downloading XLSX export…", file=sys.stderr)
    with urllib.request.urlopen(EXPORT_URL, timeout=120) as resp:
        data = resp.read()

    with zipfile.ZipFile(BytesIO(data)) as z:
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        sheets = []
        for sh in wb.findall("main:sheets/main:sheet", NS):
            sheets.append(
                {
                    "name": sh.attrib.get("name"),
                    "rId": sh.attrib.get(
                        "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
                    ),
                }
            )
        rid_to = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in ET.fromstring(z.read("xl/_rels/workbook.xml.rels")).findall(
                "rel:Relationship", NS
            )
        }
        shared = []
        ss = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in ss.findall("main:si", NS):
            shared.append("".join((t.text or "") for t in si.findall(".//main:t", NS)))

        def load_sheet(r_id: str):
            path = "xl/" + rid_to[r_id]
            root = ET.fromstring(z.read(path))
            hlinks = {}
            for hl in root.findall("main:hyperlinks/main:hyperlink", NS):
                item = {"ref": hl.attrib["ref"]}
                rid = hl.attrib.get(
                    "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
                )
                if rid:
                    item["rId"] = rid
                if "location" in hl.attrib:
                    item["location"] = hl.attrib["location"]
                if "display" in hl.attrib:
                    item["display"] = hl.attrib["display"]
                hlinks[hl.attrib["ref"]] = item
            rel_path = path.replace("xl/worksheets/", "xl/worksheets/_rels/") + ".rels"
            url_by = {}
            if rel_path in z.namelist():
                for rel in ET.fromstring(z.read(rel_path)).findall("rel:Relationship", NS):
                    if "hyperlink" in rel.attrib.get("Type", ""):
                        url_by[rel.attrib["Id"]] = rel.attrib.get("Target")
            for h in hlinks.values():
                if "rId" in h:
                    h["url"] = url_by.get(h["rId"])
            grid = {}
            max_r = 0
            for r in root.find("main:sheetData", NS).findall("main:row", NS):
                ri = int(r.attrib["r"]) - 1
                max_r = max(max_r, ri)
                for c in r.findall("main:c", NS):
                    ref = c.attrib["r"]
                    ci, _ = parse_ref(ref)
                    t = c.attrib.get("t")
                    v = c.find("main:v", NS)
                    f = c.find("main:f", NS)
                    is_e = c.find("main:is", NS)
                    if f is not None and f.text and "HYPERLINK(" in f.text.upper():
                        m = re.search(
                            r'HYPERLINK\(\s*"([^"]+)"\s*,\s*"([^"]*)"', f.text, re.I
                        )
                        if m:
                            hlinks[ref] = {
                                "ref": ref,
                                "url": m.group(1),
                                "display": m.group(2),
                                "fromFormula": True,
                            }
                    val = None
                    if t == "s" and v is not None and v.text is not None:
                        val = shared[int(v.text)]
                    elif t == "inlineStr" and is_e is not None:
                        val = "".join((t.text or "") for t in is_e.findall(".//main:t", NS))
                    elif t == "b" and v is not None:
                        val = v.text == "1"
                    elif v is not None:
                        val = v.text
                    grid[(ri, ci)] = val
            return grid, hlinks, max_r

        tabs = {}
        order = [s["name"] for s in sheets]

        # INDEX
        index = next(s for s in sheets if s["name"] == "INDEX")
        grid, hlinks, max_r = load_sheet(index["rId"])
        index_links = []
        for (ri, ci), val in sorted(grid.items()):
            if val in (None, ""):
                continue
            a1 = to_a1(ri, ci)
            h = hlinks.get(a1, {})
            index_links.append(
                {
                    "id": f"idx-{a1}",
                    "label": str(val).strip(),
                    "row": ri + 1,
                    "col": ci + 1,
                    "a1": a1,
                    "url": h.get("url"),
                    "sheetTarget": (h.get("location") or "").split("!")[0].strip("'")
                    if h.get("location")
                    else None,
                }
            )
        whats_new = []
        for ri in range(7, max_r + 1):
            date = grid.get((ri, 5))
            title = grid.get((ri, 6))
            if not title:
                continue
            a1 = to_a1(ri, 6)
            h = hlinks.get(a1, {})
            d = ""
            if date not in (None, ""):
                try:
                    d = excel_date(float(date))
                except Exception:
                    d = str(date)
            whats_new.append(
                {"id": f"wn-{ri + 1}", "date": d, "title": str(title), "link": h.get("url")}
            )
        tabs["INDEX"] = {
            "id": "INDEX",
            "name": "INDEX",
            "kind": "dashboard",
            "description": "Hub page with section navigation, exam resources, what’s new, and external links.",
            "links": index_links,
            "whatsNew": whats_new,
        }

        # Search
        search = next(s for s in sheets if s["name"] == "Search")
        sgrid, shlinks, smax_r = load_sheet(search["rId"])
        search_samples = []
        for ri in range(4, smax_r + 1):
            if not sgrid.get((ri, 0)) and not sgrid.get((ri, 3)):
                continue
            a1 = f"E{ri + 1}"
            h = shlinks.get(a1, {})
            row_v = sgrid.get((ri, 1))
            search_samples.append(
                {
                    "id": f"search-{ri + 1}",
                    "sheetName": sgrid.get((ri, 0)),
                    "row": int(float(row_v)) if row_v not in (None, "") else None,
                    "column": sgrid.get((ri, 2)),
                    "cellContent": sgrid.get((ri, 3)),
                    "link": h.get("url"),
                    "linkLabel": h.get("display") or "Open topic",
                }
            )
        tabs["Search"] = {
            "id": "Search",
            "name": "Search",
            "kind": "search",
            "description": "Native sheet search UI. The web app replaces this with full-text search across all tabs.",
            "headers": ["Sheet Name", "Row", "Column", "Cell Content", "Link"],
            "records": search_samples,
            "note": "Only cached sample rows from export; use in-app search for live filtering.",
        }

        # Interactive HYN
        hyn = next(s for s in sheets if s["name"] == "Interactive HYN")
        hgrid, hhlinks, hmax_r = load_sheet(hyn["rId"])
        hrecs = []
        for ri in range(1, hmax_r + 1):
            group = hgrid.get((ri, 0))
            topic = hgrid.get((ri, 1))
            link = hgrid.get((ri, 2))
            date = hgrid.get((ri, 3))
            if not group and not topic:
                continue
            a1 = f"C{ri + 1}"
            h = hhlinks.get(a1, {})
            url = h.get("url") or (
                link if isinstance(link, str) and str(link).startswith("http") else None
            )
            d = ""
            if date not in (None, "", False, True):
                try:
                    d = excel_date(float(date))
                except Exception:
                    d = str(date)
            hrecs.append(
                {
                    "id": f"ihyn-{ri + 1}",
                    "group": group or "",
                    "topic": topic or "",
                    "link": url or "",
                    "dateUpdated": d,
                }
            )
        tabs["Interactive HYN"] = {
            "id": "Interactive HYN",
            "name": "Interactive HYN",
            "kind": "flat_table",
            "description": "Interactive high-yield notes with group, topic, Moodle link, and update date.",
            "headers": [
                {"key": "group", "label": "Group", "type": "enum"},
                {"key": "topic", "label": "Topic", "type": "text"},
                {"key": "link", "label": "Link", "type": "url"},
                {"key": "dateUpdated", "label": "Date updated", "type": "date"},
            ],
            "validation": {
                "group": [
                    "Generic infection",
                    "Generic antibiotic",
                    "Generic bacteriology",
                    "General Virology",
                    "General Mycology",
                    "General parasitology",
                    "Laboratory",
                    "Misc",
                    "Bacteria",
                    "Virus",
                    "Parasitology",
                    "IPC revision",
                ]
            },
            "records": hrecs,
        }

        for sh in sheets:
            name = sh["name"]
            if name in ("INDEX", "Search", "Interactive HYN", "Curriculum"):
                continue
            grid, hlinks, max_r = load_sheet(sh["rId"])
            m = MAPS[name]
            recs = []
            for ri in range(1, max_r + 1):
                section = first_val(grid, ri, m["section"])
                topic = first_val(grid, ri, m["topic"])
                section = "" if section in (None, False, True) else str(section)
                topic = "" if topic in (None, False, True) else str(topic)
                if not section and not topic:
                    continue
                date = first_val(grid, ri, m["date"])
                d = ""
                if date not in (None, "", False, True):
                    try:
                        d = excel_date(float(date))
                    except Exception:
                        d = str(date)
                gap = first_val(grid, ri, m["gap"])
                gap = "" if gap in (None, False, True) else str(gap)
                rev1 = any(grid.get((ri, c)) is True for c in m["rev1"])
                rev2 = any(grid.get((ri, c)) is True for c in m["rev2"])
                url = ""
                for c in m["section"] + m["topic"] + [0, 1, 2]:
                    h = hlinks.get(to_a1(ri, c))
                    if h and h.get("url"):
                        url = h["url"]
                        break
                row_type = "section" if section and not topic else ("topic" if topic else "other")
                if (
                    not section
                    and topic
                    and re.match(r"^\d+\.", topic)
                    and not re.match(r"^\d+\.\d+", topic)
                ):
                    row_type = "section"
                    section = topic
                    topic = ""
                slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
                recs.append(
                    {
                        "id": f"{slug}-{ri + 1}",
                        "section": section,
                        "topic": topic,
                        "date": d,
                        "gapAnalysis": gap,
                        "revision1": rev1,
                        "revision2": rev2,
                        "link": url,
                        "rowType": row_type,
                    }
                )
            tabs[name] = {
                "id": name,
                "name": name,
                "kind": "topic_outline",
                "description": f"Topic outline for {name} with Moodle links, gap analysis, and revision checkboxes.",
                "headers": [
                    {"key": "section", "label": "Section", "type": "text"},
                    {"key": "topic", "label": "Topic", "type": "text"},
                    {"key": "date", "label": "Date", "type": "date"},
                    {"key": "gapAnalysis", "label": "Gap analysis", "type": "enum"},
                    {"key": "revision1", "label": "Revision 1", "type": "boolean"},
                    {"key": "revision2", "label": "Revision 2", "type": "boolean"},
                    {"key": "link", "label": "Link", "type": "url"},
                ],
                "validation": {"gapAnalysis": GAP},
                "records": recs,
            }

        tabs["Curriculum"] = {
            "id": "Curriculum",
            "name": "Curriculum",
            "kind": "topic_outline",
            "description": "Placeholder tab (empty in source spreadsheet).",
            "headers": [
                {"key": "section", "label": "Section", "type": "text"},
                {"key": "topic", "label": "Topic", "type": "text"},
                {"key": "date", "label": "Date", "type": "date"},
                {"key": "gapAnalysis", "label": "Gap analysis", "type": "enum"},
                {"key": "revision1", "label": "Revision 1", "type": "boolean"},
                {"key": "revision2", "label": "Revision 2", "type": "boolean"},
                {"key": "link", "label": "Link", "type": "url"},
            ],
            "validation": {"gapAnalysis": GAP},
            "records": [],
        }

        out = {
            "meta": {
                "spreadsheetId": SHEET_ID,
                "title": "Microregistrar Moodlecloud Index",
                "source": "Google Sheets public export (read-only snapshot)",
                "exportedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            },
            "tabOrder": order,
            "tabs": tabs,
        }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)", file=sys.stderr)
    for name in order:
        t = tabs[name]
        n = len(t.get("records") or t.get("links") or [])
        print(f"  {name}: {t['kind']} ({n})", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
