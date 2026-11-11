# Result

## Cause

This was a product bug in how React Aria's tooltip state interacts with our
`QuickTooltip`. The spec was not pressing Escape too early. The tooltip still
on screen after Escape was not Save's: Save's help did close. What stayed was
a stale "Keskustelun toiminnot" (⋯ menu) tooltip with `data-exiting`.

React Aria Components 1.21.1 keeps `<Tooltip>` mounted to play an exit
animation (`useExitAnimation`). Earlier in the spec, the ⋯ button's help
opened instantly and then closed. On a loaded page, that close and the next
help's instant opening fell into the same render. That opening closes other
help with `shouldSkipAnimation = true`, so the ⋯ tooltip rendered `null`
while its exit state became `exiting`. With no element to animate,
`useAnimation` never ends the exit, so the state stuck. Pressing Escape with
focus on the ⋯ button runs that trigger's own `onKeyDown` close. The close
resets `shouldSkipAnimation` to false, the stuck exit state renders the old
help, and it never leaves. Without load the two updates render separately
and the exit finishes normally. A person on a slow device could see the same
help get stuck after Escape or a press.

## Fix

`QuickTooltip`'s content returns `null` whenever the tooltip state is closed,
so a closed tooltip leaves the tree and its exit state starts fresh on the
next opening. Our tooltips have no exit animation, so nothing is lost. A
Vitest (`does not bring back help that closed while the next one replaced
it`) batches the press that closes one help with the warmed-up opening of the
next. It failed before the fix (stale `data-exiting` "First") and passes now.

## Verification

- Reproduced with `OH_CPU_THROTTLE=4 OH_REPLY_DELAY_MS=250`: 8 of 8 failures of
  the 390 light/dark cases at line 415. The probe showed the stale ⋯ tooltip
  appearing synchronously during the Escape keydown, with no open request.
- After the fix, the same settings with `--repeat-each 10` and all four
  "local header" cases: 40 of 40 passed.
- `./scripts/test-focused.sh --area web` passed (1591 tests), as did
  `tsc --noEmit`. These browser specs passed with 2 workers: workspace-editor,
  browser-shell, dictation-bar, browser-conversation, rail-archive,
  named-workers and worker-panel (117 passed, 1 skipped), plus the lab tooltip
  and header specs and lab-slow-creation (22 passed).
- Review: one `/llm-review` finder call (gpt-6-astra) returned "No findings."
  Local checks agreed: the early return comes after all hooks, and
  `aria-describedby` comes from the trigger.

## Decisions for later review

- Fixed in the product rather than only in the spec. Alternatives were
  moving the pointer or focus away in the spec, or patching React Aria. The
  stale tooltip can reach a person, the product expectation is that Escape
  always closes help, and unmounting closed help is the smallest change that
  removes the stuck state.
- If tooltips ever get a CSS exit animation, this unmount would skip it.
  That would need React Aria's exit-state bug fixed upstream first.
