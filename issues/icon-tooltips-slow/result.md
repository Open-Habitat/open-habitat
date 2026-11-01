# Result

Icon-only controls now use the shared React Aria tooltip: 250 ms initial hover,
immediate warm transfer between controls and keyboard-focus help. Escape dismisses
it; touch does not start a hover/long-press interaction. The tooltip is portalled,
positioned below the control with collision handling, and uses the shared tokens.
Accessible names, click actions, shortcuts and native disabled buttons remain.

The central ControlButton change covers IconButton and icon-only Segmented choices.
The title audit also migrated native composer send/stop and compact picker buttons,
dictation cancel/finish, terminal close, file download and recap settings links.
Wrapper titles for archive, rename, recap refresh and device-code copy no longer
supply a second slow tooltip. Status, path and text-labelled explanatory titles
remain native. Disabled Aria buttons need a layout-neutral pointer observer because
React Aria deliberately drops their trigger handlers. Dictation's Escape handler
runs in capture so dismissing its focused tooltip cannot swallow cancellation.

## Evidence and review

Tested the implementation based on `a103c1c79b242f5e5928e26bad92a81872ee18b4`;
the commit carrying this result identifies the final source. Birch, synthetic
host/lab only, `OH_PORT_BASE=10010`, `OH_BROWSER_WORKERS=2`, private `/var/tmp`
scratch and umask 077. No live-host or distinct-UID claim.

- `./scripts/test-focused.sh --area web`: passed, 161 files / 1185 tests;
  includes tooltip timing, warm transfer, Escape, keyboard-focused icon-only
  segments, disabled actions and touch rejection.
- `./scripts/test-focused.sh --area browser --lab --spec lab-icon-tooltips.spec.ts`:
  passed. Header tooltip visible within 600 ms, neighbour within 150 ms,
  geometry does not overlap its button, light/dark Axe clean, Escape dismissal.
- `./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts --tag 'home card blocks archive'`:
  passed; disabled archive still explains its refusal and cannot act.
- `./scripts/test-focused.sh --area browser --spec dictation-bar.spec.ts`:
  all five passed, including phone layout, keyboard cancellation and shortcut help.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`,
  `git diff --check`: passed.
- Focused self-review: checked the final diff, native title sites, disabled semantics,
  preserved refs/actions/names, portal placement, token names and Escape priority.
  No daemon, contract or authority changes. No full gate or whole browser suite.

Early checks caught missing pointer modality in the unit hover simulation,
disabled Aria trigger suppression, a stale test reference after disabled-wrapper
remount, and dictation Escape interception; all corrected and rechecked. The first
Axe run sampled the theme transition; reduced-motion capture makes both settled
themes deterministic. An unsupported focused-run `--untracked` flag and an
incorrect standalone tsconfig path were replaced by the supported focused commands.

### Synthetic lab captures, device scale factor 2

[Light screenshot](header-light.png) · [offline HTML](header-light.html)

[Dark screenshot](header-dark.png) · [offline HTML](header-dark.html)

Reviewed both captures: the tooltip is clear of the header button, readable and
inside the viewport. These are review evidence, not visual golden assertions.

## Decisions for later review

- **250 ms first hover, shared warm transfer, 100 ms close grace.** Alternatives:
  immediate first hover or a longer delay. A quarter second avoids flicker during
  incidental movement without the native delay; close grace lets the pointer reach
  the tooltip itself.
- **Reuse existing title copy, falling back to the accessible name for icon-only
  buttons.** Alternative: require a new prop at every call site. Central handling
  covers existing and future icons without changing their names or translations.
- **Disabled controls remain natively disabled and outside keyboard tab order.**
  Alternative: replace native disabling with aria-disabled. Hover help is restored
  without changing activation semantics; existing visible/ARIA refusal explanations
  remain available.
- **Below the trigger with automatic flipping.** Alternative: above everywhere.
  Below keeps header help inside the viewport; React Aria handles constrained edges.
