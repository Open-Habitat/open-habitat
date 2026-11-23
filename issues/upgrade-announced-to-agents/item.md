---
created: 2026-11-22
updated: 2026-11-23
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-upgrade-announced-to-agents
lane: upgrade-notice
lane_seq: 1
preparation: pending
---

# Upgrades proceed on schedule with advance notice to running agents

## Description

Jari (22.11.2026): installing a new release must be more assertive. Today the upgrade waits for every agent turn to finish (on our own installation it waited 15 minutes for one person's active turn, and on the test server new versions land mid-conversation all the time). Instead: announce the upgrade to running agents ahead of time (e.g. a notice/system message in each live conversation and to workers: 'Habitat restarts in N minutes'), give them time to reach a safe point, then proceed at the announced time. Next action: design (what is announced, to whom, how far ahead, what agents do, what the installer and the test-server watcher wait for) and Jari's agreement before implementation.

## Decisions

### 2026-11-23T13:37:31Z · @jari

Jari 23.11.2026 on design.md:
- Taskfleet workers run in user units and survive an upgrade, so no announcement to them; it goes to the agents of Habitat's own (daemon-owned, person-started) conversations. Unsupported-harness coverage is not a concern.
- The announcement goes to the main agent a couple of minutes before the stop and tells it what the upgrade does to it: it will be stopped, restarted, and get a second message after the restart. It should have no long-running processes going.
- First investigate what actually happens at the stop: what becomes of the agent's background processes (process tool and others), whether they survive, and whether the agent finds them again after the restart. Those findings go into the text of the announcement.
- Agents stopped mid-work (a running turn) are woken after the upgrade. Waking one that had already finished is harmless: it says it had nothing more to do. Idle conversations are not woken.
Next action (approved): investigate the stop behaviour on a test install and revise design.md to these decisions with the concrete announcement and post-restart texts; implementation waits for Jari's approval of the revised design.
