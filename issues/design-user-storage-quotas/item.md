---
created: 2026-10-05
updated: 2026-10-05
type: task
status: done
priority: normal
related: ['@named-server-admin-settings', '@server-administration-cli', '@rethink-project-docs', '@implement-user-storage-quotas']
lane: planning
collision: [docs/]
preparation: reviewing
closed: 2026-10-05
closed_by: jari
---

# Design per-user storage quotas using native Linux facilities

## Problem

A person's projects can be large, and Jari has seen them need far more disk
than the fixed allowance the test server gives today. The administrator has
no way to see how much disk each user consumes or to change their limit.

Today each user gets an operator-provisioned ext4 image mounted at `~/src`,
and the daemon admits a clone only when that volume is a separate filesystem
of at most 20 GiB with 5 GiB free. Discovery rejects a larger separately
mounted `~/src`. These numbers came from an agent and describe the current
implementation in `internal/daemon` and Fleetrepo's `src_volume.py`, not an
accepted product goal. The separate volume was Jari's decision on
2026-10-01 so that the filesystem, not a per-clone operation in the root
broker, bounds what native tools write; the per-user quota continues that
idea with a mechanism the administrator can adjust.

## Goal

Jari decided on 2026-10-05 that the limit is designed on Linux's existing
per-user quota facilities. The administrator sees each user's usage and
changes their limit. The limit covers the user's whole home, including
workspaces, Pi history and caches, and binds every writer: Git, agents,
builds and terminal sessions alike. The clone admission check cannot provide
that on its own.

## Design

Agree with Jari which Linux quota mechanism the deployment's filesystems
support, how the administrator reads usage and sets limits through the
browser and the CLI, and how the privileged change crosses the boundary that
[ADR 0011](../../docs/decisions/adr-0011-gateway-owned-server-administration.md)
draws: the unprivileged gateway owns settings and browser roles, and
per-user daemons have no server-administration role. Native quota state is
the only record of usage and limits; a parallel accounting store or custom
enforcement service would be a second place for the truth to drift.

The agreed design is recorded as an ADR that supersedes the storage policy
in [ADR 0005](../../docs/decisions/adr-0005-clone-progress-stream.md),
because it replaces a recorded decision and adds a privileged operation.
Jari confirmed on 2026-10-05 that this change warrants an ADR. The clone
admission check, the discovery rule and Fleetrepo's volume provisioning are
replaced in the same work so that a quota change never leaves valid
workspaces invisible.

### Agreed design

Jari approved this design on 2026-10-05 as proposed, including the three
points below marked for review.

Use ext4 user quotas on the filesystem that holds the homes, enabled with
`tune2fs -O quota` (the journaled quota feature, no separate quota files or
`quotacheck`), and drop the per-user `~/src` images. Each Unix user gets a
block hard limit through `setquota`; the kernel refuses writes past it with
`EDQUOT`, which native tools report as an ordinary disk-full error. Usage and
limits are read through `quotactl`, so no service has to measure anything.

The root-only broker gains two narrowly scoped operations for already-bound
users, alongside its existing read-only user list: read usage and limit, and
set the limit of one user. The gateway exposes both to the administrator
page and to the operator CLI in the pattern ADR 0011 already uses, so the
browser and the CLI reach one authority and no new root service appears. The
broker applies a default limit when it creates an account; the default is a
gateway-owned server setting.

The administrator page shows each user's usage against their limit, the
filesystem's total and free space, and a warning when the sum of limits
exceeds capacity; overcommitting is allowed, because projects rarely fill
their limit at once. Lowering a limit below current usage is allowed and
only blocks new writes, which is standard quota behaviour. A person sees
their own usage and limit in the browser, and a full quota appears there
rather than as a clone that fails for no visible reason.

The daemon's clone admission asks for the user's own quota through
`quotactl`, which needs no privilege for one's own UID, and refuses a clone
that cannot fit; the separate-filesystem requirement and the discovery rule
against oversized volumes go away.

Source basis: `internal/daemon/github_stream_linux.go` performs the
`statfs`-based admission check; Fleetrepo's
`infra/native-agent-host-test/src_volume.py` provisions the 12 GiB images,
growable once to 20 GiB. The test server is a 40 GiB Hetzner CX23, so a
limit well above 20 GiB can be set there but not filled; the design does not
depend on the test server's size.

The points Jari reviewed and accepted: the broker as the home of the
privileged quota operations, overcommit as a warning rather than a block,
and a default limit applied at account creation. The initial value of the
default is installation configuration, not a number the product fixes.

## Acceptance Criteria

- [x] The agreed design is recorded as an ADR superseding the storage policy of ADR 0005.
- [x] The implementing work is filed as bounded issues coordinated with @named-server-admin-settings and @server-administration-cli, so that afterwards the administrator sees each user's usage and changes their limit, and the limit binds native writes across the whole home.

## Decisions

### 2026-10-05T11:20:23Z · @jari

2026-10-05: Approved the proposed design: ext4 user quotas over the whole home, two scoped broker operations (read usage and limit, set one user's limit) exposed through the gateway to the administrator page and the CLI, overcommit allowed with a warning, a default limit applied at account creation, and the per-user ~/src images and the fixed clone-admission rules removed. The result is an ADR superseding ADR 0005's storage policy.

## Resolution

### 2026-10-05T11:25:57Z · @jari

Design agreed and recorded as ADR 0012; implementation tracked as one issue, @implement-user-storage-quotas, unscheduled by Jari's choice.
