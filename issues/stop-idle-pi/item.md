---
created: 2026-10-19
updated: 2026-10-25
type: improvement
reporter: jari
status: done
priority: high
lane: pi-lifecycle
lane_seq: 2
collision: [internal/daemon/pi-lifecycle]
preparation: ready
closed: 2026-10-19
---

# Stop idle Pi processes after an idle period

Jari, 2026-10-19 (after `idle-pi-holds-slots` landed): "Minusta niitä vanhoja tarpeettomia, mitään tekemättömiä Pi-prosesseja pitäisi sulkea." Today an idle Pi only yields its slot when a fifth conversation needs one, or stops on archive; otherwise idle Pi processes stay alive indefinitely (on pilot.231 four lived over an hour, using memory).

The daemon should stop a conversation's Pi process after it has been idle for a while: no turn in progress, no queued input, no live process the agent started through the processes tool, no spinoff wait or other pending work the busy definition from `idle-pi-holds-slots` covers. The next message resumes lazily as today, so the person loses nothing. Choose the idle period (suggestion: 10 minutes) and record it; stop gracefully (as archive does), never kill a busy Pi, and keep it observable in the daemon log.

## Acceptance Criteria

- [x] A ten-minute idle period stops Pi gracefully and logs the stop; busy and unknown states keep it running.
- [x] Injected-time Go tests cover the timeout boundary, every busy reason, background work and one-time lazy-resume delivery.
- [x] Daemon/caller checks and independent review completed; results recorded in result.md.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
