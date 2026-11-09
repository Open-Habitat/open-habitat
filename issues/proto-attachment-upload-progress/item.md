---
created: 2026-11-09
updated: 2026-11-09
type: task
reporter: jari
status: done
priority: normal
lane: upload-progress-proto
lane_seq: 1
preparation: pending
closed: 2026-11-09
---

# Design and prototype: upload progress for large attachments

## Description

Jari 9.11.2026, pilot.23: attaching a large file shows only the text
*Liitetään tiedostoa* that stands still until the upload finishes, which is
unclear. He would like a percentage counter or an animation that shows the
upload advancing.

Prototype round per `AGENTS-WORKFLOW.md`, one view (the composer's
attachment row): today's state first, then three directions, for example a
progress ring with percentage on the attachment chip; a thin bar under the
chip with sent/total MB and time left; one line for the whole batch with a
cancel. Cover one large file, several files, a slow connection, a failed or
cancelled upload, and what Lähetä does meanwhile. 1440 and 390, light and
dark, reduced motion. Record the host facts: how uploads are sent today
(`web/src/app/attachments.ts`; `fetch` gives no upload progress, XHR upload
events or chunked uploads would), and whether the gateway/daemon need
anything.

## Acceptance Criteria

- [ ] Prototype round 1 with view offer, directions and questions for Jari.

## Resolution

### 2026-11-09T08:31:55Z · @issuectl

Jari 9.11.: Rengas, no auto-send; implementation attachment-upload-progress.
