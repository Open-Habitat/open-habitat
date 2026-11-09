---
created: 2026-11-08
updated: 2026-11-09
type: task
reporter: jari
status: done
priority: normal
lane: attachment-refusal-proto
lane_seq: 1
preparation: ready
closed: 2026-11-09
---

# Prototype: attachment refusal message, look and wording

## Description

Jari 8.11.2026, test server (`evidence/jari-2026-11-08-refusal.avif`): attaching
a too-large file shows a bare line of text above the composer, *Valitse 1
tavun – 20 MiB:n tiedosto.* Its look does not match the other error messages
(the shared `web/src/components/WarningBanner.tsx`), and the wording is
clumsy: "1 tavun – 20 MiB:n" reads oddly and says nothing about which file
was refused or what to do.

Prototype round (`AGENTS-WORKFLOW.md`), one view: every attachment refusal in
the composer (file too large, empty file, more than 30 files, combined size
over 100 MiB, attachments directory full, upload failed, unsupported where it
applies), today's text and placement first, then three directions for look
and wording, all built on the shared warning (for example: one inline danger
warning above the composer naming the file and the limit; the refused file
as its own red chip in the attachment row with the reason on it; a short
line plus a details toggle listing every refused file when several fail at
once). Both languages, plain words (*enintään 20 Mt*), the file's name, and
what the person can do. 1440 and 390, light and dark. Catalog source:
`web/src/app/attachments.ts` and the composer text catalog.

## Acceptance Criteria

- [ ] round 1: today, three directions, view offer and questions for Jari

## Resolution

### 2026-11-09T08:25:29Z · @issuectl

Jari 9.11.: 1 Varoitus; implemented as part of notices-composer-stack.
