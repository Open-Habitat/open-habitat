---
created: 2026-10-20
updated: 2026-10-20
type: task
reporter: jari
status: done
priority: normal
lane: proto
lane_seq: 1
collision: [design-system/prototypes]
closed: 2026-10-20
---

# Prototype round: how ! commands, their output and composer notices look

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20 asked for a prototype round. Today the latest ! command shows in the bottom row and older ones go into the chat thread, where their visuals do not work. Prototype in design-system/prototypes (rounds/2026-10-2x-…) three directions for: a single typed command and its output in the thread, many commands in a row, a long-running one, failed/exit code, !! private output. Include the composer notices: 'Edellinen komento on vielä käynnissä. Pysäytä se ensin.' (now in an unclear spot — where should it appear) and the interrupt notice 'Keskeytyspyyntö vastaanotettiin. Pi:n kuittaus näkyy tilassa; työkalujen päättymistä ei ole vahvistettu.' which Jari finds unnecessary: propose 'Keskeytetään…' with a spinner until confirmed. Desktop/phone, light/dark; result.md with a recommendation; KOKEILTAVAA items for Jari.

## Acceptance Criteria

- [x] Three directions cover single/multiple commands, long runs, failures and !! context exclusion.
- [x] Rivillä-based composer shows field-adjacent refusal and pending interruption with confirmed/unknown outcomes.
- [x] Desktop/phone and light/dark focused browser checks pass; result, recommendation, published link and KOKEILTAVAA checks are recorded.
