---
created: 2026-09-29
updated: 2026-09-29
type: bug
status: fixed
priority: high
lane: pi-onboarding-live-fix
collision: [web/src/app/PiOnboarding.tsx, web/src/components/PiDeviceSignIn.tsx]
closed: 2026-09-29
closed_by: pi
---

# Pi onboarding outcome flickers after device code disappears

## Live report (Jari, 2026-09-29)
After one native Pi code became visible, the page later alternated between `Tarkistetaan tilaa` and `Pi-kirjautuminen tarvitaan` instead of showing a stable, accurate outcome. The first screenshot shows an active device-code screen (code redacted in the attached copy); two minutes later the second shows the start state plus the polling status. Read-only browser API later returned Pi `missing`, attempt HTTP 404. No provider confirmation or successful real Pi authentication was observed. The real person's code is not stored in this repository.

## Source-grounded cause
`PiOnboarding.tsx` sets `hadCode.current=true` on an observed device code, but the first absent attempt changes `view` to `expired` and resets `hadCode.current=false`; the next 3-second poll sees the same absence and changes it to `start`. `PiDeviceSignIn` renders a `Tarkistetaan tilaa` status mark whenever `checking` is true, replacing the settled outcome mark even though the native status is still missing. The repeated polls therefore oscillate both status and message. Pi SDK errors are intentionally generic, so absence is not proof that provider consent failed; an unconfirmed result stays uncertain and must not be called successful.

## Acceptance
- [x] Once a code has been seen, an absent native attempt shows a stable expired/interrupted outcome with a clear action to start one new attempt; repeated polling/focus does not replace it with `Pi-kirjautuminen tarvitaan` or visually flash `Tarkistetaan tilaa` over the settled message.
- [x] Preserve a visible code while the matching native attempt remains active; unknown/failed status stays truthful, cancellation and lost writes remain uncertain (no automatic POST/retry), and only Pi `usable` advances to workspaces.
- [x] Production component/Storybook and host-backed synthetic browser tests cover code→absence over several poll intervals, slow responses, focus and explicit retry; clean CI on committed tree. Keep screenshot evidence sanitized and distinguish synthetic proof from Jari's live provider outcome.
