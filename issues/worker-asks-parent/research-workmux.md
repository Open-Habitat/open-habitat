# Worker questions: workmux benchmark and proposals

Research snapshot: 2026-11-14. Discussion material, **not an approved design or implementation plan**.

## Finding

**workmux does not provide the structured worker-to-parent question/answer protocol suggested by the issue.** At v0.1.282 it provides status hooks, terminal capture, terminal prompt delivery, and a coordinator skill that combines them. This helps a coordinator notice and inspect workers; it does not give a question an identity, route it to its owning parent, or deliver a correlated answer. In particular, `send` deliberately refuses a worker marked `waiting`.

Taskfleet already has more of the durable question side than the issue's opening suggests: a worker can publish `node.awaiting_input` with discussion items, visible in `run show` and eventually settling `run wait`. The missing piece is a convenient, correlated request/reply exchange usable across harnesses, with parent-first rather than human-first semantics.

**Recommendation (proposal):** add a durable, shell-accessible ask/answer exchange in Taskfleet, and let Habitat display that state and use the native parent-session wake path. Do not copy terminal-input injection as the answer transport.

## Evidence and scope

Read installed workmux 0.1.282 CLI help (`send`, `wait`, top level, `claude`), its README, status-tracking documentation, coordinator skill, and relevant source at tag v0.1.282, commit `e72fd5925cbfd617bbefbf51a75f93d16556119d`. Read installed Taskfleet 0.20.0 help and `taskfleet skill print taskfleet-overview`, and read-only source snapshot `5de718bcfe22d0fd7618da947a8d135a2440ed71`. The installed Taskfleet build reports commit `6ad8d7ca22246804c6c79f038e57bba4c45acee5`; the source snapshot is not claimed to be that build. Relevant help and source agree on the capabilities below.

This is source/CLI inspection, not a live multi-agent experiment. No worker was interrupted, no hooks installed, and no implementation changed. Claude Code comparison is current vendor documentation, not a locally tested or version-pinned implementation.

## 1. What workmux actually does

### Transport and state

The [README][w-readme] describes a worktree/window orchestrator, not a messaging broker. Its [coordinator skill][w-coordinator] maintains the active handles, runs `status`/`wait`, reads `capture`, and sends actionable follow-ups with `send`.

* Harness hooks call `register-agent` and `set-window-status`. [Status updates][w-status] update the multiplexer display and the [JSON state store][w-store], keyed by backend, instance and pane. These are agent status records, not question mailboxes.
* [`capture`][w-capture] supplies terminal text for the coordinator to interpret. It does not return a typed question object.
* [`send`][w-send] resolves a worktree or pane and uses the [multiplexer input protocol][w-mux]: keys or bracketed paste plus submission according to the target harness. With tmux, this uses tmux's command/socket machinery, not an agent RPC question endpoint. Remote targets go through the remote node and observation machinery; that does not add parent/question semantics.
* The inspected orchestration path needs no MCP server. Hooks and extensions report status; CLI commands inspect state and manipulate terminal input. No automatic worker-parent identity or request/reply command was found in this version's CLI and coordinator implementation. `--parent-session` places windows; it is not a parent-agent mailbox.

### How the parent wakes and answers

[`workmux wait`][w-wait] polls reconciled state every two seconds. It waits for one specified status (`done` by default), with all/any selection. A coordinator can explicitly wait for `waiting`, but a default `done` wait does **not** settle just because a worker is waiting for input. A foreground command returns control when it exits; automatic background wake depends on the parent harness running it, not on workmux pushing the question into a parent agent.

After inspecting captured output, a coordinator can send an ordinary next prompt to a sendable agent. But `send` rejects `waiting` with `agent_waiting` (exit 3), including when targeting a specific pane. Pane targeting resolves multiple-agent ambiguity; it does not bypass the dialog guard. The skill says to capture first and answer the dialog yourself. That is a terminal/manual interaction, **not** a supported structured answer command.

A worker could be explicitly told a target handle and use ordinary `send` in the reverse direction. That is a composed convention, not built-in routing to its parent, and still inherits input-state and terminal-delivery constraints.

### Harness differences

| Worker harness | Signal source | Consequence for questions |
| --- | --- | --- |
| Claude Code | [Plugin hooks][w-claude]: `UserPromptSubmit`/`PostToolUse` → working; `Notification` matching `permission_prompt\|elicitation_dialog` → waiting; `Stop` → done | Can expose native permission/elicitation attention, but not route the question or safely answer it through `send`. Ordinary final prose can simply be done. |
| Pi | [Extension][w-pi]: session registration, agent activity/settling; optional `suba:activity` aggregation | No waiting state, explicitly documented in [status tracking][w-guide]. A question in final prose is not distinguishable from completion by status alone. The `suba` event is activity aggregation, not a workmux reply channel. |
| Codex | [Hooks][w-codex]: `PermissionRequest` → waiting; prompt/tool/subagent activity → working; `Stop` → done | Permission attention is observable; no generic question object or correlated answer. Requires working hook setup/trust. |

