# Test-speed investigation

## What changed

The native-history HTTP handler now takes private page and block budgets. Production callers pass the original 256 KiB page and 1 MiB block budgets; the test uses an 8 KiB page budget for metadata pagination (12 entries of roughly 7 KiB each) and an 8 KiB block budget with a 16 KiB image. The tests still cross both budgets, check the backward and forward cursors and reject a request one byte above the block budget. A separate test pins both production defaults and the unchanged 32 MiB legacy / 512 MiB native file limits. The tail-window test uses a 1 MiB record (four times the page budget) rather than 34 MiB: it still checks backward navigation, chunking, revision invalidation and capped HTTP responses. It no longer proves that a single record above the *historical* 32 MiB legacy-file threshold remains readable. That historical regression proof would require a separate slow test; it was not equivalent to the actual page bound.

All browser cases still start a fresh isolated synthetic host. Removed nine 2.2-second sleeps from Pi onboarding cases: their comment assumed the preceding case's Pi helper leaked into the current host, but every case gets a new daemon/device/home and scenario reset replaces its ephemeral leases. The one case checking polling while a status request remains in flight now advances Chromium's timer through one, then two more, 2-second poll intervals instead of sleeping 10.1 seconds; it still asserts single-flight, no false success, no duplicate POST, and explicit retry. Production's 2-second interval and fake Pi's 2-second native transition are untouched. No browser test was deleted.

## Redundancy audit (normal and lab browser specs)

Each row states its distinguishing proof and closest overlapping test. Overlap is not a replacement unless it covers the distinguishing behavior. Pure component rendering is also exercised by Vitest, but a browser visual, focus, or real host route assertion cannot be removed merely because a component renders.

| Spec | Distinguishing assertion; closest overlap |
| --- | --- |
| `account-settings` | Native credential observation and identity switch; `browser-conversation` settings only checks revalidation timing. |
| `browser-conversation` | 58 host-backed controller/recovery cases: once-only writes, receipts, answer/queue/continuation races, drafts across identity, and reconnect. `lab-conversation` covers happy turns and selected frame recovery, not its lost-ack/state matrix; `resilience-states` covers outage views, not write receipts. The footer/editor assertions overlap component render tests but additionally check browser widths and native interaction. |
| `control-states` | Shared controls' focus and theme feedback, plus source construction rule; `design-system` checks catalog focus, not migrated production controls. |
| `design-system` | Catalog visual themes, zoom, reduced motion and axe; `shell-accessibility` checks the actual signed-in shell. |
| `first-use-ux` | Abort semantics, delayed reads and code-preparation feedback; `pi-onboarding-host` proves native attempt result, not first-click/focus behavior. |
| `github-denied` | Denied checkout remains unconfirmed; `github-observation` exercises conflict/partial and lost responses, not denied writes. |
| `github-first-onboarding` | End-to-end checkout selection and narrow keyboard access; `github-observation` tests response reconciliation. |
| `github-observation` | Existing checkout, conflict and lost POST readback; `github-first-onboarding` proves ordinary selection only. |
| `github-session` | Cookie/identity switch fences in-flight catalog; `workspace-slice-security` authenticates mapping, not that pending catalog. |
| `github-slow` | Slow reply/focus prevents duplicate checkout; `github-observation` checks lost reply rather than concurrent focus. |
| `github-stream` | Native clone progress stage; `github-first-onboarding` checks completed clone. |
| `lifecycle-frames` | Repeated completed turns cannot become Pi messages; `lab-conversation` checks typed fragment convergence, not this frame classifier. |
| `native-history` | Paging, native-only reads, anchored scroll, corrupt/missing states, warm return and mapped identity; daemon history tests cover parser/bounds, not browser anchoring and rendering. |
| `onboarding-notices` | Desktop/phone error alignment and safe read-only retry; `first-use-ux` covers onboarding controls rather than placement. |
| `pi-attempt-host` | Foreign/stale attempt denial with mapped reads; `pi-onboarding-host` tests UI session separation, not native attempt mapping. |
| `pi-native-route-gate` | Gate's single OpenAI check alongside mapped native reads; `account-settings` covers credential settings, not native route gating. |
| `pi-onboarding-cancel-race` | Cancellation of an in-flight poll; `pi-onboarding-host` tests settled cancellation. |
| `pi-onboarding-host` | Native attempt, foreign session, unknown/expiry and polling through restart; `pi-onboarding-slow` tests delayed replies, not lost lease and explicit retry. |
| `pi-onboarding-race` | Old-session late reply and unbound-session action fence; `pi-onboarding-session` checks settled switch. |
| `pi-onboarding-restart` | Restart/expired lease; `pi-onboarding-host` also restarts a lost code, but does not check an expired lease with fresh state. |
| `pi-onboarding-session` | Device instructions removed on Alice→Bob switch; `pi-onboarding-race` tests late response during switching. |
| `pi-onboarding-slow` | Native reads span polls with exactly one write; `pi-onboarding-host` checks delayed poll after restart, not multiple delayed native reads. |
| `resilience-states` | Read/snapshot outages, stale-vs-empty state and retry; `browser-conversation` covers write reconciliation rather than workspace outage truth. |
| `round4-polish` | History labels, focus ring and distinct pending-code cancellation; `shell-accessibility` has generic route focus, `first-use-ux` has abort controls but neither checks these details. |
| `shell-accessibility` | Signed-in/out shell axe, focus restoration, zoom and headings; `design-system` checks catalog a11y, not real navigation. |
| `terminal-sync` | Native terminal append reaches two browser contexts exactly once; `native-history` checks one-context pagination. |
| `theme` | Pre-bundle theme application, system preference, storage-denied fallback; `design-system` checks rendered catalog themes, not persistence or initial flash. |
| `workspace-slice-security` | No fixture in production, safe auth/callback, mapped account and >512 workspaces; `workspace-slice` tests normal isolation and routing but not bundle or high-cardinality boundary. |
| `workspace-slice` | OAuth routing, identity isolation, snapshot truth and axe on built host; `workspace-slice-security` has narrower auth adversarial cases, not journey. |
| `lab-conversation` | Fake Pi through real controller, combined SSE, native paging, recap and recovery, heartbeat; `browser-conversation` tests many related failures, but not every combined-frame/recap assertion. |
| `lab-foundation` | Lab-only metrics, narrow navigation and title access; `design-system` checks catalog rather than lab state. |
| `lab-onboarding` | Clone/Pi flow and publication visibility across local vs cloned checkout; `github-first-onboarding` tests production checkout but not lab publication states. |
| `synthetic-demo` | Demo isolation/no external host and error sanitization; excluded from the normal suite, and not a substitute for gateway boundary tests. |

