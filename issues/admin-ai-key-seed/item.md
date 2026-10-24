---
created: 2026-10-24
updated: 2026-10-24
type: improvement
reporter: jari
status: done
priority: normal
provenance: other
provenance_detail: Implementation split of plan-site-onboarding-authority accepted by Jari 2026-10-24
source_ref: taskfleet:01m5p58hc8f6gyd5zad5gxx136/split:admin-ai-key-seed
originating_run: 01m5p58hc8f6gyd5zad5gxx136
originating_run_kind: spinoff
related: ['@plan-site-onboarding-authority', '@proto-admin-server-onboarding']
blocked_by: ['@site-ai-key']
collision: [internal/gateway/administration, internal/daemon/pi, contracts/v1/, web/src/app/, web/src/components/]
lane: proto-ai-key
lane_seq: 2
preparation: ready
closed: 2026-10-24
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

## Decisions

### 2026-10-24T15:43:17Z · @jari

Jari 2026-10-24: prototype first how giving an already-joined person the site key should go (proto-admin-ai-key-seed); implementation after the verdict.

### 2026-10-24T16:34:04Z · @jari

Jari 2026-10-24, verdict on proto-admin-ai-key-seed: implement now. (1) The browser administrator gives the key on the AI-avain page (the prototype's batch direction), alongside the root CLI. (2) The administrator may see the one-word per-person check (own credential / none); the credential's kind stays hidden. (3) Rotating the site key replaces every site-given copy everywhere, so no one is left on an old site key; this supersedes ADR 0030's 'rotation changes only future joiners', which was only the easier first implementation. A person's own key or subscription is still never overwritten. (4) No separate notification: the person's settings (Yhteydet row) show the key is site-given. Removal was not addressed: keep the prototype's choice (removal does not revoke copies) unless rotation-everywhere makes revocation the natural symmetric behaviour, and record the choice under Decisions for later review.
