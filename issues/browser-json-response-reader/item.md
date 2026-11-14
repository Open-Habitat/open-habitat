---
created: 2026-11-14
updated: 2026-11-14
type: improvement
status: untriaged
priority: normal
provenance: ai-review
source_ref: taskfleet:01m7crr8pp31xgtejmknvckwes/review-finding:browser-json-reader
review_source: ai-review
originating_run: 01m7crr8pp31xgtejmknvckwes
originating_run_kind: spinoff
assessment_classification: CONFIRMED
assessment_outcome: SPIN_OFF
review_confidence: high
review_severity: medium
review_target: 53fee283 (product source)
size: M
---

# Extract the browser's repeated JSON response reader

## Observed problem

The browser repeatedly implements the same transport operation: check JSON content type, read a bounded body, decode UTF-8, and parse JSON. Examples at review commit `53fee283`:

- `web/src/app/integrations.ts:234`, `bounded`, also imported directly by the unrelated Gitea and GitLab clients.
- `web/src/app/ClaudeSignIn.tsx:29`, `read`, duplicates the streaming decoder inside a component module.
- `web/src/app/github.ts:144`, `bounded`, accumulates byte chunks instead.
- `web/src/app/views.ts:21`, `fileOffers.ts:77`, and `viewLinks.ts:128`, each with a local `boundedJSON`.

This is already divergent, not just a possible future duplication: integrations and Claude count incoming bytes and cancel an oversized stream, whereas views and file offers first consume `response.text()` and then compare JavaScript string length. The client modules also borrow a generic transport primitive from the integration feature. A reader fix currently needs several implementations and tests; a limit means different things in different callers.

## Proposed refactor

Extract a small feature-neutral response-body reader, returning unknown JSON. Give it an explicit byte limit and keep endpoint schema validation, status/refusal mapping, cancellation ownership, and UI error wording with the callers. Begin with the named clients, then migrate equivalent readers found by a scoped search. Do not combine mutation/retry policies or build a generic API-client framework. Preserve intentional endpoint size differences; explicitly test the change from string limits to byte limits before migration.

Size: M (one utility, focused reader tests, several small caller changes). Test split multi-byte UTF-8, malformed UTF-8/JSON, missing bodies, exact/over limits, cancellation and non-JSON replies, then existing endpoint tests. No automatic retries.

## Assessment

CONFIRMED; recommendation SPIN_OFF; severity medium (maintenance); confidence high. Confirmed by reading the implementations and their live call sites, not by treating analyzer export warnings as defects. No observed service outage or exploitable input is claimed. This is a shared implementation seam, not a change to browser/daemon authority.
