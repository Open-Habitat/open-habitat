# Result: the seven browser failures

All seven came from intended changes whose tests were stale. None is a product
regression, so only tests changed.

| Test | Decision | Why |
|---|---|---|
| `browser-editor.spec.ts:523` duplicate `navigation-open` | Test race; scope the locator | Beside an open editor the desktop rail is collapsed, and its toggle uses the `navigation-open` test id. Right after the resize to 390 px, the collapsed rail is still mounted for one render, off-canvas and hidden, while the phone toolbar's opener appears. Strict mode fails at once. Only one opener is ever visible: the failure's accessibility snapshot shows just the toolbar button, and `collapsed` is `railCompact && !mobileLayout`. The test now takes the opener from `#main`, which is the toolbar's. |
| `first-use-ux.spec.ts:177`, `github-stream.spec.ts:34`, `site-ai-key.spec.ts:94`: no `workspaces-title` | Stale expectation | Graduating agent instructions made the note for the agent the onboarding route's last step whenever repositories were chosen (`instructionsStep = !skipChooser`). The heading is still there. The failure snapshot shows the route waiting at "Muistilappu agentille". The tests now leave the note for later and enter Habitat through a shared `skipAgentNote` helper, the same path the graduation already gave `pi-onboarding-host.spec.ts`. The first-use promptness bound (4.5 s) now measures the arrival of the note step, which is what completion now shows. |
| `lab-english-url-paths.spec.ts:13` `/settings/sounds` | Stale expectation | Sounds graduated to an ordinary settings page after Appearance. Added to the slug list. |
| `lab-sidebar-default.spec.ts:8` 6 vs 7 workspace actions | Stale expectation | The graduation removed `rename-workspace` from the action group because renaming now happens in the workspace strip's name. Both counts are now 6. |
| `lab-workspace-icons.spec.ts:44` no icon in the running row | Stale expectation | The test's wire seam marks each new conversation's worker as idle at its prompt. Since "give stopped workers back to the person", such a conversation is the person's turn and sits in Sinun vuorosi, not Käynnissä. The icon button is present there. The test reads `rail-yours`, including the collapsed-strip check. |

## Verification

Evidence logs are in `/var/tmp/agent-keep/gate-red-v016/fix/` (outside the
tree).

- The two exact rerun commands from the brief passed three times in a row (4/4 and 3/3 each time; `ord1..3.log`, `lab1..3.log`).
- These whole specs plus same-test-id siblings passed once with two workers:
  - ordinary, 73 passed: browser-editor, first-use-ux, github-stream, site-ai-key, agent-instructions, github-first-onboarding, pi-onboarding-host, round4-polish, workspace-slice, rail-icons-quiet, rail-groups, settings-search, settings-selectors
  - lab, 37 passed: lab-english-url-paths, lab-sidebar-default, lab-workspace-icons, lab-en-workspaces, lab-explain-coverage, lab-onboarding, lab-worktree-containers, lab-workspace-page, lab-sidebar-account
- `./scripts/test-focused.sh --area web` passed.

## Decisions for later review

- **`navigation-open` names two controls**: the rail's collapsed toggle and the phone toolbar's opener. That is unchanged product behaviour. Alternatives were to rename one id or to unmount the collapsed toggle at once on resize. Neither is visible to people, and renaming would ripple through about fifty specs on release night. Scoping the one test was the proportionate fix. A rename could be a later cleanup.
- **Other specs that use `navigation-open` unscoped were not rerun.** About fifty specs touch the id. The clean gate ran all of them on main, and only this one failed. This change touches tests only, so those results still hold.
- **The issue stays open** for the Go `internal/daemon/integrations` flake it also records. The release driver owns that flake. The browser part is done.

# Round 2: `TestMicrosoftDaemonStartFollowsTheTenant`

## Cause: a product race at daemon start

`Catalog.Start` creates the person's Microsoft MCP slot (`msmcp.Server`),
hands it to the Microsoft entry, starts `Serve` in one goroutine and the
start alignment (`alignAll`) in another. `Align` pauses the slot before any
native credential work, and `Pause` refuses a slot that is not yet serving.
Nothing ordered the two goroutines. When `alignAll` reached `Pause` before
`serveListener` set `serving`, `Align` returned `ServerUnreachable`, the start
alignment was logged as deferred, and the tenant was followed only at a later
check. A real daemon behaved the same: under load, or during a restart while
the previous daemon still held the endpoint (Serve retries a busy endpoint
every 5 s), start did not follow the tenant.

`652b6d41c` (quiesce native cache users) introduced the race by making
`Align` pause the slot. That explains why the v0.1.5 gate passed. The full
package usually wins the race, and the gate's load made it lose.

Evidence (`/var/tmp/agent-keep/gate-red-v016/round2-fix/`, outside the tree):

- `before-prelim-run1.log`: HEAD under 8 bounded CPU hogs, the gate's
  failure reproduced (`start did not follow the tenant`). `before-run1..3.log`:
  three more loaded runs of HEAD passed. The window is narrow.
- `baseline-deterministic.log`: HEAD in a detached worktree, running only the
  start tests and a new restart test with no synthetic load. The original
  test failed (5.01 s), and the restart test (a previous slot holds the
  endpoint for 200 ms after Start) failed as well.
- `fixed-deterministic.log`: both pass with the fix (the original aligns in 0.02 s).

## Fix (product)

- `msmcp.Server.Serving()` is a channel closed when the server first holds
  its endpoint and runs its scheduler.
- `Catalog.Start`'s alignment waits for it, cancellation, or 15 s
  (`startServeWait`), then aligns.
- `Pause` still refuses a slot that is not serving, so the quiesce guarantee
  of `652b6d41c` is unchanged: no native verification/reconnect runs while an
  MCP child could spend the old refresh token. The wait only delays the call.
  It adds no path around `Pause`.
- New regression test
  `TestMicrosoftDaemonStartFollowsTheTenantAfterTheEndpointFrees` covers the
  restart case deterministically.
- `TestWaitingAccountDoesNotBlockOthers` now defers `c.Stop()`, which waits for
  the catalog's resume loop and sync clients. Before, it cancelled without
  waiting, so background work could still write into the home while `TempDir`
  removed it ("directory not empty"). Test-only.

## Verification

- `after-run1..10.log`, `after-summary.txt`: the package ran 10 times in a row
  under the same 8-hog load. RESULT_PLACEHOLDER
- `./scripts/test-focused.sh --area go` passed for `./internal/msmcp` and
  `./internal/daemon/integrations`. The integrations package includes
  `microsoft_reconnect_linux_test.go`.
- `runtime/profiles/integrations/microsoft-native.test.mjs` passed in a
  disposable copy of a profile runtime built today from the same runtime
  sources (`microsoft-native-test.log`). Nothing under `runtime/` changed.
- Independent review: an `/llm-review` finder and a focused verifier probe on
  deadlock, quiesce bypass and channel panics found no defects.

## Decisions for later review

- **Bound of 15 s for the start wait.** A second daemon of the same person,
  which never gets the endpoint, now delays its own start alignment, interrupted-pass
  resume and Microsoft recovery by up to 15 s. That alignment is still deferred
  as before. The alternatives were an unbounded wait, which would starve
  resume behind a daemon that never serves, or retrying `Align` on a timer.
  The timer would add a second schedule beside the existing checks. 15 s
  covers a restart overlap (three Serve retries).
- **A previous daemon killed with SIGKILL** frees the endpoint lock without
  reaping an orphaned grandchild. The shipped unit's `KillMode=mixed` covers
  it. This is pre-existing and unchanged here.
