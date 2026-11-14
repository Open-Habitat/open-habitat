# Result

Delivered diagnostics, not a root-cause fix. `conversation_pi_ended` now includes a fixed stderr class and burst recency, retaining no native text in the journal. The classifier bounds partial lines, preserves error headers across Node trailers, and drains final stderr before publishing exit without waiting for inherited stderr EOF. Existing storage failure reporting remains.

## Evidence

- Focused daemon package checks passed twice, including the installed-runtime synthetic reproduction (Pi 1.5.2, Node 22.21.1).
- Reproduction: empty synthetic home/conversation, startup-delaying synthetic extension, five wake-on-typing continues, held message, cancel_held; Pi became idle and remained alive with input open for the three-second post-readiness observation. No provider request, credentials, personal settings or personal extensions. This did not reproduce the original later exit or preceding 409.
- Regression tests cover chunk splitting, large lines, fixed classifications, trailer preservation, stale startup warnings, zero-status unasked exit and inherited stderr without delayed reaping.
- Independent review: claude-fable-5-2 identified two diagnostic-quality problems (startup warning age and overwritten error headers); both fixed and assessed FIX. gpt-6-astra verified the repairs and the concurrency/privacy boundary. Final focused package check passed. No browser/UI/contract changes.
- Remaining observed problem is filed unlaned as `pi-silent-zero-exit-cause`. No upstream defect established, so no upstream bug report is asserted.

## Decisions for later review

- Report the strongest fixed class in the last stderr burst plus `within_2s`/`earlier`, rather than raw lines or a guessed shutdown cause. Two seconds is an observational bucket, not causal attribution. Silent extension shutdown remains unknown; intercepting extension APIs or signals would change runtime behavior and was not needed for this diagnostic increment.
- Close the delivered scope as improvement/done, not bug/fixed: issuectl rejected done for a bug. The unresolved bug has its own intake.
- Use a synthetic delayed startup to exercise held cancellation without provider credentials; do not copy a person's configuration into a public fixture.

Live check: create an empty conversation, type to wake it, send while starting and take back the held message. It should stay running. If Pi unexpectedly ends, the daemon journal now carries only fixed `stderr_class` and `stderr_recency` values beside the existing exit detail; `earlier` is not evidence of an exit cause.
