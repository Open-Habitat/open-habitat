# Result

The upload refusal now belongs to the attachment references present when the refusal occurred. Removing or changing those references clears it; ordinary typing does not. Sending clears it even before the parent clears the draft. A subsequent upload replaces the previous attempt's notice; cancelling the picker does nothing. Both upload refusals and the existing aggregate pre-send warning have an inline × control, with Finnish/English copy and an Explain-mode card that blocks dismissal during exploration.

Conversation navigation already remounts the composer via BrowserConversation's keyed provider tree; no session-state change was needed. Creation handover keeps its existing mounted-field semantics. A partially accepted upload batch retains its final refusal, anchored to the references that succeeded.

## Decisions for later review

- Keep the aggregate pre-send warning while the remaining attachments still exceed the budget (updating its totals), rather than hide a still-true warning after every removal. This preserves large-content-graceful's existing behavior. Dismissal hides it, but another Send rechecks and shows it again.
- Keep the existing plain upload paragraph and aggregate warning styling, adding only the shared inline icon control. The forthcoming refusal prototype still owns the redesign.
- Starting a nonempty upload attempt supersedes the preceding upload refusal as before; a cancelled picker is not an attempt and keeps the notice. No timeout was added: it could hide an unread refusal.

## Evidence and focused self-review

- Regression check against the original Composer: the remove, replace and send cases all fail because the alert remains. Fixed component: all 57 Composer tests pass, including ordinary typing, accepted upload, dismissal, keyed conversation switch and partially accepted batch.
- `./scripts/test-focused.sh --area web`: 200 files / 1518 tests passed after rebasing onto main at 79d5e5350, static and catalog checks passed. Before rebase: 1517 tests.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=16100 ./scripts/test-focused.sh --area browser --spec attachments.spec.ts --spec attachment-documents.spec.ts --spec lab-attachment-refusal.spec.ts`: six ordinary and two lab cases passed. Host-backed synthetic evidence, not real user/UID isolation evidence. Upload success, send and explicit dismissal clear alerts; dismissing the aggregate warning does not bypass the send check.
- The new lab spec checks the new control with axe, correct V32 Explain mapping, blocked dismissal in Explain mode and actual dismissal after leaving it. Captures are adjacent HTML/PNG at 1440 and 390 CSS pixels, device scale 2, Finnish and US English; UK inherits identical copy. No live data. Inspected Finnish compact and English desktop renders; no new layout surface.
- Rebased onto main's model-details changes; the only conflict was two insertions under KOKEILTAVAA's Työn alla, both retained. Range-diff confirms no other change to this patch. Re-ran web and all eight named browser cases successfully after rebase.
- Self-review traced upload rejection/abort, batch partial success, draft replacement, all send modes and the existing conversation-key boundary. No daemon, contract or authority changes. No additional findings.
- Regenerated the four affected agent-reference files. The generator also discovered pre-existing drift in `text--worktrees.tsx.md`; that unrelated output was restored, so `generate-ui-reference.py --check` still reports that single pre-existing stale reference.

## Failed development attempts

The first web check found a non-null test assertion and string-concatenation lint; corrected, final web check passed. The first lab attempt sent two preference changes in one request (the contract permits one), and the second picked a file before conversation handover finished. Split the preferences and waited for the conversation URL/start view; final lab checks passed. Initial exploratory rg calls used nonexistent guessed paths, then located the composer under components/composer. Baseline red tests are intentional failures proving the regression, not unresolved checks.
