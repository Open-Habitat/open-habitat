---
created: 2026-10-03
updated: 2026-10-03
type: task
status: open
priority: normal
related: ['@named-server-admin-settings']
lane: server-admin
lane_seq: 20
blocked_by: ['@named-server-admin-settings']
---

# Provide a privileged server administration CLI

## Purpose

Let the server operator manage shared server settings and user roles from the
command line, including appointing a browser administrator after installation.
A server can operate normally without a browser administrator, so installation
and routine use do not depend on appointing one.

## Shared behavior and authority

[Server settings and browser administration](../named-server-admin-settings/item.md)
owns the shared product behavior and the architecture for storing and authorizing
settings and roles. This task implements the operator-side CLI using that design.
Browser and CLI administration act on the same settings and roles, so a change
made through either surface has the same result where their authority overlaps.

The CLI is available through the privileged operator path independently of
browser roles. Operating-system maintenance authority and the browser
administrator role are distinct: managing shared settings and roles in the
browser grants no access to another user's files, credentials or conversations.
The CLI's authorization follows the agreed architecture; the existing
first-login provisioning broker is not assumed to be the administration service.

## Completion and evidence

The operator can inspect and change the supported shared settings and roles,
including assigning an administrator on a server that has none. Follow the
project's AI-first CLI canon for non-interactive use, machine-readable results
and actionable errors; [CONFORMANCE.md](../../CONFORMANCE.md) tracks that surface.

Demonstrate the operations and their authorization on a disposable server,
including agreement with the browser view of shared settings and roles.
Record the tested behavior and remaining limits in this issue's result,
using [TESTING.md](../../TESTING.md) for the relevant checks.
