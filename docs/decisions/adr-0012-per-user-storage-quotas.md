# ADR 0012: Per-user storage limits are Linux quotas over the whole home

**Status:** Accepted by Jari on 2026-10-05. Supersedes the storage policy
in [ADR 0005](adr-0005-clone-progress-stream.md).

Jari has seen projects need far more disk than a fixed allowance, and the
administrator had no way to see what each person uses or to change their
limit. The existing policy gave each user an operator-provisioned volume at
`~/src` and let the daemon admit a clone only within fixed size and headroom
figures. That bounded native writes under `~/src`, but it left Pi history
and caches outside the limit, fixed the size at provisioning time, and gave
the administrator nothing to look at.

Each Unix user has a Linux user quota on the filesystem that holds the
homes, covering the whole home. The kernel enforces it for every writer,
whether Git, an agent, a build or a terminal session, and refuses writes
past the limit as an ordinary disk-full error. Native quota state is the
only record of usage and limits; no accounting store or enforcement service
of our own duplicates it. The per-user `~/src` volumes, the daemon's
separate-filesystem requirement and the discovery rule against oversized
source volumes go away with them.

Changing a limit needs root. The root-only broker, which already creates
accounts and lists bound users for the administrator page, gains two
narrowly scoped operations for bound users: read usage and limit, and set
one user's limit. The gateway exposes both to the browser administrator
page and to the operator CLI in the pattern of
[ADR 0011](adr-0011-gateway-owned-server-administration.md), so both
interfaces reach one authority and no new root service appears. Per-user
daemons stay out of server administration; a daemon may read its own user's
quota, which needs no privilege, to refuse a clone that cannot fit.

The broker applies a default limit when it creates an account. The default
is a server setting owned by the gateway; its initial value is installation
configuration, not a number the product fixes. The administrator sees each
user's usage against their limit, the filesystem's total and free space, and
a warning when the sum of limits exceeds capacity. Overcommitting is allowed,
because projects rarely fill their limits at once. Lowering a limit below
current usage is allowed and only blocks new writes. A person sees their own
usage and limit in the browser, so a full quota is visible rather than
appearing as a clone that fails for no reason.

The deployment chooses the filesystem's quota mechanism; the test server's
ext4 root uses its journaled quota feature. A filesystem without usable user
quotas cannot host this product's homes.

[The design issue](../../issues/design-user-storage-quotas/item.md) holds
the proposal Jari approved and the source basis. Implementation is filed as
separate issues from there.
