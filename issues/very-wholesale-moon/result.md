# Result

The editor spec's `openFile` helper now waits for `conversation=pi:…` and an enabled message input before typing. `App.startFromHome` first navigates to `conversation=new`, renders `CreatingConversation`, and only redirects to the native route after creation resolves. That provisional view also exposes a composer. Waiting only for Send after filling does not distinguish the two views or protect the fill from replacement. The new wait uses the same native-route readiness condition already used by `browser-conversation.spec.ts`.

This is a setup synchronization change, not a product change. It does not retry clicks or sends, extend timeouts, or change the lazy-listing assertions. It avoids the provisional-composer handoff altogether; it does not establish whether that handoff itself has a product defect.

## Evidence

Tested base revision: `72e7558e7c13d16a5f53732d9c55c5ecdc05326f`, with the only runnable change in `web/tests/browser-editor.spec.ts` (blob `9e9afd939bd4f52f408ba3a23c5b7008cc88eeeb`).

- `umask 077; TMPDIR=/var/tmp; cd web; npx playwright test tests/browser-editor.spec.ts --repeat-each 10`: **170 passed**, four workers, 4.6 minutes, no retries. The previously failing lazy compact chains case passed all ten times. The maintained command dispatcher placed this host-backed synthetic run on Cedar and built fresh production assets.
- `npm ci --prefix web && ./scripts/test-focused.sh --area web` under umask 077 and disk-backed TMPDIR: passed static checks and 698 unit/component tests in 109 files. The initial attempt was blocked by missing worktree dependencies; installing the locked dependencies resolved it.
- `python3 scripts/validate-project-view.py`: passed.
- `issuectl ready very-wholesale-moon --json`: ready, both acceptance criteria checked.
- `issuectl doctor --json` and `git diff --check`: passed.

No full gate or live-provider/installed-UID qualification was run: the change only synchronizes browser test setup. The original high-load failure was not independently reproduced before this fix.
