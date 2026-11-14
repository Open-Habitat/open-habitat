---
created: 2026-11-14
updated: 2026-11-14
type: improvement
status: untriaged
priority: normal
provenance: ai-review
source_ref: taskfleet:01m7crr8pp31xgtejmknvckwes/review-finding:duplicate-json-validator
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

# Share the identical duplicate-JSON-key validator

## Observed problem

`internal/daemon/catalog_json_linux.go` and `internal/gateway/catalog_json_linux.go` are byte-for-byte identical apart from the package declaration at review commit `53fee283`. Both define `catalogNoDuplicates` and the recursive `catalogValue` token walker. jscpd identifies the 61-line clone; direct diff confirms it.

These are live implementations. Gateway repository catalog/observation reply readers call one copy; daemon account-key, editor-file, git-identity, clone and other request readers call the other. The rule is the same JSON grammar rule, not a component-specific identity or authorization policy. Its name and comment still describe a catalog response even where it checks unrelated incoming daemon requests.

A correction to duplicate-key handling or nested JSON parsing currently has two implementation sites. This is concrete duplicated maintenance on input validation used across many features; no existing acceptance mismatch or security vulnerability is claimed.

## Proposed refactor

Move only the pure duplicate-key/single-JSON-value predicate into a small neutral internal JSON utility, with shared table tests for nested objects/arrays, escaped duplicate keys, malformed values and trailing values. Keep endpoint body bounds, field schemas, trust checks and HTTP responses with their current owners. Both daemon and gateway import the utility; neither imports the other to reuse it. No new state, service, authority or dependency.

Size: S (two copies replaced by one tested helper, mechanical call-site changes). Run focused gateway and daemon tests and Go vet. This proposal shares a parsing algorithm only, not the gateway/daemon security boundary.

## Assessment

CONFIRMED; recommendation SPIN_OFF; severity low; confidence high. Self-review checked both implementations and live callers; generated files and deliberate provider-specific rules are excluded.
