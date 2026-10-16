# Should Taskfleet be a Pi extension in Open Habitat?

Research for [taskfleet-pi-extension](item.md), 16 October 2026. This is a
recommendation; the architecture decision is Jari's. No product code,
Taskfleet, Pi, skills or machines were changed.

## Summary

- **The wake-up is already automatic and Pi-native.** A parent that starts
  `taskfleet run wait <id>` with Pi's `process` tool is woken by the
  `@aliou/pi-processes` extension, which calls Pi's public
  `pi.sendMessage(..., { triggerTurn: true })` when the process exits. A
  Taskfleet extension would reuse the same Pi mechanism. It would not add a
  new kind of notification.
- **What goes wrong today is smaller and more specific than the question
  suggests.** (1) The process tray lists recognised waits a second time. That
  is a browser presentation bug, already tracked as
  [spinoff-process-duplication](../spinoff-process-duplication/item.md).
  (2) The browser recognises a wait by parsing a shell string with a
  deliberately narrow grammar, and Taskfleet's own skill teaches the form
  `taskfleet run wait "$run_id"`, which that grammar rejects. (3) Every wait
  dies with its Pi process. A daemon restart therefore leaves a still-running
  spinoff with no parent waiting for it, and nothing tells the parent
  afterwards. The third problem is the real reliability gap, and a wrapper
  extension does not fix it by itself.
- **Credible prior decisions argue against a custom wait extension.**
  Fleetrepo ADR 0011 evaluated and rejected building one, adopted
  `pi-processes` as the session-scoped runtime, and called dying with the
  session a safety property. Taskfleet's `AGENTS.md` makes that binding
  ("Do not file a 'build our own pi background-jobs extension' issue here").
  On the other side, Taskfleet's own earlier issue argued that
  extension-owned waiters were the right integration point, and Taskfleet
  already ships one Pi extension, `taskfleet-pi-telemetry`.
- **Recommendation: do not wrap Taskfleet as a Pi extension now.** Keep
  shell, skills and `pi-processes` as the way agents spawn and wait. Fix the
  three defects where each one lives: tray deduplication in the web UI;
  literal-ID wait guidance in Taskfleet's skills; and a small *catch-up on
  resume* in Open Habitat's existing companion extension that tells a resumed
  parent which of its spinoffs settled while Pi was down. A
  Taskfleet-shipped extension (option C) is the right shape *if* real browser
  use later shows agents still failing to wait correctly. The trigger for
  revisiting is named below.
- **The decision for an ADR** is whether an extension inside the user's own
  Pi may add a context message to the parent about spinoffs. That would
  refine ADR 0017's "no injected messages into the parent", which was
  written about the daemon.

## Background: how it works today

### The parent spawns and waits through its own shell

The parent agent reads Taskfleet's bundled skills. The guest installs the 14
unchanged 0.15.0 skills for both browser Pi and native workers
([install-taskfleet-skills/result.md:5-19](../install-taskfleet-skills/result.md)).
It then runs `taskfleet run create --kind spinoff --headless ...` through its
bash tool. The daemon launches every browser Pi with
`TASKFLEET_CREATOR_SESSION=pi:<session-id>`
([internal/daemon/pi_rpc_linux.go:97-99](../../internal/daemon/pi_rpc_linux.go)),
so Taskfleet records which conversation created the run with no new state
([manage-agent-worktrees/architecture.md:85-110](../manage-agent-worktrees/architecture.md)).

