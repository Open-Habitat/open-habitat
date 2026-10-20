# Quota experience — integration result

Preserved implementation `fde2427b` and evidence `ea7c9afb` were brought onto current main by run `01m5crtawtj0wsyqz17tfxscwa`. Final runnable revision: `ff1b3de6`, based on `daadaef5`. Later edits in this run are issue evidence only.

## Behavior and review

The signed-in account's existing quota endpoint supplies a single-flight, ten-second observation. At 90% the browser warns; at the limit it shows usage/limit, cleanup guidance, Settings → Storage/Trash and an explicit recheck. It retains available conversation history rather than presenting secondary stale-history/Pi errors as the cause. Failed quota reads retain the last observation with a stale warning. The identity-keyed subtree discards previous-person observations. A successful recovery or explicit recheck rereads conversation state/history without resending writes or starting Pi.

Daemon write boundaries classify wrapped EDQUOT/ENOSPC. Pi stderr, failed RPC replies, assistant error frames and helper failures emit fixed `native_storage` diagnostics with `quota_full`/`storage_full`, never raw paths, credentials or provider text. Direct-child stderr draining is bounded so detached descendants cannot hold reaping indefinitely.

Focused self-review is proportionate: no user boundary, ownership proof, gateway/daemon/broker authority, installation policy, contract, dependency or fixture implementation is changed by this work. Reviewed identity disposal, single-flight cancellation, read-only recovery, native-text redaction, named-error returns and child/pipe lifetime. Integration preserved concurrent local-folder context/RPC handling and UI, header changes and terminology. App.tsx's large whitespace diff is the provider wrapper; whitespace-insensitive review confirms only that wrapper, import and notice addition. No independent model/security review is claimed or required for these diagnostic/presentation changes.

The tiny-budget test supplies wrapped kernel quota errno after eight bytes, replenishes the synthetic budget and checks redacted diagnostics. This is synthetic write-budget evidence, not mounted filesystem quota enforcement or distinct-UID evidence. The browser quota read is mocked while the synthetic host uses production handlers/controller and fake Pi. Its journey checks warning/full/recovered states, retained history, settings navigation, Axe and no writes during recheck.

## Baseline regressions

Before restoring implementation, `browser-conversation.spec.ts` ran on unchanged main `6e593d42179a56add0e9dedb29eae0356ae57b3d`: **65 passed, 2 failed**, exactly the prior worker's phone pill height (59.5625px, expected ≤36) and desktop three-Tab focus mismatch. Job `0f668c0e0413137902fe141dab2fb8a244ca0f6294f0f0359690148c8a0816b4`, evidence `/var/tmp/oh-browser-6ls7j0ve`. Filed via intake as @unusually-acrid-debt, untriaged without a lane, with this run's exact provenance. Main subsequently supplied compact-pill/focus fixes; both model cases passed in the integrated conversation run. The intake item should be dispositioned against those fixes, not scheduled blindly.

The pre-rebase daemon run reproduced only the same five terminal failures recorded by the earlier worker on unchanged base: shell survival, busy shell, Taskfleet read-only attachment, lingering startup and old-server PATH. Incorporating main's terminal fixes made the whole daemon package pass. No baseline exemption remains needed for final daemon evidence.

## Evidence limits

No push, deployment, live-server write, Fleetrepo edit or installed-tool change. The runner prepares the pinned native Pi fixture using `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`; commands use umask 077 and disk-backed `TMPDIR=/var/tmp`. Remote ARM64 results do not prove native amd64 packaging or Linux UID separation. Full clean gate and packaging were not run: the worker changes diagnostics and browser presentation, not auth/contracts/build/package inputs. Main's independent changes retain their own review/test responsibility.

Before/after screenshot + static HTML captures are deferred under Alder's no-local-lab policy, as the brief permits; no lab bypass was attempted. Real provider/quota behavior and Jari's live recheck remain for conductor deployment. No Fleetrepo installation change is indicated.

## Failure and incomplete-step inventory

