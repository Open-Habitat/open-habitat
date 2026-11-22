---
created: 2026-11-22
updated: 2026-11-22
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
