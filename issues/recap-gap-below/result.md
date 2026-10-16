# Result

The recap card owns the gap below it through the shared `--ah-composer-pad-block` token (12 px). An immediately following composer no longer adds its own top padding. Read-only and composer views therefore have the same visible card-to-control gap at desktop and phone widths, without state-specific spacer elements. The draft places the recap outside the stream above the composer; its composer inset supplies the spacing reference. No new token or view-state logic was needed.

The bounded unsupported-model notice area, header popover and default-model selection behavior from `model-warning-recap-picker` are unchanged.

## Synthetic lab evidence

Captured with `OH_PORT_BASE=27300`, the real gateway/daemon conversation controller and fake Pi, using `web/lab/session.mjs` (`snapshot` saves each image with adjacent offline HTML). These are synthetic UI observations, not live-server or real-provider evidence.

| State | Desktop before / after | Phone before / after |
| --- | --- | --- |
| Composer | [before](before-desktop-composer.png) / [after](after-desktop-composer.png) | [before](before-phone-composer.png) / [after](after-phone-composer.png) |
| Read-only | [before](before-desktop-read-only.png) / [after](after-desktop-read-only.png) | [before](before-phone-read-only.png) / [after](after-phone-read-only.png) |
| Snapshot outage | [before](before-desktop-outage.png) / [after](after-desktop-outage.png) | [before](before-phone-outage.png) / [after](after-phone-outage.png) |
| Unsupported model | [before](before-desktop-unsupported.png) / [after](after-desktop-unsupported.png) | [before](before-phone-unsupported.png) / [after](after-phone-unsupported.png) |

The read-only journey opens the same native history while its synthetic browser writer still exists, so it shows “Vain luku” with “Uusi keskustelu”, not an eligible “Jatka keskustelua” action. Both use the same footer surface. Recaps were requested through the native recap API after the fake-Pi turn; automatic recap generation is independently covered by the existing browser journey.

## Validation

- `./scripts/test-focused.sh --area web` passed: format, lint, typecheck, unit and component checks.
- `OH_PORT_BASE=27300 ./scripts/test-focused.sh --area browser --spec lab-conversation.spec.ts --tag 'recap|unsupported-model'` passed (2 cases). The existing automatic-recap persistence/staleness journey now also verifies a positive, equal gap between the visible recap and both composer entry and read-only footer at 1440 px and 390 px. The existing unsupported-model/picker journey still passes unchanged.
- `OH_PORT_BASE=27300 ./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts --tag 'unsupported account model'` passed (1 case).
- Browser commands used the shared synthetic Chromium cache and disk-backed `TMPDIR=/var/tmp/open-habitat-build`.

- `OH_PORT_BASE=27300 ./scripts/ci-local.sh --clean --json` passed in 240 seconds on commit `cd9a4b4a8b9a9e18129dac8eb38e6a683e87b049`, tree `4ee8483d5265db1c46352b78a74aa5d5d84236b9`, with no reused phases: 163 normal browser cases and 24 lab cases passed, along with web, Go/contracts, Storybook and packaging checks. `free -g` showed 6 GB available before starting (above the 2 GB minimum). The receipt is in the shared git directory under `open-habitat-gate-receipts/4ee8483d5265db1c46352b78a74aa5d5d84236b9.json`. This result write-up is a later documentation-only change; that receipt does not cover the final documentation tree.
- `git diff --check` and `issuectl doctor --json` passed (no broken references or attachments; existing advisory warnings remain).

All eight after captures measured a 12 px recap-to-footer-wrapper gap, versus 0 px before; the browser regression additionally checks the visible composer entry against the read-only surface. Desktop and phone screenshot/HTML pairs were inspected. The unsupported-model notice remains visible above the recap rather than being moved into the scrolling history.

## Focused self-review

Only the shared recap margin and adjacent-composer inset change. The selector applies to the direct sibling inside `ConversationFrame`, not catalog recaps or recaps in a stream. Its specificity overrides the existing phone composer padding too. No global frame gap is added, so empty notice containers and floating controls cannot introduce extra spaces. The regression test measures actual card and visible footer rectangles at both widths and compares the gaps rather than copying a CSS token value. Existing recap persistence/staleness and unsupported-model picker assertions remain in place.
