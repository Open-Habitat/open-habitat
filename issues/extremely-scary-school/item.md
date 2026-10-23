---
created: 2026-10-23
updated: 2026-10-23
type: bug
status: in-progress
priority: normal
provenance: chat
source_ref: taskfleet:01m5m1zy6trwwymtez2k53z9sz/task
originating_run: 01m5m1zy6trwwymtez2k53z9sz
originating_run_kind: spinoff
---

# Gateway config parent traversal and pilot.5 continuation

## Description

## Reproduction
Pilot apply 2b013f00b02585b1ce2f3791054d6b44 stopped at converging seq 10: root:root 0700 /etc/open-habitat prevents the gateway reading generated config. Installer chose that mode following incomplete guide wording; check and plan accepted it.

## Acceptance Criteria
- [ ] Reject unusable ancestry before mutation, document exact repair and TLS rotation, prove safe same-operation continuation and publish product pilot.5 with unchanged runtime pilot.3.
