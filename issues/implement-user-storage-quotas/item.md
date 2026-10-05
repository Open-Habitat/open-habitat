---
created: 2026-10-05
updated: 2026-10-05
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-05:storage-quota-rethink:implementation
originating_run: 01m45w8s0bgjesrw77d59v40je
originating_run_kind: spinoff
related: ['@design-user-storage-quotas', '@named-server-admin-settings', '@server-administration-cli']
blocked_by: ['@named-server-admin-settings', '@server-administration-cli']
preparation: reviewing
---

# Implement per-user storage quotas

## Goal

Make [ADR 0012](../../docs/decisions/adr-0012-per-user-storage-quotas.md)
real: each user's whole home is bounded by a Linux user quota, the
administrator sees usage and changes limits from the browser and the CLI,
and the fixed `~/src` volume policy disappears. Jari decided on 2026-10-05
to keep this as one issue so the whole can be managed together; it is not
scheduled yet. The agreed design and its source basis are in
@design-user-storage-quotas.

## Parts

**Broker and administration.** The root-only broker gains two scoped
operations for bound users: read usage and limit, and set one user's limit.
The gateway exposes them to the administrator page and the operator CLI in
the pattern of ADR 0011, so this builds on @named-server-admin-settings and
@server-administration-cli. The broker applies the default limit, a
gateway-owned server setting, when it creates an account. The administrator
page shows each user's usage against their limit, the filesystem's total and
free space, and an overcommit warning. Lowering a limit below usage is
allowed.

**Daemon and browser.** Clone admission reads the user's own quota and
refuses a clone that cannot fit. The separate-filesystem requirement, its
size figures and the discovery rule against oversized source volumes go
away. A person sees their own usage and limit in the browser, so a full
quota is visible rather than appearing as an unexplained clone failure.

**Deployment.** The test server enables the ext4 journaled quota feature on
the filesystem holding the homes and stops provisioning per-user `~/src`
images (Fleetrepo's `infra/native-agent-host-test/src_volume.py`). That work
lives in the Fleetrepo repository; this issue tracks that it is done.
The test server is disposable, so existing images need no migration.

**Documentation.** `docs/architecture/workspaces.md`, `deployment.md` and
the administration pages describe the implemented behaviour, and the
transitional notes in ADR 0005 and the workspaces page are removed.

## Acceptance Criteria

- [ ] On the test server, a write past the limit by Git, Pi or a shell fails with a disk-full error, and the administrator sees that user's usage at the limit in the browser and through the CLI.
- [ ] The administrator changes a user's limit from the browser and from the CLI, including below current usage, and the default applies to a newly provisioned account.
- [ ] Clones are admitted against the quota without a separate `~/src` filesystem, and a larger `~/src` no longer hides workspaces.
- [ ] The architecture pages describe the quota behaviour and no fixed-volume figures remain.
