# Announce an upgrade, then start it on time

Proposal for Jari's approval, 2026-11-22. **Not an implementation decision.**
Source baseline: `18c67cfada2cf1f2a2e1f69d62369851766410ae`.

## Recommendation

Give an installation five minutes' advance warning, then begin its upgrade
at the announced time even if an agent is still working. The installation
operator chooses the release and authorizes interruption; `host upgrade`
owns the countdown and the existing maintenance transaction. Agents get a
Habitat-authored message they can act on, and people see the same deadline.
Neither an agent acknowledgement nor an idle work census is permission to
restart, and neither is required to keep the announced deadline.

The time is **when disruption begins**, not a promise that the new release
will be ready then. A service upgrade is not a machine reboot. Native workers,
SSH sessions and user-manager services must not be killed for this feature.

## What exists today

These are source observations, not proposed behavior:

| Area | Current behavior and source |
| --- | --- |
| Upgrade approval | `internal/cli/host_apply_linux.go:parseHostUpgrade` accepts maintenance and interruption approvals, not a deadline or grace period. `internal/host/upgrade_linux.go:executeUpgrade` verifies the approved plan, stages the successor, hands execution to the immutable owner and rechecks before beginning the journal. It contains no wait-until-idle countdown. |
| Busy work | `internal/host/upgrade_native_linux.go:observeUpgradeWork`, `readDaemonWork` and `interruptionRequired` inspect product services and call the predecessor's `agent work show` as each user. **Every live daemon requires interruption approval**, even when its census says idle. `internal/daemon/work_census_linux.go:census` counts live/starting turns, held work, background processes and other daemon jobs, not independent Taskfleet/SSH/tmux agents. It is an observation, not an admission barrier. |
| Disruption | `internal/host/upgrade_native_linux.go:quiesce` publishes fences, closes entry points, stops gateway/broker services, captures preservation evidence and stops product daemon services and listeners. `activate`, `verify` and `open` adopt the successor and reopen only after acceptance. User-manager units are reported but not stopped. |
| Agent shutdown | `internal/daemon/conversation_linux.go:ConversationController.shutdown` marks conversations as restarting and closes their Pi children. `internal/daemon/rest_linux.go:stopFor`, `internal/daemon/pi_rpc_linux.go:piRPC.close` and `internal/daemon/process-extension.mjs`'s `shutdown` handler distinguish a restart from a person's stop, stop managed background processes and bound child termination. They do not offer a five-minute checkpoint interval. |
| Notices | `internal/cli/notices_linux.go:agentNoticeCommand` reaches the own-UID listener. `internal/daemon/notices_linux.go:createNotice` requires a live owned conversation, writes an agent-origin native entry, checks persistence and emits `notice.created`. Its bridge explicitly **never prompts the model**; the companion uses `pi.appendEntry('oh-agent-notice', …)`. A notice alone does not tell a working agent to checkpoint. |
| Scheduled wakes | `internal/cli/wake_linux.go:agentWakeCommand` creates a wake only with a validated daemon-launch `--current` context, an RFC 3339 future time and a note. `internal/daemon/scheduled_wake_linux.go` persists wakes in the person's state and arranges a user-manager timer; startup processes overdue wakes. The companion's `scheduled_wake` handler refuses a busy Pi rather than queueing a supposedly delivered wake in memory. This is not advance steering or an “after upgrade succeeds” trigger. |
| Automatic catch-up | `internal/daemon/wake_linux.go:scanRestartWaits`, `waitOutcome` and `wakeRest` wake eligible interrupted waits, not every unfinished task. Person-stop/archive exclusions, a 24-hour horizon and cooldown bound that mechanism. `internal/daemon/restart_linux.go` and `web/src/components/RestartNotice.tsx` describe what stopped and what settled after the event, not a forthcoming upgrade. |
| Native workers | `internal/daemon/spinoffs_linux.go` and `spinoff_history_linux.go` observe Taskfleet's records; the daemon is not the worker controller. `internal/host/upgrade_native_linux.go:quiesce` deliberately leaves user managers alone. A worker can survive while the Habitat API and its parent conversation disappear. |

The reported 15-minute delay motivates this issue; it is not a product grace
constant. The inspected product entry point refuses unapproved interruption
rather than waiting 15 minutes. An operator's deployment policy, the installation's
test watcher and a separate release-cut orchestrator are outside the inspected
repository; their exact polling rules have **not** been verified here. The
handoff below is the proposed contract for those callers, not a claim about
what their current implementations do. `scripts/prepare-release.sh` prepares
release artifacts; it is not an installation-wide countdown owner.

