# Hostop pilot.4 review

Scope: numeric proc-GID generation and bounded prepare session_restarting continuation in d8a3290e..4cc5c908, plus immediate callers, quota helper, operator guide and tests. Critical rigor: privileged maintenance, durable journal and deployment integrity.
Finder: claude-fable-5-1. Verifier: gpt-6-astra. Two completed model calls; one earlier finder invocation was cancelled/replaced after correcting a diff-attachment selector mistake. It produced no result and is not evidence.

## F2 — should-fix: preserve non-recovery journal diagnostics

Location: internal/host/prepare_execute_linux.go:71 (observe).
Claim: attempting continuation for every non-pass operation.fence masks unsafe/unavailable journals as recovery_required and drops the observed checks.
Evidence: inspection distinguishes unsafe_operation_journal/operation_journal_unavailable; prepareContinuation collapses directory failures to ErrRecovery. TestPreparePreservesUnsafeJournalDiagnostic reproduced that failure on a 0750 journal before repair. Verifier survives: reachable diagnostic failure, not an authorization bypass.
Impact: operators get the wrong recovery route instead of the journal trust diagnostic.
Fix: attempt continuation only for the recovery_required reason, preserving other typed checks. Implemented; affected Go tests pass.
Confidence: high. Finder model: claude-fable-5-1.

## F3 — should-fix: admit complete same-input policy stages

Location: internal/host/prepare_continue_linux.go:77.
Claim: rejecting all policy .next files strands a continuation interrupted after a complete numeric policy was fsynced but before rename, although installPolicy already safely finishes that exact publication.
Evidence: TestPrepareContinueSameInputPolicyStage reproduced the original refusal; replaceAtMode has the stated write/chmod/fsync/rename window. Verifier survives subject to preserving independent published-policy validation and binding stage observation to approval.
Impact: an uncommon but realistic interruption blocks the supported continuation unnecessarily.
Fix: accept only trusted desired Content/mode=0644 stages, retain all journal-stage refusals, include staged content/mode/presence in policyObservation. Test covers successful stage consumption and stale approval when the stage disappears. Unknown/partial stages remain refused. Implemented; affected Go tests pass.
Confidence: high. Finder model: claude-fable-5-1.

## Dropped candidates (1)

### F1 — strict mount-instance equality after reboot

Finder called strict mount equality a should-fix, medium confidence. Local evidence and verifier refute a defect in this bounded contract: the legacy probe has no filesystem UUID binding, and the guide already requires the same mount. Relaxing equality would weaken the connection to the original probe. Preserve it; clarify that continuation precedes reboot/remount. Do not claim every reboot necessarily changes numeric mount identifiers. No reboot test or live acceptance claimed.

## Coverage and residual uncertainty

Read journal Begin/Advance/publication/trust helpers, observeJournal, prepare preflight, cleanup reservation and kernel readback, native numeric group membership validation, apply/generation/upgrade callers, legacy unit text and current guide. Finder checked byte-equality of reconstructed legacy unit against pilot.3 and ran focused tests; host independently ran affected Go tests and before/after reproductions. Native numeric remount and distinct-UID proc/polkit tests ran in disposable rootless namespaces. No VM, pilot mutation, TLS-serving, reboot or browser/provider acceptance. Additional full-site binding is unnecessary for this policy-only, same-target, same-mount continuation; no broker authority moved. No unresolved actionable finding remains after the localized repairs.
