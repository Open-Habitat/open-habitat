---
created: 2026-11-21
updated: 2026-11-21
type: feature
status: untriaged
priority: normal
provenance: other
provenance_detail: ADR 0037 implementation (technical decision run)
source_ref: taskfleet:01m7yk9bnzwbee7v6r48ecfy6e/adr-0037-implementation:gateway
originating_run: 01m7yk9bnzwbee7v6r48ecfy6e
originating_run_kind: technical-decision
preparation: pending
blocked_by: ['@person-removal-broker', '@person-removal-daemon']
related: ['@person-removal']
---

# Gateway and CLI: administrator removal of a person, removal record and storage sum

## Description

# Gateway and CLI: removing a person

Implements sections 1–2 and 6–10 of ADR 0037 (`docs/decisions/adr-0037-person-removal.md`) in `internal/gateway` and `internal/cli`, after the broker and daemon operations exist.

- Administrator operations: schedule removal (grace period or immediate), cancel, read; from a browser administrator session and root's control socket (`open-habitat admin access` gains the removal verbs; follow the AI-first CLI canon). Refuse self-removal and site.json administrators.
- Order: deny + sessions removed, delete the subject's view/offer addresses, daemon disconnect request (section 4; `not_reached` when it fails), broker schedule. Each step repeatable; `outcome_uncertain` as today.
- After the broker reports data removed: drop the onboarding receipt, designation, site AI key copies entry and the deny entry, so a later admission of the same id is a new account with a new onboarding.
- Removal record per subject in administration state (GitHub id, login hint, actor, scheduled/cancelled/completed times, final outcome, provider counts); access list states `removal_scheduled`, `removing` (with reason) and `removed`; `admin access list --state removed`; clearing a record.
- Storage read: rows of a person with a removal record carry the due date and count usage instead of the limit in the sum of limits.
- Contract changes start in `contracts/v1/`.
