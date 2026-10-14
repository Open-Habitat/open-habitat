# Decisions

Architecture decision records explain what was decided and why. The
[architecture pages](../architecture/index.md) describe the current
implementation; an accepted decision may still await implementation.
When a decision changes, its record links to the new one. Open questions
and implementation work belong in issues.

| Record | Decision |
|---|---|
| [ADR 0001](adr-0001-unix-native-agent-host.md) | Keep agents and workspaces native to Unix: one daemon per Linux user behind a shared gateway, no registry or history store of our own |
| [ADR 0002](adr-0002-frontend-stack.md) | The browser stack: React, TypeScript, Redux Toolkit, React Aria, sanitized Markdown, production components shared with Storybook |
| [ADR 0003](adr-0003-host-stack.md) | One Go binary with separate gateway and daemon roles, systemd services, Unix sockets, GitHub login that also installs native `gh` credentials |
| [ADR 0004](adr-0004-first-login-user-provisioning.md) | A root-only broker provisions a Unix account on first authorized GitHub login, bound to the numeric GitHub ID |
| [ADR 0005](adr-0005-clone-progress-stream.md) | Stream native clone progress to the browser and verify the result from Git |
| [ADR 0006](adr-0006-subject-revocation.md) | Root revokes one subject's web sessions through a private gateway control socket |
| [ADR 0007](adr-0007-bound-user-deprovision.md) | Removing a bound user is a later need; the implementation is open |
| [ADR 0008](adr-0008-snappy-conversation-switching.md) | Recent conversation windows stay in browser memory, with one event connection per tab |
| [ADR 0009](adr-0009-conversation-state-ownership.md) | Conversation content lives in a store separate from Redux application state |
| [ADR 0010](adr-0010-taskfleet-worktree-agents.md) | Taskfleet owns worktree runs; the user's daemon owns the browser-controlled Pi |
| [ADR 0011](adr-0011-gateway-owned-server-administration.md) | The gateway owns the server name and browser roles; the broker retains admission |
| [ADR 0012](adr-0012-per-user-storage-quotas.md) | Per-user storage limits are Linux quotas over the whole home, set through the broker and shown by the gateway |
| [ADR 0013](adr-0013-service-logging.md) | Consistent, readable service logs on stderr/journald, using existing IDs when available |
| [ADR 0014](adr-0014-open-test-admission.md) | The disposable test installation admits any verified GitHub account without Cloudflare Access |
| [ADR 0015](adr-0015-browser-code-highlighting.md) | Proposed: highlight.js for on-demand browser code highlighting; approval pending |
