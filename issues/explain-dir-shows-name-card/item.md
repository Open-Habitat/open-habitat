---
created: 2026-11-09
updated: 2026-11-09
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Explain mode, repository home: the directory element shows the name's card

## Description

Jari 9.11.2026, test server: in Explain mode (? view) on a repository's home
page, the directory (path) element's explanation is the repository name's
card, so the name's card appears twice and the directory has none of its
own. The screen-element mapping points the directory at the wrong card (or
the directory card is missing and falls back). Defect; fix directly.

## Acceptance Criteria

- [ ] In Explain mode on the repository home, the directory element shows its own card (fi/en), the name keeps its own.
- [ ] Explain mapping check/spec covers the two elements; touched specs green.
