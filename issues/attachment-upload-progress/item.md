---
created: 2026-11-09
updated: 2026-11-09
type: feature
reporter: jari
status: done
priority: normal
lane: notices
lane_seq: 2
blocked_by: ['@notices-composer-stack']
preparation: ready
closed: 2026-11-09
---

# Attachment upload progress: ring and percentage on the chip, Send waits for the files

## Description

Implementation of `proto-attachment-upload-progress`, direction **Rengas**
(Jari 9.11.2026). Specification: `issues/proto-attachment-upload-progress/result.md`
(host facts, shared behaviour, Explain card drafts, decisions) and the round
in `design-system/prototypes/rounds/2026-11-09-liitteen-eteneminen/`.

- Ring and percentage on each pending attachment chip, per-file cancel.
- Upload via XHR `upload.onprogress` (a sibling to `mutationFetch`; streamed
  fetch is refused by the gateway without Content-Length).
- **No automatic send.** Send stays disabled until every attachment has
  arrived; the message leaves only when the person presses Send.
- A broken save is named in the shared warning (`notices-composer-stack`'s
  Varoitus form) with one retry.
- Fix to existing behaviour Jari chose: no experimental flag. Explain cards
  fi/en for the ring and cancel.

## Acceptance Criteria

- [x] Chip shows ring + percentage during upload, cancel removes that file only; Send disabled until all are saved, enabled after, nothing sent automatically.
- [x] Browser spec with a throttled/simulated slow upload at 1440 and 390; touched specs and fast web checks green.
