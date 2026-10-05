#!/usr/bin/env python3
"""Offline consistency checks for the v1 implementation planning package."""
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
BRIEF = ROOT / "issues/plan-v1-implementation/implementation-briefs.md"
SCENARIOS = ROOT / "contracts/v1/scenarios.json"

owners = [
    "build-app-foundation", "build-design-system", "build-workspace-slice",
    "build-history-view", "build-agent-control", "complete-conversation-ui",
    "manage-workspace-lifecycle", "connect-github-workspaces",
    "manage-agent-worktrees", "archive-agent-conversations",
    "installation-and-operations-guide", "verify-v1-resilience",
]
errors: list[str] = []

brief = BRIEF.read_text()
scenarios = json.loads(SCENARIOS.read_text())

for slug in owners:
    if f"### `{slug}`" not in brief:
        errors.append(f"missing brief section: {slug}")
    item = ROOT / "issues" / slug / "item.md"
    if not item.exists():
        errors.append(f"missing issue: {slug}")

assigned = []
for row in brief.splitlines():
    if not row.startswith("| CT-"):
        continue
    scenario_ids = re.findall(r"\bCT-\d{3}\b", row)
    owner_links = re.findall(r"\]\(\.\./([a-z0-9-]+)/item\.md\)", row)
    if len(owner_links) != 1 or not (ROOT / "issues" / owner_links[0] / "item.md").is_file():
        errors.append(f"invalid scenario owner: {row}")
    assigned.extend(scenario_ids)

catalogue_ids = {scenario["id"] for scenario in scenarios}
for scenario in sorted(catalogue_ids):
    count = assigned.count(scenario)
    if count != 1:
        errors.append(f"{scenario} has {count} implementation-owner rows, expected 1")
for scenario in sorted(set(assigned) - catalogue_ids):
    errors.append(f"unknown or retired scenario in ownership map: {scenario}")

chain = [
    ("build-app-foundation", "review-implementation-plan"),
    ("build-design-system", "build-app-foundation"),
    ("build-workspace-slice", "build-design-system"),
    ("build-history-view", "build-workspace-slice"),
]
# The first four edges remain technical/accepted-plan prerequisites. History's
# pending visual verdict is NOT an agent-control prerequisite (c0d4300).
# Read scheduling metadata through issuectl rather than searching YAML spelling.
def issue_metadata(slug: str) -> dict:
    try:
        output = subprocess.run(
            ["issuectl", "--root", str(ROOT), "show", slug, "--json"],
            capture_output=True, text=True, check=True,
        )
        data = json.loads(output.stdout)["data"]
        if not isinstance(data, dict):
            raise ValueError("issue data is not an object")
        return data
    except (OSError, subprocess.CalledProcessError, ValueError, KeyError, TypeError) as exc:
        errors.append(f"cannot read issuectl scheduling metadata for {slug}: {exc}")
        return {}

for slug, blocker in chain:
    if f"@{blocker}" not in issue_metadata(slug).get("blocked_by", []):
        errors.append(f"walking-core dependency missing: {slug} <- {blocker}")

history = issue_metadata("build-history-view")
control = issue_metadata("build-agent-control")
if history.get("lane") != "ui-v1" or control.get("lane") != "agent-control":
    errors.append("history and agent control must have independent scheduling lanes")
if "@build-history-view" in control.get("blocked_by", []):
    errors.append("history visual review must not block agent control")

human = issue_metadata("review-implementation-plan")
if "human-review" not in human.get("labels", []) or human.get("lane") is not None:
    errors.append("review-implementation-plan must remain an unlaned human review")
if "@review-implementation-plan" not in issue_metadata("build-app-foundation").get("blocked_by", []):
    errors.append("product implementation head must remain blocked by review-implementation-plan")

# Open slices promise reviewable evidence, not a verdict before work can proceed.
# Closed slices record what actually happened in their results; they no longer
# need a forward-looking review policy in the issue brief.
for slug in owners[:10]:
    if issue_metadata(slug).get("status") == "done":
        continue
    text = (ROOT / "issues" / slug / "item.md").read_text()
    # Only the declared review policy counts; a historical decision in Comments
    # cannot substitute for a missing policy for this slice.
    policy = next((section for section in re.split(r"^## ", text, flags=re.MULTILINE)
                   if "visual-acceptance.md" in section), "")
    if (not re.search(r"screenshots?", policy, re.IGNORECASE)
            or not re.search(r"(?:Jari|conductor)[^\n]{0,180}(?:decision|verdict)", policy, re.IGNORECASE)):
        errors.append(f"missing visual evidence and explicit human decision policy: {slug}")

if errors:
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    sys.exit(1)
print(f"Implementation map valid: {len(owners)} product areas, {len(scenarios)} assigned contract scenarios.")
