# Result

Reduced the ordinary suite from **25 failures to one isolated failure**. Both full runs used Alder's ordinary `cd web && npx playwright test` route to the warm Cedar workspace, 12 workers:

| Run | Outcome | Command wall time |
| --- | --- | --- |
| Before | 275 passed, 25 failed, 3 skipped | 201.168 s |
| After | 299 passed, 1 failed, 3 skipped | 132.829 s |

Wall time includes routing/setup/build: **68.339 s (34%) shorter**. Playwright's rounded suite summaries were 3.1m and 2.2m. Exactly two full runs; no clean gate. The existing skips are opt-in visual captures, not newly skipped failures.

## What changed

- Legacy same-UID `sshd: …` processes denied cwd/fd reads on Cedar, making native histories persistently unknown. Recognize those protected session services while still inspecting readable descriptors. Alder's protected GPG agent is tolerated only by Pi-writer discovery, never workspace deletion. Added boundary regression coverage.
- Set synthetic host umask 0077, matching the production units: the warm runner's 0002 caused native Pi settings to become unsafe after key save. The account-settings key/provider/removal case now passes; this also fixes @considerably-jagged-office.
- Wait for established conversation routes before using IDs/reloading; exercise a real cold open rather than the optimistic creation composer. Scroll with actual reader input after layout, wait for keyboard tab focus, and await the ready control's color transition before its contrast audit.
- Update stale Pi-specific accessible labels. Keep the startup-error assertion about process state, not the independent unknown thinking level. Compare thread spare space above/below instead of a layout-dependent 150px margin. No cases removed, no timeouts raised.

## Remaining cases

@completely-great-goose: `browser-shell.spec.ts:90`, terminal tab arrows. The selected tab loses focus when the terminal socket's ready callback calls `focusTerminal()` after tab focus. It passes focused but failed in the final full run. The stronger focus waits expose the actual race; assertions remain intact. This is the only failure in the final full run.

@rather-naive-plants: the post-review focused clone removal/restart journey hit a separate intermittent read-side discovery failure: first remained listed immediately after removing second, then disappeared from a complete clone-list reply without another write. Its card/restart action never returned. The list accepts a transient negative native eligibility observation as final; the exact process/Git gate needs investigation. It passed in the full run and an earlier focused run. Both residuals were filed untriaged/unlaned with run provenance.

## Verification and limits

Base: 1e9991b8 plus this repair. All affected specs passed focused, including account-settings 13/13, browser-conversation 67/67 and browser-shell 9/9. The final full run preceded a review refinement that restricted GPG tolerance to Pi discovery; current-source single-workspace-mode and native-history focused runs, and Cedar daemon-census/deletion + browser-host Go checks verify that refinement. Clone-page's current-source focused run was 6 passed, 1 failed, 1 skipped, producing the second residual above. `scripts/test-web-fast.sh` passed (static/unit/components); no web/src changes.

Self-review and one focused finder/verifier review caught and resolved the GPG deletion-exemption issue. Native Go checks initially hit a permissive umask and then Alder's unrelated protected GPG agent; private-umask checks passed on Cedar without modifying that process. Traces were inspected with `scripts/inspect-trace.sh`; logs and synthetic trace extractions remain under `/var/tmp/browser-red-*` on Alder. These are same-UID synthetic checks, not live-provider or distinct-UID isolation evidence.