### Timeout, absence and human escalation

`wait --timeout N` exits 1; without a timeout it can keep waiting, including when an agent never became observable. A previously seen agent disappearing with its worktree still present exits 3. Removal of the worktree is treated as reached/merged by this observer, not verified Taskfleet-style landing evidence.

`send --wait` observes activity and a subsequent target status (default `done,waiting`). An initially non-working agent has five seconds to show activity or returns `send_stalled` (6); explicit timeout returns 124. Its recorded turn fence reduces stale-status confusion, but status activity is not a semantic answer/read receipt.

Neither timeout supplies a default answer nor resolves a question. Human attention is primarily the dashboard/sidebar/window status and terminal inspection (including `last-done` cycling). There is no evidenced rule that the parent must first attempt an answer and only then escalate to the human. Startup prompts before registration may remain unobserved; timeout bounds waiting but cannot diagnose them.

**Useful lesson:** reuse native tools and expose observable status. **Limit:** terminal status plus captured prose is not a durable decision protocol, and different harnesses have materially different visibility.

## 2. What Taskfleet offers today

Sources: [overview][t-overview], [awaiting-input projection][t-input], [wait][t-wait], [event validation][t-events], [message implementation][t-message], [Pi adapter][t-adapter].

| Need | Existing behavior | Remaining gap |
| --- | --- | --- |
| Worker raises a live question | `node.awaiting_input` accepts non-empty `discussion_items`; event-backed state includes opening time and event sequence | Low-level event operation, currently described as a human decision rather than parent-agent request |
| Parent notices | State is visible immediately; after default 180-second propagation grace it can settle ordinary `run wait`; registered notification hooks can also be notified | Requires an established observer/wake path; no universal direct parent-agent invocation |
| Parent replies | `run message` delivers to a live Taskfleet-launched Pi adapter over a Unix socket; adapter accepts a steering message | Not a correlated answer API; no live equivalent for Claude/Codex or caller-owned workers |
| Resolution | `node.input_resolved` requires the matching event sequence | Clears attention only; does not deliver a decision or confer approval |
| Long silence | `run wait --check-in` returns check-in, exit 4, with progress evidence | Observer heartbeat, not a worker question timeout or proof of health |
| Unanswerable unattended decision | Terminal `node report` with `success: false` and discussion items preserves the blocked outcome | Ends the attempt rather than returning a live answer |

The Pi socket acknowledgement means accepted by the adapter, not read or acted upon. A lost acknowledgement can leave delivery unknown. Resident runs have another path: between rounds `run message` resumes a native session (including Claude); this must not be confused with live cross-harness messaging.

The existing event sequence is valuable: a stale resolution cannot silently clear a newer attention generation. A proposed ask should preserve this property while making an answer durable and retrievable. Neither check-ins nor `--terminal` answers a question; `--terminal` intentionally ignores non-terminal attention.

Habitat already [projects native process notifications][h-notification], recognizing `taskfleet run wait` run IDs. This is a useful integration seam, not evidence that Habitat currently implements question delivery. Reading/displaying a process notification is distinct from waking the agent that owns the wait.

## 3. Comparator: Claude Code agent teams

The [vendor agent-team documentation][claude-teams] describes a closer match: named agents send messages automatically delivered to recipients, with no polling required by the lead. Mailboxes are JSON files, and successful send means the mailbox write succeeded. Team communication works in in-process and split-pane arrangements; tmux is a display option rather than the core message protocol.

The useful distinction is **agent message versus human authorization**. Documentation says messages are identified as coming from another agent; teammates cannot supply human consent or route around a denied permission. Permission prompts are surfaced to the lead session for the person to approve. This is not equivalent to asking the person every product question.

Limitations include experimental enablement, no restoration of in-process teammates by session resume/rewind, and harness-specific semantics. The documentation does not establish a generic question deadline/default-answer contract. Copy the explicit message identity and delivery distinction, not the whole team runtime. Ordinary subagents are not a safe synonym for teams: the current documentation also allows named subagent messaging, so the older blanket claim “subagents can only return a final result” is too strong.

## 4. Candidate designs — proposals only

### A. Durable blocking CLI ask/answer — recommended proposal

**Taskfleet would add:** a shell command that records a question with run/node/question identity and waits for a correlated durable answer; a parent-facing answer command; explicit answered, timed-out and cancelled outcomes. Existing event storage owns this truth. A retry/restart can inspect the same question rather than create another one. A default is usable only when already authorized by the brief, never merely because the worker wrote it down.

