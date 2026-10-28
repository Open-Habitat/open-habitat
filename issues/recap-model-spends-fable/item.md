---
created: 2026-10-28
updated: 2026-10-28
type: improvement
status: untriaged
priority: normal
provenance: other
provenance_detail: taskfleet worker finding while fixing recap-card-not-shown
source_ref: taskfleet:01m608p63qwjznqn9pzspappja/recap-model-choice
originating_run: 01m608p63qwjznqn9pzspappja
originating_run_kind: spinoff
---

# Recaps spend Fable usage because subscription models all declare zero cost

## Description

Observed on Birch and the test server, October 2026: the conversation recap (`internal/daemon/recap-extension.mjs`) picks the model with the lowest declared price. pi-claude-bridge declares every Claude model as `cost: 0` (`pi-claude-bridge/src/models.ts`, `buildModels`), so the cheapest is whichever bridge model comes first in its list, which is `claude-fable-5-1`. Each automatic recap (every conversation, after every three-minute idle period) therefore spends the account's Fable usage, the scarcest and most expensive Claude model, on a 40-word summary.

Effect seen: between 2026-10-25 and 2026-10-27 05:30 UTC the account was "out of usage credits" for Fable (Claude Code transcripts on Birch), and no recap was written on either server for two days. `recap-card-not-shown` adds a fallback to the conversation's own model and makes the failure visible, so recaps no longer stop, but each one still tries Fable first, and may itself help to exhaust that quota.

Decision needed: which model a recap should use. Options: (a) the conversation's own model first (works whenever the conversation works; spends that model's quota); (b) a small model per provider, e.g. Haiku for claude-bridge and the cheapest priced model otherwise, recognised by name or by an explicit setting; (c) a person or site setting for the background model, shared with automatic titles (`internal/daemon/title-helper.mjs` chooses its model the same way). The pi-claude-bridge declaring zero cost is deliberate for a subscription, so the fix belongs in our choice, not upstream.
