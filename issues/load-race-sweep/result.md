# Completion — 9 November 2026

The remaining prevention switch is enabled: focused browser runs selected with
`--spec` or `--tag` now use seeded 0–60 ms API delay unless explicitly overridden.
`OH_REPLY_DELAY_MS=0` disables it. Whole-suite/gate defaults are unchanged.
No product, fixture or browser-spec changes remain in the final diff. A
rail-archive readiness probe was reverted rather than landing a partially
verified fix; its evidence and remaining work are in an intake below.

This closes the sweep, not every subsequent detector finding. Three different
failures in unchanged specs are preserved as unlaned intakes below. No all-green
browser-suite claim is made.

## What was already landed

Checked git and the three product-fix results, rather than reapplying the sweep's
obsolete instrumentation diff:

- Groups 1–4: `race-status-merge`, `race-input-before-ready` (including its
  harvest), and `race-render-snapshot-closure`. Status ordering uses the
  **journal cursor**, not the restarting Pi event counter proposed in the sweep.
- `4ebef9276` supplies the maintained seeded delay, CPU throttle, timeout scaling,
  periodic stress script, controlled Vitest transport, and the code/spec rules.
  The delay runs before API dispatch; fixture controls and SSE remain undelayed.
  `worker-host.ts` generates a fresh seed per case without `OH_REPLY_SEED` and
  prints it on failure. The failures below exercised that diagnostic.
- `d2132a6cd` already completed groups 6–9 (`race-spec-signals`): reduced motion
  in both configs, clock-driven recap timers, fixture holds, EventSource `open`,
  native readiness, and response-body/navigation fixes. Its result in history
  records 80/80 CPU4/D250 executions after rebase. That is inherited evidence,
  not a run repeated here. Editor typing-pause clock control and immediate
  creation-response reads had landed earlier still.
- `web/AGENTS.md` already carries the requested ready-state, ordered-reply,
  event-side-effect and current-callback rules. `TESTING.md` already carries the
  spec rule and periodic detector. Only its obsolete zero-jitter-default
  paragraph needed changing.

## Group 5: focus inventory and current behavior

Reviewed the inventory against today's code and exercised its reported cases.
It is an inventory of suspect mechanisms, not proof that every deferred call
caused a defect; a mechanical replacement of every timer would be unjustified.

- **Composer and paperclip:** the single mounted composer from group 2 keeps
  the target through creation/loading. `a80f92206` removed the attachment
  popover entirely; its former Escape-return test is now the direct-picker and
  retained-draft journey. All 12 repeated variants pass.
- **Status bell:** React Aria owns its popover and focus restoration; the
  current bell survives condition-label changes. Desktop/phone Escape journey
  passes 3/3, in addition to the full baseline.
- **Skill reader:** current reader open/Escape checks pass in all 18 repeated
  variants. One fails later at unrelated full-block expansion, not dismissal.
  QuickTooltip's existing Escape routing closes hover help before allowing
  Escape to reach the focused control (`1cd904561`).
- **Rail tooltip:** `f4924df67` moved rail help beside the row, with a pointer
  reachability regression test in rail-archive. The old tooltip interception did not
  recur. A different rail-group state assertion failed once; see intake below.
- **Shell/editor:** the terminal has an explicit `onOpen` focus handoff in
  addition to its immediate-existing-surface attempt. The editor's return to
  the conversation uses pending intent plus a layout effect after expansion.
  Shell tab/paste and all four editor return-path variants pass three repeats.
- **Thread following:** thread-fill and the sweep's browser-conversation
  reader-scroll case pass three repeats; these were not established focus
  defects in the original analysis.
- **Other inventory sites:** Navigation drawer return, ArchiveNotice dismissal,
  App's Settings return, BrowserConversation's insertion/note dismissal,
  Composer insertion/goal caret, ViewHost item/guide closure, and the
  Overlays/GitStatus/BackgroundStrip/WorkspaceGitLayer/WorkspacePage return
  handlers still contain deferred focus calls. Inspected, not blanket-rewritten:
  no new concrete failure of those sites was established by this run. The
  existing instruction remains the rule for new/fixed code, not a claim that
  the inventory has been mechanically eliminated. These paths were not each
  independently tested under forced React scheduling.

No remaining **original focus-return mechanism** reproduced. Enabling the cheap
focused detector is useful now; its purpose is to expose further races rather
than wait for a claim that no possible race remains.

## Verification in this run

Birch, source `fa85393db`, unchanged product bytes throughout. Baseline, original
group-5 repeats and final committed spec bytes are unchanged from that source.
Dependencies installed from the web and Pi-fixture lockfiles; umask 077, disk-backed TMPDIR,
two browser workers. Every browser command was bounded by `timeout`. No CPU hogs,
whole suite or clean gate. No browser specs were touched or added in the final
diff; the failed temporary rail-archive experiment is disclosed below.

