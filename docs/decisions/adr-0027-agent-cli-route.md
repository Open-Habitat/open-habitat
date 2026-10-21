# ADR 0027: Agents reach their own daemon through a separate Unix listener

**Status:** Proposed, 2026-10-21. Jari's recorded decisions are identified below;
A–F are this ADR's recommendations, awaiting his approval. No implementation
is authorized by this proposed record alone.

## Context

Jari decided that agents need a comprehensive personal interface, callable
from **any process of their Unix user**, including control of other own
conversations and global model/thinking defaults. Notices start as timestamped
messages attached to a conversation; acknowledgement semantics remain open.
There is no general browser-approval list, and proactive wake is a matter of
implementation order. These are his [recorded decisions](../../issues/agent-cli/item.md#decisions),
not new proposals here. The [research](../../issues/agent-cli/research.md)
inventories the surface; its earlier suggestions to reserve personal operations
for the browser do not override those decisions.

Today the socket admits only the gateway. That is more than a filesystem
permission: [transport](../../internal/transport/transport_linux.go) checks
`SO_PEERCRED` in `guardListener.Accept`, installs peer context, and checks it
again in `TrustedPeer` and the GitHub token handoff. The
[daemon composition](../../internal/daemon/handoff_linux.go) passes that check
to browser handlers, including editor routes. Broadening `TrustedPeer` would
therefore confer gateway authority, not just access to workspace operations.

## Decision (recommended)

### A. A second socket, one daemon and one implementation of each operation

Add `/run/open-habitat/users/<name>/agent.sock`, served by the same daemon,
but with its **own handler set**. Accept only the daemon's configured UID,
verified against its effective UID at startup and against each accepted
connection's kernel peer UID. Root and the gateway are not alternative allowed
peers. No request field, header, username, home path or environment value
selects an identity.

Use a system-manager socket unit, paired with the existing daemon service:
`SocketUser=<name>`, the person's group, mode **0600**, descriptor name
`agent`, and `Service=open-habitat-daemon@<name>.service`. Both socket units
must be active when the service starts, whichever one triggered activation.
The daemon validates both named descriptors and their exact configured paths;
missing, extra, swapped or unsafe descriptors fail startup. Extend deployment
and broker socket restoration accordingly: root prepares a listener for an
already admitted account, not a new agent identity or broker protocol.

Keep the root-owned parent and per-user search ACLs of the
[current socket template](../../systemd/open-habitat-daemon@.socket) and
[tmpfiles layout](../../tmpfiles.d/open-habitat.conf). The owner must not be
able to replace the socket through a writable parent; other users must not
traverse to it. Do not broaden those ACLs for the new socket. The CLI derives
the canonical name from its effective UID's OS account, not `$USER`, and
validates root-controlled, non-symlink parents, socket owner and mode before
connecting. As with the existing systemd listener, server-side peer credentials
seen by the client name PID 1/root, not the daemon. That is expected, not
permission to skip pathname validation. Do not reuse `udssecure.Mapped`
unchanged: it specifically requires `daemon.sock`, 0660 and the gateway group.

The gateway listener and `TrustedPeer` retain their current meaning. The agent
listener gets a separate own-peer predicate and a default-deny route table;
it never forwards arbitrary paths to the browser mux. Browser and agent
adapters share the same controllers, native operation functions and event
journal. Where logic currently lives in HTTP handlers, extract it rather than
copy it or pretend an agent request came from the gateway.

Socket activation includes the **first queued CLI request**. The existing
startup challenge queues gateway connections but treats an owner connection
as its probe. It cannot be copied unchanged: validation of the new socket
must distinguish its random probe from queued legitimate owner requests,
preserve those requests unread for serving, and bound queues, deadlines and
connection slots. Test cold activation from either socket, simultaneous
connections and overload. Do not trade a lost first command for a successful
startup check.

Reuse request/result schemas, resource IDs, freshness tokens and receipts in
[contracts/v1](../../contracts/v1/) for shared operations. Add genuinely new
shapes there and generate both bindings; no parallel agent domain model.
The CLI's versioned output envelope is presentation, not another state store.
[CT-001/002](../../contracts/v1/scenarios.json) remain true for the gateway
socket; add own-socket scenarios rather than weakening CT-002 to “either UID”.
Distinct-UID tests must prove rejection before native reads, rejection of
forged identity hints, and absence of every gateway-only route on agent.sock.

### B. Personal operations, not browser or root authority

The daemon-owned inventory is in scope: environment and native status;
workspaces, repositories, clone jobs, Git observations and worktrees;
conversations, history, messages, steering, queues, questions, processes and
receipts; Trash and explicit deletion; models, global defaults and Git
identity; integration accounts/login control and credential configuration;
attachments, notices and requests for browser-local files. This includes other
own conversations. Native `git`, `gh`, `tmux` and `taskfleet` remain the way to
do their native jobs; the CLI need not wrap each command. In particular,
Taskfleet spinoff control stays with Taskfleet, not the daemon.

Exclude **by construction**:

- gateway GitHub token handoff and its identity-binding payload;
- editor grants/tickets, editor cookies, browser-session-scoped terminal
  relays, and browser replies/claims to local-file requests;
- browser sessions, device links, gateway profile/role management and logout;
- account provisioning, user lists, server administration and quota changes;
- raw credential reads, dumps or echoing in results, errors or diagnostics.

Personal credential writes may take secret input through stdin or protected
files, never require secrets in argv, and return only redacted status. Provider
OAuth consent can still require the provider's browser; that is not a new host
approval gate. The existing local-files socket remains valid; a general CLI
request may ask for browser-local data, not forge a browser's file grant.
Notices identify agent origin and show a timestamp. Reuse native conversation
entries and the event stream, not a notice database; a full-disk delivery must
not report persistence unless the native write succeeded. A live, nonpersistent
warning can still reach an open browser, with that limitation explicit.

These exclusions constrain the **host API**, not the user's shell authority:
an own-UID agent can already read its native credential files. Prompt-injected
text from a repo, mail, history or a notice is data, never an identity or
approval proof. Existing ownership, one-writer, observation-token, typed-delete
and uncertain-outcome checks apply unchanged. Cross-conversation writes name
the target explicitly (or use explicit `--current`); no automatic replay of an
uncertain send under a new receipt ID.

### C. Read quota from the kernel; report the daemon's running version

`environment show` asks the daemon to read **its own effective UID** through
[storagequota.Read](../../internal/storagequota/quota_linux.go), plus filesystem
capacity/free space through `Capacity`. No UID/path selector, broker connection,
capability or setuid helper is added. Report usage, hard limit, enforcement,
filesystem free space, observation time and source; quota headroom and filesystem
free space are different constraints. A read failure is unavailable, never zero
usage, unlimited space or a healthy quota.

This is feasible without changing authority. Historical ADR 0012
(`docs/decisions/adr-0012-per-user-storage-quotas.md`) explicitly permits own-user
daemon reads. The current implementation uses `quotactl_fd` on `/home`,
requires ext4 and both accounting and enforcement, and converts quota blocks
as 1024 bytes. Linux 6.8's
[`check_quotactl_permission`](https://github.com/torvalds/linux/blob/v6.8/fs/quota/quota.c)
allows `Q_GETQUOTA` for the effective UID and `Q_XGETQSTATV` without special
privilege, subject to the security module's checks.

Fleetrepo's test-server `infra/open-habitat-test/REBUILD.md` and private inventory
record journaled ext4 user quotas on the root filesystem containing `/home`,
enforced at boot, kernel 6.8, and real `EDQUOT` tests. This was documentary
verification, not a new live unprivileged probe. Implementation must prove
own-UID reads in the actual daemon confinement, including enforcement and byte
units, before claiming support. If kernel, LSM or filesystem policy prevents
that read, return `quota_unavailable` with a diagnostic reason and retain
separately available filesystem figures. **`df` is not a quota fallback.** A
future supported filesystem needs a native reader, not a silent broker bypass.

For version discovery, return the running daemon's embedded version/full commit
and the invoking CLI's version separately; they can differ during upgrades.
The daemon is the server answering this route. Do not label a CLI on disk, a
release symlink or the daemon version as the observed gateway version. Gateway
process version, server display name and administrator status remain unavailable
on this first surface unless independently observed; no gateway RPC is added
just to duplicate `/api/v1/server`.

### D. No host browser-confirmation set in the first release

The set is **empty**. Personal destructive operations require explicit targets
and the existing safety proofs; CLI flags and truthful dry-run express intent
without a popup. Agent controls of Pi questions are personal guardrails, not a
human-only authorization boundary. Admin operations are absent, not available
“with confirmation”. Any later browser-confirmed operation needs an explicit
named exception and its reason, not a general approval framework.

### E. `--current` is inherited launch context, not discovery by recency

At daemon-owned Pi launch, inject `OPEN_HABITAT_CONVERSATION_ID`,
`OPEN_HABITAT_WORKSPACE_ID` and `OPEN_HABITAT_LAUNCH_GENERATION`, inherited by
its tools and child processes. Do not depend on a file in Pi's private temporary
process directory: the service's `PrivateTmp` is not a general CLI rendezvous.
IDs resolve against the same daemon's live controller and native inventory;
`--current` checks the generation so a stale shell cannot silently target a
replacement launch. Context selects a resource, never authorizes it.

Outside such a launch, ordinary commands work with explicit IDs.
`conversation show --current` returns actionable `current_context_unavailable`;
malformed or stale context errors rather than guessing from cwd or “newest
session”. Explicit target and `--current` are mutually exclusive. A child run
inherits the parent's context until a new daemon-owned conversation launch
supplies its own; the skill must explain this rather than infer conversation
identity from Taskfleet or terminal process ancestry.

### F. One binary, a discoverable agent namespace

Ship `open-habitat agent <noun> <verb>` alongside `admin`, not a second program.
Ship the version-matched `agent` skill through `open-habitat skill print agent`
and install/list discovery; host context points to it. Follow the AI-first CLI
canon, including structured drill-down help, classified exits, noninteractive
inputs, large-output files, dry-run and receipt-based retry safety.

The first implementation slice also repairs shared CLI plumbing identified in
the research: §2 exit documentation/classification; §14 text and JSON help with
flags, examples and command paths; §8/§18 usable bare config/doctor commands and
nonzero error exits. Bare config/doctor inspect the caller's personal agent
configuration without root service configuration access; component-specific
operator inspection remains explicit. Re-verify the two §24 deferral references
rather than carry their historical justification forward. Repair or remove
stale references in that slice; any genuine remaining blocker needs a verified
open local owner. These are shared fixes, not agent-only exemptions.

Validate the built surface with `project-canon review --profile cli --run
<binary>` and `/cli-canon`, updating `CONFORMANCE.md` from evidence. The automated
probe's known envelope-reading false positives do not establish missing features;
manual judgment still checks the agent surface. This documentation-only ADR has
not run a review of a nonexistent agent implementation.

## Consequences and rejected alternatives

- **One socket admitting gateway or owner:** fewer deployment changes, but a
  missed per-route gate exposes handoff/editor/browser semantics. It also
  collides with the startup probe's owner-as-challenge assumption. Separate
  listeners keep the gateway denial invariant intact and reduce a routing bug's
  blast radius; they do not sandbox the person's own UID.
- **A listener in the user's runtime directory:** avoids root socket preparation,
  but needs a separate cold-start/lifetime arrangement and permits owner-side
  endpoint replacement. System socket activation already solves those needs.
- **Per-conversation local-files socket only:** cannot serve arbitrary personal
  processes, contrary to Jari's decision. Extending it would also tie global
  operations to a Pi child's lifetime.
- **Gateway-pushed quota cache:** stale when no browser visits, precisely when an
  unattended agent needs it; creates a second observation store unnecessarily.
- **Narrow daemon-to-gateway quota RPC:** could preserve root binding resolution,
  but adds a listener, peer mapping and availability dependency to obtain a
  kernel value the UID may already read. No evidence requires it here.
- **Broker access for agents, or browser confirmation for admin:** moves authority
  across the Unix-user boundary; neither is an acceptable personal interface.

The cost is a second socket's activation/restore/packaging contract and an
explicit agent route table. The benefit is that adding a browser-only route
cannot accidentally expose it to agents. Native state remains the sole record;
new CLI adapters do not introduce workspace, history or credential stores.

**Proposer:** Taskfleet technical-decision run `01m5dy0m4fptrt9747ee8erp15`.
**Decider:** Jari Mustonen (pending A–F). **Date:** 2026-10-21.
