# Implementation notes from ADR 0027

Working material for the implementation issues of ADR 0027. The technical-
decision run (`01m5dy0m4fptrt9747ee8erp15`, 2026-10-21) found these while
settling the route; they are not decisions and the implementer re-verifies
them against the code.

## Agent socket (A)

- Path `/run/open-habitat/users/<name>/agent.sock`; systemd socket unit with
  `SocketUser=<name>`, the person's group, mode 0600, descriptor name `agent`,
  `Service=open-habitat-daemon@<name>.service`. Both socket units must be
  active when the service starts, whichever one triggered activation. The
  daemon validates both named descriptors and their exact paths; missing,
  extra, swapped or unsafe descriptors fail startup.
- Keep the root-owned parent and per-user search ACLs of
  `systemd/open-habitat-daemon@.socket` and `tmpfiles.d/open-habitat.conf`.
  The owner must not be able to replace the socket through a writable
  parent; other users must not traverse to it.
- The CLI derives the account name from its effective UID, not `$USER`, and
  validates root-controlled non-symlink parents, socket owner and mode before
  connecting. Peer credentials seen by the client name PID 1, not the daemon;
  that is expected. `udssecure.Mapped` requires `daemon.sock`, 0660 and the
  gateway group, so it is not reused unchanged.
- Socket activation includes the first queued CLI request. The existing
  startup challenge (`guardListener`, around `transport_linux.go:500–600`)
  queues gateway connections but treats an owner connection as its probe.
  The agent socket's validation must distinguish its random probe from
  queued legitimate owner requests, keep those unread for serving, and bound
  queues, deadlines and connection slots. Test cold activation from either
  socket, simultaneous connections and overload.
- Deployment and broker socket restoration (Fleetrepo) prepare the second
  listener for an already admitted account; no new broker protocol.
- Tests: distinct-UID rejection before any native read, rejection of forged
  identity hints, absence of every gateway-only route on `agent.sock`,
  contract scenarios for the agent socket beside CT-001/002.

## Quota (C)

- `internal/storagequota/quota_linux.go` uses `quotactl_fd` on `/home`,
  requires ext4 with accounting and enforcement, and converts quota blocks
  as 1024 bytes. Linux 6.8 `check_quotactl_permission` allows `Q_GETQUOTA`
  for the effective UID. Historical ADR 0012
  (`docs/decisions/adr-0012-per-user-storage-quotas.md`) permits own-user
  daemon reads.
- Fleetrepo `infra/open-habitat-test/REBUILD.md` and the private inventory
  record ext4 user quotas on the root filesystem with `/home`, enforced at
  boot, kernel 6.8. This was documentary verification; the implementation
  must prove the read as the confined daemon UID, including enforcement and
  byte units, before claiming support. On failure return `quota_unavailable`
  with a reason and keep filesystem figures separate.
- Report usage, hard limit, enforcement, filesystem free space, observation
  time and source. Report the daemon's version and the CLI's version
  separately; they differ during upgrades.

## Launch context (E)

- Environment variables `OPEN_HABITAT_CONVERSATION_ID`,
  `OPEN_HABITAT_WORKSPACE_ID`, `OPEN_HABITAT_LAUNCH_GENERATION`, set by the
  daemon at Pi launch. Do not use a file in Pi's private process directory:
  the service's `PrivateTmp` is not a CLI rendezvous.
- Explicit target and `--current` are mutually exclusive. A child run
  inherits the parent's context until a new daemon-owned launch supplies its
  own; the agent skill explains this rather than inferring identity from
  Taskfleet or process ancestry.

## Canon repairs in the first slice (F)

From `project-canon review --profile cli --run <binary>` on 2026-10-21
(`issues/agent-cli/research.md` §4): §2 exit-code documentation; §14 text and
JSON help with flags, examples and command paths; §8/§18 bare `config` and
`doctor` that inspect the caller's personal configuration and exit nonzero on
error, with component-specific operator inspection staying explicit; §24
re-verify the two deferral references instead of carrying them. Update
`CONFORMANCE.md` from evidence; the probe's envelope-reading false positives
on §10 and §15–17 are not gaps.

## Proposed slices

1. Agent route plus `environment show`, `workspace list`,
   `conversation show --current`, the `agent` skill and the canon repairs.
2. Notice contract and bindings, `notice create` and `notice list`, UI place
   in the conversation, honest persistence outcome under EDQUOT.
3. The rest of the surface in bounded batches: conversation control including
   other own conversations, global defaults, workspace, clone, worktree and
   Trash operations, integrations and credentials with protected secret
   input, history, receipts, processes, attachments and local-file requests.