- Initial baseline browser command returned test-exit on the two observed model-control regressions above. This was expected comparison evidence, not a runner failure.
- First restored-tree checks: web/contracts/quota browser passed; daemon failed only the known five terminal cases; conversation had the two model failures plus timeouts in `401 from actual status request opens login` and `a lost accepted send resolves on reload without another write`. An unchanged-tree retry passed those two and finished 65/67 with only the baseline model failures.
- First rebase round: web/contracts/daemon/quota browser passed. Conversation finished 64/67: baseline model failures plus a timeout finding Send in `daemon restart loses controller without declaring the send rejected`. That case passed in the subsequent integrated run.
- Second rebase hit an App.tsx conflict from concurrent local-folder UI and the quota wrapper. Resolved by taking current-main App and reapplying only the quota import/wrapper/notice; reviewed the whitespace-insensitive diff. A web check then rejected three formatting wraps. Fixed them in the formatting commit; later web checks pass.
- Integrated conversation run finished 66/67 with both model cases passing; `validated uncertain send receipt never reposts` timed out because the details popover intercepted its recheck click. Final validation is recorded below rather than inferring a pass from that partial result. The final attempt reproduced exactly this failure; the same full spec on a clean unchanged-base clone reproduced it identically. Filed @immoderately-sloppy-aunt through intake, without a lane. This satisfies the brief's explicit unchanged-main exception; the suite is not claimed green.
- A local log-summary script initially used `.logs` instead of the runner envelope's `.data.logs` and failed with KeyError; corrected parsing read the retained complete log responses. No test result was inferred from the failed parse.
- Earlier-worker failures, including unused import attempts and exploratory path misses, remain recorded in preserved evidence commit `ea7c9afb`; they were superseded by successful builds here. No external review was launched or omitted. Captures and live recheck are deliberately deferred, not passing checks.

### Earlier integration attempts (superseded)

| Attempt | Job | Evidence directory |
| --- | --- | --- |
| quota-land-web | `2305c4ec53ddac6e1410f7701fdae1029ecc708d01b4a6a09ec80b05f4696d2b` | `/var/tmp/oh-browser-bpkm9qpd` |
| quota-land-contracts | `01d0c2a2c7d0769a61197a76d8908f6d192814a032e0ae0df4aab596f05b579c` | `/var/tmp/oh-browser-xhjw4lk8` |
| quota-land-go | `a43e4a647b100475a91ea78215b40b3c366abe6327ad036229b0413e829039be` | `/var/tmp/oh-browser-m__n_job` |
| quota-land-browser-quota | `73f4625d417a889af2f362a04277792d6ae6298be33907009bd766e51b0cb5ff` | `/var/tmp/oh-browser-y4axujom` |
| quota-land-browser-conversation | `613bc175f2952c82d4397a3db6c747036540f5c566350061f95fcc3407f52d18` | `/var/tmp/oh-browser-i5hbowsj` |
| quota-land-conversation-retry | `6f0159e8a153d83af89d8ec8e0f8ce0010fe988dc5c5a00d29b435d7bc095c65` | `/var/tmp/oh-browser-nd3noiuy` |
| quota-land-rebased-web | `28b996d4732fb6e68d05c21554af2b34aed84a8f9a0c9b2af378e8332c632e6e` | `/var/tmp/oh-browser-nqqdwc8k` |
| quota-land-rebased-contracts | `cc7db896da86b304651224a1ba80099b0c7561e27fe67216972d8883107210fe` | `/var/tmp/oh-browser-25lztium` |
| quota-land-rebased-go | `87438dcf1c90e5730fffc3d0861a63836a0added0a85cbb2fb8e40e055db8d70` | `/var/tmp/oh-browser-azorv7v3` |
| quota-land-rebased-browser-quota | `e5c6fc1a33d25627072f158faace2014e5f66ad557fd074cfc76b534759ab304` | `/var/tmp/oh-browser-kuy_8pjf` |
| quota-land-rebased-browser-conversation | `553f4a14bcb44f0f71549f1ae11316122351e8023654fdfbd2030f0337eb081e` | `/var/tmp/oh-browser-9ua_1jkc` |
| quota-land-latest-web | `1b18cc81d0f916958f7a0f3062d68c388e3c015c46ef5771ede44d20ad9b12c3` | `/var/tmp/oh-browser-d41m7sq_` |
| quota-land-integrated-web | `5a897f8e68e14e2af1100dc12de20779c116c5002bd0f86705798129def9cd98` | `/var/tmp/oh-browser-pjouyv3f` |
| quota-land-integrated-contracts | `b07f2081144ba3fa332797cec7d1806cd9cd9a95b0471d6f25eeb6365b0aaab5` | `/var/tmp/oh-browser-x5o2w4le` |
| quota-land-integrated-go | `bb9fcbecd0e493f9cc4ddf51a5bade4f88583efd94236176bc148fd88d7d1237` | `/var/tmp/oh-browser-fgwiqy2k` |
| quota-land-integrated-browser-quota | `47d7d486f28f6f18b14074e5aa1d7fee3389d6ad8c684c14f629bb2593e01ee2` | `/var/tmp/oh-browser-7io7aw0b` |
| quota-land-integrated-browser-conversation | `49222f92c230418c3f783dc7fa87bdcc14aa67c47d097fb69880d592d63f9b7c` | `/var/tmp/oh-browser-e8hqzw8v` |

