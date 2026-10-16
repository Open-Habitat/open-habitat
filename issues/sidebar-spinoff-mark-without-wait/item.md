---
created: 2026-10-16
updated: 2026-10-16
type: bug
reporter: jari
status: open
priority: high
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
---

# Sidebar shows no spinoff mark when a spinoff works but the parent's wait died

Jari, 2026-10-16 ~19:25 local, live test: a daemon restart (release pilot.183 at 16:22 UTC) killed the parent Pi and its `taskfleet run wait`, while the spinoff kept working in its own Taskfleet user units. Back in the conversation the spinoff showed in the thread as working, but the sidebar dot showed nothing: "Siinä piti olla se semmoinen branch-kuva, missä vilkkuu tavallaan tilanne, että se aliagentti on töissä."

Today the blinking mark follows the parent's wait process (`proto-spinoff-agents` decision: the dot may blink so it is clear which conversation is running, especially in the sidebar). Jari expects it whenever a sub-agent of the conversation is working, wait or no wait. Derive the mark from the spinoff's own Taskfleet state (running children of this parent), and keep "Odottaa spinoffia" wording only where a wait truly exists.

## Acceptance Criteria
- [ ] With a running spinoff and no live wait (after a daemon restart), the sidebar row shows the working-spinoff mark; it clears when the spinoff settles (browser test with host-backed restart).
