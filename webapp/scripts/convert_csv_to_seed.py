#!/usr/bin/env python3
"""
Local import workflow: converts the raw per-tab CSV exports in
webapp/data/raw-csv/ (produced from the Google Sheet's public CSV export,
one file per tab) into a single JSON seed file the web app loads at
runtime (webapp/data/seed-data.js).

Usage:
    python3 scripts/convert_csv_to_seed.py

Re-run this any time you drop refreshed CSV exports into data/raw-csv/
(see webapp/README.md "Refreshing data from the sheet" section).
"""
import csv
import json
import os
import re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(BASE, "data", "raw-csv")
OUT_FILE = os.path.join(BASE, "data", "seed-data.js")

# Column maps derived from manual audit of each tab's header row + sample
# rows (see AUDIT.md). Index positions are 0-based CSV columns.
# topicCols: ordered list of columns that can hold a topic string; the
#            index within this list (0/1) becomes the outline "level"
#            for tabs that encode nesting via column offset.
OUTLINE_TABS = {
    "Infection":    dict(topicCols=[0, 1], dateCol=2, gapCol=3, rev1Col=4, rev2Col=5),
    "Antibiotic":   dict(topicCols=[0, 1], dateCol=2, gapCol=3, rev1Col=4, rev2Col=5),
    "Bacteria":     dict(topicCols=[0, 1], dateCol=2, gapCol=3, rev1Col=4, rev2Col=5),
    "Mycology":     dict(topicCols=[0, 1], dateCol=2, gapCol=3, rev1Col=4, rev2Col=5),
    "Virology":     dict(topicCols=[1, 2], dateCol=3, gapCol=4, rev1Col=5, rev2Col=6),
    "Parasitology": dict(topicCols=[1],    dateCol=4, gapCol=5, rev1Col=6, rev2Col=7),
    "Lab":          dict(topicCols=[1],    dateCol=None, gapCol=5, rev1Col=6, rev2Col=7),
    "Transplant":   dict(topicCols=[1],    dateCol=None, gapCol=4, rev1Col=5, rev2Col=6),
    "IPC":          dict(topicCols=[1, 2], dateCol=None, gapCol=5, rev1Col=6, rev2Col=7),
    "Vaccine":      dict(topicCols=[1],    dateCol=None, gapCol=4, rev1Col=5, rev2Col=6),
    "Statistics":   dict(topicCols=[1],    dateCol=None, gapCol=5, rev1Col=6, rev2Col=7),
    "HYN":          dict(topicCols=[0, 1], dateCol=None, gapCol=5, rev1Col=6, rev2Col=7),
}

# Seed keys MUST exactly match the `id` field of each tab entry in
# js/tabs-config.js - that id is what data-layer.js uses to look up
# records at runtime. A mismatch here silently yields 0 records per tab.
TAB_ID_MAP = {
    "Infection": "infection",
    "Antibiotic": "antibiotic",
    "Bacteria": "bacteria",
    "Mycology": "mycology",
    "Virology": "virology",
    "Parasitology": "parasitology",
    "Lab": "lab",
    "Transplant": "transplant",
    "IPC": "ipc",
    "Vaccine": "vaccine",
    "Statistics": "statistics",
    "HYN": "hyn",
    "Curriculum": "curriculum",
    "InteractiveHYN": "interactiveHYN",
    "Index": "index",
}

NUM_PREFIX = re.compile(r"^\s*(\d+(?:\.\d+)*)\.\s*")


def cell(row, idx):
    if idx is None or idx >= len(row):
        return ""
    return row[idx].strip()


def to_bool(v):
    return str(v).strip().upper() == "TRUE"


def level_from_number(text):
    m = NUM_PREFIX.match(text)
    if not m:
        return 1
    return len(m.group(1).split("."))


def load_csv(name):
    path = os.path.join(RAW_DIR, f"{name}.csv")
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.reader(f))


def parse_outline_tab(name, cfg):
    rows = load_csv(name)
    records = []
    next_id = 1
    for row in rows[1:]:  # skip header row
        topic_text = ""
        level = 1
        for i, col in enumerate(cfg["topicCols"]):
            v = cell(row, col)
            if v:
                topic_text = v
                level = i + 1 if len(cfg["topicCols"]) > 1 else level_from_number(v)
                break
        if not topic_text:
            continue  # blank template/padding row
        records.append({
            "id": f"{name.lower()}-{next_id}",
            "level": level,
            "title": topic_text,
            "date": cell(row, cfg["dateCol"]) or None,
            "gapAnalysis": to_bool(cell(row, cfg["gapCol"])) if cfg["gapCol"] is not None else False,
            "revision1": to_bool(cell(row, cfg["rev1Col"])) if cfg["rev1Col"] is not None else False,
            "revision2": to_bool(cell(row, cfg["rev2Col"])) if cfg["rev2Col"] is not None else False,
            "link": None,
            "notes": "",
        })
        next_id += 1
    return records


def parse_interactive_hyn():
    rows = load_csv("Interactive_HYN")
    records = []
    next_id = 1
    for row in rows[1:]:
        topic = cell(row, 1)
        if not topic:
            continue
        records.append({
            "id": f"link-{next_id}",
            "group": cell(row, 0) or "Uncategorised",
            "title": topic,
            "link": cell(row, 2) or None,
            "date": cell(row, 3) or None,
            "reviewed": to_bool(cell(row, 4)),
        })
        next_id += 1
    return records


