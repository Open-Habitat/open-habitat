---
created: 2026-10-05
updated: 2026-10-06
type: feature
reporter: jari
status: in-progress
priority: normal
provenance: chat
source_ref: chat:2026-10-05:storage-quota-rethink:implementation
originating_run: 01m45w8s0bgjesrw77d59v40je
originating_run_kind: spinoff
related: ['@design-user-storage-quotas', '@named-server-admin-settings', '@server-administration-cli']
blocked_by: ['@named-server-admin-settings', '@server-administration-cli']
preparation: ready
lane: server-admin
collision: [internal/provision/, internal/gateway/, internal/daemon/, web/, docs/]
---

# Implement per-user storage quotas

## Goal

Implement [ADR 0012](../../docs/decisions/adr-0012-per-user-storage-quotas.md):
bound each user's whole home with a Linux user quota, make usage and limits
visible, and replace the fixed `~/src` volume policy. The ADR owns the quota
mechanism, authority boundaries and agreed behavior; @design-user-storage-quotas
holds the source basis. This issue carries the implementation as one whole,
including the test installation.

## Scope

Build quota administration on @named-server-admin-settings and
@server-administration-cli. The administrator can see each user's usage and
limit, change that limit in the browser or CLI, and see filesystem capacity,
free space and overcommit warnings. Newly provisioned accounts receive the
gateway-owned default limit. The broker operations and gateway interfaces
follow the authority model in the ADR rather than introducing another record
of quota state.

A person sees their own usage and limit in the browser. Clone admission uses
the user's quota instead of the old fixed-volume assumptions, so a full quota
has an understandable explanation. Remove the separate-filesystem requirement,
fixed size and headroom figures, and discovery rule that hides workspaces on
oversized source volumes.

The concrete deployment change belongs in Fleetrepo: enable ext4 journaled
quotas on the test server's home filesystem and stop creating per-user `~/src`
images in `infra/native-agent-host-test/src_volume.py`. The server and existing
images are disposable; no image migration is needed. This issue's result ties
the product and Fleetrepo changes to the behavior verified on that server.

Update `docs/architecture/workspaces.md`, `deployment.md` and the administration
pages to describe the implemented behavior, removing the transitional notes in
ADR 0005 and the workspaces page.

## Acceptance Criteria

- [ ] On the test server, quota enforcement rejects writes beyond the limit from Git, Pi and a shell across the user's home, without per-user `~/src` images.
- [ ] The administrator sees usage and limits in the browser and CLI, can change a limit including below current usage, and newly provisioned accounts receive the configured default. The browser also shows filesystem capacity, free space and an overcommit warning when applicable.
- [ ] A person sees their own usage and limit; clone admission uses the quota without a separate `~/src` filesystem, and a larger `~/src` no longer hides workspaces.
- [ ] The documentation describes the implemented quota behavior rather than the fixed-volume policy, and the result records the product and Fleetrepo changes verified on the test server.
