#!/usr/bin/env python3
"""Offline consistency checks for the v1 implementation planning package."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
BRIEF = ROOT / "issues/plan-v1-implementation/implementation-briefs.md"
REVIEW = ROOT / "issues/plan-v1-implementation/review.md"

owners = [
    "build-app-foundation", "build-design-system", "build-workspace-slice",
    "build-history-view", "build-agent-control", "complete-conversation-ui",
    "manage-workspace-lifecycle", "connect-github-workspaces",
    "manage-agent-worktrees", "archive-agent-conversations",
    "prepare-mvp-operations", "verify-v1-resilience",
]
criteria = [f"Y{i}" for i in range(1, 6)] + [f"M{i}" for i in range(1, 8)]
errors: list[str] = []

brief = BRIEF.read_text()
review = REVIEW.read_text()
for slug in owners:
    if f"### `{slug}`" not in brief:
        errors.append(f"missing brief section: {slug}")
    item = ROOT / "issues" / slug / "item.md"
    if not item.exists():
        errors.append(f"missing issue: {slug}")
    elif "planning handoff" not in item.read_text().lower():
        errors.append(f"missing planning handoff: {slug}")

for criterion in criteria:
    rows = re.findall(rf"^\| {criterion}(?:\s|\|)", brief, re.MULTILINE)
    if len(rows) != 1:
        errors.append(f"{criterion} has {len(rows)} ownership-map rows, expected 1")

for gap in ("CG-01", "CG-02", "CG-03", "CG-04", "CT-030", "CT-031", "CT-032", "CT-033"):
    if gap not in brief:
        errors.append(f"missing contract-gap mapping: {gap}")

ct_section = brief.split("## Contract-scenario implementation ownership", 1)[1].split("## Success-criterion ownership map", 1)[0]
for number in range(1, 34):
    scenario = f"CT-{number:03d}"
    count = len(re.findall(rf"\b{scenario}\b", ct_section))
    if count != 1:
        errors.append(f"{scenario} has {count} implementation-owner rows, expected 1")

chain = [
    ("build-app-foundation", "review-implementation-plan"),
    ("build-design-system", "build-app-foundation"),
    ("build-workspace-slice", "build-design-system"),
    ("build-history-view", "build-workspace-slice"),
    ("build-agent-control", "build-history-view"),
]
for slug, blocker in chain:
    text = (ROOT / "issues" / slug / "item.md").read_text()
    if f"'@{blocker}'" not in text:
        errors.append(f"walking-core dependency missing: {slug} <- {blocker}")

human = (ROOT / "issues/review-implementation-plan/item.md").read_text().split("---", 2)[1]
if "labels: [human-review]" not in human or re.search(r"^lane:", human, re.MULTILINE):
    errors.append("review-implementation-plan must remain an unlaned human review")

for required in (
    "ADR 0002", "ADR 0003", "Production design", "Contract policy",
    "Title adapter", "Identity, credentials and security proof order",
    "Alder/Fleetrepo and deployment",
):
    if required not in review:
        errors.append(f"review package missing decision section: {required}")

if errors:
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    sys.exit(1)
print(f"Implementation plan valid: {len(owners)} briefs, {len(criteria)} criterion mappings, 33 contract scenarios, 4 contract corrections.")
