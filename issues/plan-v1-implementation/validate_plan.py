#!/usr/bin/env python3
"""Offline consistency checks for the v1 implementation planning package."""
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
BRIEF = ROOT / "issues/plan-v1-implementation/implementation-briefs.md"
REVIEW = ROOT / "issues/plan-v1-implementation/review.md"
CORRECTION_RESULT = ROOT / "issues/apply-review-corrections/result.md"

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
correction_result = CORRECTION_RESULT.read_text()
if "CORRECTION_ARTIFACT_REVISION" in correction_result:
    errors.append("correction artifact revision is not stamped")

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

for gap in ("CG-01", "CG-02", "CG-03", "CG-04", "CT-030", "CT-031", "CT-032", "CT-033", "CT-034"):
    if gap not in brief:
        errors.append(f"missing contract-gap mapping: {gap}")

for required in ("Go is locked to 1.27.1", "TypeScript to 7.0.2", "Biome 2.5.14", "tsc --noEmit", "unique union of at most first four and last four", "one private remote smoke"):
    if required not in brief:
        errors.append(f"corrected implementation invariant missing: {required}")

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

# An issue promises reviewable evidence, not a particular section heading or a
# verdict before work can proceed. Future slices have no screenshots yet.
for slug in owners[:10]:
    text = (ROOT / "issues" / slug / "item.md").read_text()
    # Only the declared review policy counts; a historical decision in Comments
    # cannot substitute for a missing policy for this slice.
    policy = next((section for section in re.split(r"^## ", text, flags=re.MULTILINE)
                   if "visual-acceptance.md" in section), "")
    if (not re.search(r"screenshots?", policy, re.IGNORECASE)
            or not re.search(r"(?:Jari|conductor)[^\n]{0,180}(?:decision|verdict)", policy, re.IGNORECASE)):
        errors.append(f"missing visual evidence and explicit human decision policy: {slug}")

for required in (
    "Frontend and TypeScript", "Go host and restart semantics",
    "Production design and visual acceptance", "Contract and retention policy",
    "Title adapter", "Authentication, session and native credentials",
    "Security and GitHub proof", "Self-hosting, Fleetrepo and release trigger",
):
    if required not in review:
        errors.append(f"review package missing decision section: {required}")

if errors:
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    sys.exit(1)
print(f"Implementation plan valid: {len(owners)} briefs, {len(criteria)} criterion mappings, 34 contract scenarios, 4 contract corrections plus native disconnect.")
