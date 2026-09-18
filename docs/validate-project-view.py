#!/usr/bin/env python3
"""Validate the maintained Glasspad Project View without external dependencies."""

from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
SITE = DOCS / "site"
REQUIRED = {
    "index",
    "architecture",
    "decisions",
    "evidence",
    "implementation",
    "status",
}
AUTHORITY_FIELDS = ("Authority", "Updates when", "Not the source for")
SLUG = re.compile(r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$")
LINK = re.compile(r"!?(?<!\\)\[[^\]]*\]\(([^)]+)\)")
ADR_FILE = re.compile(r"^adr-(\d{4})-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.md$")
HEX40 = re.compile(r"\*\*Source revision:\*\* `([0-9a-f]{40})`")
DATE = re.compile(r"\*\*Updated:\*\* \d{4}-\d{2}-\d{2}")


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def manifest_slugs(text: str) -> list[str]:
    """Read slug values from this deliberately small, structure-only YAML subset."""
    result: list[str] = []
    for line_no, line in enumerate(text.splitlines(), 1):
        match = re.match(r"^\s*-\s+slug:\s*([a-zA-Z0-9_.-]+)\s*$", line)
        if match:
            result.append(match.group(1))
        elif "slug:" in line:
            raise ValueError(f"unsupported slug syntax at glasspad.yaml:{line_no}")
    return result


def check_link(errors: list[str], page: Path, raw_target: str, page_slugs: set[str]) -> None:
    target = raw_target.strip().split(maxsplit=1)[0].strip("<>")
    target = target.split("#", 1)[0].split("?", 1)[0]
    if not target or re.match(r"^(?:https?://|mailto:|tel:)", target):
        return
    if target.startswith("/"):
        fail(errors, f"{page.relative_to(ROOT)}: absolute local link is not portable: {raw_target}")
        return
    site_target = target[2:] if target.startswith("./") else target
    if "/" not in site_target and site_target.endswith(".md") and site_target[:-3] in page_slugs:
        fail(errors, f"{page.relative_to(ROOT)}: link to a site page must use its slug, not .md: {raw_target}")
        return
    if "/" not in site_target and site_target in page_slugs:
        return
    resolved = (page.parent / target).resolve()
    try:
        resolved.relative_to(SITE)
    except ValueError:
        fail(errors, f"{page.relative_to(ROOT)}: local link leaves the publishable space: {raw_target}")
        return
    if not resolved.exists():
        fail(errors, f"{page.relative_to(ROOT)}: missing local link target: {raw_target}")


def main() -> int:
    errors: list[str] = []
    if not SITE.is_dir():
        print("ERROR: docs/site is missing", file=sys.stderr)
        return 1

    config = SITE / ".glasspad.yaml"
    expected_config = "space_key: native-agent-host\n"
    if not config.is_file() or config.read_text(encoding="utf-8") != expected_config:
        fail(errors, "docs/site/.glasspad.yaml must contain only 'space_key: native-agent-host'")

    for path in SITE.rglob("*"):
        if path.is_symlink():
            fail(errors, f"symlink forbidden inside docs/site: {path.relative_to(ROOT)}")
        if path.parent == SITE and path.is_dir() and path.name != "assets":
            fail(errors, f"unexpected top-level directory in docs/site: {path.name}")
        if path.parent == SITE and path.is_file() and path.name not in {
            ".glasspad.yaml",
            "glasspad.yaml",
        } and path.suffix not in {".md", ".html"}:
            fail(errors, f"unexpected top-level file in docs/site: {path.name}")

    pages = sorted(SITE.glob("*.md"))
    stems = {page.stem for page in pages}
    missing_required = sorted(REQUIRED - stems)
    if missing_required:
        fail(errors, f"missing required pages: {', '.join(missing_required)}")
    for page in pages:
        if not SLUG.fullmatch(page.stem):
            fail(errors, f"invalid page slug: {page.name}")

    manifest = SITE / "glasspad.yaml"
    if not manifest.is_file():
        fail(errors, "docs/site/glasspad.yaml is missing")
        nav_slugs: list[str] = []
    else:
        try:
            nav_slugs = manifest_slugs(manifest.read_text(encoding="utf-8"))
        except ValueError as exc:
            fail(errors, str(exc))
            nav_slugs = []
    counts = Counter(nav_slugs)
    duplicates = sorted(slug for slug, count in counts.items() if count > 1)
    if duplicates:
        fail(errors, f"duplicate manifest slugs: {', '.join(duplicates)}")
    missing_nav = sorted(stems - set(nav_slugs))
    unknown_nav = sorted(set(nav_slugs) - stems)
    if missing_nav:
        fail(errors, f"pages missing from manifest: {', '.join(missing_nav)}")
    if unknown_nav:
        fail(errors, f"manifest slugs without pages: {', '.join(unknown_nav)}")
    for slug in nav_slugs:
        if not SLUG.fullmatch(slug):
            fail(errors, f"invalid manifest slug: {slug}")

    for page in pages:
        text = page.read_text(encoding="utf-8")
        for field in AUTHORITY_FIELDS:
            if not re.search(rf"^\*\*{re.escape(field)}:\*\*\s+\S", text, re.MULTILINE):
                fail(errors, f"{page.relative_to(ROOT)}: missing '**{field}:**' declaration")
        for target in LINK.findall(text):
            check_link(errors, page, target, stems)

    status = SITE / "status.md"
    if status.is_file():
        status_text = status.read_text(encoding="utf-8")
        if not DATE.search(status_text):
            fail(errors, "docs/site/status.md: missing ISO Updated date")
        if not HEX40.search(status_text):
            fail(errors, "docs/site/status.md: missing 40-hex Source revision")

    adr_ids: dict[str, str] = {}
    decisions_text = (SITE / "decisions.md").read_text(encoding="utf-8") if (SITE / "decisions.md").is_file() else ""
    registered_targets: set[str] = set()
    for raw_target in LINK.findall(decisions_text):
        target = raw_target.strip().split(maxsplit=1)[0].strip("<>")
        target = target.split("#", 1)[0].split("?", 1)[0]
        if target.startswith("./"):
            target = target[2:]
        if target.endswith(".md"):
            target = target[:-3]
        registered_targets.add(target)
    for page in pages:
        match = ADR_FILE.fullmatch(page.name)
        if page.name.startswith("adr-") and not match:
            fail(errors, f"invalid ADR filename: {page.name}; expected adr-NNNN-<slug>.md")
        if match:
            adr_id = match.group(1)
            if adr_id in adr_ids:
                fail(errors, f"duplicate ADR id {adr_id}: {adr_ids[adr_id]} and {page.name}")
            adr_ids[adr_id] = page.name
            if page.stem not in registered_targets:
                fail(errors, f"{page.name}: ADR is not linked from decisions.md")

    if errors:
        for message in errors:
            print(f"ERROR: {message}", file=sys.stderr)
        print(f"Project View validation failed with {len(errors)} error(s).", file=sys.stderr)
        return 1
    print(f"Project View valid: {len(pages)} pages, {len(nav_slugs)} navigation entries.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
