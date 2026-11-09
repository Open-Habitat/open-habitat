---
created: 2026-11-09
updated: 2026-11-09
type: improvement
reporter: jari
status: open
priority: normal
lane: notices
lane_seq: 1
blocked_by: ['@large-send-stuck-uncertain']
preparation: ready
---

# Notices as one system: the conversation's notices above the composer (direction A), attachment refusals included

## Description

Jari chose direction **A Kentän yllä** of `proto-notices-one-system`
(9.11.2026, all five answers per recommendation). The specification is that
round: `issues/proto-notices-one-system/result.md` (inventory, the proposal,
the decision) and the built prototype in
`design-system/prototypes/rounds/2026-11-09-ilmoitukset/` (direction A,
production components and catalogs). The attachment refusal is the same
system's case: `issues/proto-attachment-refusal/result.md`, decision
*1 Varoitus*, long wording, the first 30 attached and the rest named.

Scope, this conversation's and this draft's notices:

- Four kinds on the shared `WarningBanner` tones: Este (`danger`), Tieto
  (`neutral`), Käynnissä (`progress`), Korjautui (`success`).
- One notice per subject; a consequence merges into its cause (one uncertain
  send = one notice, with the refused *ping* as a sentence in it, not four
  signals). History unavailable once, as Tieto.
- All of them stacked above the composer, at most two visible plus *Näytä N
  muu(ta)*; the item's own one-word mark stays (bubble state word, row ring).
- Lifetime = the condition; events last until the next attempt or ×; no
  error disappears on a timer (the 6 s grey lines go). Only Korjautui and
  acknowledgements expire.
- Worker waiting for you: a Tieto notice. Expired login and full storage:
  clock plus a notice above the composer, no page-wide bar.
- Attachment refusals (too large, empty, over 30 files, total over 100 MB,
  directory full, upload failed incl. *Failed to fetch*) as the decided
  Varoitus wording, both languages.
- No new host data or API; presentation of existing state only.

Fix to existing behaviour that Jari chose explicitly: not behind an
experimental flag. Explain cards for changed controls in both languages.

## Acceptance Criteria

- [ ] Every conversation/draft case of the round's inventory renders as direction A; the uncertain send shows one notice; no timer-dismissed errors remain in the conversation view.
- [ ] Attachment refusals use the Varoitus wording (fi/en) and the shared warning.
- [ ] Browser specs for the stack (two visible + more), the uncertain-send merge and an attachment refusal, at 1440 and 390; touched specs and fast web checks green.
