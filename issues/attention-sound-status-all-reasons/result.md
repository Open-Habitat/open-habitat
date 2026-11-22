# All active sound-silencing reasons

Adopted the earlier implementation and evidence commits (`acd3cac18`, `534ce40c2`) onto `18c67cfad` without conflicts. The harvest's runnable revision is `ad6c59fec`; the previously blocking browser spec now passes all 15 repetitions (120/120 cases).

## What changed

The Sounds status lists global off, device mute and the active local-clock night window independently, each with its permanent fix. Subordinate reasons remain actionable when globally off. Fixes preserve focus on persistent settings; Explain mode blocks lasting effects. Finnish and English cards cover the actions. The account menu, playback policy, sessions, daemon and wire contract are unchanged.

## Flake causes and fixes

- The rename test treated an optimistic name and unchanged geometry as confirmation. `App.renameWorkspace` confirms the first rename by navigating to its durable ID, remounting the strip. A picker opened on the provisional strip was then lost. The test now waits for the confirmed pathname change before interacting with the strip.
- The reply test advanced the browser clock five seconds immediately after the rail entered Your turn, while history could still be arriving. `railNow` supplies a reply key from the available reply identity; `useAttentionSound` coalesces nearby observations in a two-second burst. The jump artificially expired that burst between completion observations. Playback is immediate, not timer-delayed, so the post-completion jump served no purpose and was removed. The pre-completion advance still clears the initial settle window while the synthetic agent is held. Exact sound-array assertions remain unchanged, including night suppression. This repairs the test timing; it does not claim a new production guarantee for unusually delayed history delivery.

The two reports adopted from the previous worker retain their original provenance and are resolved by this harvest; no new issues were filed.

## Tests run

All heavy checks ran under umask 077, the shared scratch lease and an outer timeout.

- `./scripts/test-focused.sh --area web`: passed, 256 files / 2165 tests; static, unit and component checks.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15700 ./scripts/test-focused.sh --area browser --spec attention-sound.spec.ts`: passed 8/8. The first attempt stopped before tests because the Pi SDK fixture was missing; installed its locked dependencies with `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`, then reran successfully.
- From `web`, `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15700 OH_REPLY_DELAY_MS=60 npx playwright test tests/attention-sound.spec.ts --repeat-each 15`: **120/120 passed in 11.8 minutes**, under `timeout 1200`, with a leased private scratch directory. This is the entire spec, not only the new status journeys, with no retries or increased assertion timeouts.
- The feature touched no other browser spec. Its status journeys include independent fixes, persistence, focus, axe, local-clock boundaries and Explain interception.
- Generated UI-reference check, project-view validation, issue doctor and diff whitespace check: passed.

Logs: `/var/tmp/agent-keep/attention-sound-harvest/`. Previous synthetic PNG/HTML pairs remain at `/var/tmp/agent-keep/attention-sound-status-all-reasons/`; the feature rendering was adopted unchanged. No new visual captures, deployment, live-installation verification, whole browser suite or clean gate were run. Browser evidence uses the isolated synthetic host, not real accounts or providers.

## Review

Focused self-review, proportionate to a presentation-only feature and two test synchronization changes. Reviewed all reason combinations, disabled/account-busy behavior, independent local unmute, persistent focus, Explain interception, preference confirmation, and the route/rail/audio code behind both timing fixes. No sessions, daemon state, contract or authorization boundary changed, so an independent model review was not required or claimed.

## Decisions for later review

- Preserve the selected three-reason scope; volume and viewed-conversation policy are not new reasons in this feature.
- Keep the existing confirmed preference setters and disappearing reason as confirmation, rather than adding transient toasts.
- Repair the synthetic clock sequence instead of altering production notification policy based on an artificial five-second gap. Delayed real history was not qualified by this run.

## Live check after deployment

Enable experimental attention sounds. At night, mute this device and turn Sounds off globally: all three causes should appear. Clear them in different orders; only the matching cause disappears. Reload, check persistence, change the night hours, and try phone width and English. The account menu should behave as before.
