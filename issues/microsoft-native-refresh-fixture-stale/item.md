---
created: 2026-11-22
updated: 2026-11-22
type: bug
status: untriaged
priority: normal
provenance: ai-review
source_ref: taskfleet:01m829wjhf4bp5w8q7hstrkpjq/review-finding:sha1:9518cbf977d08977a7fb4d13f55d3333fa943959
review_source: ai-review
originating_run: 01m829wjhf4bp5w8q7hstrkpjq
originating_run_kind: spinoff
labels:
- ai-review-model:claude-fable-5-2
- ai-review-model:gpt-6-astra
assessment_classification: CONFIRMED
assessment_outcome: FIX
review_confidence: HIGH
review_severity: should-fix
review_target: internal/daemon/integrations/microsoft_native_linux_test.go
---

# Native Microsoft refresh fixture panics before exercising rclone

## Description

## Description

The optional native Microsoft refresh test cannot currently qualify a runtime update. `TestMicrosoftSingleGrantNativeRuntime` in `internal/daemon/integrations/microsoft_native_linux_test.go` still asserts the former union write scopes (lines 45–47) and reads a token from the old account-level configuration. At line 145 it assigns `tok["expiry"]` while `tok` is nil, panicking before the native rclone refresh call.

Observed on 2026-11-22 with the documented disposable integrations runtime and the three test-only `.mjs` fixtures copied beside its adapter. Running `scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations` with `OH_TEST_MICROSOFT_RUNTIME` pointing to that runtime and `OH_TEST_RCLONE` to a pinned binary emits five `union scope missing` assertions and then `panic: assignment to entry in nil map`. Both rclone 1.71.2 and 1.76.0 produce the same failure before rclone is invoked; the fixture and Microsoft product code are unchanged by the version update.

Ordinary runs skip this opt-in test, so a green default suite does not prove native Microsoft reload/refresh compatibility. This is a test-coverage defect, not evidence that either rclone version loses files or that production login is broken.

Update the synthetic login and config lookup to the current level-specific grants and per-remote native token layout. Assert that the expected token was found before changing its expiry. Retain the loopback-only OAuth/Graph boundary and prove that the test actually reaches native refresh and checks token rotation; do not relax the assertions merely to make it pass.
