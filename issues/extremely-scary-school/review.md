# Gateway ancestry and activated-apply continuation review

Scope: 01dc1e6f45d1d2783e5daec99ce961e77035e650..a5766d0f,
including the new continuation files, native driver, executor, parent checks,
regressions and source/shipped operator guides.
Finder: claude-fable-5-1. Verifier: gpt-6-astra. Two model calls.
Rigor: critical (secrets, privileged maintenance/release integrity).

## F1 — should-fix / low: nonroot mode assertion rejects GID first

Location: internal/host/apply_secret_parent_linux_test.go,
TestGatewayAncestorTraversal.
The nonroot fixture's GID is not zero, so asserting a refusal for 0700 before
skipping cannot distinguish a broken mode check from correct group refusal.
Local code inspection confirms the short-circuit. Move the nonzero-GID skip
before that assertion; root-container tests retain actual mode and kernel-UID
coverage. Fixed in a5766d0f. Verifier confirmed the test correction.
Impact: misleading ordinary-test evidence, not a runtime permission defect.

## High-risk false-negative verification

No actionable bypass found. Host checked both full call paths and root tests;
verifier independently traced complete original binding reconstruction,
original approval and receipt equality, pending/split-file refusal, installed
config/generation/unit validation and repeated structural verification before
fence removal. Site semantics and trust-key bytes are bound; their own file
inodes are not. Protected secret references bind inode/ctime as before.
Late recovery does not republish product or reseed broker. The original
installed product remains approved pilot.4.

## Dropped candidates and uncertainty

No dropped actionable candidates. Unlocked-looking helper descriptor is used
only while executeApply already owns flock; clarified by comment. Refusing
successor receipt-first splits is a documented conservative choice. Earlier
phase binding mismatch refuses before resumeSteps; synthetic driver returns
ErrRecovery there through a different seam, with the same no-mutation result.

Real pilot journal equality, installed-original executable digest equality,
and live systemd/HTTPS continuation remain customer-installation acceptance,
not established by synthetic tests. No speculative issue filed from these limits.

## Coverage

Finder ran focused Go tests and vet. Verifier ran continuation plus adjacent
executor/revalidation/publication/fence/input-drift tests; root-only cases
honestly skipped there. Host separately ran the disposable root-container
suite: ancestry preflight, actual gateway/foreign UIDs and actual full binding
with parent chmod versus identical-byte secret replacement all passed.
No VM or live recovery, reboot, browser/provider or fresh apt evidence claimed.
