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
| [ADR 0005](adr-0005-clone-progress-stream.md) | Stream native clone progress to the browser and verify the result from Git; completion and interruption replaced by ADR 0024 |
| [ADR 0006](adr-0006-subject-revocation.md) | Root revokes one subject's web sessions through a private gateway control socket |
| [ADR 0007](adr-0007-bound-user-deprovision.md) | Removing a bound user is a later need; the implementation is open |
| [ADR 0008](adr-0008-snappy-conversation-switching.md) | Recent conversation windows stay in browser memory, with one event connection per tab |
| [ADR 0009](adr-0009-conversation-state-ownership.md) | Conversation content lives in a store separate from Redux application state |
| [ADR 0010](adr-0010-taskfleet-worktree-agents.md) | Taskfleet owns worktree runs; daemon-controlled Pi deferred by ADR 0017; browser worktree agents use plain Git worktrees instead (ADR 0025) |
| [ADR 0011](adr-0011-gateway-owned-server-administration.md) | The gateway owns the server name and browser roles; the broker retains admission |
| [ADR 0012](adr-0012-per-user-storage-quotas.md) | Per-user storage limits are Linux quotas over the whole home, set through the broker and shown by the gateway |
| [ADR 0013](adr-0013-service-logging.md) | Consistent, readable service logs on stderr/journald, using existing IDs when available |
| [ADR 0014](adr-0014-open-test-admission.md) | The disposable test installation admits any verified GitHub account without Cloudflare Access |
| [ADR 0015](adr-0015-browser-code-highlighting.md) | Accepted: highlight.js for on-demand browser code highlighting |
| [ADR 0016](adr-0016-native-harnesses-and-subscription-authorization.md) | Proposed: Claude subscriptions through pi-claude-bridge first; separate Claude Code only as a technical fallback |
| [ADR 0017](adr-0017-observe-taskfleet-spinoffs.md) | Observe Taskfleet-owned spinoffs read-only; defer caller-owned browser worktree agents |
| [ADR 0018](adr-0018-phone-sign-in-by-qr.md) | Accepted 2026-10-16: sign a phone in from a desktop session with a one-minute, single-use QR link minted by the gateway; persons can list and revoke their sessions |
| [ADR 0019](adr-0019-workspace-deletion.md) | Accepted: delete a workspace by moving it to the freedesktop Trash and restore from there; a clean, fully pushed Git clone is deleted outright; otherwise permanent deletion only from the Trash on explicit request; worktree cleanup added by ADR 0025 |
| [ADR 0020](adr-0020-resume-on-send.md) | A stopped browser conversation resumes when the person sends; the daemon holds messages sent before Pi runs and joins them into one prompt |
| [ADR 0021](adr-0021-resume-catch-up.md) | A resumed conversation's first turn is told which processes were cut off and which spinoffs settled while its Pi was stopped; refines ADR 0017 |
| [ADR 0022](adr-0022-request-records.md) | Accepted: gateway and daemon record mutating, failed and slow requests (warning at 1 s) by route template, joined by a gateway-made request ID |
| [ADR 0023](adr-0023-browser-mutation-layer.md) | Accepted: every browser write goes through one mutation layer; optimistic, pending and confirmed classes by who owns the fact; replies and `workspace.changed` events carry the change, not a snapshot reread |
| [ADR 0024](adr-0024-clone-jobs.md) | Accepted 2026-10-17: a clone is a job of the user's daemon that outlives the request; an interrupted clone is recognised from the filesystem and only removed or restarted explicitly; replaces ADR 0005's completion rules |
| [ADR 0025](adr-0025-worktree-as-a-place.md) | Accepted 2026-10-18: a worktree is a plain Git place holding ordinary browser conversations; agents settle it, the browser shows Git's state, and the daemon lists and removes worktrees with the Trash's safety rules; amends ADR 0010, extends ADR 0019 |
