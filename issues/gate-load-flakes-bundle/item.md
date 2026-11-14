---
created: 2026-11-14
updated: 2026-11-14
type: chore
status: open
priority: normal
preparation: ready
lane: gate-load-flakes
lane_seq: 2
---

# Browser cases that fail only under host load (six reports in one)

## Goal

Browser cases that fail only under host load make the clean gate red without
a product defect; on 13.11.2026 the release gate failed twice with 18
timeouts at load 30+, and each rerun costs ten minutes. Make these cases
robust under load (wait for the real condition instead of fixed timing or a
settling layout), or fix the product race where one exists.

Collected from six earlier reports, now closed as duplicates of this issue:

- `browser-flakes-under-load`: several cases that pass alone and fail under load 15–38.
- `intensely-talented-ornament`: lab-conversation recap footer gap measured while the layout settles.
- `positively-flawless-horse`: lab-conversation-scroll first-turn follow; stream never grows under reply jitter.
- `purely-chilly-loss`: rail-unread Enter opened the second conversation under gate load.
- `quota-pressure-escape-flake`: Escape pressed before focus returns to the status panel.
- `lab-startup-spurious-upgrade-notice`: a fresh lab conversation sometimes shows "Palvelin päivitettiin" under reply jitter; investigate first whether this is a real build/instance-fence defect before changing the test.

Their texts and evidence stay in the closed issues.
