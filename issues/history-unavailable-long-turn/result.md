# Result

## Cause

Jari's two 503s on 12.11. (13:36:20 and 13:37:37 +02:00, `GET /api/v1/agents/{id}/history`, ~120 ms) were on his open-habitat conductor conversation (5 MiB session file). Each read overlapped Pi appending a tool step: assistant tool call and result at 11:36:20.898/.913Z, and tool call plus custom entry at 11:37:37.217/.250Z.

The page reader (`nativeWindow`, `internal/daemon/history_window_linux.go`) hashed the whole file and then required size and mtime to be unchanged at the end. Any growth during the read counted as instability. It retried once, and in a busy tool loop the next append hit that retry too. A synthetic reproduction failed 30 of 30 reads.

The browser then marked the window stale and only read it again on the next event. A turn whose single tool runs for an hour produces no events, so the card stayed up all that time. That is the most likely explanation for Kaisa's card under her 52-minute bash: the tool call was appended just as the bash started, then nothing else was written. Her account and logs were not read, so this is an inference, not a verified fact.

## Limits checked (step 0)

- **Storage quota.** A cut at the end of the file was already readable (`cut_off`, "Keskustelun loppu katkesi"). A cut followed by Pi's next append, once room returns, leaves a glued line in the middle of the file. That line read as `broken_record`, which is exactly this card ("tell the administrator"). It now refuses with its own code `native_history_cut`, and the browser shows "Tallennustila loppui kesken tallennuksen" with what helps: free space or ask for more, then continue in a new conversation. A cut inside a multibyte character is recognized too. The bytes are never repaired.
- **Model usage limit.** Pi stores the provider error as an ordinary assistant entry (`stop_reason: error`). It reads normally and never produces this card (`TestHistoryReadsAUsageLimitReply`).

## Fix

- Daemon: the reader takes exactly the bytes up to the size seen at open. Pi only appends to a live session, so that prefix is a whole history. Growth during the read is accepted, and an unterminated record that the file grows past is an append in progress, not `cut_off`. A shrunk or replaced file still refuses.
- Every history 503 logs a fixed `reason` on the `http_request` record (`diagnostic.Reason`): for example `source_changed`, `broken_record`, `broken_chain`, `quota_cut_record`, `duplicate_session_id`, `discovery_failed`. Codes only, no content.
- Browser: a refused read is retried quietly (1.5 s, backing off to 30 s) for as long as it lasts. The card waits 4 s for that first retry and says reading is retried automatically. The administrator is named only after an explicit check finds the history still refused.

Tests: `internal/daemon/history_append_race_linux_test.go` (fails before the fix, passes after), `web/src/app/conversationStoreCut.test.ts`, and three browser-conversation specs (refusal card, momentary refusal without a card, storage cut). The lab notices spec is green.

## Decisions for later review

- **Prefix read instead of more retries.** Alternatives: retry with backoff, or a writer lease. Chosen because it reads a coherent snapshot without waiting and needs no new store. Residual risk: Pi's in-place `_rewriteFile`, which happens only when Pi loads or migrates a session, could mix bytes from one concurrent read. The next read corrects it.
- **The quota cut is refused, not read past.** Alternatives: skip the broken line as Pi itself does. Kept the existing "never repair, never skip a bad record" rule and only named the cause, because skipping would change the integrity stance of every reader.
- **New wire code `native_history_cut`, still 503.** The contract's problem code is a free pattern, so the schema did not change.
- **Card timing (1.5 s first retry, 4 s card) and wording.** Alternatives: show at once as before. The administrator is named only after a check because a refused read usually passes by itself.
- **The whole-file forward reader (`?after=`, used only by the goal guide) and the status snapshot keep their strict stability check.** Their stamps guard continuation decisions, which is a separate concern.
