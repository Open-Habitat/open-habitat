# ADR 0011: The gateway owns the server name and browser roles

**Status:** Accepted by Jari on 2026-10-04, including the bound-user list.

The server needs a recognizable name and browser-managed settings and roles.
Browser and operator CLI changes need the same effect, and normal use must
remain possible without appointing a browser administrator.

The unprivileged gateway owns the persistent server name and browser roles
and is their sole writer. Browser administration uses authenticated sessions
and current roles; the root-only CLI sends operations over a private socket
whose peers are authenticated by the operating system. This gives both
interfaces one authority without another service or a root process for
routine settings writes. The CLI consequently needs a functioning gateway,
even when there are no browser administrators.

The broker retains admission, account creation and bindings. The administrator
page lists already-bound users through a scoped read-only broker operation,
so roles can be assigned by selecting a person. That list carries no
credentials or home paths. Assigning a browser role does not admit a person
to the server or grant access to another user's native data. Per-user daemons
have no server-administration responsibility.

[The options brief](../../issues/named-server-admin-settings/options.md)
compares other placements. Implementation belongs to
[named-server-admin-settings](../../issues/named-server-admin-settings/item.md)
and [server-administration-cli](../../issues/server-administration-cli/item.md).
