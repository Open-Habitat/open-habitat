---
created: 2026-10-16
updated: 2026-10-16
type: task
reporter: jari
status: open
priority: high
lane: pi-runtime
lane_seq: 6
collision: [internal/daemon]
preparation: ready
---

# Taskfleet skills and host note on the test server

Jari approved on 2026-10-16 (after `taskfleet-skills-for-open-habitat`): install **Taskfleet's own bundled skills as they are**, pinned to the guest's Taskfleet release (0.15), for the test server's Pi, together with **one short host note** that tells agents how this environment differs: no desktop seat or tmux view for the person; the browser shows spinoffs under the parent conversation (Langassa); start spinoffs headless and wait for them with `taskfleet run wait` as a process, so the parent shows "Odotan spinoffia" and wakes when the wait ends; no Telegram, `tw` or Fleetrepo. There are no Open Habitat forks of the skills. Environment neutrality is fixed upstream in Taskfleet (`~/Sources/taskfleet/issues/environment-neutral-skills`), and the guest gets it with the next Taskfleet release.

Distribution: operator-declared, alongside the Taskfleet runtime in Fleetrepo's guest runtime. Both the browser's parent Pi and the spawned workers must discover the skills and the note.

## Acceptance Criteria
- [ ] On the test server, a fresh browser Pi conversation lists the Taskfleet skills, and the note is in its context.
- [ ] One end-to-end proof as the mapped user: Pi starts a tiny spinoff, waits for it with `taskfleet run wait`, and the browser shows the spinoff under the parent. Jari repeats it himself from the browser (KOKEILTAVAA.md).
