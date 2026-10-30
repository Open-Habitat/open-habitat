---
created: 2026-10-30
updated: 2026-10-30
type: improvement
reporter: jari
status: done
priority: normal
lane: own-machine
lane_seq: 5
preparation: ready
closed: 2026-10-30
---

# Own machines: Toistaiseksi as the default access duration

_Source: chat_

## Description

Jari 30.10.: own-machine access gets a **Toistaiseksi** (no expiry) option for *Pääsyn kesto*, and it is the default; 7, 30 and 90 days stay selectable. The key line then carries no `expiry-time=` (keeps `restrict` and `from=`). Reason: the principle is that the agent has what the person's user has, access is revoked on the person's machine at any time, and a forced monthly renewal makes the agent lose the machine unexpectedly. Reverses decision 11 in `issues/own-machine-access/result.md` (from history if pruned).

## Acceptance Criteria

- [x] Wizard and *Uusi pääsy* offer Toistaiseksi first and preselected; the card says "voimassa, kunnes perut" instead of an end date; existing dated grants keep showing their date.
- [x] Windows and Unix key lines without `expiry-time` when indefinite; the OpenSSH 8.2 requirement text only when a date is chosen.
- [x] Contract (GrantDays), daemon and browser tests; KOKEILTAVAA line.
