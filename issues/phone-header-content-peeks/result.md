# Result

The workspace toolbar stuck at main's padding edge (14px at the tested
390px viewport), while page content could paint into that padding. A phone-only
opaque pseudo-element now covers the padding and gutters through the toolbar's
bottom edge. Controls, toolbar dimensions and desktop rules are unchanged.
The conversation header is outside its scrolling stream and needs no CSS change.

No top safe-area inset is used by either layout, and the viewport meta does not
request viewport-fit=cover. Thus there is no env() top inset to simulate; the
actual exposed padding, not an invented safe-area rule, is tested. Physical
Safari/Brave and OS notch rendering remain unverified.

## Verification

On the final working tree based on `97bdd42ea` plus this fix:

- `./scripts/test-web-fast.sh`: passed.
- `./scripts/test-focused.sh --area browser --spec lab-phone-header-content-peeks.spec.ts --spec lab-phone-header.spec.ts`: 4 passed. Synthetic host-backed Chromium, 390px light/dark scrolling and header hit tests; related compact header/a11y journeys at 390/360px.
- Disabling the covering pseudo-element (`content: none`) made both new cases fail at the workspace hit-test assertion. Restored it and reran both commands above successfully.
- `workspace-light.png` / `.html` and `workspace-dark.png` / `.html`: synthetic lab captures after scrolling, inspected visually. Produced only with `OH_VISUAL_CAPTURE=1`.
- Focused self-review: appropriate for one scoped paint-only CSS rule; no shell restructuring, controls or conversation feed rows changed.

The initial test setup incorrectly used the ordinary suite's default preview
origin, then capture correctly refused a non-lab host. The final spec uses the
isolated lab fixture and all final checks above passed.
