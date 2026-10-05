---
created: 2026-10-02
updated: 2026-10-05
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-02:ui-observations:1-3
related: ['@server-administration-cli']
lane: server-admin
lane_seq: 10
preparation: ready
---

# Named server and separate administrator settings with user roles

## Purpose

Show a configurable server name in the sidebar and provide a separate
administrator page for shared server settings and user roles, alongside
personal Settings. Jari reported on 2 October 2026 that the expanded sidebar
showed the truncated URL "omega-habitatat.ma...", followed by "Yhdistetty".
He requested a recognizable name, administrator settings, equivalent CLI
operations, and ordinary/admin roles.

## Product behavior

A browser administrator can change shared settings and assign or remove
administrator roles. The page lists users already bound to the server so the
administrator can select a person without finding their numeric GitHub ID.
The list contains the identity information needed to distinguish people and
their current browser roles; credentials and home paths are not part of it.
Role assignment does not admit a new user or create a Unix account.

A browser role grants no access to another user's conversations, files or
credentials. Operating-system maintenance authority remains separate. A server
can start and run normally with no browser administrator; the privileged CLI
can appoint one later. A disposable installation needs no administrator setup
before ordinary use.

## Implementation boundary

[ADR 0011](../../docs/decisions/adr-0011-gateway-owned-server-administration.md)
records the agreed authority: the gateway owns the persistent server name and
browser roles and is their sole writer. Browser administration and root-only
CLI operations use that writer. The broker retains admission, account creation
and bindings; per-user daemons have no server-administration responsibility.
The [options brief](options.md) explains the alternatives considered.

Key roles by the authenticated numeric GitHub subject, which survives changes
to display logins and Unix names. Administrative requests use the person's
current role, so removing a role takes effect on subsequent requests without
waiting for a new login. Browser writes retain the gateway's session, origin
and CSRF checks; CLI authority comes from the connecting operating-system
identity over the private control socket.

The broker supplies the bound-user list and target validation through scoped
read-only operations. These reads must work when a user's daemon socket is
stopped: changing a browser role does not require that person's agent to run.
The current broker protocol exposes only `ensure` and `authorize`, and
`authorize` also checks socket readiness, so it does not yet supply this read
interface.

This issue implements the shared state, browser contract and UI, broker reads,
and gateway control operations. The separate
[administration CLI task](../server-administration-cli/item.md) implements the
operator client. Shared state persists across restarts and release replacement;
browser and CLI changes use the same serialization and become visible without
a gateway restart. The installation needs persistent storage writable by the
gateway and a private root-only control socket. Choose the schema, API and
unit details during implementation, updating Fleetrepo's concrete installation
alongside the product templates.

## Acceptance Criteria

- [ ] The sidebar displays the configured server name, with a usable fallback
  when no name has been set.
- [ ] A browser administrator can inspect and change shared settings and
  manage roles by selecting a bound user, including one whose daemon is stopped.
- [ ] Ordinary users cannot perform administrator operations, and role removal
  takes effect on subsequent requests without a new login. Neither browser
  role gives access to another person's native data.
- [ ] The server works with no browser administrator. Gateway control
  operations allow an authenticated root operator to appoint one later and
  use the same settings and roles as browser administration.
- [ ] Settings and roles survive restart and release replacement. Checks cover
  authorization and consistent browser/control updates, with actual evidence
  and limits recorded in this issue's result using [TESTING.md](../../TESTING.md).
