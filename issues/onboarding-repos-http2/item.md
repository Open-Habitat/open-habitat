---
created: 2026-10-23
updated: 2026-10-23
type: bug
status: fixed
priority: normal
provenance: chat
source_ref: taskfleet:01m5m61xxkwkws1gbxqtx329tk/onboarding-repos
originating_run: 01m5m61xxkwkws1gbxqtx329tk
originating_run_kind: spinoff
closed: 2026-10-23
---

# HTTPS onboarding repository list rejects HTTP/2

## Description

## Problem
On the Northwind pilot, the first signed-in user's onboarding repository chooser fails with an unavailable state despite working native gh authorization and repository listing. Reported 2026-10-23 10:45 UTC.

## Reproduction
Sign in to the HTTPS pilot, reach onboarding step 2, and refresh the repository list. The browser negotiates HTTP/2; the gateway returns HTTP 400 before querying the user's daemon.

## Acceptance Criteria
- [x] HTTPS onboarding can retrieve the mapped user's repositories over HTTP/2.
- [x] Route failures have credential-free reason diagnostics.
- [x] Focused regression checks pass and the fix is deployed to the pilot.

## Resolution

### 2026-10-23T11:31:31Z · @issuectl

Fixed in coordinated pilot dev3; conductor relayed chooser recovery and independent live gateway journal confirms catalog HTTP 200 at 11:00:41 UTC. Targeted Go/web/contracts checks and independent review passed. Pilot.7 publication is separate.
