# Result

Settings has a separate automatic-recaps On/Off choice, with Finnish and English warning that home-page descriptions stop updating. Manual recaps remain available. Off survives native Pi settings readback and daemon restart; pending automatic timers and resting recovery honour it. The four existing scope choices retain their layout.

## Decisions for later review

- Store off as `level: "off"`, retaining all numerical/model settings, rather than introducing a second enable flag. It is a single explicit mode in the existing settings contract; re-enable selects Custom with those numbers, rather than resetting to Standard or remembering a second preset field.
- Already-running model requests may finish; off prevents subsequent automatic requests rather than cancelling a shared RPC operation. Existing recaps are retained, not erased.
- Re-enable resumes automatic scheduling at the next settlement; it does not immediately backfill conversations completed while off. Manual recap is available for immediate catch-up.

## Evidence

Tested implementation based on 8776b247 (the commit carrying this result identifies the final tree):

- `./scripts/test-focused.sh --area contracts`: passed, 88 schemas / 134 fixtures / 43 scenarios and generated drift.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed. Storage round-trip, restart owed-recap suppression, pending admission/manual bypass and silent extension suppression have regression coverage.
- `node --test internal/daemon/pi-device-test/recap-settings.test.mjs`: 4 passed, including no automatic model calls while off and manual history write.
- `./scripts/test-focused.sh --area web`: 161 files / 1188 tests passed, typecheck and Biome passed.
- `OH_PORT_BASE=10110 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec recap-settings.spec.ts`: 4 passed, including off/reload/on preservation, disabled timing control and Axe audit while off; existing narrow-layout checks retained.
- Synthetic lab screenshot and static HTML: `off.png`, `off.html`; capture script `web/lab/recap-can-be-off.mjs`. Inspected screenshot: warning visible, control and delay fit the settings card.

Independent `/llm-review`: claude-fable-5-1 finder, gpt-6-astra verifier; `/assess-findings` classified two confirmed occasional defects FIX. Both corrected with regressions: extension `fenced` outcome allowlist and clicking selected On mutating preset to Custom. Review/assessment scratch under `history/`; model performance logged through its canonical writer. No follow-up issues.

Initial checks needed correction: Go first lacked Python referencing on PATH (rerun with disposable uv environment); web first exposed a TypeScript union narrowing error, then formatting drift (both repaired); browser visual-capture attempt correctly refused a non-lab host (moved capture to actual synthetic lab and reran suite). `test-focused.sh --help` prints usage with exit 2. A later daemon rerun hit a transient existing TestAgentConversationControls archive writer_conflict; the complete package rerun passed. The capture script also needed Biome import spacing, repaired before the final passing web checks. None remains blocking.

Rebased onto main at 2ccf25e8; only KOKEILTAVAA conflicted, resolved by retaining all workers' entries. Contract regeneration remained clean. Post-rebase daemon, contracts, web (1188 tests) and named browser suite (4 tests) passed again. Parallel post-rebase checks first hit two unrelated 5-second web timeouts and the extended browser journey's 30-second deadline; sequential reruns passed. One browser rerun hit transient port 10131 reuse; no listeners/orphan hosts remained on inspection and the next full named-spec run passed. Captured HTML trailing whitespace was normalized after diff-check detected it.

A second rebase onto 0cfb2c57 retained newer view-address contracts and all KOKEILTAVAA entries; regenerated the two conflicting generated contract files from the combined schemas. Contracts passed (135 fixtures), and targeted daemon recap tests plus all four extension-settings tests passed again. Other workers' later prototype documents do not overlap this feature.

No full clean gate, whole browser suite, live provider or distinct-UID claim. Tests use synthetic fixtures; conductor owns integrated full-suite verification.
