# Result

Single-item Trash deletion is now Delete → confirmation naming the item and size, with an irreversible warning → Delete permanently. No name field, experiment or prototype. Cancel receives initial focus. Emptying remains a separate confirmation.

The request supplies the listing digest captured when the dialog opened. The daemon verifies the same listing under its Trash writer lock, selects only the requested entry from that listing, then retains the existing opened-directory inode check during removal. A changed listing is refused with `trash_changed`; the dialog closes and the person must reopen from the refreshed list. Row actions wait for refresh after a mutation. No silent token replacement or automatic mutation retry.

The canonical schema, generated contracts, agent CLI and agent guide use `listing_token` for single-item deletion too. Dead typing strings/styles are removed. Explain mode has the opening action's own card and still blocks the destructive confirmation. Generated UI references were refreshed; this also corrected pre-existing Terminal selection-color reference drift to match its source.

Workspace removal elsewhere is unchanged and does not use this typed step. Forced **worktree** removal does still require its name; that distinct flow remains out of scope.

## Verification

- Focused Go: `./internal/daemon` and `./internal/cli` passed separately.
- Focused contracts passed; generated contracts and UI references are clean.
- Focused web: 220 files / 1736 tests passed. Added frozen-token/refusal/reload regression and changed no-typing component test.
- Host-backed synthetic browser: `lab-workspace-trash.spec.ts` exercises deletion, restore, click-click purge, emptying and accessibility; `lab-trash-confirm.spec.ts` covers Finnish and English, 1440/390 widths, correct Explain cards and blocked destructive presses. Five cases passed on three consecutive final runs.
- Daemon regression replaces a Trash directory while preserving its name and metadata: the old token is refused and both directories survive; a fresh token deletes only the replacement. Existing same-name entries, process/mount blocking and emptying tests still pass.
- Paired screenshots/static HTML were captured under this issue and inspected, then retained outside git at `/var/tmp/agent-keep/trash-item-delete-simple-confirm/` to avoid committing 6.5 MB of disposable captures. The same directory holds final check logs. The visual spec can regenerate them with `OH_VISUAL_CAPTURE=1`.
- Focused self-review plus finder `claude-fable-5-2` and verifier `gpt-6-astra`; four confirmed findings fixed (obsolete assertion, stale-dialog retry loop, actions during reload, masked CLI negative tests). Assessment: `history/assessment-trash-item-delete-simple-confirm.{json,md}`. No follow-up issues filed.

This is synthetic host-backed evidence, not a live installation or distinct-UID test. The inherited digest identifies entries by device/inode and metadata, not recursive contents or filesystem generation; no guarantee against uncooperative native writers or inode recycling is added.

## Decisions for later review

- Reuse the existing whole-listing digest rather than introduce a per-entry token. It preserves the established changed-Trash refusal and avoids a second identity mechanism. A change to another entry also requires fresh confirmation; this is intentionally conservative.
- Keep optional Git inspection non-blocking. Name, listed size and irreversible warning already support the requested click-click confirmation, just as emptying does; inspection failure must not make deletion impossible.
- Close stale/missing-item confirmations rather than substitute a fresh token into an already-open dialog. The alternative could authorize an identity the person did not confirm.

Live check: Settings › Storage → Trash → Delete permanently… on one item. Check name and size, cancel once, then reopen and confirm without typing. In another tab change the Trash before confirming: it must refuse and ask for a fresh confirmation. Emptying the rest should still work.
