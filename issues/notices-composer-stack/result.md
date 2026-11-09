# Result

Implemented direction A without an experimental flag or host/API changes.

- Conversation and draft warnings share the `WarningBanner` stack above the field: four existing tones, strongest first, two subjects visible and a show-more control.
- A refused follow-up joins its uncertain send, not a separate grey line. History failure appears once as neutral information, with the existing check action/time. Stop outcomes remain separate subjects.
- Attachment selection accepts the valid files and names rejected files. The first 30 fitting files are attached; individual size, empty-file and combined-size refusals happen before upload. Upload failures no longer discard later files in the batch. The warning uses the accepted long wording and named list, translates transport failures, distinguishes quota/disk refusal, and retries interrupted uploads without clearing other refusals.
- Error events no longer expire after six seconds. Conditions follow their owners; events end at another attempt or dismissal. Only worker acknowledgements retain their expiry. Dismissal returns focus to the field.
- Worker input waits, full storage, stale/gapped conversation observations, title failures and held-message outcomes use the same stack. AI login, model, GitHub, weight and capacity warnings join it through the shared component. Creation refusals no longer need transcript scrolling to reveal them.
- The earlier large-send delivery logic is unchanged: no unknown held-message bubble, truthful field claim, timestamped checking and undelivered text/pictures returned to the draft.

## API for the following work

`NoticeStackProvider` is local to the conversation view and preserves the mounted field across creation. `WarningBanner` joins the nearest provider (otherwise it stays inline). Its `subject` merges a cause and consequences, its existing `tone` supplies the kind, and `lifetime` identifies condition/event/acknowledgement. Producers retain the real condition, event dismissal and permitted acknowledgement timer; the stack creates no parallel host state or persistence. `NoticeStack` alone subscribes to presentation registrations.

Upload progress and app-wide notices are not implemented here. Native transcript messages/history remain native content rather than a second persisted notice history.

## Verification

- After rebasing onto current `main`, `./scripts/test-web-fast.sh`: 204 files, 1536 tests, static checks and typecheck passed.
- Host-backed synthetic browser checks: `large-send.spec.ts`, `browser-conversation.spec.ts`, `queued-send.spec.ts`, `attachments.spec.ts`: 107 passed after rebase.
- Synthetic lab: `lab-notices-composer.spec.ts` at 1440/390 in Finnish/US English; two-visible/show-more, neutral history deduplication, persistent attachment refusal, focus after dismissal, no horizontal overflow and stack axe audit. Explain cards V33/V34/V35 are mapped and captured; show-more still works in Explain mode and retry waits. `lab-capacity-refusal.spec.ts` and `lab-slow-creation.spec.ts` cover the moved creation warnings and field preservation. All 11 cases passed after rebase; the four stack cases also passed with `OH_VISUAL_CAPTURE=1` to refresh evidence.
- Paired screenshots and offline HTML are in `evidence/`, captured with `lab/session.mjs` from synthetic lab hosts. Reviewed the notice stack and Explain cards at both widths/languages. UK uses the same new copy.
- UI reference regenerated and checked; regeneration also catches prior large-send/worktree-copy drift already present in source.

No full clean gate, live-host test, native provider test or UID-isolation claim. No Go implementation changed. Named Playwright specs ran with the normal configs directly because the focused wrappers force `/var/tmp`, contrary to this worker's scratch constraint; scratch/logs stayed in `.cache/notices/` in the worktree. Browser test identities, homes, files and responses were synthetic.

## Review

`/llm-review`: claude-fable-5-1 finder, gpt-6-astra verifier; `/assess-findings`: six fixes, two drops. Fixed acknowledgement expiry, unrelated stop/send merging, missing event dismissal, retry erasing other refusals, size rounding at the limit, and focus lost on explicit dismissal. The verifier rejected the proposed automatic clearing of past-tense refusals and an unreachable pending-stop example. Retaining expansion intent and hypothetical secondary-title formatting were not actionable defects. No follow-up issues were filed.

Review/assessment artifacts were written under ignored `history/`; the findings and their disposition above are the durable record. Model assessment was logged through the canonical Alder writer.
