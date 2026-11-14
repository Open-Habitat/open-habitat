# Result

The Finnish and English confirmation now says that all later changes in the restored files, including the person's own, are replaced and that current contents are saved first for undo. It appears for both file-restoring choices, not conversation-only. Restore behavior and the experimental gate are unchanged.

Aligned the experiment description, undo/continuation wording and generated open-habitat-ui references. Existing stories use the production catalog; no stored screenshot baseline pins the old copy.

## Verification

- Focused self-review: checked the diff, bilingual meaning, warning visibility and existing capture-before-restore implementation. No authority or state changes.
- `scripts/test-focused.sh --area web`: 215 files, 1663 tests passed.
- `scripts/test-focused.sh --area browser --spec rewind-conversation.spec.ts`: both desktop and narrow host-backed synthetic cases passed, including accessibility and new confirmation text.
- Initial web check caught import ordering, corrected before rerun. Initial browser attempt needed the Pi SDK fixture dependencies; installed from the lockfile and reran successfully.

## Decisions for later review

- Clarified the command exception as files changed *only* by commands. The alternative, saying all command changes stay, contradicts whole-file restoration when a command also changed a tracked file.
- Replaced agent-only attribution in the undo and continuation hints with saved contents. Keeping the attribution would contradict the confirmation's own-edit warning.
- Regenerated only the two relevant checked-in guide references; unrelated existing reference drift is outside this copy change.

Live check: with Palaa tähän enabled, open an earlier own message's menu and select Palaa tähän. With Tiedostot selected, check the own-edits and undo explanation in Finnish or English; deselect Tiedostot and it disappears.
