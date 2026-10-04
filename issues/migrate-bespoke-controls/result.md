# Result — shared control migration

## Initial green slice — composer footer, return row and jump control

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

## Remaining after the initial slice (resolved below)

The issue's acceptance criteria are **not yet met**. Migrate remaining raw buttons/anchors and bespoke controls (Tiedot, workspace toggle, tool opener styling, mobile toolbar/close, rail home, read-only footer, settings/tabs and external/skip links as appropriate) into primitives; remove the general `.ah-control` wrapper and its ancestor-dependent layout; use `ListRow` in sidebar and settings; extend the source guard to the whole production tree without exceptions. Investigate and verify the completed-turn line, missed-events notice alignment and tool-block inner spacing in realistic synthetic content. Repeat lab checks at the original reported viewport and zoom if those become known, and obtain Jari's eventual appearance review. @composer-footer-layout and @latest-control-obscured remain open until the shared layout and their full symptoms are demonstrated and resolved; neither was closed by this slice.

## Completion — shared control migration

The remaining Tiedot/workspace toggles and mobile drawer controls use `ControlButton`; internal navigation uses `LinkRow`, external/fragment links use `ExternalLink`, and settings tabs use `ControlTab`. Sidebar agent and workspace rows and theme/session settings rows now use `ListRow`. An enabled `Button` has no alignment wrapper; only unavailable actions keep a small reason stack so the explanation remains beneath its own button. The production source guard rejects raw buttons, anchors and `AriaButton` in the app, main entry and all production components outside `ControlElements.tsx`. The `.ah-control` layout wrapper and its CSS selectors are gone (the distinct `.ah-control-reason` explanation remains).

The completed-turn marker's extra margins and feed spacing are reduced, the missed-event notice's trailing paragraph margin is removed, and expanded tool output has smaller inner padding. The queue action, read-only new-conversation footer, skip link and device-sign-in external link also use primitives. This changes presentation, not routing authority, session identity or sanitized Markdown's URL protocol policy.

## Final synthetic evidence

| View | PNG | Static offline HTML |
| --- | --- | --- |
| New conversation, overflowing synthetic history, grown editor; 390 × 844 CSS px, 100% | [image](migration-phone-390-100pct.png) | [HTML](migration-phone-390-100pct.html) |
| Same at 312 × 675 CSS px (equivalent CSS viewport to a 390 × 844 physical viewport at 125% browser zoom; browser zoom itself was not changed) | [image](migration-phone-312x675-zoom125-equivalent.png) | [HTML](migration-phone-312x675-zoom125-equivalent.html) |
| Read-only history and tool row, 390 × 844 CSS px | [image](migration-history-390-100pct.png) | [HTML](migration-history-390-100pct.html) |
| Expanded synthetic tool row, 390 CSS px | [image](migration-tool-expanded-390-100pct.png) | [HTML](migration-tool-expanded-390-100pct.html) |
| Synthetic display-only settled turn and missed-events notice, 390 × 844 CSS px | [image](migration-spacing-synthetic-390-100pct.png) | [HTML](migration-spacing-synthetic-390-100pct.html) |

At 390 × 844 the jump bottom is 595 CSS px, composer top 604 and bottom 844. At 312 × 675 they are 417.6, 426.6 and 675. The Enter guidance shares the button row at both sizes (it wraps inside its own column at the narrower size). The reported live screenshots did **not** record viewport or browser zoom; the synthetic pair verifies representative sizes rather than an unrecorded exact original. The completed-turn marker and missed-events notice in the last pair were **inserted as generic display-only synthetic DOM** because that particular lab history lacks those states; they show CSS spacing, not actual event delivery. The expanded tool row is production lab content. A host-backed browser test asserts that the notice edge aligns with the editor border. Neither the lab nor the test proves the exact live screenshot. **Jari has not reviewed appearance.** Synthetic identity/history only; no real login or live server.

## Verification and review

- Runtime commit `048baf3` on top of `cb7bd13`. `NAH_PORT_BASE=14000 ./scripts/test-web-fast.sh` passed after formatting, and focused host-backed browser tests passed for footer/jump geometry, control feedback, drawer and sidebar layout, workspace row height and accessibility.
- The first full clean gate on `cb7bd13` **failed**, so it is not a pass: 121/123 browser cases passed; one detected a real desktop workspace row-height regression (44px versus the 36px test limit), and the new synthetic-overflow test intermittently lost its DOM-inserted history during feed reconciliation. `048baf3` fixes the actual geometry and uses a stable style-only test overflow. The final clean gate passed on `048baf3`; the full gate was not rerun after evidence-only whitespace cleanup, issue metadata, and this report.
- Independent review was proportionate because this is a cross-view CSS cascade and control migration. `claude-fable-5-1` found five concrete regressions; `gpt-6-astra` verified the source and rendered CSS and narrowed the workspace-link finding to desktop. All five were fixed in `048baf3`, then a lab view exposed a separate notice-to-editor gutter mismatch; the final browser assertion covers that alignment. This model review supplements, not substitutes for, the deterministic gate. No residual warrants another issue.
- @composer-footer-layout and @latest-control-obscured were closed as `fixed`, each with a resolution referencing this issue. Their older issue bodies lack acceptance checklists, so `issuectl close` returned advisory DoD warnings; `issuectl doctor --json` reports no warnings or blockers. All three acceptance criteria here are checked.
- No claim of real Pi/provider, distinct-UID isolation, Jari-browser or test-server behavior. Appearance remains unreviewed by Jari.
- `TMPDIR=/var/tmp/nah-migrate-controls NAH_PORT_BASE=14000 PLAYWRIGHT_BROWSERS_PATH=/home/maintainer/Sources/native-agent-host/.cache/ms-playwright ./scripts/ci-local.sh --clean --json`: **passed** on the clean committed runtime tree `048baf3` (status `passed`, clean `true`). The gate covers web fast/unit/component, browser/a11y, Go, generated contracts, docs, packaging and issue doctor. The lab pairs are synthetic and not a live-host test.