To learn the outcome, the parent starts
`taskfleet run wait <full-id> --output json` with the `process` tool and turn
notifications, then ends its turn. On the guest this behaviour comes from a
host note that Fleetrepo writes into the mapped user's `~/.pi/agent/AGENTS.md`
(Fleetrepo `infra/open-habitat-test/guest_taskfleet_skills.py:21-26` at
`395d5a09`). It does not come from Taskfleet's skills. Those skills only say
that completion reaches the session if the agent "wired `--notify` or a
background `taskfleet run wait "$run_id"` through a harness facility that
wakes you when it exits"
([taskfleet `crates/taskfleet/skills/taskfleet-spawn-spinoff/SKILL.template.md:306-313`](https://github.com/jarimustonen/taskfleet/blob/0cc4ded082455828dceb7c48ae66632aa43bfd32/crates/taskfleet/skills/taskfleet-spawn-spinoff/SKILL.template.md#L306-L313)).

### Pi wakes the parent through `pi-processes`

`@aliou/pi-processes@0.10.9` owns the background process. Its tool
description tells the model "After starting a process, do not wait -
notifications bring you back on exit"
(`~/.pi/agent/npm/node_modules/@aliou/pi-processes/extensions/processes/tools/index.ts:55-61`).
Exit notifications default to `"turn"` (`.../tools/notify.ts:22-24`), which
becomes `{ triggerTurn: true, deliverAs: "steer" }` and a
`pi.sendMessage` of custom type `ad-process:notification`
(`.../processes/notification-sender.ts:16-42`, `constants.ts:1`). On
`session_shutdown` it kills every managed process
(`.../processes/hooks/cleanup.ts:26-41`). The same package blocks shell
backgrounding (`&`, `nohup`, `setsid`) when configured to
(`.../processes/hooks/background-blocker.ts:1-13`).

Pi 1.3.0 documents this as the general mechanism. Extensions "Send user or
custom messages" with `pi.sendUserMessage()` / `pi.sendMessage()`
(`~/.local/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md:80`).
`sendMessage` takes `triggerTurn` and `deliverAs: "steer" | "followUp" | "nextTurn"`
(`dist/core/extensions/types.d.ts:1257-1261`). A run started that way reaches
`before_agent_start` with `messageType: "custom"` (`types.d.ts:735-740`).
Extensions can also register model-callable tools (`extensions.md:133-151`),
call other tools through `ctx.executeTool()`, whose nested calls "do not add
transcript entries" (`extensions.md:149`), and observe
`session_start` with `reason: "startup" | "reload" | "new" | "resume" | "fork"`
(`types.d.ts:575-581`). The docs say long-lived resources start in
`session_start` and stop in `session_shutdown` (`extensions.md:58-60`).

### Open Habitat observes, read-only

- Open Habitat's companion `process-extension.mjs` is explicitly not a second
  process manager: "pi-processes remains the sole registry, log and signal
  owner" ([internal/daemon/process-extension.mjs:1](../../internal/daemon/process-extension.mjs)).
  It answers the daemon over a per-Pi `0600` socket by querying
  `pi-processes` on Pi's in-process event bus (`:14-28`, `:115-145`). It
  works out whether a process wakes the agent by reading the `process start`
  tool result from the current branch (`:34-45`).
- The daemon decides that a process is a Taskfleet wait by parsing its
  command string. It rejects any quote, `$`, pipe, `&`, `;` or substitution,
  and accepts only `taskfleet run wait` followed by known flags and literal
  26-character run IDs
  ([internal/daemon/processes_linux.go:46-90](../../internal/daemon/processes_linux.go)).
  A recognised, running, waking process makes the conversation *Odottaa
  spinoffia* (`:193-210`). The architecture sketch chose this narrowness on
  purpose: the agent-chosen process name is never trusted, and "a wait run
  any other way ... is invisible to this rule"
  ([architecture.md:188-226](../manage-agent-worktrees/architecture.md)).
- The spinoff group comes from the user's own `taskfleet run list/show`, the
  native transcripts and Git, with no host store
  ([implement-spinoff-agents/result.md:113-160](../implement-spinoff-agents/result.md)).
  ADR 0017 makes the browser an observer: "The parent learns their outcomes
  through Taskfleet's native wait mechanism"
  ([docs/decisions/adr-0017-observe-taskfleet-spinoffs.md:6-10](../../docs/decisions/adr-0017-observe-taskfleet-spinoffs.md)),
  and the implementation issue adds "no injected messages into the parent"
  ([implement-spinoff-agents/item.md:65](../implement-spinoff-agents/item.md)).
- [manage-agent-worktrees](../manage-agent-worktrees/item.md) is obsolete
  because its browser-*controlled* worktree agent (a daemon-run Pi in a
  caller-owned run, ADR 0010) was replaced by this observe-only model. Jari
  decided that a person speaks only to the parent (`item.md:19-36`).

### Taskfleet's public surface

Taskfleet 0.15.0 (commit `8464733b`, installed here as well as on the guest)
provides what a waiter needs:

- `run wait` is read-only, settles on terminal, stalled or attention states
  (or on terminal states only with `--terminal`), defaults to a 6 h timeout,
  and has distinct exit codes 0/1/2/3 (`taskfleet run wait --help`).
- `--notify <cmd>` runs a shell command in the *supervisor's* environment,
  at least once, before teardown (`taskfleet run create --help`). The skill
  calls a "file or FIFO append that the harness watches" the robust sink
  ([SKILL.template.md:267-272](https://github.com/jarimustonen/taskfleet/blob/0cc4ded082455828dceb7c48ae66632aa43bfd32/crates/taskfleet/skills/taskfleet-spawn-spinoff/SKILL.template.md#L267-L272)).
- `event tail --follow` polls a run's event log every 500 ms
  (`taskfleet event tail --help`).
- `--agent-owner caller` provisions a Git-only worktree without an agent.
  Its help text says it is "NOT Pi launch admission". ADR 0017 defers it.

### What Jari observed

On the live test server the spinoffs appear correctly in their group, and
the `run wait` processes appear *again* in the process tray. Jari wrote that
"the mechanism that brings the spinoff result back to the parent (run wait)
is fine" ([spinoff-process-duplication/item.md](../spinoff-process-duplication/item.md)).
The guest provider proof woke the parent after 51 s through exactly this path
([install-taskfleet-skills/result.md:71-79](../install-taskfleet-skills/result.md)).
That proof's prompt spelled out the process-tool wait, though (Fleetrepo
`infra/open-habitat-test/evidence/taskfleet-skills/provider-parent.mjs:62-63`),
so it shows that the mechanism works. It does not show that an unprompted
agent picks it.

## The gaps, by cause

| Gap | Cause | Does a wrapper extension fix it? |
|---|---|---|
| Waits listed twice | Tray does not filter `kind: taskfleet_wait` records the daemon already classifies (`processes_linux.go:203-205`) | No; it is a web-UI filter either way |
| Wait not recognised, so no *Odottaa spinoffia* | Agent writes `run wait "$run_id"` (as Taskfleet's skill shows, `SKILL.template.md:311,317`), uses `&&`, or waits in foreground bash | Yes: a structured tool call removes shell parsing |
| Agent never waits, or blocks its turn | Instructions only; nothing makes the process-tool wait the default | Partly: a dedicated tool is easier to choose than a recipe |
| Parent never learns of a completion after a daemon restart | Pi is killed with `Pdeathsig: SIGKILL` (`pi_rpc_linux.go:123`); `pi-processes` kills its waits on shutdown (`cleanup.ts:40`); the spinoff survives in its own user unit; lazy resume restarts Pi only on the next send ([lazy-resume-on-send](../lazy-resume-on-send/item.md)) | **No.** Any in-Pi waiter dies the same way. What helps is a catch-up when Pi starts again, and that works with or without a wrapper |

## Options

### A. Status quo: skills, shell and `pi-processes`, hardened

Agents keep driving `taskfleet` from bash and waiting with the `process`
tool. The defects are fixed where each one lives:

1. Web: hide recognised waits from the tray (the open bug).
2. Taskfleet skills: teach the literal form
   `taskfleet run wait <full-run-id> --output json` started with the
   harness's background facility, and drop `"$run_id"`. This fits Taskfleet's
   open [environment-neutral-skills](https://github.com/jarimustonen/taskfleet/blob/0cc4ded082455828dceb7c48ae66632aa43bfd32/issues/environment-neutral-skills/item.md)
   issue, whose third bullet already asks that waiting "work as a plain
   `taskfleet run wait` process the parent awaits".
3. Open Habitat companion extension: on `session_start` with reason
   `startup` or `resume`, read `taskfleet run list` for runs whose
   `created_by_session` is this session. If any settled after the branch's
   last wait result for them, or are still running with no live wait, add a
   short context message (`triggerTurn: false`) naming them and their native
   state. The agent then knows on the person's next turn. The extension takes
   the facts from Taskfleet and decides what is "already known" from the
   native Pi branch, the same way `wakes()` already does
   (`process-extension.mjs:34-45`). It writes no new store.

### B. An Open Habitat-owned Pi extension wrapping the Taskfleet CLI

The daemon loads a third extension next to `process-extension.mjs`. It
registers tools such as `spinoff_create` (dry-run, then create with an
idempotency key, `--headless` and the inherited creator attribution),
`spinoff_wait` (non-blocking, structured `run_ids`, mode and timeout) and
`spinoff_status` (`run show`). The wait either spawns
`taskfleet run wait` as an argv child and calls `pi.sendMessage` with
`triggerTurn` on exit, or delegates to `process` through
`ctx.executeTool`. The browser recognises waits from structured tool details
instead of parsing a command. The same `session_start` catch-up as in A
applies.

### C. A Taskfleet-shipped Pi extension used everywhere

The same tool surface ships as a Taskfleet-family Pi package in its own
repository, following the precedent of
[`taskfleet-pi-telemetry`](https://github.com/jarimustonen/taskfleet-pi-telemetry/blob/b19a3b9b3613ea6208c7a60a83d2d9e6327afa18/README.md),
a Pi extension that calls only Taskfleet's public CLI. Fleetrepo installs it on
Jari's machines through fleet units, and the operator declares it on the
guest. Open Habitat's companion recognises its structured tool results.
Taskfleet interprets its own states (attention, timeout, landed, retained
work) in one place and keeps the extension in step with its CLI.

### D. A thin wait tool that delegates the process to `pi-processes`

This is a narrower form of B or C. It is a single `taskfleet_wait` tool
whose only job is to validate run IDs and call
`ctx.executeTool("process", { action: "start", command: "taskfleet run wait <ids> --output json", ... })`.
That gives structured recognition while keeping `pi-processes` the only
background runtime. The catch is that nested calls leave no transcript entry
(`extensions.md:149`), so the companion's branch-based `wakes()` detection
would need the wait tool's own result instead. The coupling also moves to
`process`'s model-facing parameter schema. That is more public than its event
bus, but it is still another package's interface.

### E. The daemon follows Taskfleet and wakes the parent

The daemon tails attributed runs (`event tail --follow` or `run wait`) and,
when one settles, resumes the parent's Pi and starts a turn. This is the only
option that wakes a parent whose Pi is *not running*. It contradicts ADR
0017's daemon-does-not-write rule. It also means the host spends provider
tokens with no person present, and it brings back the daemon as a controller
of agent turns, which Jari kept out when he rejected keeping Pi alive across
restarts as "too complicated" ([lazy-resume-on-send](../lazy-resume-on-send/item.md)).
It is listed for completeness, not recommended.

## Trade-offs

| | A. Hardened status quo | B. OH-owned wrapper | C. Taskfleet-shipped wrapper | D. Thin delegating tool |
|---|---|---|---|---|
| **Agent reliability** | Depends on instructions; improved by literal-ID skills and catch-up | Higher: one obvious tool, typed arguments | Same as B, and also in SSH/TUI Pi | Higher for waiting; spawning stays a recipe |
| **Browser view of spinoffs** | Shell-string inference, narrow but tested | Structured; the parser can go | Structured | Structured |
| **Duplication of truth** | None new | Second wait runtime if it spawns its own child (B-own); none if delegating | Same as B | None |
| **Security boundary** | Unchanged: everything runs as the mapped user | Unchanged: runs inside the user's Pi as that user; adds privileged code that only Open Habitat reviews | Unchanged; adds a privileged npm package to every Pi on the fleet, reviewed by Taskfleet | Unchanged |
| **Session portability** | A browser conversation continued in a TUI behaves the same | A browser history holds `spinoff_*` calls that a TUI Pi cannot repeat unless the extension is installed there too | Same everywhere Pi runs; Claude Code sessions still use their own facility | Same as B/C depending on owner |
| **Maintenance across upgrades** | Skill text follows Taskfleet; companion follows `pi-processes` bus (already the case) | Open Habitat tracks both Taskfleet CLI and Pi extension API | Taskfleet tracks its CLI (natural) and the Pi API (new burden) | Adds coupling to `process` tool schema |
| **Fixes restart gap** | Only with catch-up | Only with catch-up | Only with catch-up | Only with catch-up |
| **Prior decisions** | Consistent with Fleetrepo ADR 0011, Taskfleet `AGENTS.md`, ADR 0017 | B-own conflicts with ADR 0011's rejection of a custom waiter | Requires reopening Taskfleet `AGENTS.md`'s binding rule | Mostly consistent |

Points behind the table:

- **The wake-up gain is zero in every option.** All of them end in the same
  Pi `sendMessage(..., { triggerTurn: true })`. The real differences are how
  sure the agent is to start a wait, how the browser learns that a process
  *is* a wait, and who maintains the code.
- **Prior art splits along the same line.** Claude Code gives the harness a
  generic facility: background Bash returns a task ID, and a background
  subagent's "results reach Claude as a completion notification in a later
  turn" ([sub-agents](https://code.claude.com/docs/en/sub-agents)). Its
  background commands stop when Claude Code exits
  ([interactive mode, background Bash](https://code.claude.com/docs/en/interactive-mode#background-bash-commands)).
  The harness owns waking and the tool owns state, which is option A's
  split. Claude Code plugins can also ship *monitors*, "a shell command that
  runs in the background for the whole session" whose output "reaches Claude
  as notifications" ([plugin components, Monitors](https://code.claude.com/docs/en/plugins/components#monitors)).
  That is a vendor packaging its watcher for a harness, which is option C's
  pattern, and it still has session lifetime.
- **None of the options gives durability across restarts.** Fleetrepo ADR 0011
  separates session-scoped waits from a future "harness-neutral and durable"
  runner (Fleetrepo `docs/decisions/0011-pidev-background-process-runtime.md:56-60`).
  On Open Habitat the durable fact already exists: Taskfleet's run record.
  The parent only needs to be told about it again when Pi comes back. That is
  why the catch-up is the one new mechanism worth building.

## Where credible views disagree

- **Custom extension or existing process manager.** Taskfleet's August issue
  argued that "Extension-owned waiters are the correct integration point
  because pi can track the child process and wake the agent"
  ([taskfleet `issues/pi-background-jobs-extension/item.md:26-27`](https://github.com/jarimustonen/taskfleet/blob/0cc4ded082455828dceb7c48ae66632aa43bfd32/issues/pi-background-jobs-extension/item.md#L26-L27)).
  Fleetrepo ADR 0011 then rejected building one: "It would duplicate a
  tested-looking session manager ... Build only after the controlled
  comparison proves an existing focused package cannot meet the contract"
  (`0011-pidev-background-process-runtime.md:76-78`). Taskfleet recorded
  "that option was evaluated and rejected"
  ([taskfleet `AGENTS.md:39-50`](https://github.com/jarimustonen/taskfleet/blob/0cc4ded082455828dceb7c48ae66632aa43bfd32/AGENTS.md#L39-L50)).
  Since then `pi-processes` has met the contract in production use, which
  supports ADR 0011. Jari's question is not a general background-process
  question, though. It asks for *Taskfleet-specific* tools, and ADR 0011 did
  not weigh that narrower case.
- **Does Taskfleet ship harness adapters?** Taskfleet's `AGENTS.md` says
  waits are "not this repository's problem". Yet the family already
  publishes `taskfleet-pi-telemetry`, a Pi extension built over a public CLI
  contract with vendored conformance fixtures (its README, "Compatibility
  contract"). A Taskfleet-shipped wait tool would fit that precedent if it
  delegated the process to `pi-processes` or shelled out to `run wait`
  without reaching into anyone's internals.
- **Is a Pi extension's message an "injection"?** ADR 0017's
  implementation note forbids injected messages into the parent. That rule
  was written to keep the *daemon* from authoring parent history
  ([architecture.md:217-219](../manage-agent-worktrees/architecture.md)).
  `pi-processes` already sends a custom message into that history on every
  wake, and nobody treats that as a violation, because Pi itself writes it.
  One reading is that the catch-up is the same kind of Pi-native message.
  The stricter reading is that any automatic message about spinoffs needs
  Jari's explicit consent. This report treats it as a decision to record,
  not as something already permitted.
- **Instructions or tools.** The earlier skills research concluded that v1
  "needs **no executable extension**"
  ([taskfleet-skills-for-open-habitat/report.md](../taskfleet-skills-for-open-habitat/report.md),
  section "Distribution"). Jari then chose the unchanged upstream catalog
  over Open Habitat adapters ([install-taskfleet-skills/result.md:5-10](../install-taskfleet-skills/result.md)).
  The case for tools is that recipes drift: the upstream skill's `"$run_id"`
  form already fails the browser's grammar. The case against is that a tool
  is one more privileged package per Pi, plus a second interface for
  Taskfleet to keep compatible.

## Recommendation

**Choose A now, keep C as the named escalation, and do not build B.**

1. A fixes everything Jari has observed without new privileged code. The
   duplication is a UI filter. The grammar mismatch is one skill edit in a
   Taskfleet issue Jari already opened. Both keep "reuse native components"
   intact.
2. The restart gap is real and no wrapper closes it. The catch-up belongs
   in Open Habitat's companion extension, which already runs in every browser
   Pi, already reads the branch to tell what the agent knows, and already
   depends on the `pi-processes` bus. It reads Taskfleet's records as the
   mapped user, so the Unix boundary is unchanged.
3. B is the worst of both worlds. It gives Open Habitat-only agent
   behaviour, leaves browser history that a TUI resume cannot repeat, and
   makes Open Habitat responsible for Taskfleet's CLI semantics. If
   Taskfleet-specific tools turn out to be needed, Taskfleet should own them
   (C), preferably in D's thin form that leaves process lifetime to
   `pi-processes`.
4. **Trigger to revisit C:** real browser conversations, without a
   prompt that spells out the recipe, still produce unrecognised or blocking
   waits after the skill fix. This shows up as spinoffs under a parent that
   reads *Odottaa sinua* instead of *Odottaa spinoffia*, or as parents that
   never wake. At that point the evidence favours a typed tool over better
   prose, and the Taskfleet `AGENTS.md` rule should be reopened on that
   evidence.

### Decision Jari would record (ADR, amending ADR 0017)

> Taskfleet stays a CLI that agents drive from their shell; spinoff waits
> stay ordinary `taskfleet run wait` processes under Pi's process runtime.
> Open Habitat does not ship a Taskfleet wrapper extension. Open Habitat's
> companion Pi extension **may** add a non-triggering context message to a
> parent conversation when its Pi starts, naming spinoffs attributed to that
> conversation that settled, or lost their wait, while Pi was not running,
> taken solely from the user's Taskfleet records and the native Pi branch.
> The daemon still never writes into a conversation. A Taskfleet-owned Pi
> tool surface is reconsidered if field use shows instruction-driven waits
> remain unreliable.

The open choice inside that decision is whether the catch-up may also start
a turn (`triggerTurn: true`) on resume. Recommend **no**. Pi resumes only
because the person sent a message, so that message already starts a turn,
and an extra turn would only add noise.

## Suggested follow-up issues

- **Open Habitat, spinoff catch-up on resume** (feature, `internal/daemon`
  companion extension). Implement step 3 of option A. Tests cover:
  settled-while-down, still-running-without-wait, already-reported (no
  repeat), another session's runs ignored, and Taskfleet missing or older.
  Blocked by the ADR above.
- **Taskfleet, literal-ID harness wait in bundled skills**. Extend
  `environment-neutral-skills`: replace `run wait "$run_id"` in
  `taskfleet-spawn-spinoff` and `taskfleet-run-overview` with a literal
  full-ID form for background waits. Add a validator rule.
- **Open Habitat, measure wait recognition in real use**. After the two
  fixes, check a sample of real browser parents that created spinoffs for
  a recognised live wait, so the trigger for option C becomes an
  observation rather than a guess. This could be a check item in the
  existing manual acceptance list rather than a new issue.
- Existing: [spinoff-process-duplication](../spinoff-process-duplication/item.md)
  covers the tray filter. No new issue is needed for it.

## Sources not otherwise linked

- Pi 1.3.0 package: `~/.local/lib/node_modules/@earendil-works/pi-coding-agent/`
  (`package.json` version 1.3.0; `docs/extensions.md`;
  `dist/core/extensions/types.d.ts`), inspected 2026-10-16.
- `@aliou/pi-processes@0.10.9`: `~/.pi/agent/npm/node_modules/@aliou/pi-processes/`,
  the pinned version that the guest also runs
  ([install-taskfleet-skills/result.md:37-38](../install-taskfleet-skills/result.md)).
- Taskfleet 0.15.0 (`taskfleet version --json`, commit
  `8464733b0d69cf1342eed64995163fd36c33523d`) `--help` output for
  `run wait`, `run create` and `event tail`. Note: the earlier skills report
  saw 0.13.1 on Alder; Alder now runs 0.15.0.
- Fleetrepo at `395d5a09`: `docs/decisions/0011-pidev-background-process-runtime.md`,
  `infra/open-habitat-test/guest_taskfleet_skills.py`,
  `infra/open-habitat-test/evidence/taskfleet-skills/provider-parent.mjs`.
- Pi extension surfaces mapped earlier for transport purposes:
  [pi-extension-ahp-transport.md](../native-agent-host-architecture/research/pi-extension-ahp-transport.md).
