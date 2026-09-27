---
created: 2026-09-27
updated: 2026-09-27
type: bug
status: open
priority: high
lane: auth-incident
collision: [internal/provision/]
---

# Align JIT parent guard with protected config directory

## Description

Pilot.5 real Chrome login reaches broker ensure but rejects with drift. Bounded root broker JSONL in same time window reports parent_policy. Read-only guest parent stat shows /etc/native-agent-host is root:gateway 0750 (the reviewed activation installer policy) while internal/provision/executor_linux.go available() expects root:root 0755; all other inspected parents satisfy safeParents. Change the executor parent owner check to exactly the protected root:gateway 0750 policy, not chmod the host to 0755. Add synthetic tests for accepted protected mode and rejection of world-traversable/group-writable/wrong-owner drift; preserve fail-closed JIT and UID isolation. Full green CI and independent security review. No live host mutation in worker; incidents remain open pending real retest.
