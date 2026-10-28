# Result

The panel now covers the conversation whenever the split cannot fit the narrowest panel beside the narrowest conversation. The shelf and the HTML view panel had identical phone rules (`ah-view-pane` inside the same `ViewSplit`), keyed on the window: `@media (max-width: 800px)`. With the window as the reference, two things went wrong:

- In portrait (390 px), both Chromium and WebKit (iPhone 13 profile, run from the Playwright image under Podman) already covered the conversation. I could not reproduce the report in portrait.
- An iPhone on its side is 844–932 CSS px wide, above the 800px breakpoint. The desktop layout then applies: the navigation stays open, and the panel takes its side-by-side width from the window (`panelBounds(window.innerWidth)`). The conversation is crushed to a ~300 px column beside the panel (`evidence/before-iphone-landscape.png`). This matches "keskustelu jää näkyviin sen rinnalle", so it is the reproduction this fix is built on.

`web/src/components/ViewPanel.css` makes the open split a size container (`view-split`). The cover rules now apply under `@container view-split (width < 680px)`, where 680 px is `ViewHost`'s `minPanel` (320) plus `minConversation` (360). The decision now follows the space the split actually has, so a landscape phone with the navigation open covers. Portrait phones still cover, since they are always narrower than 680 px. The rule applies equally to the HTML view panel and the guide.

## Decisions for later review

- **Landscape as the cause.** I could not reproduce a non-covering shelf in portrait on current main with WebKit or Chromium. If Jari saw it in portrait, the cause is something else, and the KOKEILTAVAA line asks him to try both orientations.
- **Container width replaces the 800px viewport breakpoint for the panel.** Alternatives: keep the media query and add the container query (duplicated rules), or measure the split in JS. With the single container rule, a split 680–800 px wide with no navigation beside it, such as a tablet in portrait, now shows the panel beside the conversation (each at least 320 and 360 px) instead of covering. A landscape phone with the navigation collapsed (split ≥ 680 px) also keeps the side-by-side layout with both columns at their minimums or wider. I chose this because the threshold then means "the two do not fit", which is the rule `ViewHost` already uses for its bounds.
- **Not changed:** `ViewHost` still clamps the side-by-side panel width against the window width, not the split. On a desktop with the navigation open, a wide panel can still leave the conversation under 360 px. This is outside this issue and was not filed: no one has reported it.

## Verification

- `agent-file-offers.spec.ts` phone case: in portrait (390×844) the composer is now asserted not visible under the shelf. After closing, the window becomes 844×390 with the desktop navigation open, the shelf is reopened, and the composer and resize divider are asserted not visible; closing brings the composer back. The landscape assertion failed on the old CSS and passes with the change.
- `./scripts/test-focused.sh --area browser --spec agent-file-offers.spec.ts`: 5 passed. `agent-views.spec.ts` (view panel at 1366, side by side): 3 passed. `lab-start-page-goal.spec.ts` (guide panel): 2 passed. `--area web`: passed.
- Evidence (WebKit, iPhone 13 profile with touch, device scale factor 2, synthetic host, opened by tapping the top bar toggle): `evidence/before-iphone-portrait.png` (already covered), `evidence/before-iphone-landscape.png` (conversation crushed beside the shelf), `evidence/after-iphone-portrait.png`, `evidence/after-iphone-landscape.png` (shelf covers everything right of the navigation).
- WebKit ran as `playwright run-server` in the `mcr.microsoft.com/playwright:v1.63.0-noble` image under Podman, because Birch lacks WebKit's GTK/GStreamer libraries. The synthetic host itself ran under the ordinary harness. The capture spec was throwaway and is not committed.
- Focused self-review (CSS-only change, no daemon, contract or authority path). No whole browser suite was run; the conductor runs it on integrated main.
