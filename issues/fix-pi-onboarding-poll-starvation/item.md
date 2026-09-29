---
created: 2026-09-29
updated: 2026-09-29
type: bug
status: open
priority: high
lane: pi-onboarding-live-fix
collision: [web/src/app/PiOnboarding.tsx, web/src/components/PiDeviceSignIn.tsx, web/src/app/App.tsx]
---

# Pi onboarding poll starves device code on live host

## Live observation
On pilot.9, the first authenticated browser visit displayed an indefinite loading banner and then a Pi card saying “Kirjautuminen keskeytyi”, without showing the available device code. Two submitted screenshots have identical bytes; one sanitized image is attached as [live interrupted state](screenshots/live-interrupted.avif). Jari explicitly permits examining the open Chrome tab. Browser-origin read-only checks returned Pi status `missing` and a session-bound attempt state `device_code` (code itself was not read or copied). A Pi-status request took ~2.4 seconds. The UI polls every three seconds but `check()` aborts any preceding read before completing session → Pi status → attempt → session, and focus events also replace visible state with `interrupted`. A valid native device-code event may never reach the card. No real provider login has been completed.

## Requested UI changes (Jari, 2026-09-29)
- Every onboarding view uses the eyebrow `Käyttöönotto` (not `Ensimmäinen käyttökerta · Pi`).
- Card title `ChatGPT-kirjautuminen` (not `Yhdistä Pi ChatGPT-tilaukseen`).
- Remove the generic provider/password admonition and the explanatory paragraph under the card about Pi verifying status / opening workspaces.
- Show failures in a clear red notice **below** a prominent `Kirjautuminen keskeytyi` heading, not a small status chip amid prose. Give a short accurate actionable message, with a read-only status recheck when uncertainty remains; do not call an uncertain native attempt confirmed failed or auto-retry the credential operation.
- Logout action says `Keskeytä käyttöönotto ja kirjaudu ulos`.
- Replace the persistent “Ladataan palvelimen tilaa” connection banner while authenticated but Pi is required with a truthful state.

## Acceptance
- [x] Browser recovers a real in-flight `device_code` after native status/attempt responses exceed the 3-second interval, without polling cancel starvation, duplicate POST or leaking code to other sessions.
- [x] Focus/revalidation, logout, lost request, actual interrupted/unknown, pending, expiry and retry states are distinguishable and accessible, with the requested Finnish copy and red error presentation in the shared production component/Storybook.
- [x] Host-backed synthetic Playwright coverage using slow replies reproduces pre-fix starvation and passes after fix; native login still owned by Pi, no fixture seam in production bundle. Full clean CI on committed tree and a release verifier pass. Record synthetic vs live evidence honestly. No provider login without Jari.

## Scope
This bug is separate from the newly requested *repo choice before Pi* feature. Do not remove Pi credential gate on existing workspace/history/control routes as an incidental UI fix. The next pilot release requires a separate guarded upgrade from live pilot.9.