## Three options

| Option | Benefit | Why choose or reject it |
| --- | --- | --- |
| Deployment script sends existing notices, sleeps, then upgrades | Smallest product change; operator can prototype the browser warning. | Reject as the final design. Notices do not steer agents; wakes cannot interrupt a busy turn. Each deployment script would own its own deadline, cancellation and recipient discovery. |
| **One host-owned schedule, consumed by each user's daemon and supported worker adapter** | One truthful deadline; existing native writers and restart executor retain their jobs. No cross-user conversation registry. | **Recommend.** Requires a typed announcement and delivery path, but does not need a scheduler service or agent readiness protocol. |
| Host asks every agent to checkpoint and waits for readiness | Can report cooperative readiness before stopping. | Reject. A hung tool, absent adapter or agent that never acknowledges recreates indefinite waiting. A bounded version still needs option two's deadline and adds a misleading “safe to stop” claim. |

## Who schedules it

The **installation operator** chooses when a qualified release should land.
An operator's own deployment tooling is one such caller, not a product dependency. A test-server watcher
uses the same product path rather than restarting services directly. A release
cut publishes artifacts; it schedules a particular installation only if its
operator has explicitly authorized that deployment. Publishing a release is
not permission to restart every installation.

Extend `open-habitat host upgrade`, not the gateway or provisioning broker,
to own a bounded announcement phase after successor qualification/staging and
before `quiesce`. Keep the existing exact-plan, maintenance and interruption
approvals. A deadline must not implicitly grant `--approve-interruption`.
The immutable successor owner runs the countdown; an initial invocation that
only stages must not announce a restart it cannot execute.

The proposal needs a positive lead-duration input (default five minutes), an
explicit operator-only immediate-interruption mode, and machine-readable
schedule/withdrawal/progress outcomes. Exact flag names are deferred until
approval. Preview validates without announcing; JSON/JSONL reports the exact
UTC deadline, schedule identity, target and delivery coverage separately from
upgrade success. No interactive prompt, silent approval or arbitrary shell
hook is added. A caller waits for this command's terminal result, not for
`active_turns == 0`, and does not restart the countdown on each poll.

## The announcement and its authority

Propose a small, versioned, **root-written, publicly readable advisory record**
under the installed product's trusted directory. It contains only a random
schedule ID, revision, predecessor/target identity, announcement time, UTC
cutover time and lifecycle state. No account, conversation, workspace, text
from an operator, command or credential belongs in it. This is the public
projection of one host operation's scheduling intent, not another job queue.
Use trusted-parent checks, bounded parsing and atomic publication; a malformed
or untrusted record can never authorize maintenance or agent execution.

This is a new read-only host-to-agent signal requiring Jari's architectural
approval. It is **not** a new privileged agent-socket route: root and gateway
remain unable to use the own-UID agent listener. No daemon writes the schedule,
changes its deadline, chooses another user or gains restart authority. The
existing cold/agent fences remain separate denial mechanisms
(`internal/host/upgrade_native_linux.go:publishUpgradeFences`); do not publish
them during the warning period, when agents still need notices and wakes.

The host's existing operation exclusion covers the countdown so two callers
cannot announce competing successors. A pre-quiescence cancellation or owner
loss means “withdrawn/unknown”, **not** “restart now”. The advisory needs a
bounded owner-liveness indication so a dead owner cannot leave a countdown
looking live forever; expiry withdraws only the advisory, never opens a
maintenance fence. Resuming a pre-quiescence operation after owner loss must
requalify and announce a fresh full lead time. Once quiescing has begun, retain
the existing fail-closed recovery rules and immutable owner; do not substitute
schedule expiry for recovery authority. This distinction needs explicit new
journal handling: today's `executeUpgrade` cleanup is not already that design.

## How agents receive it

1. Each running daemon reads the trusted advisory on change, with a bounded
   periodic reread to recover lost notifications. It uses its own live controller
   handles, not a host's list of history files, to select recipients. Newly
   started conversations receive the current notice too; archived/resting
   conversations are not started merely to announce maintenance.
2. Add a typed companion operation for a Habitat maintenance message. While a
   turn runs it uses Pi's supported steering path; when idle it records the
   notice for the next turn without starting paid work just to checkpoint
   nothing. The companion writes a displayable native custom message with
   schedule ID/revision and deterministic product-owned wording. It is neither
   fabricated user speech nor an agent-origin `notice create` entry.
