---
created: 2026-10-24
updated: 2026-10-24
type: task
status: done
priority: normal
preparation: pending
lane: proto-ai-key
lane_seq: 1
closed: 2026-10-24
---

# Prototype: giving the site AI key to an already-joined person

## Description

Jari, 2026-10-24: before implementing `admin-ai-key-seed` (root or the browser administrator gives the site AI key to a person who joined before the key existed), prototype how it goes. Questions for the round: where the administrator does it (the AI-avain page, the person's row in Käyttäjät ja pääsy, or both), how a person who already has their own key is shown (never overwritten), what the person sees afterwards, how replacing or removing the site key treats people who received a seeded copy, and what the administrator is told about writing into another person's credentials. Read ADR 0030 "Rotation and removal", the `admin-ai-key-seed` issue and the landed `site-ai-key` / `admin-tabs-naming-ai-key-page` results (git history). 2–3 directions, method of earlier proto-* rounds (production components, PICKER.md tablet, desktop/390 px, light/dark, synthetic data, shared check); short text.

## Acceptance Criteria

- [x] Round published on a new glasspad page with a Finnish summary, recommendation and questions in result.md; KOKEILTAVAA prototype line.

## Decisions

### 2026-10-24T16:34:04Z · @jari

Jari 2026-10-24: AI-avain page direction accepted; admin sees the check; rotation replaces all site-given copies; no separate notification. Implementation in admin-ai-key-seed.
