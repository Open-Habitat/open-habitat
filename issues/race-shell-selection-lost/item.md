---
created: 2026-11-10
updated: 2026-11-10
type: bug
status: open
priority: normal
preparation: ready
lane: shell-selection
lane_seq: 1
---

# Terminal selection lost under gate load (browser-shell multi-line paste)

## Description

Clean gate on main `ed9ac446b` (Birch, 10.11.2026) failed one browser case:
`web/tests/browser-shell.spec.ts:241` "@browser-shell multi-line paste asks
first and a selection goes to the composer", at line 298:
`expect(page.locator(".xterm-selection div").first()).toBeVisible()` found
no selection after the spec's 2 s wait. The step exists as a regression check
("the selection and its actions must outlast background reads"), so under
gate load the terminal selection was apparently cleared by a background read
or re-render. The whole spec passed 12/12 alone right after (focused run with
the default 60 ms reply jitter).

A person would see a terminal selection they made disappear before they can
send it to the composer. Establish under load (reply delay 250 ms with seeds,
CPU throttle beside host load, per TESTING.md's ordering detector) whether
the product loses the selection or the spec measures too early, and fix the
cause.