| Run | Detector / selection | Result |
| --- | --- | --- |
| Focus baseline | D250, seed `sweep-focus`, port 15300; status-bell, rail-groups, browser-shell, workspace-editor, thread-fill | 27 passed, 1 native-editor prerequisite skip |
| Lab baseline | Same settings; lab-composer-area, lab-skill-invocation | 15 passed, 1 block-load failure |
| Original ordinary group-5 cases | D250, seed `sweep-focus-repeat`, port 15500, `--repeat-each 3` | 29 passed, 1 different rail-row failure |
| Lab picker/reader | D250, seed `sweep-lab-repeat`, port 15700, `--repeat-each 3` | 29 passed, 1 block-load failure |
| Default-on entrypoint | No delay override; `browser-focused.py --spec rail-archive.spec.ts`, port 15900 | 2 passed |
| Rail tooltip regression | D250, seed `sweep-tooltip`, port 15900, rail-archive `--repeat-each 3` | 3 passed (touch), 3 failed (desktop: handover/title ×2, missing Ei nyt ×1) |

The ordinary repeat selected titles matching `several conditions|Käynnissä rows|tooltip|tabs, Ctrl|multi-line paste|local header|short conversation|only reader scroll`
in status-bell, rail-groups, rail-archive, browser-shell, workspace-editor,
thread-fill and browser-conversation. The rail-archive title does not match that
expression, so its dedicated validation is recorded separately in the table.
Lab repeat selected `recorded skill reader|attachment` in lab-skill-invocation
and lab-composer-area with the lab config.

Logs (disposable): `/var/tmp/load-sweep-{focus,repeat,lab-repeat,default,tooltip}.log`.
These are same-UID synthetic browser results, not live-server or UID-isolation
evidence. No new user-visible behavior to add to KOKEILTAVAA.

`python3 scripts/test-test-focused.py`: 8 tests pass. Added behavioral checks
capture the environment delivered through the actual shell/Python entrypoint:
spec and tag selections default to 60, explicit 0/250 and the replay seed survive,
and a whole suite gets no implicit delay. Project-view and whitespace validators
pass. Fast web checks passed twice (206 files, 1546 tests); these were run during
the temporary spec probe, with unchanged product/unit code. No Go package changed.

## Residuals and the five related intakes

- `wholly-hushed-tomatoes`: full skill-message block remains a preview after
  Load, twice observed in the 1440/light variant, after its Escape checks passed.
- `completely-cagey-page`: first mocked parked-worker row absent after opening
  the second conversation, 1/3. This is not tooltip interception; real host
  updates versus the snapshot-only parked-worker mock need investigation.
- `enormously-awake-desire`: rail-archive leaves before native handover in two
  runs; another reaches the reply and tooltip but lacks Ei nyt as a Tab stop.
  A temporary opened/native-active readiness probe removed the title failures
  but not the absent action (5/6 passed). An initial probe mistakenly expected
  command state `working`; trace inspection corrected that to `run_active`.
  The experiment was reverted, not presented as a passing fix. The intake
  preserves both the readiness correction and the status-versus-snapshot lead
  for the absent action.

All three occurred with the exact unchanged main product/spec tree and explicit
D250, so the brief's untouched-main-failure exception applies. Filed with this
run's full provenance, unlaned; no failure was hidden by retries or assertion
changes. All required checks for the changed runner passed. There is outstanding
spec/product investigation in these intakes; closing the sweep does not close it.

The five named intakes remain untouched: no new fix here demonstrably closes
one. `intensely-talented-ornament` has relevant later geometry work in
`739e58fa7`, but that is not this run's fix or verification. The stream-growth,
rail-unread, phone-editor-unit and installed-agent-PATH reports are distinct
from the original focus-return mechanism and were not investigated here.

## Review and decisions for later review

Focused self-review is proportionate: only a runner default, its environment
regressions and documentation change. Checked explicit overrides, selection
scope, seed generation/failure reporting, and that the gate default is not
changed. No sessions, contract, daemon state or authority boundary changed;
independent LLM review was not required or run.

- **Enable focused jitter despite unrelated detector reds.** Alternative: keep
  the default off until every old and new spec is green. That defeats prevention;
  the original focus failures no longer reproduce, and concrete new failures
  have their own unlaned records. This is not a claim that all focus scheduling
  is proven safe.
- **Retain the existing gate policy.** Only focused selection defaults change,
  as requested. The periodic stronger detector remains separate from the gate.
