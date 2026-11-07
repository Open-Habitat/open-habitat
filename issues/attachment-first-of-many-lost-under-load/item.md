---
created: 2026-11-07
updated: 2026-11-07
type: bug
status: open
priority: normal
provenance: other
provenance_detail: taskfleet spinoff clean gate
source_ref: taskfleet:01m6tmzqp0grzgswdh9g7d4r0s/gate-load-residual:attachment-documents
originating_run: 01m6tmzqp0grzgswdh9g7d4r0s
originating_run_kind: spinoff
lane: attachment-flake
lane_seq: 2
preparation: ready
---

# First of six dropped attachments lost under full-gate load (attachment-documents)

## Description

# First of six dropped attachments lost under full-gate load (attachment-documents)

Observed once in the clean gate after the round-65 fix-forward (branch
`wt/dh9g7d4r0s-r65-gatefix2`, base e1577e255 plus the gate fixes; loadavg 7 at
the end of the browser phase). Ordinary suite 1 failed / 566 passed, lab 171
passed, Go and contracts green.

`attachment-documents.spec.ts` › "documents preview in the app's dialog
without running anything they carry": six files are dropped into a new
conversation while creation and the first upload are both held. The composer
ended with five chips for 30 s. The missing one is the **first** file
(`tarjous.pdf`); the other five are present in order and there is no upload
error in the composer. The field-connected check after creation passed, so
the composer was not remounted (which would also have stopped the later
uploads).

So the first upload completed and its `/api/v1/attachments/<id>` reference
went into a draft that the later uploads did not build on. A plausible but
unproven path: the draft key flips between the creation key
(`draft:new:<ws>`) and the conversation key around adoption
(`adoptCreation` in `heldMessages.ts`, also called from `BrowserConversation`
when the view gets its ID and from App's creation route), so a reference
written under one key is replaced when the other key's draft is adopted or
re-read. This is the residual of `attachment-chip-load-flake`, whose
adopted-view-key fix (e1577e255) removed the remount but not necessarily
every draft handover race.

Not reproduced on demand: the spec passed 2/2 alone, 12/12 with
`--repeat-each 6`, and 16/16 at `OH_CPU_THROTTLE=6`, `OH_REPLY_DELAY_MS=250`,
four workers. The failure block is in `evidence/`; the page snapshot (lost
when the repeat runs reused `test-results/`) showed the opened conversation
with chips muistio.md, raportti.docx, mittaukset.xlsx, kvartaali.pptx and
vanha.doc, an empty focused field, and no upload notice.

Effect if real: a person who drops several files into a conversation that is
still being created can silently lose one attachment from the message.
