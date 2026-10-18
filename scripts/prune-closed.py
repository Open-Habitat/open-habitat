#!/usr/bin/env python3
"""List, or with --apply remove, closed issues that nothing living names.

A closed issue's directory stays while an open issue, TODO.md or KOKEILTAVAA.md
names its slug; otherwise its content belongs to git history (root AGENTS.md,
"Code is the record"). --apply removes the directories with `git rm -r`, so the
removal is staged for the next commit, drops `related`/`blocked_by` edges that
now point nowhere, and removes the one-off `web/lab/` capture scripts whose
every `issues/<slug>` output directory is gone. --json prints
{"removable": [...], "kept": {slug: [referrers]}, "lab_scripts": [...]}.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ISSUES = ROOT / "issues"
CLOSED = {"done", "fixed", "obsolete", "wontfix", "duplicate", "cannot-reproduce"}
NARRATIVE = ("TODO.md", "KOKEILTAVAA.md")
TEXT = {".md", ".txt", ".yaml", ".yml", ".json", ".jsonl", ".log"}


def status(item: Path) -> str | None:
    match = re.search(r"^status:\s*(\S+)", item.read_text(encoding="utf-8"), re.M)
    return match.group(1) if match else None


def drop_dangling_refs() -> None:
    """Remove related/blocked_by edges that point at issues no longer in the tree.

    Only kept closed issues can hold such edges (an open one keeps its targets
    alive), and `issuectl doctor` fails the gate on them.
    """
    doctor = subprocess.run(
        ["issuectl", "doctor", "--json"], cwd=ROOT, capture_output=True, text=True
    )
    refs = json.loads(doctor.stdout)["data"].get("broken_refs", [])
    edges: dict[str, list[str]] = {}
    for ref in refs:
        if ref["kind"] not in {"related", "blocked_by"}:
            continue
        if (ISSUES / ref["target"]).is_dir():
            continue
        flag = "--remove-related" if ref["kind"] == "related" else "--remove-blocked-by"
        edges.setdefault(ref["slug"], []).extend([flag, f"@{ref['target']}"])
    for slug, args in edges.items():
        subprocess.run(
            ["issuectl", "update", slug, *args, "--json"],
            cwd=ROOT,
            check=True,
            stdout=subprocess.DEVNULL,
        )


def one_off_lab_scripts() -> list[str]:
    """Capture scripts that write only into issue directories no longer present."""
    found = []
    for script in sorted((ROOT / "web" / "lab").glob("*.mjs")):
        slugs = set(re.findall(r"issues/([a-z0-9][a-z0-9-]*)", script.read_text(encoding="utf-8")))
        if slugs and not any((ISSUES / slug).is_dir() for slug in slugs):
            found.append(script.relative_to(ROOT).as_posix())
    return found


def main(argv: list[str]) -> int:
    unknown = [a for a in argv if a not in {"--apply", "--json", "-h", "--help"}]
    if unknown or "-h" in argv or "--help" in argv:
        print(__doc__.strip(), file=sys.stderr if unknown else sys.stdout)
        return 2 if unknown else 0
    statuses = {
        d.name: status(d / "item.md")
        for d in sorted(ISSUES.iterdir())
        if (d / "item.md").is_file()
    }
    closed = sorted(s for s, st in statuses.items() if st in CLOSED)
    referrers: dict[str, str] = {}
    for slug, st in statuses.items():
        if st in CLOSED:
            continue
        referrers[f"issues/{slug}"] = "\n".join(
            f.read_text(encoding="utf-8", errors="ignore")
            for f in (ISSUES / slug).rglob("*")
            if f.is_file() and f.suffix in TEXT
        )
    for name in NARRATIVE:
        path = ROOT / name
        if path.is_file():
            referrers[name] = path.read_text(encoding="utf-8")
    kept: dict[str, list[str]] = {}
    removable: list[str] = []
    for slug in closed:
        token = re.compile(r"(?<![A-Za-z0-9-])" + re.escape(slug) + r"(?![A-Za-z0-9-])")
        by = sorted(name for name, text in referrers.items() if token.search(text))
        if by:
            kept[slug] = by
        else:
            removable.append(slug)
    if "--apply" in argv and removable:
        subprocess.run(
            ["git", "rm", "-r", "-q", "--", *(f"issues/{s}" for s in removable)],
            cwd=ROOT,
            check=True,
        )
        drop_dangling_refs()
    lab = one_off_lab_scripts()
    if "--apply" in argv and lab:
        subprocess.run(["git", "rm", "-q", "--", *lab], cwd=ROOT, check=True)
    if "--json" in argv:
        print(json.dumps({"removable": removable, "kept": kept, "lab_scripts": lab, "applied": "--apply" in argv}))
    else:
        verb = "removed" if "--apply" in argv else "removable"
        print(f"{len(removable)} closed issues {verb}, {len(kept)} kept by a living reference.")
        if lab:
            print(f"{len(lab)} one-off lab scripts {verb}: {', '.join(lab)}")
        for slug, by in kept.items():
            print(f"  kept {slug}: {', '.join(by)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
