---
created: 2026-11-08
updated: 2026-11-08
type: task
reporter: jari
status: done
priority: normal
lane: helper-archive-proto
preparation: pending
closed: 2026-11-08
---

# Prototype: how archiving a conversation with helpers is told to the person

## Description

Jari 8.11.2026 accepted the named-workers archive rule (`named-workers-in-habitat`,
decision 8.11.): archiving a parent conversation merges nothing; finished
helper rounds are already merged; an unfinished round stays on the helper's
branch; archived helpers return archived when the parent is restored. He
wants to see how this is told to the person, because that is how we learn
how it is meant to work.

Prototype round (`AGENTS-WORKFLOW.md`), one view: the archive flow of a
conversation with two helpers (one waiting with all rounds merged, one with
an unfinished round on its branch). Today (the current archive notice that
`named-workers-in-habitat` added), then three directions for what the person
sees before, during and after archiving and on restore (for example a
confirmation listing helpers and unmerged work; a quiet notice after the fact
with an *Avaa haara* / *Palauta* path; helpers shown as their own rows in the
archive with their state). 1440 and 390, light and dark.

## Acceptance Criteria

- [x] round 1: today, three directions, view offer and questions for Jari

## Decision (Jari 2026-11-08, kierros 1)

**1 Vahvistus ja sen jälkeen 3 Arkistossa**: arkistointi kysyy ensin ja
luettelee avustajat tiloineen ja sen, mikä jää haaraan; arkistossa avustajat
näkyvät keskustelun alla omina riveinään tiloineen. Kysymykset 2 ja 3
kapellimestarin päätöksellä suosituksen mukaan: palautus kertoo rivillä
keskustelun lopussa, ja haaraan pääsee *Avaa haara* -toiminnolla; haaran
ikkunassa ei muutosten määrää (ei uutta host-tietoa). Toteutus:
`helper-archive-flow`.
