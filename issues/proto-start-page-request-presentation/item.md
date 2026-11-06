---
created: 2026-11-03
updated: 2026-11-03
type: task
reporter: jari
status: open
priority: normal
lane: start-page-button
lane_seq: 1
preparation: ready
---

# Prototype: how a start-page request looks before and after sending

## Description

Jari 3.11.: two questions of the start-page round were unclear in words; answer them visually. One flow, three screens side by side: (a) the workspace landing with its *Luo aloitussivu* / *Päivitä aloitussivu* buttons, (b) what pressing does there today (the command text `/open-habitat-start-page` lands in the field) versus alternatives (a named chip *Luo aloitussivu* in the field; sent at once as in the empty conversation decision), and (c) how the sent request then reads in the conversation history: today the native skill name and its template prompt, versus a *Luo aloitussivu* label with the prompt folded, versus the label only. Show today first, then the directions, so the difference is visible. Same for the empty conversation button (Jari 3.11.: it starts at once).

## Decision (Jari 2026-11-06)

Suunta **Siru ja lause**. Vihjeitä (esim. "hakasulkeinen rivi jää pois")
ei tarvita. Kysymys (b), jätetäänkö koskematon paikkamerkki pois ja
toimiiko tavoitteiden `[kysymys]` samoin, riffataan: Jari haluaa ymmärtää
sen visuaalisesti (kierros 3).

## Acceptance Criteria

- [ ] A prototype round showing today and three directions for both screens, phone and desktop, with a recommendation and at most three questions.

## Round 1 (3.11.)

Prototype round `design-system/prototypes/rounds/2026-11-03-aloitussivupyynto/`,
result and questions in [result.md](result.md). Awaiting Jari's choice.
Today's button inserts a command Pi does not expand: filed as
`start-page-button-bare-command`.

## Jari 3.11. on round 1

The button puts a **template prompt** in the message field: a sentence for
the agent such as "Luodaan aloitussivu käyttäen … -taitoa", a line break, and
then a bracketed placeholder already selected, e.g. "[anna lisäohjeita]", so
typing replaces it. Round 2 shows this for both buttons (workspace page and
empty conversation), create and update, and how it then reads in the history.

## Round 2 (3.11.)

Prototype round `design-system/prototypes/rounds/2026-11-03-aloitussivupyynto-2/`,
result and questions in [result.md](result.md). Awaiting Jari's choice.
