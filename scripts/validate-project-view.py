#!/usr/bin/env python3
"""Validate project documentation and navigation without external dependencies.

Checks ADR registration under docs/
and that every local Markdown link in the repository's living documents
resolves: tracked Markdown outside issues/, plus the files of open issues. A
reference into git history is written as a plain path, not a link, and
instruction files name no issue at all (root AGENTS.md, "Code is the record").
history/ must stay ignored and untracked, because worker briefs land there.
"""

from __future__ import annotations

import re
import subprocess
import sys
from urllib.parse import unquote
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "docs"
CLOSED = {"done", "fixed", "obsolete", "wontfix", "duplicate", "cannot-reproduce"}
SLUG = re.compile(r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)?$")
LINK = re.compile(r"!?(?<!\\)\[[^\]]*\]\(([^)]+)\)")
ADR_FILE = re.compile(r"^adr-(\d{4})-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.md$")


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


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


def living_markdown() -> list[Path]:
    """Tracked Markdown that the tree keeps current: everything but closed issues."""
    listed = subprocess.run(
        ["git", "-C", str(ROOT), "ls-files", "-z", "--cached", "--others", "--exclude-standard", "*.md"],
        capture_output=True, check=True,
    ).stdout.decode().split("\0")
    result = []
    open_issue: dict[str, bool] = {}
    for name in listed:
        path = ROOT / name
        if not name or not path.is_file() or path.is_symlink() or "node_modules" in path.parts:
            continue
        parts = Path(name).parts
        if parts[0] == "private-dev":
            continue
        # The website's pages link by site URL; its build
        # (starlight-links-validator) checks them, not this file walk.
        if parts[:3] == ("website", "src", "content"):
            continue
        if parts[0] == "issues" and len(parts) > 2:
            if parts[1] not in open_issue:
                item = ROOT / "issues" / parts[1] / "item.md"
                status = re.search(r"^status:\s*(\S+)", item.read_text(encoding="utf-8"), re.M) if item.is_file() else None
                open_issue[parts[1]] = bool(status) and status.group(1) not in CLOSED
            if not open_issue[parts[1]]:
                continue
        result.append(path)
    return result


ISSUE_PATH = re.compile(r"issues/[a-z0-9][a-z0-9-]*")


def instructions() -> list[Path]:
    """Instruction files, which state their rules instead of pointing at issues."""
    names = {"AGENTS.md", "TESTING.md", "AGENTS-WORKFLOW.md", "CONFORMANCE.md"}
    return [
        page for page in living_markdown()
        if page.name in names and not page.relative_to(ROOT).parts[0] == "issues"
    ]


def check_repository_link(errors: list[str], page: Path, raw_target: str) -> None:
    target = raw_target.strip().split(maxsplit=1)[0].strip("<>")
    target = target.split("#", 1)[0].split("?", 1)[0]
    if not target or re.match(r"^(?:[a-z][a-z0-9+.-]*:)", target):
        return
    if not (page.parent / unquote(target)).exists():
        fail(errors, f"{page.relative_to(ROOT)}: missing local link target: {raw_target}")


def main() -> int:
    errors: list[str] = []
    if not SITE.is_dir():
        print("ERROR: docs is missing", file=sys.stderr)
        return 1

    pages = sorted(
        page for page in list(SITE.glob("*.md")) + list(SITE.glob("*/*.md"))
        if page.name not in {"AGENTS.md", "CLAUDE.md"}
        and not page.name.startswith("AGENTS-")
        and page.parent.name != "brand"
    )
    slug_of = {page: page.relative_to(SITE).with_suffix("").as_posix() for page in pages}
    stems = set(slug_of.values())
    for page in pages:
        if not SLUG.fullmatch(slug_of[page]):
            fail(errors, f"invalid page slug: {slug_of[page]}")

    for page in pages:
        text = page.read_text(encoding="utf-8")
        for target in LINK.findall(text):
            check_link(errors, page, target, stems)

    # Generator authoring provenance is not part of the public CLI canon.
    # Catch reinstallations of generator versions that still embed that note.
    for agent in (".claude", ".pi"):
        skill = ROOT / agent / "skills/ai-first-cli-canon/SKILL.md"
        if skill.is_file() and "PROVENANCE / MAINTENANCE" in skill.read_text(encoding="utf-8"):
            fail(errors, f"{skill.relative_to(ROOT)}: remove upstream maintenance provenance before publishing")

    for page in living_markdown():
        if page.is_relative_to(SITE) and page in pages:
            continue
        for target in LINK.findall(page.read_text(encoding="utf-8", errors="ignore")):
            check_repository_link(errors, page, target)

    for page in instructions():
        for match in ISSUE_PATH.finditer(page.read_text(encoding="utf-8", errors="ignore")):
            fail(errors, f"{page.relative_to(ROOT)}: instructions name no issue: {match.group(0)}")

    # Taskfleet copies each worker's brief, which may name private context, to
    # history/.worktree/ inside the checkout. The ignore rule keeps it out of
    # ordinary staging; a tracked history/ path means it was forced past that.
    tracked_history = subprocess.run(
        ["git", "-C", str(ROOT), "ls-files", "--cached", "-z", "--", "history"],
        capture_output=True, check=True,
    ).stdout.decode().split("\0")
    for name in filter(None, tracked_history):
        fail(errors, f"{name}: history/ is agent scratch and must stay untracked")
    probe = subprocess.run(
        ["git", "-C", str(ROOT), "check-ignore", "-q", "--no-index", "history/.worktree/probe.md"],
        capture_output=True,
    )
    if probe.returncode != 0:
        fail(errors, ".gitignore must ignore history/ (worker briefs land in history/.worktree/)")

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
    print(f"Project View valid: {len(pages)} pages.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
