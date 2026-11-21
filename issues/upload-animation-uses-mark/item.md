---
created: 2026-11-14
updated: 2026-11-21
type: improvement
reporter: Jari Mustonen
status: open
priority: normal
provenance: chat
source_ref: taskfleet:01m7dndj5tkgpnew9syvxrkc00/upload-animation-uses-mark
originating_run: 01m7dndj5tkgpnew9syvxrkc00
originating_run_kind: spinoff
preparation: ready
lane: upload-mark-proto
lane_seq: 1
---

# Attachment upload animation uses the Open Habitat mark

## Description

Jari (14.11.2026): "Tiedostojen uploadissa pitäisi käyttää tätä meidän Open
Habitat -logoa kunnolla siinä animaatiossa."

Today an attachment chip in the composer shows a plain progress ring while
uploading (`web/src/components/AttachmentChips.tsx`, `.ah-upload-ring`), next
to the percentage in the `attachment-progress` progressbar. The product's
mark (`HabitatMark`) already serves as the agent's state indicator in every
place that shows an agent's state. The upload should use the mark properly
in its animation, without being mistaken for the agent's "working" state.

Constraints:
- progress stays readable as a real percentage, not only motion;
- the `attachment-progress` progressbar semantics stay;
- reduced motion, forced colours and the three themes (Päivä, Yö, Korkea
  kontrasti) keep the state readable;
- "uploading" is distinct from "agent working".

Work proceeds as prototype rounds in
`design-system/prototypes/rounds/2026-11-14-upload-mark/` before
implementation.

## Decisions

### 2026-11-21T08:10:32Z · @jari

Jari 21.11.2026: direction 1 Merkki täyttyy is ok, but the percentage and the file-name chip sat right against each other — give them proper spacing. The 'Tallessa' moment (closed door, ~1.2 s) before the chip turns into the file: yes. Next action: implement.