## Final focused checks

All captures below used the same clean runnable revision `ff1b3de6`; each adapter snapshot differs because task arguments are captured as job inputs. No runnable edits followed.

| Command (`./scripts/test-focused.sh`) | Job | Evidence | Outcome |
| --- | --- | --- | --- |
| `--area web` | `86b4475a6abe7c2db56b56e503d6c1b6b12de9b89a421ebade9681c1d7017c4f` | `/var/tmp/oh-browser-626qgdnx` | Pass: format/lint/typecheck/unit/component |
| `--area contracts` | `ea8647abc6e5dc2ce5a3943689cefed07a65f5a3dc467822a17cede09df8b24e` | `/var/tmp/oh-browser-pttm575z` | Pass: generated contracts and fixture validation |
| `--area go --go-package ./internal/daemon` | `96b97936ea50c4916f8fee7ecf46e61c8a16427b475079af7aa7c041552a479b` | `/var/tmp/oh-browser-1gt8k3tj` | Pass: complete daemon race suite |
| `--area browser --spec quota-pressure.spec.ts` | `e640b0eaa60859b28c171fcb027b72c3d68e2857866c982fc19d68e67999d7a7` | `/var/tmp/oh-browser-2ip24wum` | Pass: quota warning/full/recovery and Axe |
| `--area browser --spec browser-conversation.spec.ts` | `079921cc647a5a275d0146628eaa8e45db106a3199ebf7e704b546fac3de2089` | `/var/tmp/oh-browser-_gad_urb` | 66 passed, 1 pre-existing failure: uncertain receipt popover interception; reproduced identically on unchanged base |

Final detail: web passed **281 unit + 196 component tests**, plus format/lint/typecheck. Contracts passed 56 schemas/56 fixture files/37 scenarios/17 negative checks. Complete daemon race suite passed in 52.877s. Quota browser passed in 7.5s, including Axe. Tested runnable tree: `37bf269dc4ad2e1a3471e99129a1d7c9e519b4ab`.

The final full conversation spec returned 66 passed/1 failed. The **identical command** on a clean detached clone of unchanged base `daadaef5` also returned 66 passed/1 failed, the same uncertain-receipt recheck/popover hit-testing timeout. Comparison job `5bb9a88285f87a52cc6aeff87da1db7da91d3b6d0a088406be8d87250932a044`, evidence `/var/tmp/oh-browser-d98qk0ym`, snapshot `f080c99f245af6c021f6968f09465990262ceb3d1dd5e8108d69f890cd6a1730`. Both final model-control cases pass. This baseline regression is @immoderately-sloppy-aunt; it does not block this merge under the task's explicit exception. No new failing required behavior remains attributable to this implementation. All launched jobs reached terminal outcomes.

`python3 scripts/validate-project-view.py`, `issuectl doctor --json` and `git diff --check` pass. The conductor can deploy the implementation; the useful live check is to fill the person's disposable quota, observe one full-storage notice and fixed native diagnostics, free space through Storage/Trash, then recheck without reloading or replaying a message. The tiny synthetic budget and mocked browser quota do not establish this live behavior.
