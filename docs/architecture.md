# How Native Agent Host works

Native Agent Host gives users a browser interface to the agents and workspaces on
their Linux servers. A user can SSH to the server, work in tmux, and resume a Pi
conversation directly. The browser gives another way to work with those same
files, conversations and processes.

For example, Jari has a project at `/home/maintainer/src/native-agent-host`. He can open
it in the browser or enter that directory over SSH and use Pi there. Pi keeps the
conversation history in its own files. Closing the browser does not stop the agent.

The core design below is agreed in [ADR 0001](adr-0001-unix-native-agent-host).
The first working implementation is still to be built.

## Build on what already works

The product follows the Unix idea of simple tools working together. Open-source
Unix and Linux systems provide mature services for accounts, permissions, files
and processes, developed over decades. We use that foundation for AI applications
and reuse existing software wherever it already does the job well.

Each component keeps responsibility for its own behavior, data and configuration.
For example, Pi uses its own configuration, Git manages branches and worktrees,
and tmux keeps terminal sessions available. Agent Host connects these components to
the browser. New storage, configuration or services need a concrete reason to exist.

## One daemon per Linux user

```text
Web client
  └─ Server's authentication gateway
       ├─ Linux user jari → daemon running as jari
       │    └─ ~/src → workspaces and agents
       └─ Linux user kaisa → daemon running as kaisa
            └─ ~/src → workspaces and agents
```

The gateway handles TLS, signs the user in, and forwards HTTP and streaming
connections to that user's daemon. The administrator configures which web
identity maps to which Linux account. On each server, one web identity maps to
exactly one Linux account; the browser cannot choose a different username.

The gateway does not read home directories, list workspaces or run agents. Each
user's daemon does that user's work under their UID, without needing root or
switching user identities. Keep both processes lightweight and straightforward.

The browser can connect separately to several servers and combine what it shows.
Each server keeps its own account mapping and native files.

### Proposed first host stack

[ADR 0003](adr-0003-host-stack.md) proposes one Rust release artifact for a
non-root gateway and the per-user daemons. The browser would sign in with OIDC;
a root-owned mapping would bind the verified issuer and subject to one fixed
Unix account. The gateway would then reach only that account's systemd-created
Unix socket. Linux peer credentials would authenticate the gateway to the daemon,
without passing a reusable local token or a browser-selected username.

Each daemon would run as its user's real UID and start Pi RPC as its own child.
The browser or SSE connection would not own that process, so browser loss would
not stop it. A daemon crash or planned daemon restart would stop its controlled
Pi children; after restart the daemon would rediscover native history and permit
a deliberate resume only after proving that the previous writer exited and the
history settled. This is deliberately smaller than a second persistent process
supervisor. Terminal-started Pi remains read-only until the separately agreed
stop-and-transfer boundary is proved.

The proposed artifact would include the static frontend and be installed as an
immutable, checksum-verified release. Alder's persistent user, units, account
mapping, encrypted OIDC input, HTTPS route and release pin would all be declared
in Fleetrepo and converged through its fleet workflow. These details and their
operator commands remain proposals until `review-implementation-plan`; they do
not describe an installed service.

## Workspaces are directories

A workspace is an immediate directory under `~/src`. It may or may not be a Git
repository:

```text
/home/maintainer/src/
  native-agent-host/
  northwind-monorepo/
  ensihoitokurssi/
```

The daemon finds workspaces by listing the directories under `~/src`. There is no
workspace registry.

Workspace-specific settings live inside each workspace, in
`.agent-host/workspace.json`. This file can hold a stable workspace ID and display
name. Create it when a workspace setting needs to be saved; a directory without
it is still a workspace. In a Git repository, prefer a local `.git/info/exclude`
entry; the user may choose to version the file instead.

Runtime state and credentials do not belong in the workspace file. Before a Git
repository can be opened, a blocking integration step must establish that the
repository and the user's credential environment are ready for agents' ordinary
`git pull` and `git push` commands. Detecting `gh` authentication alone is not
that guarantee. The implementation of this integration is still undecided.

