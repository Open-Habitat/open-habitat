# Settings density fit — synthetic evidence

The settings sections now use compact bordered rows. The theme choices sit horizontally but retain the native React Aria radiogroup and keyboard semantics. The account menu has a compact theme strip; its actions still use the accessible Menu primitive. Phone drawer agent rows are shorter, with a one-line observed status under each title. Search and refresh remain available.

The designer draft is a composition reference, not an authority source. I2/I3 remain intentional deviations: the synthetic identity is “Oma tili”, without an unverified name/email/avatar; only verified native GitHub state is shown, without an invented OpenAI connection; logout closes this browser session, not the server's native credentials. The phone drawer retains filter/refresh and explicit status text unlike the draft (I1). No host or contract change is requested by this slice. No draft phone settings frame exists, so those captures are evidence of product layout only, not a matched pair.

The affected desktop settings, desktop account-menu and 390 px drawer pairs in [the comparison](../compare-v2-pairs/index.md) were refreshed from the synthetic TLS lab in both themes with adjacent inert HTML. Phone settings have no matching draft frame; the [light screenshot](settings-light-390-lab.png) · [HTML](settings-light-390-lab.html) and [dark screenshot](settings-dark-390-lab.png) · [HTML](settings-dark-390-lab.html) show the product layout at 390 px. The lab uses same-UID invented homes/history and fake Pi; it proves visual/interaction correspondence, not real provider behavior, kernel UID isolation or a production host.

## Validation

- `TMPDIR=/var/tmp ./scripts/test-web-fast.sh` — passed (119 format checks, 120 linted files, typecheck, 14 unit + 67 component tests).
- `NAH_PORT_BASE=21000 TMPDIR=/var/tmp PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" npm run test:browser --prefix web -- tests/account-settings.spec.ts tests/theme.spec.ts tests/shell-accessibility.spec.ts` — passed (10 synthetic host-backed browser tests, including 390 px drawer status, keyboard theme choice and accessibility).
- `NAH_PORT_BASE=21000 PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" node web/lab/compare-v2.mjs` — passed; retained only the six affected pairs. Refreshed desktop settings after the final heading token change using `snapshot` from `web/lab/session.mjs`; captured phone settings as unmatched product views.
- `issuectl doctor --json`, `git diff --check` — passed before candidate commit.
- Independent focused diff review (`claude-fable-5-1`) and local assessment (`history/assessment-fit-settings-density-v2.{json,md}`): six confirmed small findings; corrected the logout border/variant, menu group semantics, unknown-status label ownership, full accessible-description assertion and back-button target height. No follow-up issue needed.
- Final committed-tree gate: record after completion.
