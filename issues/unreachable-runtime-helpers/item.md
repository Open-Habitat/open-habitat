---
created: 2026-11-14
updated: 2026-11-14
type: improvement
status: untriaged
priority: normal
provenance: ai-review
source_ref: taskfleet:01m7crr8pp31xgtejmknvckwes/review-finding:dead-runtime-helpers
review_source: ai-review
originating_run: 01m7crr8pp31xgtejmknvckwes
originating_run_kind: spinoff
assessment_classification: CONFIRMED
assessment_outcome: SPIN_OFF
review_confidence: high
review_severity: low
review_target: 53fee283 (product source)
size: S
---

# Remove unreachable legacy runtime entry points and helpers

## Observed problem

`deadcode -test ./...` (golang.org/x/tools v0.52.0, Linux) reports these product functions unreachable even with test roots at review commit `53fee283`. Repository call-site searches confirm that none is called:

- `internal/daemon/conversation_linux.go:817`: `(*ConversationController).lookup`.
- `internal/daemon/events_linux.go:180`: `(*eventJournal).appendNativeEntry`.
- `internal/daemon/github_observe_linux.go:23`: `observeName` (the live handler uses `observeNameAt`).
- `internal/daemon/github_repos_linux.go:128,287`: `RepoLookupHandler` and `lookupName` (production uses the noting/path-aware variants).
- `internal/daemon/handoff_linux.go:26`: `ServeHandoff`, whose obsolete comment still describes a future phase; production uses `ServeHTTP`.
- `internal/daemon/snapshot_facts_linux.go:232`: `(*taskfleetRunFacts).exclude`.
- `internal/provision/state_linux.go:407`: `(Store).Evaluate`, explicitly documented as a legacy policy-only probe, not the real broker handler.

These leftover entry points and alternate helper paths suggest APIs that are no longer wired into the product. In particular, the legacy handoff and policy probe distract from the real startup and broker paths when maintaining them. They also create extra locations that a change appears to need to update.

## Proposed refactor

Delete the eight uncalled declarations and their obsolete comments/imports, then rerun test-root reachability and focused package tests. Do not remove similarly named live functions. In particular retain `evaluate`, called directly by provision tests, fixture handler constructors used by cross-package tests, the underlying transport server, and the real native-history publication path. Test-only fixture APIs are deliberately outside this finding.

Size: S (bounded deletion in six daemon files and one provision file; no wire or behavior change). Check daemon, provision and transport packages plus Go vet. No changes to authority or broker policy are proposed.

## Assessment

CONFIRMED; recommendation SPIN_OFF; severity low; confidence high. Evidence is the intersection of production/test-root deadcode and manual symbol/caller inspection, not all production-only deadcode output. Excludes fake-server helpers and the already filed `command-changed-state-pending-dead-code`.
