---
created: 2026-10-20
updated: 2026-10-20
type: bug
status: untriaged
priority: normal
provenance: other
source_ref: taskfleet:01m5crtawtj0wsyqz17tfxscwa/baseline:model-controls
originating_run: 01m5crtawtj0wsyqz17tfxscwa
originating_run_kind: spinoff
---

# Composer model pill grows on phones and keyboard regression fails on desktop

## Description

## Description

On unchanged main `6e593d42179a56add0e9dedb29eae0356ae57b3d`, the new-conversation model control fails both phone sizing and desktop keyboard navigation. These are independent of the preserved quota implementation (not present in this baseline capture).

## Reproduction

Run `TMPDIR=/var/tmp ./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts` on that revision. In `@model-controls empty choice stays in this conversation`, the 390px model pill is 59.5625px high (expected <=36); at 1280px focusing the textarea and pressing Tab three times no longer focuses `.md-pill`.

Host-backed synthetic ARM64 evidence: job `0f668c0e0413137902fe141dab2fb8a244ca0f6294f0f0359690148c8a0816b4`; complete fetched logs/traces in `/var/tmp/oh-browser-6ls7j0ve`. Suite: 65 passed, 2 failed. The same two failures occurred with the earlier quota branch; this baseline independently proves they predate its integration. Composer attachment/command additions are a candidate, not an established root cause. Inspect whether the focus assertion needs to account for intended new buttons rather than changing valid navigation to fit an old count.

## Impact

The model picker loses its compact phone layout; the keyboard regression check no longer matches the composer. Establish intended tab order and preserve usable keyboard access while fixing phone geometry.

## Quick Test

Both affected cases pass on phone/desktop with intended new composer controls retained. No live-server or distinct-UID claim.
