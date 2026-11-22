# All active sound-silencing reasons

Implemented in `acd3cac18`, but **not merged**: the required complete attention-sound browser spec is not reliably green. The changed status, clock and Explain-mode journeys pass; failures in the other journeys are recorded below. Work remains on the worker branch for recovery.

## What changed

Direction B is the top status list: off everywhere, this device muted and the active local-clock night window, in that order. Each has its permanent fix; night also links to the hours. The subordinate rows remain visible and actionable while sounds are off globally. Redundant bottom notes are removed, and the off row has no listening reassurance. The account menu and playback policy are unchanged. The feature remains experimental `attention-sound`.

Account writes use the existing confirmed preference setters. Local unmute stays available during account writes. Successful fixes remove only their reason. Keyboard focus moves to the corresponding persistent setting rather than disappearing with the action. Finnish/English Explain cards cover the list and all actions; lasting effects wait in Explain mode.

## Tests Run

Final runnable tree: `acd3cac18` (based on `ae56fcc9945990dbb4c17db829e51239614c0378`). All heavy commands used a timeout, umask 077 and the scratch lease.

- `./scripts/test-focused.sh --area web`: passed, 256 files / 2164 tests. Includes all eight reason combinations and account-busy versus local-unmute availability. Initial CSS lint warning was corrected before this final run.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15300 ./scripts/test-focused.sh --area browser --spec attention-sound.spec.ts`: first run passed 8/8 before the final icon-only adjustment; the final-tree run passed 7/8, failing the existing same-workspace reply journey on a duplicate sound start.
- `npx playwright test tests/attention-sound.spec.ts --repeat-each 3`, with two workers and 60 ms reply jitter: two final-tree runs each passed 23/24. One failed on the existing workspace picker after rename; the other on the existing same-workspace duplicate reply sound. All changed/added journeys passed on every repeat. No assertion was relaxed.
- Final focused changed journeys, `--tag 'night follows|all reasons|night explanation'`: 3/3 passed. Covers independent permanent fixes, reload persistence, focus, axe, clock boundaries and Explain-mode write blocking/navigation.
- Baseline archive of unchanged main-base `ae56fcc99`: picker-after-rename failed twice in six mixed repeats (10/12 passed overall). The same-workspace reply case passed those six repeats and ten isolated repeats; its baseline failure is **not established**.
- `python3 scripts/generate-ui-reference.py --check` and `git diff --check`: passed. Generated reference changes were reviewed alongside their source.
- No full browser suite, clean gate, deployment or live-installation verification was run. These checks use the synthetic host, not a real account or native provider.

## Blocking observations

- `sound-picker-after-rename-flake`: observed and reproduced on the unchanged baseline. The cause is not yet established (possible rename/route synchronization or picker lifetime).
- `attention-sound-duplicate-reply-start`: observed twice in the complete spec. Expected one reply sound, recorded two. Not reproduced in the isolated baseline runs, so it cannot be dismissed as proven pre-existing.

Both reports were filed through intake, unlaned, with this run's provenance. The required green-spec condition is unmet; do not merge on the strength of only the changed subset.

## Review and visual evidence

Focused self-review was chosen: this is a presentation change calling existing setters, with no session, daemon, wire-contract or authorization change. Reviewed independent reason selection, account-off/busy behavior, missing-preference handling, persistent focus, Explain interception and unchanged account-menu/playback code. No independent model review was required or claimed.

Synthetic PNG/HTML pairs and test logs are retained outside git at
`/var/tmp/agent-keep/attention-sound-status-all-reasons/`.
Inspected the all-reasons list at 390 and 1440 pixels, light/dark, and Finnish/English Explain cards. The list fits the first phone screen without horizontal scrolling; permanent-action cards name their scope and wait in Explain mode. US/UK share these messages; UK formatting was not separately visually exercised.

## Decisions for later review

- Kept the existing production confirmation pattern rather than adding the prototype's transient toast: the reason disappears only when its state changes, and focus moves to the persistent setting where it can be reversed. Alternative: an additional timed confirmation. This avoids claiming success before the existing confirmed write completes and preserves the clock implementation's focus behavior.
- The three specified causes are the list's scope. Zero volume and the viewed conversation's quiet policy are not new reasons here; adding them would exceed the selected design.

## Live check

After landing and deployment, enable experimental attention sounds. At night, mute this device and turn Sounds off globally. The top list should show all three causes and the chosen night window. Clear them in any order: only the matching cause disappears. Reload and verify the changes persist. Change hours through the night link. The device card must have no duplicate off/muted notes. Repeat at phone width and in English; the account menu should behave as before.
