---
created: 2026-10-23
updated: 2026-10-23
type: bug
status: untriaged
priority: normal
provenance: chat
source_ref: taskfleet:01m5m61xxkwkws1gbxqtx329tk/onboarding-repos
originating_run: 01m5m61xxkwkws1gbxqtx329tk
originating_run_kind: spinoff
---

# HTTPS onboarding repository list rejects HTTP/2

## Description

## Problem
On the Northwind pilot, the first signed-in user's onboarding repository chooser fails with an unavailable state despite working native gh authorization and repository listing. Reported 2026-10-23 10:45 UTC.

## Reproduction
Sign in to the HTTPS pilot, reach onboarding step 2, and refresh the repository list. The browser negotiates HTTP/2; the gateway returns HTTP 400 before querying the user's daemon.

## Acceptance Criteria
- [ ] HTTPS onboarding can retrieve the mapped user's repositories over HTTP/2.
- [ ] Route failures have credential-free reason diagnostics.
- [ ] Focused regression checks pass and the fix is deployed to the pilot.
