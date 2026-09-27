---
created: 2026-09-27
updated: 2026-09-27
type: bug
status: fixed
priority: high
lane: auth-incident
collision: [internal/provision/]
closed: 2026-09-27
closed_by: pi
---

# Align JIT parent guard with protected config directory

## Description

Pilot.5 real Chrome login reaches broker ensure but rejects with drift. Bounded root broker JSONL in same time window reports parent_policy. Read-only guest parent stat shows /etc/native-agent-host is root:gateway 0750 (the reviewed activation installer policy) while internal/provision/executor_linux.go available() expects root:root 0755; all other inspected parents satisfy safeParents. Change the executor parent owner check to exactly the protected root:gateway 0750 policy, not chmod the host to 0755. Add synthetic tests for accepted protected mode and rejection of world-traversable/group-writable/wrong-owner drift; preserve fail-closed JIT and UID isolation. Full green CI and independent security review. No live host mutation in worker; incidents remain open pending real retest.

## Resolution

### 2026-09-27T15:03:03Z · @pi

Source guard now matches protected root:gateway 0750; clean synthetic CI passed. No guest or real login retest. Security review identified a likely separate daemon config traversal risk: daemon UID cannot traverse this parent without an exact ACL, and no ACL receipt exists. Keep incident issues open pending authorized architecture decision and real retest.
