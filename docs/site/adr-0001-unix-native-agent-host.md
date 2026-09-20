# ADR 0001: Keep agents and workspaces native to Unix

**Status:** Accepted

**Date:** 2026-09-19

## Why this approach

Build on working open-source systems. Unix and Linux offer decades of work on
users, permissions, files, processes and tools that compose well. Their stable
foundations are a good basis for AI applications too. Native Agent Host should
use these services and existing software rather than build them again.

This is a product development principle: keep the system simple, give each
component a clear job, and let it do that job using its own interfaces and
configuration. Add code where connecting those components makes something useful
possible. Add new machinery when an actual need calls for it.

Users already work with Linux accounts, project directories, Pi histories, Git,
tmux and Taskfleet. They should be able to keep doing so directly after adding a
browser interface. A user can SSH to the server, enter a project directory, attach
to tmux and resume a conversation without going through Agent Host.

The earlier design proposed platform sessions, tenants, policy and credential
services, and a separate durable history. The design discussion chose a smaller
system that reads the information these native components already maintain.

## What we decided

Each Linux user has one lightweight daemon running under their own UID. A shared
gateway handles TLS and authentication, maps the web identity to exactly one Linux
account on that server, and forwards requests to that user's daemon. The
administrator owns the mapping. The browser cannot select a Unix account, and the
gateway does not read workspaces or run agents.

The browser may connect independently to several servers. Each server keeps its
own users and files. Closing the browser does not stop the agents.

A workspace is an immediate directory under `~/src`, whether or not it is a Git
repository. The daemon finds workspaces by listing those directories. There is no
workspace registry. Workspace-specific settings live inside each workspace in
`.agent-host/workspace.json`, created when settings such as a stable ID or display
name need to be saved. A directory without this file is still a workspace.

Each component manages its own configuration; for example, Pi's default model is
configured in Pi. Agent Host's workspace settings do not duplicate component
configuration. Credentials, process state and facts already available from Git
do not belong in the workspace settings file.

Agent identity comes from the harness's native resume ID, prefixed with its name,
such as `pi:<id>`. The harness keeps the conversation history and model changes.
PIDs, tmux panes and Taskfleet runs help find the running agent; they do not replace
that identity. A conversation remains available to inspect and resume after its
process exits.

Discover information from Linux, files, Git, the harness, tmux, Taskfleet and
extensions. Store an annotation only when a specific UI or behavior needs it and
it cannot be reconstructed reliably. Grow agent hierarchy and presentation fields
as those needs arise. Add a disposable, rebuildable cache only after measuring a
performance problem.

Agents have their Linux user's permissions and credentials. Unix permissions
separate users. Extensions can add restrictions or approvals, but restrictions
within the same UID are guardrails, not a sandbox. The UI must make that clear.
No separate credential broker is required.

Use a separate deployment for each tenant. Within a deployment, the host has
Linux users and no internal tenant object. Unix groups may later support shared
workspaces. Application organizations remain part of their applications.

Use JSON/HTTP for snapshots, queries and commands, with one cursor-marked SSE feed
per server combining the user's events. Reconnect from the cursor when possible;
otherwise fetch a new snapshot. Keep the feed combined until measured load gives
a reason to split it. AHP, ACP or AG-UI is not needed for this first implementation.

## What this means in practice

The daemon stays small by reading and controlling existing components. SSH, tmux,
Git, Taskfleet and native resume remain usable alongside the browser. There is no
new platform session, workstream or history database that users must go through.

There is still work to do. Authentication must route requests to the correct user
and reject them when the mapping cannot be established. Discovery must show
missing, stale or conflicting information honestly. Each harness needs an adapter
for its history and resume behavior. Some UI choices may need small annotations.
Same-UID extensions cannot enforce stronger isolation by themselves.

## What remains to be worked out

Choose the authentication mechanism and daemon packaging, try Pi discovery and
process controls, and define the HTTP requests and reconnect limits. Decide
annotation fields when the first UI needs them. Application integrations and
stronger isolation need their own concrete use cases.

See [how the system works](architecture), [open questions](decisions) and
[the first implementation](implementation).
