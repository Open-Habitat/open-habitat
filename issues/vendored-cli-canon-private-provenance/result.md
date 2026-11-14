# Result

Removed the upstream maintenance comment from both vendored canon skills. The
copies remain identical; installation metadata and all canon sections are intact.

## Cause and update handling

`project-canon 0.9.4` still returns the comment through `skill print
ai-first-cli-canon`, confirming that it comes from the generator rather than a
repository-specific edit. The repository validator now rejects that maintenance
marker in either harness copy. Root instructions explain how to remove it after
an install until an upstream release stops emitting it. No installed tool or
external repository was changed.

## Validation and review

- `python3 scripts/test-project-scripts.py`: four tests passed, including clean,
  contaminated and repaired skill fixtures for each harness. Fixtures use
  synthetic authoring context, not the removed private provenance.
- `python3 scripts/validate-project-view.py`: passed (13 pages).
- `cmp` of both vendored skills and `git diff --check`: passed.
- The issue refers to a publication scanner inventory but supplies no executable
  check; that scanner is not present in this checkout. No full publication scan
  is claimed. The gate regression checks this specific recurrence.
- Focused self-review: appropriate for comment removal and a repository-only
  validation rule; no host, upgrade runtime, sessions or wire contract changed.
  No Go/web tests needed.

Live check: inspected the installed generator's actual rendered output and both
repaired on-disk skills; no service or deployment was involved.

## Decisions for later review

Applied the authorized local removal plus an update guard rather than waiting
for an external generator release. This prevents silent reintroduction at the
repository gate but does not fix the upstream generator itself.
