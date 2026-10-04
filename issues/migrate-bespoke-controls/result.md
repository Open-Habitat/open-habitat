# Partial result — composer footer, return row and jump control

Runtime candidate `80536f3` is a **green slice, not completion of this issue**. `ActionRow` puts the send buttons and visible Enter guidance on one baseline, with blocked reasons beneath their buttons. The queue-status action now uses `ControlButton`. `ListRow` supplies indicator/content/trailing slots and is used by the return list. The jump-to-latest button is portaled from the timeline into a floating layer owned by `ConversationFrame`; a resize observer follows the composer's actual height as its editor grows, rather than relying on a sticky zero-height box and negative margin. These are provisional layout choices; @design-control-states still owns finished control appearance.

The synthetic host-backed browser test checks that the jump button is fully above a growing composer and that the composer fits the viewport at **390 × 844 CSS pixels**; it checks vertical overlap of the hint and button and activates the jump. The reported live screenshots did not record an exact viewport or zoom, so this is a representative phone width, **not a claim to have reproduced the original zoom**. Synthetic lab screenshot/HTML pairs show a 390 × 844 phone and 1440 × 900 desktop at 100%:

| View | Screenshot | Offline HTML |
| --- | --- | --- |
| Phone | [PNG](composer-latest-390-100pct.png) | [HTML](composer-latest-390-100pct.html) |
| Desktop | [PNG](composer-latest-1440-100pct.png) | [HTML](composer-latest-1440-100pct.html) |

The snapshots contain 40 DOM-inserted synthetic history rows to show overflow; they do not depict a real person's Pi session or a native history fixture. **Jari has not reviewed the appearance.**

## Verification

- `NAH_PORT_BASE=14000 ./scripts/test-web-fast.sh`: 87 unit + 73 component tests passed with disk-backed `/var/tmp` scratch.
- `NAH_PORT_BASE=14000 PLAYWRIGHT_BROWSERS_PATH=/home/maintainer/Sources/native-agent-host/.cache/ms-playwright npm run test:browser --prefix web -- --grep 'footer and floating latest'`: passed after adjusting synthetic overflow and the viewport test.
- `NAH_PORT_BASE=14000 PLAYWRIGHT_BROWSERS_PATH=/home/maintainer/Sources/native-agent-host/.cache/ms-playwright ./scripts/ci-local.sh --clean --json`: **passed**, `{"status":"passed","clean":true}`, on committed candidate `80536f3`. Its first attempt failed in the unrelated `@lab combined stream reconciles a forced gap without reposting` timing assertion (`streamReads` was 2, expected 1). That test passed alone on the unchanged commit and the full clean gate passed on retry. The initial gate is not counted as a pass. All builds used `/var/tmp` scratch.
- No distinct-UID isolation, real Pi/provider, live-server or Jari-browser behavior is claimed.

Focused self-review of the final diff after deterministic tests: the touched runtime surface is local presentation/layout and does not change authentication, ownership, contracts or native process control. I checked portal target lifetime, removal of the sticky rule, composer-height updates, baseline wrapping on narrow screens and existing return navigation. The source guard still only covers migrated components; the remaining raw controls prevent claiming complete primitive enforcement. The clean gate and the phone-width browser geometry test are the primary evidence, not model opinion.

## Still open

The issue's acceptance criteria are **not yet met**. Migrate remaining raw buttons/anchors and bespoke controls (Tiedot, workspace toggle, tool opener styling, mobile toolbar/close, rail home, read-only footer, settings/tabs and external/skip links as appropriate) into primitives; remove the general `.ah-control` wrapper and its ancestor-dependent layout; use `ListRow` in sidebar and settings; extend the source guard to the whole production tree without exceptions. Investigate and verify the completed-turn line, missed-events notice alignment and tool-block inner spacing in realistic synthetic content. Repeat lab checks at the original reported viewport and zoom if those become known, and obtain Jari's eventual appearance review. @composer-footer-layout and @latest-control-obscured remain open until the shared layout and their full symptoms are demonstrated and resolved; neither was closed by this slice.
