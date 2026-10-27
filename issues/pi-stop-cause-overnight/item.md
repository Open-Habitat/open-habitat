---
created: 2026-10-27
updated: 2026-10-27
type: task
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-10-27/pi-stop-cause-overnight
lane: agent-lifecycle
preparation: ready
closed: 2026-10-27
---

# Why the conductor's Pi stopped overnight on Birch

## Description

Jari 2026-10-27: this browser conversation's Pi (pi:be94c497-359f-4cda-bb57-998d6ecd2ae3, workspace ws_9aVGVKUBudoprTcn3hHCt04R, user maintainer) was found stopped in the morning ('This conversation's Pi had stopped … and was started again'); five Taskfleet workers settled while it was down and the conductor's run wait (a pi-processes background process) went with it. Birch had not rebooted (uptime 2 days). Find out from metadata only (daemon/gateway journal, systemd user units, process exit status, OOM or memory-pressure records, idle reaping, upgrade or apply runs; not conversation content) when and why the Pi process and its background processes ended, and whether the same can stop other people's agents. Report cause, and fix it if it is a product defect; otherwise state what the operator should change.

## Acceptance Criteria

- [x] Stop time and cause established with evidence, or stated plainly as unknown with what was ruled out

## Resolution

### 2026-10-27T05:31:15Z · @issuectl

Analysis in result.md: idle reaper stopped Pi 10 min after a turn that ended without re-arming run wait; no product defect; fix belongs to wake-agent-on-settled-wait. Retyped bug→task since no defect was found.
