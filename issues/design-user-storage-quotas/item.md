---
created: 2026-10-05
updated: 2026-10-05
type: task
status: open
priority: normal
related: ['@named-server-admin-settings', '@server-administration-cli', '@rethink-project-docs']
lane: planning
collision: [docs/]
preparation: reviewing
---

# Design per-user storage quotas using native Linux facilities

The server administrator needs to see each user's disk usage and change their
storage limit, including limits above 20 GiB for large projects. Jari approved
using standard Linux quota facilities during the documentation review on
2026-10-05. The limit covers the user's files, including workspaces, Pi history
and caches, regardless of whether Git, an agent, a build or a terminal session
writes them. Clone admission alone cannot provide that protection.

Recommend a mechanism grounded in the deployment's filesystems and native Linux
facilities. The recommendation should make clear what storage is covered, how
usage is measured, what deployment changes enable enforcement and how the
administrator sees usage and changes limits. Exhaustion, a limit lowered below
current usage and the server's available capacity are part of that experience.
Native quota state is the preferred authority: a separate accounting store or
custom enforcement service would duplicate what Linux already provides.

[ADR 0011](../../docs/decisions/adr-0011-gateway-owned-server-administration.md)
places browser roles and settings in the unprivileged gateway; changing quotas
requires privileged system authority. The design needs a narrowly scoped way
to cross that boundary while keeping per-user daemons out of server
administration. The mechanism and privileged interface remain architectural
choices to resolve with Jari.

The current clone and discovery code in `internal/daemon` embodies the volume
policy in [ADR 0005](../../docs/decisions/adr-0005-clone-progress-stream.md):
clones require a separate `~/src` filesystem of at most 20 GiB with 5 GiB free,
and discovery rejects oversized separate source volumes. Replacing those
assumptions together avoids a quota change leaving valid workspaces invisible.
The result of this design task is an agreed ADR superseding that storage policy
and bounded implementation issues, coordinated with @named-server-admin-settings
and @server-administration-cli.