**Removal/move map:** none. Changed wait only in the nine Pi cases listed above; each keeps its original assertions. All Unix-user, socket, gateway, daemon identity and provisioning tests remain. No claim that same-UID browser hosts prove kernel UID isolation.

## Timing, decisions and remaining gap

Before (previous changed-tree warm run): elapsed 169 s, browser 129 s, Go/contracts 124 s. Before cold: 233 s, browser 142 s, Go/contracts 157 s; dependencies alone 49 s. This worktree's 8-core host has eight Playwright workers. Race measurement on the three originally slow daemon cases (before changes, with metadata test edit racing the measurement): `go test -race` 50.94 s package / 54.81 s wall; plain run was 1.56 s package / 3.37 s wall but failed because the first 4 KiB test budget was smaller than an individual 7.5 KiB entry. After correction, the same three cases pass under race in 2.79 s package / 5.84 s wall. This shows a real input-size amplification under the race detector; keep `-race` in the full gate for every Go package rather than silently dropping race coverage. In three serial normal-suite runs, all 142 cases passed each time (76.81 s, 72.15 s and 78.23 s wall, with eight workers). No fixed network-idle wait appears in the browser specs; the only remaining fixed browser sleeps are two 1-second waits in conversation cases. The slow Pi native read test still delays actual HTTP responses 1.9 seconds so it crosses the production 2-second poll interval; replacing those replies with an immediate fixture would erase its single-flight proof. The host remains cheap to start (previous median 17 ms). The same 142-case suite with four workers took 89.72 s; eight workers' 72.15–78.23 s is faster on this eight-core host, so keep eight. These timings exclude the separate lab suite and packaging.

Focused diff review: production entry points `HistoryHandler` and `HistoryHandlerWithNativeRoot` still use the production constants; the unexported budget override is called only from tests. The image is 16 KiB against an 8 KiB injected block limit; a limit of 8,193 bytes is rejected. Twelve metadata-rich entries each weigh about 7.5 KiB against an 8 KiB page budget, so both directions cross the page bound and retain cursor assertions. No browser case was deleted, and no security boundary assertion was removed. The remaining risk is the retired >32 MiB record proof and actual Pi's real-time 2-second transition, which the browser tests still wait for. The fixture's `scenario` switch resets devices and the suite starts a fresh host per case, so removing pre-case 2.2-second sleeps does not grant cross-case state.

## Full gate evidence

| Changed-tree `--clean --json --no-reuse` | Setup | Dependencies | Web checks | Browser | Go/contracts | Packaging | Elapsed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Before, cold (previous run) | 5 s | 49 s | 12 s | 142 s | 157 s | 10 s | 233 s passed |
| Before, warm (previous run) | 5 s | 14 s | 11 s | 129 s | 124 s | 10 s | 169 s passed |
| After, cold-cache attempt on `1e5e9ae7` | 5 s | 47 s | 11 s | 139 s | 95 s | not reached | 202 s failed |
| After, warm-cache retry on `1e5e9ae7` | 5 s | 14 s | 11 s | 124 s | 82 s | 9 s | 162.82 s passed |

Cold-cache failure: the browser phase passed; the Go phase failed in `TestConversationSpontaneousExitWithInheritedStdout` and `TestPiRPCDetachedStdout` waiting for fixture holder processes under concurrent browser load. These subprocess fixtures passed in the subsequent complete gate. The failed run produced no gate receipt. These numbers are not a 10x speedup: the browser side still determines wall time, and the 82-second Go/contracts phase includes build/storybook and validators, not just the now-faster daemon bounds cases. Gate wall time improved only 6 seconds warm. The separate Go suite with pinned Pi fixture installed took 17.84 s plain and 21.07 s under `-race` with warm Go caches. Per-package times (plain → race, seconds): `cli` 0.13→10.12, `core` 0.013→1.013, `daemon` 14.27→17.68, `diagnostic` 0.003→1.022, `gateway` 0.569→2.734, `nativegh` 3.059→4.079, `provision` 7.926→8.544, `storagequota` 0.006→1.021, `transport` 1.031→2.080, `udssecure` 0.006→1.010. The all-package race check retains concurrent code coverage and adds only ~3.2 seconds wall after the large inputs were removed, so it remains in the gate.

The gate receipt for `1e5e9ae7` covers its tree and has `reused_phases: []`. Documentation and issue metadata change the tree, so the final committed tree needs its own no-reuse gate receipt. The issue stays open because 163 s is nowhere near the under-60-second close threshold. Further progress needs a browser journey rewrite that removes unique cross-layer cost without losing evidence; dropping security tests or turning off `-race` would disguise the problem rather than fix it.
