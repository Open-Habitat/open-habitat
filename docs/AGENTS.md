# Documentation

`docs/` is the project documentation, starting at `index.md`. It is written for
someone who wants to understand or use the system, and it is also what Glasspad
publishes: the Markdown here is the site, there is no separate source tree.
The product pages (`product.md`, `ui.md`, `design-system.md`, `index.md`) are
in Finnish for Jari. The architecture pages and the decision records are in
English, because agents are their main readers and the repository will be
public. Keep a page in the language it already has.

## Three kinds of page

`architecture/` describes the system as it is. Each page covers one whole:
components and authorities, identity and trust, conversations, events and
recovery, workspaces, the HTTP API, deployment. A page opens with what happens,
in ordinary words, then a Mermaid diagram, then sections. It is written in the
present tense and carries no dates, revisions, review status, or distinction
between agreed and built. What is not built is simply not there, apart from the
short "Not in the system" list on the overview page. Reasons stay, as reasons:
"the gateway cannot read homes because a bug in the component that parses
browser traffic must not become access to files" belongs on the page; "Jari
decided on 2026-09-23" does not. Constants appear only where they shape
behaviour the reader must know; otherwise point at the package. Code pointers
are at package level and sparse, since file names drift. Each page may end
with one line naming the decision records behind it, and does not link records
inline.

Before writing a claim on an architecture page, check it against the current
source. The pages exist to be trusted without reading the code, so a page that
describes last month's behaviour is worse than no page.

`decisions/` holds the architecture decision records, `adr-NNNN-<slug>.md`,
indexed in `decisions/index.md`. They are the history layer and are not edited
to track the present: a decision that changes gets a new record that the old
one links to. The validator requires every record to be linked from the index.

The product pages describe the agreed experience and may say which part is
still being built, because the product is pre-release. Even there, write
"read Pi's session file" rather than "reconstruct the authoritative native
projection". Process vocabulary and acceptance labels displace the explanation
the reader came for.

## What does not belong here

Status, progress and schedule live in `TODO.md` and the issues. Research
reports, proposals awaiting a decision, reviews and investigation results live
in the issue that produced them. A proposal that reaches `docs/` as a page
reads as the current design to the next agent, which is how the old
`logging.md` and `assumptions.md` pages misled readers. Maintenance notes about
pages, such as who updates one and when, belong in this file.

`brand/` holds the identity brief. It is not a page and the validator does not
look at it.

## Files, validation and publishing

Pages live under `docs/` and one level of subdirectories; a page's slug is its
path without `.md`, so `architecture/index` is a slug. `.glasspad.yaml`
contains only `space_key: native-agent-host`, the stable key that lets a
re-publish from any checkout update the hosted space in place. `glasspad.yaml`
is the reader navigation and has to name exactly the pages that exist.

From the repository root, `python3 scripts/validate-project-view.py` checks the
required pages, the navigation, local links and ADR registration;
`git diff --check` catches whitespace. The root `TESTING.md` describes when the
full gate is needed.

Publishing is a separate act from landing on `main`, run as
`(cd docs && glasspad publish .)`. The configured target is hosted, so the
result is a shareable link, and the pages link into issue directories that a
reader of the link may not be able to open. Glasspad renders fenced Mermaid diagrams locally, and versions from 0.20.0
publish pages in the `architecture/` and `decisions/` subdirectories under the
path slugs declared in `glasspad.yaml`. GitHub and editors render the same
source. Publishing still needs an installed Glasspad release that supports
nested pages; never describe a publication that did not happen.
