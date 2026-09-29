---
created: 2026-09-29
updated: 2026-09-29
type: bug
status: in-progress
priority: normal
provenance: other
provenance_detail: Observed in synthetic lab during spinoff
source_ref: taskfleet:01m3qgrasv8s7mfnb12dbz20jv/observed:intermediate-assistant-finished-label
originating_run: 01m3qgrasv8s7mfnb12dbz20jv
originating_run_kind: spinoff
---

# Intermediate Pi messages say Valmis while a tool is still running

## Description

During a synthetic slow Pi turn, the history card for Pi's intermediate assistant message says “Valmis” while the header and progress panel correctly say “Pi työskentelee” and the tool call has not returned. This is visible in `issues/complete-conversation-ui/working-crash.png` (the intermediate message was written before fake Pi exited), and in the slow-turn lab before the crash.

`Entry` in `web/src/app/HistoryView.tsx` renders every assistant entry using `streamState="complete"`, including tool-use messages. The history format distinguishes stop reasons only in the native source; if completion cannot be inferred from the projected entry, remove the per-message “Valmis” claim for intermediate messages rather than guessing. Do not mark a tool-use message as a finished turn until the actual turn settles. Reproduce with a synthetic `hidas` prompt and compare the intermediate card with the working header before the tool result arrives.
