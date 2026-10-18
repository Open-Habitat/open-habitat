# Documentation

`docs/` holds what the code cannot say, starting at `index.md` (root
`AGENTS.md`, "Code is the record"). These Markdown files are also the source
for the Glasspad site. Product pages (`product.md`, `index.md`) are in Finnish
for Jari; the operator guide and decision records are in English for agents
and the future public repository.

## What each document owns

`product.md` is Jari's product goal and usage flows. It says what the product
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

Status and scheduling live in `TODO.md` and the issues. Research, proposals,
reviews and investigation results belong with their issue. `brand/` holds the
identity brief outside the published page set.

## Validation and publishing

Pages live directly under `docs/` or one subdirectory below it. Their paths
without `.md` are the slugs in `glasspad.yaml`, which defines the navigation.
`.glasspad.yaml` holds the stable `space_key: native-agent-host`, so publishing
from another checkout updates the same hosted space.

From the repository root, `python3 scripts/validate-project-view.py` checks the
page set, navigation and ADR registration here, and that every local Markdown
link in the repository's living documents resolves. `git diff --check` catches
whitespace; `TESTING.md` describes the checks for each kind of change.

Publishing is separate from committing: `(cd docs && glasspad publish .)`
creates or updates a shareable hosted site. Consider the contents being shared;
links into repository issue directories may not be accessible to site readers.
