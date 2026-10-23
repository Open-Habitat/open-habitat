---
created: 2026-10-23
updated: 2026-10-23
type: task
status: in-progress
priority: normal
provenance: chat
source_ref: taskfleet:01m5m4q6km8z20egt16p4sb9bs/hands-on
originating_run: 01m5m4q6km8z20egt16p4sb9bs
originating_run_kind: spinoff
---

# Make the pilot actually serve through direct hands-on iteration

## Description

## Goal
Make the disposable Northwind pilot serve through its real TLS ingress by iterating product fixes directly on the machine, retaining the existing operation and protected inputs. Adopt the preserved low-port fix if sound, then build and exercise the actual maintenance/upgrade commands.

## Acceptance Criteria
- [ ] CA-validating HTTPS health and exact GitHub callback redirect, served build identity, clean host check.
- [ ] One cold reboot and the same checks pass.
- [ ] Independently reviewed product diff released as 0.1.0-pilot.6; exact verified release installed and rechecked; operator handoff recorded.