3. Distinguish observed schedule, queued steering, native persisted delivery
   and unknown delivery. A tool that blocks steering may never read the notice
   before the deadline. Dedupe by schedule/revision in the native branch and
   live pending delivery; do not blindly resend after an ambiguous reply or
   claim a queue acknowledgement means the model read it. Preserve existing
   participant/text-only restrictions: maintenance must not promote a shared
   turn to the owner's tool authority.
4. Workers outside the daemon need **their own harness integration** consuming
   the same advisory. Recommend a small native Pi/Taskfleet adapter, not daemon
   writes into Taskfleet sessions or history. It tells surviving workers that
   Habitat APIs will be unavailable, not that their processes will be killed.
   This adapter is new work and must be installed before promising coverage.
   The locally inspected `taskfleet run message --help` offers acknowledged
   delivery to live Taskfleet-launched Pi workers, explicitly without proving
   they read or acted on it. That facility is a possible adapter integration,
   not permission for Habitat's read-only worker observer to control runs.
5. Caller-owned agents, unsupported harnesses and already running workers
   without the adapter are explicitly uncovered. Do not paste into their tmux
   panes, edit their JSONL or claim a broadcast reached them. Coverage gaps
   appear in the operator result and do not silently become “all agents told”.

Compatibility is a rollout constraint: a successor cannot retroactively add
an announcement receiver to a running predecessor. First ship the receiving
capability through an explicitly approved ordinary upgrade; enable scheduled
announcements on the next upgrade. A known unsupported predecessor requires
an explicit unannounced-maintenance choice, not a counterfeit delivery receipt.
The same applies to workers already running an older harness generation.

## What the agent should do

The model-facing message states the absolute deadline as well as the remaining
time, target and affected lifetime. Suggested content, not final copy:

> Habitat käynnistyy uudelleen 5 minuutin päästä, klo 14.05 UTC. Lopeta uuden
> pitkän työn aloittaminen. Vie nykyinen työ turvalliseen välipisteeseen ja
> tallenna jatko-ohje. Päivitys alkaa ilmoitettuna aikana, vaikka työ olisi kesken.

A daemon-owned agent should finish a small safe unit, commit only coherent
changes it owns when the task authorizes commits, and write a concise handoff
with unfinished work, verification and uncertain external effects. It must not
push, force a merge, stop another process or mark incomplete tests successful
merely to satisfy the timer. Saving files is useful even when a commit is not.

For autonomous work that should resume, it may use the **existing**
`open-habitat agent wake create --current --at <RFC3339> --note <handoff>` with
a stable UUID idempotency key before the fence closes. Recommend a time two
minutes after cutover, but describe it as a **resume check**, not guaranteed
post-upgrade execution. The note must require observing the scheduled target's
successful availability before continuing and reconciling uncertain effects,
not replaying a failed command. Reuse/list the wake after a lost response rather
than creating another. A person can cancel it through the existing wake UI.
No wake is needed when the task is finished or further work needs the person.

A surviving worker cannot assume `wake --current` works: it requires a
daemon-issued launch context (`internal/cli/wake_linux.go:currentQuery`). It
keeps its native task and waits/rechecks Habitat availability in place, without
retrying writes of unknown outcome. It needs no replacement worker. If an
upgrade is cancelled, the resume check observes cancellation and follows the
handoff rather than waiting forever for the target.

**Required implementation addition:** gate scheduled-wake delivery during an
active cutover and let overdue wakes run after entry reopens. Apply this to all
scheduled wakes, since the existing wake record has no upgrade association;
the agent's note carries the resume-check intent. Current
scheduled wakes are wall-clock commitments, not generation-bound continuations;
their retry limit and native persistence must remain visible, and an extended
outage can still leave a failed wake. Do not promise every interrupted turn
will automatically continue. Existing restart catch-up remains the fallback
account of what stopped, not a substitute for the saved handoff.

## Timing and the person's browser

Five minutes is the recommended default on both normal and test installations.
It is long enough to save a checkpoint without waiting for a whole task; it is
a product choice for approval, not a measured guarantee. The operator can
choose a longer lead, but a background worker cannot extend it.

