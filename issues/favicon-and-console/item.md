---
created: 2026-10-20
updated: 2026-10-25
type: improvement
reporter: jari
status: done
priority: normal
lane: web-chrome
lane_seq: 1
collision: [web/index]
closed: 2026-10-20
---

# No favicon; console noise on a fresh load

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20: the app needs a favicon (from the design-system mark; Jari wants it for prototyping too, so prototypes get it as well). On a fresh load the console shows favicon.ico 404, Ajv warnings 'unknown format "date-time"/"uuid" ignored in schema' (add ajv-formats or register the formats), and [reconnect] debug logs (gate them behind a debug flag). Clean console on load.

## Acceptance Criteria

- [x] Production HTML serves the design-system mark as its favicon.
- [x] Prototype builds embed the same favicon without external dependencies.
- [x] Fresh authenticated loads emit no console messages; schema formats are registered.
- [x] Reconnect diagnostics are silent by default and explicitly opt-in per tab.

## Result

See [verification and review](result.md).

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
