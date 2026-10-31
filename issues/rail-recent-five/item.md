---
created: 2026-10-31
updated: 2026-10-31
type: feature
reporter: jari
status: open
priority: normal
lane: rail-recent-five
lane_seq: 1
related: ['@proto-rail-recent']
blocked_by: ['@single-workspace-normal-rail']
preparation: ready
---

# Rail: the five most recent conversations, count configurable

Jari 31.10. chose direction **2 · Viisi viimeisintä** from
`proto-rail-recent` (`issues/proto-rail-recent/result.md`, prototype
`issues/proto-rail-recent/prototypes/raide.html`), with one change: the
count must be configurable.

Implement it on main as the result's "Implementing it on main" describes:
a third rail section below Käynnissä listing the most recently changed
conversations (`changed_at`), not archived, not Taskfleet worker
conversations, not already in Sinun vuorosi or Käynnissä, plus the open
conversation; Hiljaiset and its folds go away. Pi's idle stop or a restart
never moves a row.

The count is a per-person setting with default 5, stored in the existing
account preferences (`contracts/v1/account-preferences.schema.json`, the
daemon's preferences document), so it follows the person to every device
like the language. It is set in Settings and findable through the settings
search.

Defaults for the prototype's open questions (Jari did not answer them;
record them under "Decisions for later review"): section name
*Viimeisimmät* / *Recent*; terminal-run conversations are listed;
finished worker conversations are not; the narrow dot rail beside the
editor does not show the section.
