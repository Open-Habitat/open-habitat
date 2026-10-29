---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: agent
status: open
priority: normal
lane: unlaned
lane_seq: 4
preparation: ready
---

# View offer succeeds silently on a site without views; nothing appears

_Source: other_

## Description

Found by `research-ville-feedback` (29.10.): on an installation without `views.origin_template` in `site.json` (the Northwind pilot), view cards are not shown and `open-habitat agent view offer` still reports a published offer, so the agent tells the person the page was published while nothing appears ("hiljaa näkymätön"). Ville could not see his interactive page.

## Acceptance Criteria

- [ ] Without a views origin, `view offer` fails with a clear code and message the agent can relay (and suggests a file offer instead), and the agent guidance says so.
- [ ] `agent environment show` tells whether views are available on this site.
- [ ] Tests for both configurations.
