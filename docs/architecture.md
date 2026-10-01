# How Native Agent Host works

A person opens a project in the browser and works with an agent running under
their Linux account. The project is an ordinary directory, and the conversation
is the agent harness's own history. The same files and native tools remain
available over SSH and tmux. Closing the browser leaves the agent running.

The design builds on mature Unix and Linux components: accounts separate users,
Git manages repositories, and Pi manages its configuration, tools and history.
Each component keeps the job it already does well. New storage or services need
a concrete need, because duplicating native information creates another place
where information about a person's work can drift.

This page explains the agreed architecture. The [implementation map](implementation.md)
links to the work and its evidence; [interfaces](interfaces.md) distinguishes
existing browser routes from the remaining contract. The first implementation
uses Pi and one server. Other harnesses and a browser spanning several servers
need their own product decisions.

## Sign in to one Linux account

Three roles run in separate processes, shipped in one Go binary:

```text
Browser
  └─ Gateway (fixed non-root account)
       ├─ Provisioning broker (root): approve binding, create/verify account
       ├─ A's authenticated socket → A's daemon (UID A) → A's workspaces
       └─ B's authenticated socket → B's daemon (UID B) → B's workspaces
```

The gateway authenticates the browser and maps its identity to exactly one Linux
account on that server. On an approved first GitHub login, the root broker
creates and verifies the account and its binding to the stable numeric GitHub ID.
The administrator controls admission; the browser cannot choose a Unix user.
The broker authorizes the binding at login, not on each request or stream frame.
An operator uses `RevokeSubject` to remove live browser sessions before changing
the allowlist; changing the allowlist alone does not log out existing sessions.

The gateway forwards requests to that account's systemd-created Unix socket.
It verifies the trusted filesystem route, and the daemon authenticates the
connecting gateway through Linux peer credentials and independently checks its
own identity. It forwards finite daemon replies without parsing their JSON and flushes event
streams as bytes arrive; the browser validates the public reply contract. The
conversation lease remains a temporary exception: the gateway filters its list
and records created handles until Unix-user ownership replaces the browser
session lease. The gateway cannot read homes or run agents. The broker's root
authority is confined to account provisioning; native work belongs to the daemon
running under that user's UID.

One GitHub authorization also supplies the user's native `gh` HTTPS credentials.
The gateway forwards the callback token once over the authenticated local route;
the daemon verifies and installs it. The gateway does not persist or log the
token or return it to the browser. Optional Google login establishes web identity
only. [ADR 0003](adr-0003-host-stack.md) explains the stack and credential flow;
[ADR 0004](adr-0004-first-login-user-provisioning.md) defines first-login provisioning.

## Open an ordinary directory

A workspace is an immediate directory under `~/src`, with or without Git. The
daemon finds it by listing that directory. A workspace needs no registry entry
or settings file to exist.

When a stable ID or display name needs saving, its settings live in
`.agent-host/workspace.json` inside the workspace. In a Git repository, prefer
a local `.git/info/exclude` entry unless the user chooses to version the file.
Credentials, process state and Git facts stay with their native owners.

Before opening a Git workspace, repository integration must establish that the
repository and credentials are ready for the agent's ordinary `git pull` and
`git push`. Successful web login or `gh` authentication alone cannot establish
that. The [GitHub integration work](../issues/plan-v1-implementation/implementation-briefs.md)
owns the implementation and evidence for this behavior.

Git supplies branches and worktree facts. Taskfleet owns creation and management
of dedicated agent worktrees. Other worktrees, including ones outside `~/src`,
can appear as observations or as effects to consider before changing a workspace;
they do not become browser-managed environments merely because they were found.

## Work with a native conversation

The daemon starts Pi RPC as its child in the workspace. Pi executes tools and
writes its own history. The conversation's identity is its native resume ID,
prefixed with the harness name, such as `pi:<id>`. A PID identifies one running
process; the conversation can survive that process and continue later.

A conversation has one writer. Independent clients do not control it
simultaneously through the browser, SSH or tmux. Terminal histories are readable
in the browser, but Pi RPC cannot attach to a running terminal TUI. An ended
browser conversation can be deliberately continued with the same native ID once
its previous work is known to have ended.

The browser shows incoming messages, questions and tool content. Content without
a dedicated renderer still appears as safe text. Answering or cancelling Pi's
separate question dialogs and taking over terminal conversations are outside
the current agent-control work.

Discovery reads the tools that already own the facts:

| Information | Source |
|---|---|
| Workspaces | Directories under `~/src` |
| Users, permissions and processes | Linux |
| Repositories, branches and worktrees | Git |
| Conversations, models and resume IDs | The agent harness (initially Pi) |
| Terminal sessions and retained output | tmux |
| Worktree runs and their lifecycle | Taskfleet |
| Extension-managed subprocesses and output | The owning extension |

Small annotations hold presentation choices that native sources cannot supply,
such as hiding a workspace or archiving a conversation in the UI. Archiving
leaves native history in place. Parent links are added only when needed and not
reliably available from native sources; a conversation branch alone does not
prove that a child agent was started. A cache needs a measured performance
problem and must be rebuildable without losing user information.

## Recover the view after a disconnection

The general browser contract uses JSON/HTTP for snapshots and commands, and one
SSE (Server-Sent Events) feed per server for the user's updates. A cursor lets
the browser request missed events; when replay is no longer possible, it fetches
a fresh snapshot. A command's acceptance and its eventual effect are separate:
a lost response leaves an uncertain result, not permission to repeat the write.
The [interface contract](interfaces.md) defines recovery and operation results.

Browser or gateway loss leaves the daemon's Pi process running. Daemon failure
is different: systemd cleans up the service's processes, and an active turn is
not promised to survive. A detached tool may outlive that cleanup. After restart,
the daemon reconciles native history and process evidence before allowing another
writer; unresolved work stays uncertain. A second persistent supervisor would
need its own justification.

Onboarding clone progress has a separate stream under
[ADR 0005](adr-0005-clone-progress-stream.md). Losing that connection cancels the
write. It has no replay or persisted progress job: a refresh inspects native Git
state and whether the writer has stopped. This exception serves the bounded
onboarding operation, while the general feed follows ongoing agent work.

## Keep access within the user's authority

An agent has its Linux user's permissions, credentials and network access.
Accounts, filesystem permissions and authenticated per-user sockets separate
people. Each tenant has a separate deployment; within it, the host works with
Linux accounts and has no internal tenant object. Future shared directories may use Unix groups.

Pi extensions can add restrictions and approval prompts, including administrator
requirements. An agent with shell access under that same UID can bypass a
restriction enforced only by a tool. These are guardrails, not a security sandbox.
Subprocess controls come from the component that owns the process; observing a
process does not by itself give the daemon authority to stop it.

The [native design decision](adr-0001-unix-native-agent-host.md) records these
principles. The host ships the binary, static browser assets and neutral systemd
templates as an immutable release, with native history and settings outside it.
[Installation and recovery](implementation.md#julkaisu-ja-asennus) separates
portable product packaging from Fleetrepo's concrete test deployment and receipts.
