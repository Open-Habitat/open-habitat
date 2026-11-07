# Result

The queued card rendered its full transport text directly. It now uses the
sent-message `messageText` and `AttachmentChips` helpers: text stays in the
compact queue row, images are thumbnails and files are named chips. Both open
the existing preview. Steering and follow-up share the fix; queue identity,
delivery, restoration and deduplication are unchanged.

## Evidence and review

Tested the implementation diff against base `b5befbe4e`; evidence covers the
four changed production/test files.

- `./scripts/test-focused.sh --area web`: passed, 179 files / 1353 tests,
  plus static and TypeScript checks. First run found a non-null assertion in
  the new test (fixed); next run timed out in two untouched integration-form
  tests at 5 seconds. A full unchanged retry passed. After rebasing earlier
  landings, static/type checks and 1369/1370 tests passed; the same unrelated
  Integrations test timed out again. A focused retry of Integrations and
  Composer passed, and the browser regression passed again on the rebased tree.
  The only rebase conflict was adjacent KOKEILTAVAA additions; both sides were
  retained.
- `OH_PORT_BASE=16100 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts --tag 'one Enter queues'`:
  passed. The existing host-backed synthetic regression now samples queue
  frames for a thumbnail and absence of raw reference paths, alongside its
  one-row/one-steer assertions. No live provider or separate-UID claim.
- Component regressions cover both queue kinds, mixed image/file attachments,
  unchanged native text, no removal control and opening the shared preview.
- Focused self-review: checked reuse of the attachment URL recognizer (no new
  arbitrary-URL rendering), valid nested list structure, grid min-width,
  unchanged queue keys and restoration bytes. No daemon, session state or
  authority change.
- `queue-dark.png` / `queue-dark.html`: paired synthetic-lab capture, English,
  dark, 2x. The capture script holds the steer request to keep the optimistic
  card visible; it is visual evidence, not proof of delivery. Initial capture
  attempts used the ordinary host's workspace ID, which the lab does not have;
  corrected to its Aurinkokello workspace and captured successfully.

## Decisions for later review

- Keep the queue's compact, single-line text preview rather than introducing
  full Markdown blocks; show attachments below it using the sent-message
  renderer. Alternative: expand all queue text like a conversation bubble.
  The defect concerns raw attachment syntax, not the existing compact queue
  layout. Attachment controls remain available without truncation.

No live test-server change or push was made. Jari's follow-up check is under
Työn alla in KOKEILTAVAA.md.
