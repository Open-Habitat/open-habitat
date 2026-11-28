---
created: 2026-11-28
updated: 2026-11-28
type: task
reporter: jari
status: untriaged
priority: normal
provenance: chat
source_ref: chat:conductor-2711/eval-reconsider
---

# Reconsider the server browser eval removal under an accident-only threat model

## Description

Jari 28.11.2026, on `server-browser-eval-reads-passwords` (landed: fixed agent
command set, `eval` removed, external DevTools clients no longer work): the
threat model is not an attack. It is enough that the agent really, really
does not read a person-typed password by accident (e.g. a general `eval` that
dumps a form, a page-text read, a screenshot of a revealed field). The eval
changes are to be reconsidered later.

To decide: whether to restore `eval` and external DevTools clients with an
accident-level guard (password values redacted from eval/text/DOM results,
revealed-password screenshots refused), or keep the fixed command set.
Before the next release this matters, because the landed change removes
capabilities agents use.
