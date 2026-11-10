# Documentation

`docs/` holds what the code cannot say, starting at `index.md` (root
`AGENTS.md`, "Code is the record"). `index.md` is a standalone public Markdown
index. The product page, operator guide and decision records are in English;
none requires a hosted documentation service or private repository to read.

## What each document owns

`product.md` is Jari's product goal and user journeys, written for an outside reader. It says what the product
should do and why, not how far the implementation has come: a sentence about
implementation status is a second description of the code and goes stale
without anyone noticing. Visual design lives in `design-system/design.md`.

`operations.md` is the guide for an operator installing the host on their own
server. It describes what the release ships and what the installer must
supply; when a release changes an operator step, the guide changes in the
same commit.

`decisions/` holds architecture decision records while their decision waits
for its code or for Jari's later review, indexed in `decisions/index.md` with
filenames `adr-NNNN-<slug>.md`. A record is removed when its implementation
lands, after the rules the code cannot show have moved into the nearest
`AGENTS.md`; the next record takes the next unused number, so check history
(`git log --all --format= --name-only -- docs/decisions | sort -u`) before
numbering. The wording can be clarified while preserving the decision; a
changed decision gets a new record.

Status and scheduling live in the issue tracker. Research, proposals,
reviews and investigation results belong with their issue. `brand/` holds the
identity brief outside the published page set.

## Validation

Pages live directly under `docs/` or one subdirectory below it. Navigation uses
ordinary relative Markdown links. Keep operator examples installation-neutral,
and explain decision context here rather than depending on archived research.

From the repository root, `python3 scripts/validate-project-view.py` checks ADR
registration and local Markdown links in the repository's living documents.
`git diff --check` catches whitespace; `TESTING.md` describes the checks for
each kind of change.
