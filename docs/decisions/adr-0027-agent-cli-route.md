# ADR 0027: Agents reach their own daemon through a separate Unix listener

**Status:** Accepted by Jari on 2026-10-21. His decisions of 2026-10-20 and
2026-10-21, including the approval of A–F, are recorded in
[agent-cli](../../issues/agent-cli/item.md#decisions). Implementation notes
that this record does not need are in
[the issue's notes](../../issues/agent-cli/adr-0027-notes.md).

## Context

In the quota test an agent learned that the disk was full only from a
failing `dd`, and had no way to tell the person. More generally, an agent has
no way to read its own environment or to do what the person does in the
browser. Jari decided that agents get a comprehensive personal CLI, callable
from any process of the person's Unix user, covering everything the browser
can do including other own conversations and global model defaults, carrying
timestamped notices to the person, with no general list of browser-confirmed
actions. The [research](../../issues/agent-cli/research.md) inventories that
surface.

The daemon's socket today admits only the gateway: the transport checks the
kernel peer UID on accept and again in `TrustedPeer`, and the GitHub token
handoff and editor routes rely on that check. Widening `TrustedPeer` to the
owner would hand the agent gateway authority, not just workspace operations.
That is why the route is a decision and not a flag.

## Decision

### A. A second socket, one daemon, one implementation of each operation

The daemon serves a second listener, `agent.sock`, beside `daemon.sock` in the
same root-prepared per-user directory, as a systemd socket unit owned by the
person with mode 0600. It accepts only the daemon's own UID, verified from
kernel peer credentials; root and the gateway are not alternative peers, and
no request field selects an identity. The gateway listener and `TrustedPeer`
keep their current meaning. The agent listener has its own default-deny route
table and never forwards to the browser mux. Browser and agent adapters call
the same controllers and native operations and reuse the request, result,
ID, freshness-token and receipt schemas in `contracts/v1`; new shapes are
added there and generated for both sides. The contract scenarios that deny
non-gateway peers on `daemon.sock` stay true; the agent socket gets its own.

### B. Personal operations, not browser or root authority

Everything the daemon owns is in scope: environment and status; workspaces,
repositories, clone jobs, Git observations and worktrees; conversations,
history, messages, steering, queues, questions, processes and receipts; Trash
and deletion; models, defaults and Git identity; integration accounts and
credential configuration; attachments, notices and browser-local file
requests. Native `git`, `gh`, `tmux` and `taskfleet` keep their jobs; the CLI
does not wrap them, and Taskfleet runs stay Taskfleet's.

Excluded by construction, because they are gateway or root authority: the
GitHub token handoff, editor grants and browser-session terminal relays,
browser sessions and device links, profile and role management, provisioning,
user lists, server administration and quota changes, and raw credential
values in any output. Credential writes take secrets from stdin or a file,
never argv. These exclusions bound the host API, not the person's shell: the
same UID can already read its native credential files. Injected text from a
repository, mail, history or a notice is data, never an approval.

Notices are native conversation entries with agent origin and a timestamp,
delivered over the existing event stream; there is no notice database. A
full-disk notice reports persistence only if the native write succeeded.

### C. Quota is read from the kernel as the daemon's own UID

`environment show` returns the daemon's own quota from the existing
`storagequota.Read` and filesystem capacity from `Capacity`, with observation
time and source. Linux permits `Q_GETQUOTA` for the caller's own UID without
privilege, and the test server runs ext4 user quotas on the filesystem holding
`/home`. No broker connection, selector or helper is added. A failed read is
reported as unavailable, never as zero usage or unlimited space, and free
space is not a quota substitute. The daemon reports its own version and
commit; gateway version, server name and administrator status are not on this
surface.

### D. The browser-confirmation set is empty

Destructive personal operations require explicit targets, the existing
safety proofs and truthful dry-run; no pop-up. Admin operations are absent,
not available with confirmation. A later confirmed operation is a named
exception with its reason.

### E. `--current` is inherited launch context

When the daemon launches Pi it sets the conversation, workspace and launch
generation in the environment, which tools and child processes inherit.
`--current` resolves them against the live daemon and fails on a stale
generation. Outside such a launch, commands take explicit IDs and `--current`
returns `current_context_unavailable`; nothing is guessed from the working
directory or the newest session.

### F. One binary, a discoverable `agent` namespace

`open-habitat agent <noun> <verb>` ships beside `admin`, with a
version-matched `agent` skill through `skill print` that host context points
to, following the AI-first CLI canon. The first slice also repairs the shared
canon gaps the research found, since the agent surface would inherit them,
and the built surface is checked with `project-canon review` and `/cli-canon`.

## Consequences and rejected alternatives

The cost is a second socket's activation, restore and packaging contract and
an explicit route table. The benefit is that a browser-only route cannot be
exposed to agents by accident, and native state remains the only record.

- **One socket admitting gateway or owner.** Fewer deployment changes, but one
  missed per-route gate exposes handoff, editor or session semantics, and the
  startup probe already treats an owner connection as its challenge.
- **A listener in the user's runtime directory.** Avoids root preparation but
  needs its own lifetime arrangement and lets the owner replace the endpoint.
- **Extending the per-conversation local-files socket.** Cannot serve
  arbitrary personal processes, which Jari requires, and ties global
  operations to a Pi child's lifetime.
- **Gateway-pushed quota cache.** Stale exactly when no browser is open, which
  is when an unattended agent needs it.
- **Daemon-to-gateway quota RPC.** Adds a listener and an availability
  dependency to fetch a value the UID can read itself.
- **Broker access for agents, or admin with confirmation.** Moves authority
  across the Unix-user boundary.

**Proposer:** Taskfleet technical-decision run `01m5dy0m4fptrt9747ee8erp15`.
**Decider:** Jari Mustonen, 2026-10-21.