Read branches and worktree facts from Git, but expose worktree creation and
management only as Taskfleet-created dedicated agent environments. The v1 browser
has no general UI for creating, editing or managing arbitrary manual worktrees.
A worktree outside `~/src` can still be shown as an observed effect on a listed
workspace without becoming a supported management target.

## An agent keeps its native identity and history

Use the harness's own resume ID, prefixed with the harness name: `pi:<id>`,
`claude-code:<id>` or `codex:<id>`. A running process can exit and a later process
can resume the same conversation. Its PID is therefore not the agent's identity.
Pi RPC cannot attach to a currently running terminal TUI. A controlled transfer
first stops the terminal process safely, waits for native history to settle and
only then starts another runtime with `pi --mode rpc --session <session>`; this
valid resume command is not a live-attachment mechanism.

The daemon reads native histories and combines them with observations from the
operating system, tmux, Git, Taskfleet and optional extensions. Pi's history keeps
the conversation and model changes. Pi, Claude Code and Codex each retain their
own resume mechanism and configuration.

Start with a simple agent list. Add a main-agent marker, parent links or other
presentation details when the UI actually needs them. Store a detail only if it
cannot be found reliably in the native sources. A conversation branch does not
by itself mean that a child agent was started.

For example, Taskfleet can report a worktree run as top-level even when a Pi agent
started it as a tool call. If the UI needs that parent link, an extension could
capture it. We can address this when that use case appears; it does not require
a complete agent classification now.

## Discover, don't duplicate

Read facts from the component that already keeps them:

| Information | Where to read it |
|---|---|
| Workspaces | Directories under `~/src` |
| Users, permissions and running processes | Linux |
| Repositories, branches and worktrees | Git |
| Conversations, models and resume IDs | The agent harness |
| Terminal attachment and retained pane output | tmux |
| Runs, nodes and lifecycle information | Taskfleet |
| Agent subprocesses and their output | The extension managing them |

Keep new information only when something specific needs it and it cannot be
reconstructed reliably. For example, a user's choice of main agent may need a
small annotation. A branch name already available from Git does not.

Read these sources directly at first. Add an index or cache only after measurement
shows what is slow. Such a cache must be disposable: deleting it must not lose
user information.

This keeps terminal use practical. Users can attach to tmux, resume through the
native harness, inspect `git worktree list`, and use Taskfleet directly. The daemon
can observe native facts without requiring work to have started through the browser.
Only Taskfleet-created dedicated agent worktrees are supported management objects;
other discovered worktrees remain read-only facts or operation impacts.

## Permissions and subprocesses

An agent runs with its Linux user's permissions, SSH keys, credentials and network
access. Unix accounts and file permissions separate users. There is no separate
credential broker. Each tenant has its own deployment; within that deployment,
the host works with Linux users and has no internal tenant object.
Future shared directories may use Unix groups.

Pi extensions can add restrictions and approval prompts, including ones required
by the administrator. These are guardrails within the same Unix account. An agent
with shell access under that UID can bypass a tool-only restriction. The UI must
explain this honestly and must not call it a sandbox.

Each agent manages the subprocesses it starts. A process extension can expose
status, retained output, exit information and stop controls. If it already uses
tmux to keep processes and output, the daemon displays that information instead
of building another process registry.

## HTTP requests and one event feed

The browser first requests a JSON snapshot. It sends commands with HTTP POST and
follows updates through one SSE (Server-Sent Events) connection per server.
That feed combines the user's workspace, agent, process and output events.

Events carry a cursor so a reconnecting client can request what it missed. When
the server no longer has those events, the client fetches a fresh snapshot. Exact
request formats and retention limits still need to be worked out.

Start with the combined feed. Split it only if actual use shows a need. The same
rule applies to caches and broader protocols: simple JSON/HTTP and SSE are enough
for the first version; AHP or another agent protocol is not a prerequisite.

## What to build next

The [first implementation](implementation) connects one browser to one user's Pi
agent on Alder. It will clarify authentication, daemon packaging, discovery,
commands and reconnect behavior through working code.

See [research](evidence) for the systems and workflows inspected so far.