INDEX_SECTIONS = [
    ("Moodlecloud Sections", [
        "Infection", "Antibiotic", "Bacteria", "Mycology", "Virology", "Parasitology",
        "Laboratory Microbiology", "Transplant Microbiology", "Infection control",
        "Vaccine", "Statistics", "High Yield Notes", "Guideline summary [New]",
    ]),
    ("Additional Materials & External Websites", [
        "Additional materials and helpful external websites",
    ]),
    ("AI Models", [
        "AI models", "ChatGPT - Microregistrar Statistics Coach",
        "ChatGPT- CJD Training Assistant", "Endoscope decontamination coach",
        "Evidence reviewer", "ABMM trainer",
    ]),
    ("Other Documents", [
        "Other documents", "Greenbook MCQ set (obsolete)", "Greenbook MCQ answers (obsolete)",
        "Oxford handbook 3 index", "RCPath Model Q themes", "NICE, Greenbook, SMI etc (List)",
    ]),
    ("Questions & Mock Exams", [
        "Part 1 candidates", "MCQ Module", "Exam planner - Part 1", "Part 2 candidates",
        "Part 2 revision", "Part 2 Q v2025", "Part 2 Mock (33 Q)",
        "Part 2 AI-Guided OSPE Practice", "Exam planner Part 2", "Audio section",
        "Statistics audiobook",
    ]),
    ("External Websites", [
        "External websites", "UK SMI", "EUCAST", "BIA LearnInfection", "Microregistrar.com",
        "Microquora.com", "Greenbook", "NICE", "BNF", "BASHH", "HTM", "BHIVA",
    ]),
    ("Social Media", ["Facebook", "Youtube", "Whatsapp", "LinkedIn"]),
    ("Exam Guide", [
        "Part 1 candidates: read this first - Q analysis,",
        "Part 2 candidates - read this first - Q analysis",
    ]),
]

WHATS_NEW = [
    ("11/09/2026", "TB meningitis"), ("01/08/2026", "Zoliflodacin"),
    ("21/06/2026", "UKSMI: Aerobic actinomycetes"), ("20/06/2026", "UKSMI: Actinomycetes"),
    ("09/06/2026", "Culture media basics"),
    ("09/06/2026", "The retention/storage of pathological records and specimens"),
    ("30/05/2026", "EUCAST based MCQ set (3rd set)"), ("16/05/2026", "Ebola"),
    ("11/05/2026", "New MCQ set: Board type adapted 3 (10Q)"), ("07/05/2026", "Hantavirus"),
    ("23/04/2026", "AMS - UK 5 years plan 2024 - 29 (brief summary)"),
    ("23/04/2026", "AMS - what BNF says"),
    ("23/04/2026", "Antimicrobial stewardship - principles and methods"),
    ("01/04/2026", "Oxidase test"), ("31/03/2026", "VP shunt infection"),
    ("30/03/2026", "Whipple's disease"),
    ("29/03/2026", "Part 2 question set 3 revised and updated"),
    ("28/03/2026", "Presentaion - preparing for part 1 - Teams session"),
    ("23/03/2026", "BBV optout test in emergency department"),
    ("23/03/2026", "OSPE F2F CustomGPT"), ("22/03/2026", "Conjunctivitis"),
    ("21/03/2026", "Varicella zoster virus (VZV) (revised)"), ("17/03/2026", "MALDI-ToF"),
    ("14/03/2026", "Indole test"), ("10/03/2026", "Bile aesculin test"),
    ("08/03/2026", "Digital PCR (dPCR)"), ("02/03/2026", "Lab: Whole genome sequencing"),
]


def build_index_links():
    records = []
    next_id = 1
    for section, items in INDEX_SECTIONS:
        for label in items:
            records.append({
                "id": f"idx-{next_id}",
                "section": section,
                "title": label,
                "date": None,
                "link": None,
            })
            next_id += 1
    for date, label in WHATS_NEW:
        records.append({
            "id": f"idx-{next_id}",
            "section": "What's New (Changelog)",
            "title": label,
            "date": date,
            "link": None,
        })
        next_id += 1
    return records


def main():
    seed = {"tabs": {}}

    for name, cfg in OUTLINE_TABS.items():
        seed["tabs"][name] = parse_outline_tab(name, cfg)

    seed["tabs"]["Curriculum"] = []  # sheet tab exists but has no rows yet
    seed["tabs"]["InteractiveHYN"] = parse_interactive_hyn()
    seed["tabs"]["Index"] = build_index_links()

    # Re-key everything to the app's route ids (see TAB_ID_MAP) so
    # data-layer.js lookups (keyed by tabs-config.js `id`) succeed.
    seed["tabs"] = {TAB_ID_MAP[name]: records for name, records in seed["tabs"].items()}

    for name, records in seed["tabs"].items():
        print(f"{name}: {len(records)} records")

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        f.write("// Auto-generated by scripts/convert_csv_to_seed.py — do not edit by hand.\n")
        f.write("// Regenerate from refreshed CSV exports in data/raw-csv/.\n")
        f.write("window.SEED_DATA = ")
        json.dump(seed, f, indent=2, ensure_ascii=False)
        f.write(";\n")

    print(f"\nWrote {OUT_FILE}")


if __name__ == "__main__":
    main()
