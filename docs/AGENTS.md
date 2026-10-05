# Documentation

`docs/` helps readers understand and use the system, starting at `index.md`.
These Markdown files are also the source for the Glasspad site. Product pages
(`product.md`, `index.md`) are in Finnish for Jari; architecture pages and
decision records are in English for agents and the future public repository.

## What each document owns

`product.md` describes the agreed product goal and usage flows. Visual design
lives in `design-system/design.md`. An agreed experience may still await
implementation.

`architecture/` describes the implemented system, grounded in the current
source so readers can trust it without reading the code. Each page explains
one whole, opening with what happens in ordinary words and using Mermaid
diagrams to make relationships visible. Reasons belong beside the choices
they explain. Constants and code references earn their place when they help
explain behavior; package references usually outlast individual filenames.

A brief link to a change issue helps readers understand a limitation or a
choice being reconsidered. Distinguish an open question from an agreed change;
plans and progress stay in the issue. Update the description as implementation
changes, keeping the reference only while it remains useful.

`decisions/` records what was decided and why, indexed in `decisions/index.md`
with filenames `adr-NNNN-<slug>.md`. The wording can be clarified while
preserving the decision. A changed decision gets a new record linked from the
old one; implementation differing from a decision does not itself replace it.

Status and scheduling live in `TODO.md` and the issues. Research, proposals,
reviews and investigation results belong with their issue, where readers can
distinguish them from agreed product direction and implemented behavior.
`brand/` holds the identity brief outside the published page set. Documentation
maintenance guidance belongs here.

## Validation and publishing

Pages live directly under `docs/` or one subdirectory below it. Their paths
without `.md` are the slugs in `glasspad.yaml`, which defines the navigation.
`.glasspad.yaml` holds the stable `space_key: native-agent-host`, so publishing
from another checkout updates the same hosted space.

From the repository root, `python3 scripts/validate-project-view.py` checks the
page set, navigation, local links and ADR registration. `git diff --check`
catches whitespace; `TESTING.md` describes the checks for each kind of change.

Publishing is separate from committing: `(cd docs && glasspad publish .)`
creates or updates a shareable hosted site. Consider the contents being shared;
links into repository issue directories may not be accessible to site readers.