**Habitat would show/wake:** worker-row question text, age, answer state and parent ownership. An established native wait wakes the parent promptly for a new question; where no observer exists, show undelivered/pending rather than pretending the parent was notified. The parent answers within its authority or explicitly asks the person in its own conversation. Habitat displays Taskfleet state, not a second inbox database.

**Trade-off:** works for any harness able to run a shell command, avoiding live adapter dependence. Blocking commands need bounded waits and restart/cancellation semantics. A timeout must not turn absence of permission into permission. Parent answer versus human escalation needs explicit provenance. Immediate parent delivery would differ from today's human-oriented 180-second grace.

### B. Non-blocking question inbox plus native message adapters

**Taskfleet would add:** durable questions and correlated answers, plus adapter delivery to wake workers and parents; the worker can continue independent work while a question is open. Existing Pi steering is one adapter, not the whole protocol.

**Habitat would show/wake:** the same state, plus queued/accepted/delivered distinctions and an unresolved-question list; agent wake uses supported native adapters.

**Trade-off:** good interactive experience and no long-running shell wait, but each harness needs a reliable resume/delivery integration. It risks building a general messaging platform before proving the narrower question need. Durable retrieval is still required when an adapter disconnects.

### C. Package the existing attention + message workflow

**Taskfleet would add:** a small convenience wrapper around awaiting-input events and generation-fenced resolution, with instructions for live Pi replies or preservation/respawn elsewhere.

**Habitat would show/wake:** richer attention details and the existing wait-based notification path; parent interprets discussion items and replies via `run message` where supported.

**Trade-off:** lowest initial change and useful for a Pi-only experiment, but not a uniform cross-harness answer path. Clearing attention still cannot prove answer delivery. This is an interim workflow, not fulfillment of the general requirement.

**Recommendation for discussion:** choose A as the smallest complete cross-harness capability; defer B until non-blocking conversations demonstrate a need. Keep non-blocking notes separate from decision questions. Treat startup silence as a separate observation problem: no ask command can run before the worker reaches its agent loop. None of these proposals grants a parent new permissions or moves authority between gateway, daemon and provisioning.

## Source index

Pinned workmux links below refer to v0.1.282; Taskfleet links refer to the inspected source snapshot. Vendor documentation is mutable.

[w-readme]: https://github.com/raine/workmux/blob/v0.1.282/README.md
[w-coordinator]: https://github.com/raine/workmux/blob/v0.1.282/skills/coordinator/SKILL.md
[w-status]: https://github.com/raine/workmux/blob/v0.1.282/src/command/set_window_status.rs
[w-store]: https://github.com/raine/workmux/blob/v0.1.282/src/state/store.rs
[w-capture]: https://github.com/raine/workmux/blob/v0.1.282/src/command/capture.rs
[w-send]: https://github.com/raine/workmux/blob/v0.1.282/src/command/send.rs
[w-wait]: https://github.com/raine/workmux/blob/v0.1.282/src/command/wait.rs
[w-mux]: https://github.com/raine/workmux/blob/v0.1.282/src/multiplexer/mod.rs
[w-claude]: https://github.com/raine/workmux/blob/v0.1.282/.claude-plugin/plugin.json
[w-pi]: https://github.com/raine/workmux/blob/v0.1.282/resources/pi/extensions/workmux-status.ts
[w-codex]: https://github.com/raine/workmux/blob/v0.1.282/resources/codex/hooks/workmux-status.json
[w-guide]: https://github.com/raine/workmux/blob/v0.1.282/docs/src/content/docs/guide/status-tracking.mdx
[t-overview]: https://github.com/jarimustonen/taskfleet/blob/5de718bcfe22d0fd7618da947a8d135a2440ed71/crates/taskfleet/skills/taskfleet-overview/SKILL.template.md
[t-input]: https://github.com/jarimustonen/taskfleet/blob/5de718bcfe22d0fd7618da947a8d135a2440ed71/crates/taskfleet/src/run/awaiting_input.rs
[t-wait]: https://github.com/jarimustonen/taskfleet/blob/5de718bcfe22d0fd7618da947a8d135a2440ed71/crates/taskfleet/src/run/wait.rs
[t-events]: https://github.com/jarimustonen/taskfleet/blob/5de718bcfe22d0fd7618da947a8d135a2440ed71/crates/taskfleet/src/event/create.rs
[t-message]: https://github.com/jarimustonen/taskfleet/blob/5de718bcfe22d0fd7618da947a8d135a2440ed71/crates/taskfleet/src/run/message.rs
[t-adapter]: https://github.com/jarimustonen/taskfleet/blob/5de718bcfe22d0fd7618da947a8d135a2440ed71/crates/taskfleet/src/run/message-extension.ts
[h-notification]: ../../internal/daemon/process_notification_linux.go
[claude-teams]: https://code.claude.com/docs/en/agent-teams
