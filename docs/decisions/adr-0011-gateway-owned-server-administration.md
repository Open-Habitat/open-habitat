# ADR 0011: The gateway owns the server name and browser roles

**Status:** Accepted; not implemented. Jari approved recommendation A of the
decision brief in [named-server-admin-settings](../../issues/named-server-admin-settings/item.md)
on 2026-10-04. That issue and
[server-administration-cli](../../issues/server-administration-cli/item.md)
implement it.

## The need

The sidebar shows a truncated server URL where a configured name belongs. A
server needs shared settings and an administrator role that manages them and
assigns roles, reachable both from the browser and from an operator CLI, with
the same result either way. A browser administrator must gain no access to
another person's home, credentials, conversations or daemon. A server must run
normally with no administrator at all, so a disposable installation needs no
bootstrap ceremony.

## Decision

The unprivileged gateway owns a small persistent record of the server name and
the browser roles, keyed by the numeric GitHub subject, in a state directory
writable by the gateway's service account and nothing else. The gateway is the
record's sole writer. Browser requests reach it through the ordinary session,
origin and CSRF checks, with the role read from the current record on every
administrative request rather than frozen into the session. A root-only CLI
sends its operations to the same writer over a private socket authenticated by
kernel peer credentials, the pattern revocation already uses, so the CLI's
authority comes from the operating system and not from a browser role.

The broker keeps admission, account creation and bindings exclusively. Role
assignment operates on subjects the broker has bound; checking a target needs
a narrow read-only broker lookup that does not depend on the daemon socket
being ready. The administrator page lists bound users through a bounded
read-only broker inventory that carries no credentials or home paths. Jari
can narrow that scope before the broker operation is added.

Daemons receive no administrative request.

## Why here and not root

Browser roles govern shared host metadata, not Linux accounts. Putting the
writer in the gateway keeps the root broker's purpose narrow and auditable
and adds no always-on service. The accepted cost is that a compromised
gateway can grant itself the browser-administrator role and change shared
settings; it still cannot write the broker's allowlist or bindings, reach a
home or obtain root. That must stay true in the implementation.

## Alternatives displaced

- A separate unprivileged administration service as the writer. Isolates the
  file from the gateway's account but cannot make browser identity
  independently verifiable, since the gateway is the only component that
  authenticates the browser; two sockets and another service account for
  little gain.
- Extending the root broker with settings and role verbs. Routine
  browser-driven writes would reach a root process and widen a deliberately
  narrow authority.
- Root-owned configuration files edited by the CLI and read at startup.
  Suitable for a read-only name, but browser-managed roles would need a
  privileged writer anyway and a restart would drop web sessions.
