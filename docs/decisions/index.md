# Decisions

Architecture decision records explain why the system is the way it is. They
are the history layer: each one records the context of a choice, the choice
itself and the alternatives it displaced, at the time it was made. The
[architecture pages](../architecture/index.md) describe the system as it is
now; when the two disagree, the architecture pages are current and the record
shows how it got there. A decision that changes gets a new record that the old
one links to, rather than an edit that quietly changes what was decided.

| Record | Decision |
|---|---|
| [ADR 0001](adr-0001-unix-native-agent-host.md) | Keep agents and workspaces native to Unix: one daemon per Linux user behind a shared gateway, no registry or history store of our own |
| [ADR 0002](adr-0002-frontend-stack.md) | The browser stack: React, TypeScript, Redux Toolkit, React Aria, sanitized Markdown, production components shared with Storybook |
| [ADR 0003](adr-0003-host-stack.md) | One Go binary with separate gateway and daemon roles, systemd services, Unix sockets, GitHub login that also installs native `gh` credentials |
| [ADR 0004](adr-0004-first-login-user-provisioning.md) | A root-only broker provisions a Unix account on first authorized GitHub login, bound to the numeric GitHub ID |
| [ADR 0005](adr-0005-clone-progress-stream.md) | Clone progress is a bounded per-request stream with no replay; a dedicated per-user volume bounds disk use |
| [ADR 0006](adr-0006-subject-revocation.md) | Root revokes one subject's web sessions through a private gateway control socket |
| [ADR 0007](adr-0007-bound-user-deprovision.md) | Removing a bound user is a later need; the implementation is open |
| [ADR 0008](adr-0008-snappy-conversation-switching.md) | Recent conversation windows stay in browser memory, with one event connection per tab |
| [ADR 0009](adr-0009-conversation-state-ownership.md) | Conversation content lives in a store separate from Redux application state |
| [ADR 0010](adr-0010-taskfleet-worktree-agents.md) | Taskfleet owns worktree runs and their settlement; the daemon owns a browser-controlled Pi in the verified checkout |
| [ADR 0011](adr-0011-gateway-owned-server-administration.md) | The gateway owns the server name and browser roles, written by it alone for the browser and a root-only CLI; the broker keeps admission |

Open questions that need a decision are issues, not records. The logging
policy is one such issue.
