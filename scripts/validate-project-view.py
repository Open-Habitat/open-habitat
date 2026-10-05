#!/usr/bin/env python3
"""Validate project documentation and navigation without external dependencies."""

from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "docs"
REQUIRED = {
    "index",
    "product",
    "architecture/index",
    "architecture/components",
    "architecture/identity-and-trust",
    "architecture/conversations",
    "architecture/events-and-recovery",
    "architecture/workspaces",
    "architecture/http-api",
    "architecture/deployment",
    "decisions/index",
}
SLUG = re.compile(r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)?$")
LINK = re.compile(r"!?(?<!\\)\[[^\]]*\]\(([^)]+)\)")
ADR_FILE = re.compile(r"^adr-(\d{4})-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.md$")


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def manifest_slugs(text: str) -> list[str]:
    """Read slug values from this deliberately small, structure-only YAML subset."""
    result: list[str] = []
    for line_no, line in enumerate(text.splitlines(), 1):
        match = re.match(r"^\s*-\s+slug:\s*([a-zA-Z0-9_./-]+)\s*$", line)
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
    if site_target.endswith(".md"):
        site_target = site_target[:-3]
    if (page.parent / site_target).resolve().relative_to(SITE).as_posix() in page_slugs if (page.parent / site_target).resolve().is_relative_to(SITE) else False:
        return
    resolved = (page.parent / target).resolve()
    try:
        resolved.relative_to(ROOT)
    except ValueError:
        fail(errors, f"{page.relative_to(ROOT)}: local link leaves the repository: {raw_target}")
        return
    if not resolved.exists():
        fail(errors, f"{page.relative_to(ROOT)}: missing local link target: {raw_target}")


def main() -> int:
    errors: list[str] = []
    if not SITE.is_dir():
        print("ERROR: docs is missing", file=sys.stderr)
        return 1

    config = SITE / ".glasspad.yaml"
    expected_config = "space_key: native-agent-host\n"
    if not config.is_file() or config.read_text(encoding="utf-8") != expected_config:
        fail(errors, "docs/.glasspad.yaml must contain only 'space_key: native-agent-host'")

    pages = sorted(
        page for page in list(SITE.glob("*.md")) + list(SITE.glob("*/*.md"))
        if page.name not in {"AGENTS.md", "CLAUDE.md"}
        and not page.name.startswith("AGENTS-")
        and page.parent.name != "brand"
    )
    slug_of = {page: page.relative_to(SITE).with_suffix("").as_posix() for page in pages}
    stems = set(slug_of.values())
    missing_required = sorted(REQUIRED - stems)
    if missing_required:
        fail(errors, f"missing required pages: {', '.join(missing_required)}")
    for page in pages:
        if not SLUG.fullmatch(slug_of[page]):
            fail(errors, f"invalid page slug: {slug_of[page]}")

    manifest = SITE / "glasspad.yaml"
    if not manifest.is_file():
        fail(errors, "docs/glasspad.yaml is missing")
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
        for target in LINK.findall(text):
            check_link(errors, page, target, stems)

    adr_ids: dict[str, str] = {}
    decisions_index = SITE / "decisions" / "index.md"
    decisions_text = decisions_index.read_text(encoding="utf-8") if decisions_index.is_file() else ""
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
                fail(errors, f"{page.name}: ADR is not linked from decisions/index.md")

    if errors:
        for message in errors:
            print(f"ERROR: {message}", file=sys.stderr)
        print(f"Project View validation failed with {len(errors)} error(s).", file=sys.stderr)
        return 1
    print(f"Project View valid: {len(pages)} pages, {len(nav_slugs)} navigation entries.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
