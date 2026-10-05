---
created: 2026-09-20
updated: 2026-10-05
type: task
status: open
priority: normal
epic: native-agent-host-architecture
blocked_by: ['@review-mvp']
lane: post-mvp-design
lane_seq: 10
collision: [docs/, design-system/]
preparation: pending
---

# Evaluate a user-requested conversation recap

Help someone returning to a long conversation understand where the work stands
and what they might do next. This is accepted post-MVP design work for L7 in
[the UI follow-up list](../native-agent-host-architecture/ui-design-later.md).
Use observed MVP experience to establish whether a recap would help.

## Design scope

Start with a user-requested recap presented as a short card separate from the
conversation history. Automatic recap remains a later possibility, worth
considering only after the manual experience proves useful. The L7 notes and
[conversation design document](../native-agent-host-architecture/ui-design-conversation.md)
provide context, not a settled recap design; v1 has no recap card.

The card should make generation, failure, age and staleness understandable, so
the user can judge whether it reflects the conversation now. A suggested next
step helps them resume work; it remains a suggestion, with a link to the relevant
target where applicable, rather than an action executed automatically. The recap
supplements the native history.

## Integration considerations

Establish what recap support the native component actually exposes to the
browser integration. Pi's TUI `/recap` extension does not on its own establish
browser support. If integration is missing, describe what would be needed,
including model-call cost and separation from the active conversation's model
context.

Follow the [agreed architecture](../../docs/architecture.md): native components
retain ownership of history, configuration and subprocesses, and browser
communication uses HTTP/SSE. This work does not introduce a workspace registry,
parallel history store, credential broker, internal tenant model or speculative
cache; the recap is a way to understand existing work, not a new owner of it.

## Acceptance Criteria

- [ ] Produce and review a concrete interaction design grounded in observed need before activating an implementation issue.
- [ ] Verify native recap support or design the missing integration, including model-call cost and context separation.
- [ ] Show generation, age, failure, staleness and a suggested next step without replacing history or executing the suggestion.

Keep the design, review and findings in this issue directory. The
[design package](../native-agent-host-architecture/ui-design-package.md)
provides the surrounding UI context.

## Decisions

### 2026-09-30T17:35:34Z · @claude

Rethink-night 30.9.: rethink-instructions (gpt-6-astra), faktantarkistus fact-check-instructions (claude-opus-5-5). Ilman Jaria rajattiin työ manuaalisen recap-kortin suunnitteluun; automaattinen recap pysyy myöhempänä harkintana, ei toteutuspäätöksenä. Otsikkoa selkeytettiin ja L7:n vanhentuminen sekä seuraavan toimen linkki tuotiin näkyviin. Faktantarkistus korjasi epämääräisen viittauksen vanhoihin luonnoksiin L7-muistiinpanoiksi ja täsmensi TUI-piirteen Pi:n /recap-extensioniksi; lähteet ja asennettu symlinkki tarkistettiin paikallisesti. Hyväksymisruudut säilytettiin työn myöhempää sulkemista varten. Ei ristiriitaa Jarin aiempiin päätöksiin. Tämän issuekansion ulkopuolella epicissä näkyy vanha otsikko ja design-paketin ajantasaisuus jäi epävarmaksi; niitä ei muokattu.
