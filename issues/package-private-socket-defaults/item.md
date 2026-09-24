---
created: 2026-09-24
updated: 2026-09-24
type: bug
status: in-progress
priority: high
lane: auth-sockets
lane_seq: 10
collision: [systemd/]
---

# Package non-world-traversable daemon socket defaults

## Bug
The public package template `systemd/native-agent-host-daemon@.socket` still declares `DirectoryMode=0711`, which gives every local Unix UID search permission if systemd creates the per-user socket directory after reboot or drift. Fleetrepo's current Hetzner guest overrides it to `0710` and strictly pre-creates root:gateway ACL directories; but a new packaged JIT first-login release must be safe by default, not rely solely on one deployment override. Do not change the existing guest or staged old release in place.

## Acceptance Criteria
- [x] Change the neutral public socket template to `DirectoryMode=0710` (not world-traversable) and document the pre-creation/reboot named-ACL requirement for authorized per-user daemon UID. Ensure no socket can be activated before secure parent/ACL preflight by the reviewed root broker/operator; `0710` alone is not a full isolation proof.
- [x] Update any package/VM test assertions that depend on exact unit bytes. Add automated check rejecting `DirectoryMode=0711` or world access in packaged template; unit/package verification and Go gate pass. No live guest, Fleetrepo, SSH, useradd, public ingress or credentials.
- [x] Note Fleetrepo currently pins the **old release** template bytes and overrides it; a future rebuilt release requires a separately reviewed Fleetrepo transition. Do not claim current guest has new package or active sockets.
