---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: open
priority: normal
preparation: ready
lane: unlaned
collision: [web/src/components/AgentTurn, web/src/components/composer]
---

# Stopped turns: no visible interrupt marker; flicker remains in restored conversations

## Description

Jari, 2026-10-24, testing the calmer stop (`stop-turn-flicker`) on 0.0.0-pilot.372:

1. **Flicker remains in a conversation restored from the archive.** "Kyllä siinä oli jotakin vilkkumista, mutta tämä oli arkistosta palautetun keskustelun viesti." In a normal conversation the stop is now fine.
2. **An interrupted turn has no visible interrupt event.** Screenshot: "Millainen on readmen githistoria" → `› 1 työkalu · 4 s` → next user message "Jatka" → `› 1 ajatus · 6 s` → answer. The first turn ended because he stopped it, but nothing says so; every interrupted turn looks like it silently ended. "Musta tässä pitäisi olla jokin oma interrupt-eventti näkyvissä." Show a distinct, quiet marker on a stopped turn (e.g. "Keskeytit" with time), derived from the native history/Pi abort record so it also appears after reload and in restored conversations, not only in the live session.

## Acceptance Criteria

- [ ] Stop in a restored-from-archive conversation is as calm as in a normal one (browser spec reproducing the archive-restore case).
- [ ] A stopped turn shows the interrupt marker live and after reload (unit + browser spec, story).
- [ ] KOKEILTAVAA.md line.
