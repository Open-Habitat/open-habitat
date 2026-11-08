# Result

Idle helpers now add no archive-notice detail, regardless of unlanded or
unconfirmed work. Only live helpers with a working round contribute the single
`helpersWorking` line. Removed all three unused messages in Finnish and English
and regenerated the UI reference. Explain-mode cards had no matching obsolete
notice claims to remove.

The formatter was unused at the starting revision: the confirmation flow had
replaced its caller. Reconnected it using the already-read, accepted helpers;
no second request, archive-scoping change or host mutation was added.

## Validation

Starting revision: `42386b3ef`, with this issue's working-tree changes.

- `./scripts/test-focused.sh --area web`: 193 files / 1451 tests passed.
- Named browser specs, each run separately with `OH_PORT_BASE=13300`,
  `OH_BROWSER_WORKERS=2`, private disk-backed TMPDIR and umask 077:
  `helper-archive.spec.ts` (1), `rail-archive.spec.ts` (2),
  `workspace-archive.spec.ts` (3): all passed.
- Helper browser journey now verifies a busy detail exists, then after restore
  and an idle archive verifies that the ordinary notice has no detail.
- Unit cases cover Finnish, US and UK English, mixed busy/idle helpers and idle
  landing states without freezing translated wording.
- `generate-ui-reference.py --check` and `git diff --check`: passed.
- Focused self-review: checked the accepted-read path, existing session-binding
  guard, cancellation, no-helper path, mixed helper selection, both catalogs,
  and generated diff. No authority, daemon or session-state ownership changed.

Browser evidence is synthetic host-backed, not live Taskfleet/provider evidence.
No visual layout or Explain mapping changed; no screenshot review was performed.
Generator also refreshed pre-existing BrowserConversation/BackgroundStrip drift
from earlier source changes; no source changes to those components were made.

## Decisions for later review

Reuse the helper list displayed by the archive confirmation for the notice,
rather than issue a second read after confirmation. This preserves the existing
read/confirmation flow and avoids adding a race or delaying archive; it remains
a point-in-time observation, not live round tracking.

## Tool notes

The focused browser runner accepts one `--spec`: a first invocation repeating
it ran only the last (workspace archive). Re-ran the other two separately; all
six intended cases passed. Exploratory searches for a guessed Explain helper
file and a global issue skill path found neither; the actual catalog and
repository issue skill were then read. These did not affect implementation or
validation.
