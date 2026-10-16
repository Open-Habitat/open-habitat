---
created: 2026-10-16
updated: 2026-10-16
type: bug
reporter: jari
status: fixed
priority: high
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
closed: 2026-10-16
---

# New conversation opens slowly with no placeholder; empty 'Ei prosesseja' row

Jari on the test server, 2026-10-16 13.29–13.31 local:
1. `uusi-keskustelu-hidas.png`: pressing the sidebar + of the open-habitat workspace took a very long time before the conversation opened. It should go immediately to a placeholder page for that conversation (the conversation layout with its header and an empty thread), with a spinner or a "Luodaan keskustelua…" state, and turn into the real conversation once Pi has started.
2. `ei-prosesseja.png`: the conversation shows an "Ei prosesseja" bar above the composer. "Jos ei ole prosesseja, ei ole prosesseja. Turha niistä on puhua." (In short: if there are no processes, say nothing.) The process row appears only when the conversation has processes (per `proto-processes`, direction Kentän yllä).

## Acceptance Criteria
- [x] + navigates instantly to a placeholder conversation view, which becomes the real one with no layout jump. Failure and uncertain outcomes show in place (consistent with `reconnect-button-dead`). Browser test.
- [x] No process row without processes; browser test.
