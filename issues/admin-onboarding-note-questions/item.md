---
created: 2026-11-21
updated: 2026-11-28
type: feature
status: open
priority: normal
provenance: other
provenance_detail: worker proposal answering the maintainer's question in new-user-agent-instructions-template
source_ref: taskfleet:01m7zbxs4sc2a2kmjkfb4dpxeh/proposal:admin-note-questions
originating_run: 01m7zbxs4sc2a2kmjkfb4dpxeh
originating_run_kind: spinoff
lane: onboarding-note
lane_seq: 1
preparation: ready
---

# Administrator-defined questions for the person's agent note in onboarding

## Description

## Problem

The note for the agent (onboarding's last step and Settings › Tili › Ohjeet
agentille, experimental `agent-instructions`) asks fixed questions written in
the product's text catalog (`web/src/text/agentNote.ts`): the answer
language, the answer style, what the agent must ask before doing, and the
person's own words. No model runs and nothing is configurable. The site's
onboarding configuration (ADR 0030: repositories, integration steps, AI
account offer) has no part for the note, so an administrator cannot add a
question that matters on their server (for example the team or course a
person belongs to, or the house rules for publishing).

## Proposal (simplest design)

- Add an optional `instructions.questions` list to the onboarding
  configuration, which is already gateway administration state with one
  writer lock and version (ADR 0030). Each question has a Finnish and an
  English prompt, up to four choices (a label and the sentence it puts on the
  note), and whether free text is allowed; at most five questions, bounded
  lengths, plain text only.
- `GET /api/v1/onboarding/site` carries the list to the signed-in person as
  presentation, exactly like the integration steps. The browser asks the
  site's questions after the built-in ones and before "omin sanoin". A choice
  puts its sentence on the note; free text goes under the question as its own
  heading.
- Nothing new reaches a home: the note is still written only by the page,
  through the person's daemon's compare-and-swap write, after the person has
  seen the whole text in the editor and pressed Save. The daemon gains no
  input from the site. A change applies to notes made afterwards.
- Administrators edit the list in Settings › Käyttöönotto beside the other
  steps, with the same preview of the route the page already has.

## Not in scope

A site-wide instructions file that every person's agent reads without seeing
it would be a different, host-level authority and is not proposed here.

### 2026-11-28 · @jari (via conductor)

Prototype round first.
