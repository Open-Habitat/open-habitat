---
created: 2026-10-24
updated: 2026-10-24
type: improvement
reporter: jari
status: untriaged
priority: normal
provenance: other
provenance_detail: Implementation split of plan-site-onboarding-authority accepted by Jari 2026-10-24
source_ref: taskfleet:01m5p58hc8f6gyd5zad5gxx136/split:admin-ai-key-seed
originating_run: 01m5p58hc8f6gyd5zad5gxx136
originating_run_kind: spinoff
related: ['@plan-site-onboarding-authority', '@proto-admin-server-onboarding']
blocked_by: ['@site-ai-key']
collision: [internal/gateway/administration, internal/daemon/pi]
---

# admin ai-key seed: give an already-joined person the site AI key

## Description

Goal (deferred by Jari 2026-10-24, decision 6 of `plan-site-onboarding-authority`): root can give an already-joined person the site AI key.

`open-habitat admin ai-key seed --subject <id> [--dry-run]` per ADR 0030 and plan.md decision 3, "Rotation and removal". It writes only if the person's Pi has no key for that provider or has exactly a key the site seeded earlier. The gateway keeps salted fingerprints of seeded keys, never old keys. It never overwrites a key the person added, and the output says root is writing into another person's credentials.

Scheduling proposal: deferred, no lane, until Jari asks for it.

## Acceptance Criteria

- [ ] Write-if-absent / replace-only-site-seeded semantics tested under Pi's lock; the person's own key is never overwritten.
- [ ] `CONFORMANCE.md` row; `--dry-run` reports the exact effect.
- [ ] Review: independent `/llm-review` at high-risk level.
