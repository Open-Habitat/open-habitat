---
created: 2026-09-29
updated: 2026-09-29
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: Observed in synthetic lab during spinoff
source_ref: taskfleet:01m3qgrasv8s7mfnb12dbz20jv/observed:intermediate-assistant-finished-label
originating_run: 01m3qgrasv8s7mfnb12dbz20jv
originating_run_kind: spinoff
closed: 2026-09-29
closed_by: claude
---

# Intermediate Pi messages say Valmis while a tool is still running

## Description

During a synthetic slow Pi turn, the history card for Pi's intermediate assistant message says “Valmis” while the header and progress panel correctly say “Pi työskentelee” and the tool call has not returned. This is visible in `issues/complete-conversation-ui/working-crash.png` (the intermediate message was written before fake Pi exited), and in the slow-turn lab before the crash.

`Entry` in `web/src/app/HistoryView.tsx` renders every assistant entry using `streamState="complete"`, including tool-use messages. The history format distinguishes stop reasons only in the native source; if completion cannot be inferred from the projected entry, remove the per-message “Valmis” claim for intermediate messages rather than guessing. Do not mark a tool-use message as a finished turn until the actual turn settles. Reproduce with a synthetic `hidas` prompt and compare the intermediate card with the working header before the tool result arrives.

## Follow-up recommendation

The native Pi history records `stopReason` (including `toolUse`), but the projected browser history entry does not expose it. If a future design needs per-message completion labels, first decide and document a host/browser contract change carrying that fact; do not infer it from `content.complete` (which describes byte pagination) or from the current process state. For now, the conversation header and progress panel report the turn's current activity and history cards make no per-message completion claim.

## Acceptance Criteria

- [x] Intermediate Pi history card no longer says “Valmis” while the turn is active; synthetic browser and component regressions pass.
- [x] Full clean gate passes on the final implementation tree.
