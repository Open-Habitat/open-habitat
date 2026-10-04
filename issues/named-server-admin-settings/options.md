# Server settings and administrator roles: alternatives considered

Jari chose gateway ownership on 2026-10-04 and confirmed that the administrator
page lists bound users. [ADR 0011](../../docs/decisions/adr-0011-gateway-owned-server-administration.md)
records the decision; [the implementation issue](item.md) owns the work.

## The choice

The browser and privileged CLI need to change the same server name and browser
roles. Those roles govern shared settings and role management, while the broker
continues to own admission and Unix accounts. The gateway already authenticates
browser users. The placement question was which component should own the new
shared state and authorize its changes.

## Gateway ownership — selected

The gateway stores the server name and roles and serializes changes from both
browser requests and a root-only local control socket. It owns the original
record of these new product facts; it does not duplicate native histories or
the broker's admission list. A server can start with no browser administrators,
and an operating-system operator can appoint one through the CLI.

This keeps routine settings writes out of the root broker and adds no new
service. It requires persistent gateway-writable storage and a private control
socket. The CLI depends on a functioning gateway. Gateway ownership also means
that protection of browser roles rests with that component; separating the
file alone would not establish an independent browser identity authority.

## Separate unprivileged administration service

A dedicated service could own the record and serve both interfaces. It would
separate file-writing permissions from the gateway, but would still rely on
the gateway to identify browser users. That limited benefit did not justify
another service account, protocol and availability dependency for this work.

## Root provisioning broker

The broker could store settings and roles beside its binding ledger. This
would bring routine browser-driven settings writes into the root process and
expand its responsibility beyond admission and account provisioning. Browser
roles do not need that authority, so this placement was rejected.

## Operator-managed configuration

Root-owned files read at startup fit settings changed only by an operator.
Browser-managed settings would still need a privileged writer, and changes
would need a reload mechanism or gateway restart. This does not provide the
shared runtime editing that the browser and CLI need.

## User-list source

The gateway's role record cannot enumerate ordinary users, because their
account bindings belong to the broker. The selected design reads bound users
from the broker through a scoped read-only operation. The administrator gets
enough identity information to select a person and see their browser role,
without credentials or home paths. Listing users and validating role targets
do not create accounts or depend on a running user daemon.
