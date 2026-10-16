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
lane_seq: 7
---

# Spinoff group in the thread disappears after returning to the conversation

Jari, 2026-10-16 19:05 local, testing a parent that started two spinoffs (`ui-test-ok`, `ui-test-fail`) and waited for them (spinoffit-live.avif): the thread shows a "Spinoffit 2" group with both rows, and above the composer "Odotan spinoffia · ui-test-ok · Työskentelee +1". At first the upper group (Spinoffit) was missing, then it appeared and its rows were clickable. Coming back to the conversation a moment later, the upper group had disappeared and only the lower status line remained; its small grey texts are clickable after all, but nothing says so.

Find why the thread's spinoff group comes and goes (snapshot vs. history derivation, conversation switching per ADR 0008/0009) from live evidence where possible, and make it stable. The strip above the composer is being redesigned in `proto-composer-strip` (round `2026-10-16-taustatyo`); keep this fix to the group's presence and make clickable texts look clickable.

## Acceptance Criteria
- [ ] The spinoff group stays present across leaving and returning to the conversation, and while spinoffs run and settle (browser test).
- [ ] Clickable parts of the waiting line look clickable.
