---
created: 2026-09-27
updated: 2026-09-27
type: task
reporter: pi
status: untriaged
priority: normal
provenance: chat
source_ref: chat:2026-09-27/config-parent-review
---

# Decide private daemon config traversal

## Description

First-login security review and live read-only ACL check: configuration parent is root:gateway 0750, with no named per-user ACL. A new daemon UID cannot traverse it to read its private root:UID 0640 binding; adding it to the gateway group would expose unrelated gateway secrets. Decide jointly with Jari whether to grant each bound daemon UID execute-only ACL on the parent (recommended), with installer/policy verification and rollback, or use another protected delivery method. Must be settled before first real provisioning retry or live promotion of the parent guard fix. No host permission broadening or group membership shortcut.
