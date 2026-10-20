---
created: 2026-10-20
updated: 2026-10-20
type: feature
reporter: jari
status: open
priority: normal
lane: composer
lane_seq: 6
collision: [web/src/components/composer]
blocked_by: ['@proto-bash-runs-2']
---

# Implement ! command history as Kortit (proto-bash-runs-2)

_Source: chat:proto-decision-2026-10-20_

## Description

Jari chose direction **Kortit** on 2026-10-20 from prototype round 2 (https://glasspad.example.test/p/qcyedtd2bwzzau3yk5aavhc4ne/; issues/proto-bash-runs-2/result.md). Implement it in production for typed ! and !! commands, their output and the composer notices from the round (running command, 'Edellinen komento on vielä käynnissä', 'Keskeytetään…' with a spinner until confirmed).
Jari's changes to the prototype: do not repeat 'Pi näkee tulosteen seuraavan viestisi mukana.' on every card; show only necessary information. The ! vs !! visibility (agent sees it / only you) is shown once, as a hint in the composer while a command is being typed, not in every card box. User messages are right-aligned (see user-messages-right-aligned).
