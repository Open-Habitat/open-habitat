# Result

Fixed in `49c74b39a`: stopped failed workers move their parent conversation to Sinun vuorosi, retaining the failure marker, rather than appearing as ongoing work. A worker idle at its prompt likewise no longer makes the parent live by itself. Actual parent activity or another working worker still counts as work. Ei nyt can dismiss the row under the existing reply-bound rules.

## Signal analysis

- Taskfleet's `spinoffState` maps failed to failed, done/cancelled to unmerged, and interactive attention/preserved review to waiting_parent. Preserved branches/reports do not produce a working count.
- `liveWorkerState` checks native Pi history only for runs classified working. An ended assistant turn yields idle. `workingSpinoffs` counts only working and idle separately; the snapshot publishes `spinoffs_working` and `spinoffs_idle`.
- `workerFailedUnseen` independently publishes `failure: worker_failed` when an own run failed after the parent last changed. This is an attention signal, not liveness.
- The defect was in `web/src/app/railNow.ts`: failure prevented quiet placement without claiming the person's turn, leaving the row in Running. Separately, idle workers were included in `live`. Both client predicates are corrected.
- Agent `section update --section running` is already conditional on observed work and `spinoffs_working`, not preserved work; failures already override the agent's choice. It was not the cause.
- The daemon's `inventoryWaiting` includes actual running waking processes. Such a process remains independent work evidence: aggregate idle worker counts cannot identify what a particular process is waiting for. No daemon state derivation, contract, session or authority changed.

## Decisions for later review

- Keep Ei nyt reply-bound, including when a worker later fails without a new reply. Alternative: introduce failure-time-sensitive dismissals. The existing rule explicitly holds until another reply; this fix does not invent a second attention identity.
- Put an idle worker needing review in Sinun vuorosi even without a new parent reply. Keeping it in Running would continue conflating preserved work with ongoing work.
- Preserve existing parent crash/interrupted-turn treatment. A surviving idle worker must not erase the parent's failure marker. A review caught that interaction; explicit regressions now cover it.
- Do not suppress genuinely running wait processes based on aggregate idle counts. That could hide unrelated ongoing work.

## Verification

Tested code revision: `49c74b39a` (checks ran on its identical code tree before commit), under umask 077 and the shared scratch lease.

- `./scripts/test-focused.sh --area web`: passed static/type checks and 255 test files, 2160 tests.
- `GOFLAGS='-run=Test(Spinoff|Worker|LiveWorker|Snapshot.*Failure|AgentSection|WorkingSpinoffs)' ./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed. Covers unchanged native worker classification and snapshot failure/section boundary.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15600 ./scripts/test-focused.sh --area browser --spec rail-running-after-done.spec.ts --spec agent-section.spec.ts`: 2 passed on final code. Existing specs unchanged; failed-worker regressions belong in the cheaper unit layer.
- Unit regressions cover failed and idle workers, running/quiet agent choices, dismissal, genuine working siblings, and interrupted parents with surviving workers.
- Initial broad daemon-package attempt reached its 420-second outer timeout without a result. It is not claimed as a pass; the required focused boundary tests above passed on retry. Initial test/typecheck failures were corrected and the entire web check rerun successfully.
- No whole browser suite, clean gate, live installation or real-provider check run; none is required for this client-only change. Synthetic browser evidence proves grouping/navigation interactions, not deployment or UID isolation.
- Logs and raw review output: `/var/tmp/agent-keep/rail-running-shows-stopped-run/`. No captured personal data or screenshots committed.

## Review

Routine, low-risk client-only grouping change. Voluntary independent `/llm-review` used claude-fable-5-2 as finder and gpt-6-astra as adversarial verifier, followed by `/assess-findings`: one confirmed interrupted-parent regression fixed; two proposals dropped against local policy/native process evidence. No unresolved actionable findings. Local reports: `history/review-rail-stopped-run.md` and `history/assessment-rail-stopped-run.{json,md}`. Performance logging disabled because this worker does not publish commits.

## Live check

After deployment, start a worker from a conversation and let it fail while keeping its work. Once the parent is no longer working, its row should be in Sinun vuorosi with the failure mark, not Käynnissä. Ei nyt should move it to Hiljaiset. An idle worker awaiting review should likewise not keep an otherwise settled parent running. Repeat with another genuinely working worker: the parent should still show ongoing work. This live check has not been performed.
