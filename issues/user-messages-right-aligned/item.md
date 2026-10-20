---
created: 2026-10-20
updated: 2026-10-20
type: improvement
reporter: jari
status: open
priority: normal
lane: conversation
lane_seq: 1
collision: [web/src/components/conversation-thread]
---

# Right-align the person's own messages in the conversation

_Source: chat:proto-decision-2026-10-20_

## Description

Jari 2026-10-20: in the prototype the person's messages are right-aligned, on the test server left-aligned. Right alignment is clearer and is how chats always work; change production accordingly (user bubbles right, agent content left), desktop and phone, light and dark, without breaking long messages, code blocks, attachments thumbnails or 'Näytä koko viesti'.

## Implementation result (validation blocked)

The user timeline row now right-aligns bubbles in both reading and ordinary
views. The conversation header is untouched. Extended the attachment journey
with desktop/phone and light/dark geometry checks, long literal code,
expand/collapse and persisted thumbnails. Focused self-review was chosen:
this is presentation-only CSS and browser regression coverage, with no security
or authority change.

Evidence on base `de5ce12d541674503a7b98609a50ec63bd571923` plus worker edits:

- `./scripts/test-focused.sh --area web` passed remotely (job
  `03c5ead357afd75d2c8c56f9629cf1baf2f33742bcdd00d7fa469d1d799dc93d`).
- Earlier web attempts failed on test formatting, then non-null assertion lint;
  both corrected before the passing run.
- `./scripts/test-focused.sh --area browser --spec attachments.spec.ts` reached
  the geometry checks; user bubble alignment passed, but an incorrect test
  expectation of zero assistant inset failed (actual existing inset: 26px).
  The test now checks that agent content starts on the left, preserving its
  existing inset. This final test correction has not been validated.
- The final web/browser sequence was refused during capture with
  `spool_quota`: retained input spool exceeds 8GiB after lossless compaction;
  terminal inputs must be archived before further jobs. The installed
  `fleetrepo-exec` help exposes no archive operation. No local fallback used.
- `browser-conversation.spec.ts` never ran because the preceding checks failed.
- `git diff --check` passed. Lab captures deferred: Alder policy prohibits lab
  execution. No live-server access, deployment or push.

Required final checks remain blocked, so this issue stays open and the worker
must not merge. Resume with the three focused commands above after runner spool
maintenance. No production/Fleetrepo installation change is needed for the UI;
runner maintenance belongs to its operator.
