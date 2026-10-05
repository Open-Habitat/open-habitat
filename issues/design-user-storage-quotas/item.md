---
created: 2026-10-05
updated: 2026-10-05
type: task
status: open
priority: normal
related: ['@named-server-admin-settings', '@server-administration-cli', '@rethink-project-docs']
lane: planning
collision: [docs/]
---

# Design per-user storage quotas using native Linux facilities

## Goal

Give the server administrator a per-user view of used disk space and an
editable storage limit. Large projects can need much more than 20 GiB.
Jari approved this direction during the workspace documentation review on
2026-10-05: use Linux's existing tools and standard quota mechanisms.

The quota should cover the user's files as a whole, including workspaces,
Pi history and caches. Native Git, agents, builds and terminal sessions must
obey the same limit. A clone admission check alone cannot enforce this.

## Design to resolve with Jari

Recommend a standard Linux quota mechanism suitable for the deployment's
filesystems, and explain what storage it covers, how usage is measured and
how the operator enables it. Define the admin experience for viewing usage,
changing limits and reporting exhaustion, including a limit lowered below
current usage. Account for the server's actual available capacity.

ADR 0011 gives the unprivileged gateway ownership of browser roles and
settings. Quota changes need privileged system authority. Recommend the
smallest scoped operation across that boundary; per-user daemons retain no
server-administration role. Prefer native quota state as the source of truth
rather than adding a parallel accounting store or a custom enforcement service.

The existing clone implementation requires a separate filesystem at ~/src,
at most 20 GiB total and at least 5 GiB free before admission. Its workspace
scanner also rejects larger separately mounted source volumes. The new design
must replace these fixed-volume assumptions coherently and supersede the
relevant part of ADR 0005 through a new decision record.

## Completion

Jari has a source-grounded recommendation covering the Linux mechanism,
authority boundary, administrator experience and deployment changes. Record
the agreed architecture and create the bounded implementation tasks. The
choice of mechanism and privileged interface is not predetermined here.

Related work: @named-server-admin-settings and @server-administration-cli.
