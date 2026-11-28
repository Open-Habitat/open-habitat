---
created: 2026-11-14
updated: 2026-11-28
type: bug
reporter: jari
status: testing
priority: normal
provenance: chat
source_ref: chat:2026-11-14/worker-waits-promise-browser-cannot-keep
preparation: ready
lane: unlaned
---

# Worker 'odottaa sinua' and its banner promise an answer the browser cannot give

## Description

Jari 8.11.2026 and 14.11.2026 (test server): an `--interactive` spinoff that
has committed and waits at its prompt shows a yellow dot and "odottaa sinua"
in the Workers panel, but the worker view is read-only ("Vain luku · kysy
pääagentin kautta") and the browser offers nothing to answer it or accept its
work. Jari: "mitä se ottaa minulta, kun en voi olla sen kanssa missään
interaktiossa". On 14.11. a headless worker stuck at Pi's trust prompt
raised a banner above the parent's composer: "Worker odottaa vastaustasi.
Avaa Workerit ja katso, mitä se tarvitsee", while the worker's terminal is
read-only in the browser and its card says to answer with `taskfleet run
attach` in a native terminal. Taskfleet's own `awaiting_input` is false for
the interactive run; Habitat infers the state itself.

Expected: never promise the person a task they cannot do in the browser.
Either the label says what is expected and where (e.g. "odottaa päätöstä:
pyydä agenttia yhdistämään tai hylkäämään", with a direct action), or the
browser gets a way to answer. Relates to `worker-asks-parent` (the parent
agent answers workers and asks the person only when needed).

### 2026-11-28 · @jari (via conductor)

Fix approved.
