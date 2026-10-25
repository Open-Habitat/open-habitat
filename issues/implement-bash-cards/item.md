---
created: 2026-10-20
updated: 2026-10-25
type: feature
reporter: jari
status: done
priority: normal
lane: composer
lane_seq: 2
collision: [web/src/components/composer]
blocked_by: ['@proto-bash-runs-2']
closed: 2026-10-20
---

# Implement ! command history as Kortit (proto-bash-runs-2)

_Source: chat:proto-decision-2026-10-20_

## Description

Jari chose direction **Kortit** on 2026-10-20 from prototype round 2 (https://glasspad.example.test/p/qcyedtd2bwzzau3yk5aavhc4ne/; issues/proto-bash-runs-2/result.md). Implement it in production for typed ! and !! commands, their output and the composer notices from the round (running command, 'Edellinen komento on vielä käynnissä', 'Keskeytetään…' with a spinner until confirmed).
Jari's changes to the prototype: do not repeat 'Pi näkee tulosteen seuraavan viestisi mukana.' on every card; show only necessary information. The ! vs !! visibility (agent sees it / only you) is shown once, as a hint in the composer while a command is being typed, not in every card box. User messages are right-aligned (see user-messages-right-aligned).

## Acceptance Criteria

- [x] Live and saved `!` / `!!` commands use the selected open-by-default Kortit presentation, with literal output and necessary outcome metadata.
- [x] Context visibility appears in the composer hint while typing, without repeating the explanation on each command card.
- [x] Another command is refused without losing the draft; interruption remains pending until host confirmation or an explicitly unknown outcome.
- [x] Focused web and ordinary host-backed browser checks pass, including keyboard disclosure and affected accessibility/layout behavior.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