An active human conversation gets the full announced lead time, **no additional
automatic delay**. A turn finishing early does not pull the restart earlier;
a new prompt, typing, presence or a long tool does not push it later. The
reported 15-minute stall is precisely what a fixed deadline avoids. No
person-specific grace timer or all-users-idle gate is recommended. Only the
operator can cancel/reschedule before quiescence, publishing a new revision
and a fresh full lead time. Emergency interruption is explicit and says that
normal notice was bypassed.

Proposed UI: a non-modal installation banner with local clock time and remaining
minutes, plus a Habitat line in each affected live conversation. Keep drafts
and allow checkpoint-related interaction during the lead period; newly sent
work carries the same deadline warning. Do not block all sends at announcement
time or present an unearned “saved safely” checkmark. Countdown expiry changes
to “update starting”, not “complete”. During downtime show reconnecting without
resending an uncertain prompt; on return refresh the actual schedule/version
and show the existing restart/catch-up account where relevant. Cancellation
replaces the countdown with “update cancelled”; a stale owner says status
unknown, never an endless zero-second countdown. No browser tab is required
for model delivery. Shared participants see the installation warning but no
other person's work or delivery details.

The banner, snapshot/event fields and companion message are **new**; define
wire additions in `contracts/v1/` and generate both clients only after approval.
The existing post-restart presentation seam is
`web/src/components/RestartNotice.tsx`; do not overload its retrospective
report into a misleading advance-warning record.

## Failure policy

| Failure | Proposed outcome |
| --- | --- |
| Qualification, staging or explicit approval fails | Announce nothing; predecessor keeps serving. |
| Unsupported receiver | Require explicit operator choice for unannounced maintenance; report the coverage limitation. |
| Supported daemon/bridge does not answer, model ignores notice, or tool blocks steering | Record delivery as unknown/failed; proceed at the approved deadline. Do not convert missing acknowledgement into an unbounded wait. |
| Native history full or unwritable | Browser may show the live host warning, but persistence is unknown/failed. Do not report checkpoint or notice durability without native evidence (`createNotice` already distinguishes these). |
| Owner dies before quiescence, cancellation, or target changes | Withdraw/expire advisory; keep predecessor serving. Requalification and a new announcement precede another attempt. Never reuse an obsolete deadline as interruption permission. |
| Clock changes or daemon joins late | Carry absolute UTC time, use a monotonic countdown within the live owner, and publish a revised wall-clock deadline after a material correction. A late recipient sees the remaining time; no per-recipient extension. An owner restart requires a new lead period. |
| Daemon or browser reconnects during countdown | Reread current schedule; dedupe native messages. Browser rendering never starts Pi. |
| Failure after quiescence | Existing fences and immutable-owner recovery remain authoritative. Show unavailable/update incomplete; do not reopen simply because the countdown expired. |
| Wake due during outage, slow upgrade or cancelled upgrade | Process overdue wakes only when allowed; resume check verifies target/state. Retain failed/late status and person cancellation. Never silently replay external writes. |
| Surviving workers call unavailable APIs | Fixed maintenance/unavailable outcome; reads can be retried, ambiguous writes must be reconciled. Do not terminate the user manager to make the census quiet. |

## Approval questions for Jari

1. Approve **five minutes, fixed deadline, no automatic human-turn extension**?
   Alternative: one bounded extra grace for turns already active when announced;
   that makes the displayed deadline conditional and is not recommended.
2. Approve the **root-owned advisory → per-user daemon/companion and native
   worker adapter** architecture, with no new privileged agent-socket access?
3. Accept explicit coverage limits and a two-release rollout? Recommend first
   guaranteeing daemon-owned Pi conversations and supported Taskfleet Pi workers;
   other harnesses remain visibly unsupported rather than blocking indefinitely.
4. Approve optional agent-created resume checks rather than waking every
   interrupted conversation automatically? Automatic universal continuation
   would change the existing person-stop and “wake only for a reason” policy.

## Evidence required after approval

Implementation must test schedule exclusion, cancellation/owner death on both
sides of quiescence, stale revisions, clock changes, deadline enforcement with a
busy turn, late joiners, history write failure and ambiguous delivery. Native Pi
coverage must show steering actually reaches a running model without changing
turn authority; a fake acknowledgement is insufficient. Distinct-UID tests must
prove users cannot publish/alter schedules or reach other users' sessions and
that root still cannot use agent.sock. Exercise supported and unsupported native
workers, worker survival, overdue/cancelled wakes, browser draft/reconnect and
no-resend behavior with synthetic users. Qualify the real predecessor-to-successor
upgrade on staging. None of these runtime claims is established by this design.
