---
created: 2026-11-21
updated: 2026-11-21
type: improvement
status: untriaged
priority: normal
provenance: ai-review
source_ref: taskfleet:01m7zetb9c2dwe7feak907cm0n/review-finding:sha1:b8fe40dfa251d72fab76a45ffeb716b76f8dfd7d
review_source: ai-review
originating_run: 01m7zetb9c2dwe7feak907cm0n
originating_run_kind: spinoff
labels:
- ai-review-model:gpt-6-astra
- ai-review-model:claude-fable-5-2
assessment_classification: CONFIRMED
assessment_outcome: DISCUSS
review_confidence: MED
review_severity: should-fix
review_target: 01e1dc15..6135ad0a
---

# A removed participant's waiting request disappears from the owner's card

## Description

## Problem

When the owner removes the last participant of a shared conversation while that participant's request is still waiting (a participant message the agent answered text-only, with no release or decline yet), the request disappears from the owner's card, although it is still unsettled in native history.

## Where

- `internal/daemon/membership_linux.go`, `sharedState` (`GET /api/v1/conversations/<id>/shared`): facts are read only while the conversation is in the membership record (`if record.Conversations["pi:"+id] != nil`).
- `saveMembership` prunes a conversation entry with no members and no pending lines; `deliverMemberLines` saves right after writing the `removed` Habitat line. With an idle Pi the entry is gone at once, and the route answers `waiting_requests: []`.
- `sharedFactsOf` (`shared_facts_linux.go`) deliberately does not settle requests on membership lines, and the release path already handles "someone removed since", so the daemon otherwise treats the request as still waiting.

## Impact

The owner can no longer release (Salli kaikki / Hyväksy yksitellen) or decline a request they may have wanted to act on. The prototype round on taking rights back assumed the request survives removal and stays with the owner; Jari has not confirmed that point.

## Decision needed

Either the waiting request survives removal (the daemon keeps a marker that the conversation was shared while any request waits, and the owner's route reads facts for it), or removal ends it (and the browser card and ADR 0038 say so). Found by an AI review of the multiplayer browser surface and confirmed by reading the code paths above; the browser side now reads facts at opening regardless of membership.
