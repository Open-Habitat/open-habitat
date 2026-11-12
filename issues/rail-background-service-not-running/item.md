---
created: 2026-11-12
updated: 2026-11-12
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-11-12/rail-bg-process
lane: unlaned
preparation: ready
closed: 2026-11-12
commits:
- hash: 5c17ef50d
  summary: Give the person the turn over a service the agent left running
- hash: 3a96d6b3e
  summary: Home card names only the waits the turn ended for
---

# A conversation with a live background service shows under Käynnissä although it is the person's turn

## Description

Jari 12.11.2026 on Birch: the fleetrepo conversation "Hillakoneen käyttöönotto"
(`pi:bbb673c6-263d-4a92-9b7c-6c96073acbbe`) sits in the rail's Käynnissä
group although it is his turn: the agent's turn ended at 10:48Z
(`stopReason: stop`, last message "Odotetaan Antin arviota…").

Cause candidate: the conversation has a live background process with
`wakes_agent: true` (`proc_6b7c` "hilla-dell-script-review", an `ssh alder
python3 serve.py` file server that runs until stopped). The rail apparently
treats any running waking process as running work. A long-lived service the
agent started is not work the person waits for; once the turn has ended and
the agent handed over, the conversation is the person's turn (the process
can still show as a background indicator on the row).
