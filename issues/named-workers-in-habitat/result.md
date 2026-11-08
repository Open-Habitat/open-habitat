# Result: named support workers in Habitat (experimental)

Avustajat is under Kokeelliset ominaisuudet (`named-workers`). Habitat reads
Taskfleet's named workers (resident runs, Taskfleet ADR 0003) as the person's
own Unix user, shows them in a chip of their own, and wakes a stopped main
conversation on a round report. Habitat gains no new authority: landing,
messaging, expiry and teardown stay Taskfleet's, and the daemon runs no new
Taskfleet command.

## Taskfleet gap (blocks live use, not the code)

The installed Taskfleet on Birch is **0.18.0** (`taskfleet version`), which has
no named workers: no `run create --resident --name`, no `node round-report`,
no `run land`, and no `resident` object on `run list` / `run show`. Taskfleet's
`main` (commit `40909cf8`, `named-resident-workers` closed 2026-11-06) has all
of it under `[Unreleased]` in its CHANGELOG, but no release has carried it.
Habitat's part is built against that read surface only (`resident.name`,
`round_state` of `working | waiting | dormant`, `rounds_reported`,
`last_round {round, reported_at, summary, open}`, `last_landing.round`,
`expiry_attention_at`; `run wait` settling on an open round report), and is
tested with synthetic Taskfleet state of that shape. Nothing is imitated in
Habitat: with 0.18.0 no run has `resident`, and every surface behaves as before.
The gap for Taskfleet is a release of the resident-worker work and its fleet
rollout (Fleetrepo), after which the Avustajat chip works as is.

## What changed

- **Daemon** (`internal/daemon/resident_linux.go`): a live resident between
  rounds (waiting or dormant, also with expiry attention) is `waiting_parent`,
  so it no longer reads as *Odottaa vastausta päätteessä* from its exited Pi.
  Each spinoff row carries a `resident` projection (name, round state, rounds,
  latest report, landed round, unlanded). A waiting resident counts as settled
  for a cut-off `run wait`, so the existing wake path wakes a stopped
  conversation on its helper's round report, and it does not keep the
  parent's Pi from the idle stop. The catch-up (Go and the companion
  `process-extension.mjs`, one shared fixture) tells each round report once,
  keyed by its round, with the worker's own summary and its name.
- **Contracts**: `spinoffs.schema.json` gains the optional `resident` object;
  the catch-up/rest run state gains `round_reported` with `round` and `name`.
- **Browser**: with Avustajat on, live named workers leave the Workers pill
  for one *Avustajat* chip beside it with the Botit icon and a Pallot mark
  each: working ball during a round, accent ring with a centre for a report
  not yet opened, muted ball while waiting or resting, and the wait ring when
  the main agent waits on it. The chip opens an *Avustajat* tab in the strip's
  panel: name · task, rounds, where the round stands, the latest report's
  first line, and a note that messages, landing and stopping go through the
  main agent. A row opens the worker's own read-only view, whose state reads
  *Avustaja · 2 kierrosta · odottaa pääagenttia*, and opening it clears the
  unseen mark (kept in the browser, per device). The rest card and catch-up
  history say *raportoi kierroksen N ja odottaa pääagenttia*. Archiving a
  conversation with helpers adds to the archive notice who went with it,
  which round is still under way and which helper's work is not yet landed.
  Explain mode's worker legend has the new mark.
- **Instructions**: AGENTS-WORKFLOW.md says when a named worker is used, that
  each round is landed before the next message, that the conductor relays
  the person's words, and what Habitat does and does not do with them.

## Jari's 8.11. decision, as built

- *The main conversation's Pi ends*: helpers keep waiting (Taskfleet's state;
  nothing in Habitat stops them), and their next round report wakes the
  conversation through the existing wake path (cut-off `run wait` settles on
  the report).
- *The main conversation is archived*: its helpers are archived with it
  because they belong to it by Taskfleet's creator session: they disappear
  with it, and an archived conversation is never woken. The notice says so,
  and names unlanded work kept on a helper's branch.
- *The main conversation is restored*: its helpers come back with it in their
  Taskfleet state, unstarted; a waiting or dormant helper resumes only from
  the main agent's next message.

## Decisions for later review

- **Archiving merges nothing in Habitat.** The decision says finished work is
  merged on archive. Under the per-round landing rule the main agent has
  already landed each finished round; a round still unlanded at archive time
  stays on the helper's branch (Taskfleet preserves it and raises attention at
  idle expiry), and the notice names it. The daemon calling `taskfleet run
  land` or `run merge` on archive would give it merge authority it must not
  have (root and `internal/AGENTS.md`). Alternative: a Taskfleet command that
  lands on the parent's behalf, decided with Jari.
- **No Stop control on a helper row.** Round 2's prototype drew one; it would
  make the daemon initiate Taskfleet teardown, which the issue keeps
  Taskfleet's. Stopping goes through the main agent, as messages do.
- **Restored helpers show their Taskfleet state** (*odottaa pääagenttia* or,
  after idle expiry, *lepää · herää pääagentin viestistä*) rather than an
  *arkistoitu* word of their own: Habitat keeps no store of which helpers went
  with an archive, and the dormant state already says "visible, restorable,
  not running".
- **Helpers are a tab in the strip's panel**, beside Workerit and Prosessit,
  instead of the prototype's separate floating card: it is the production
  panel's own pattern and keeps one popover at a time.
- **An ended named worker returns to the Workers pill.** What remains of it
  is a branch to handle, and the Workers pill already has the requests for
  that (*Kerro agentille*); one that leaves the list while Avustajat is on
  shows *lopetettu* under the chip for a moment.
- **The unseen report mark lives in the browser** (localStorage, per device),
  as the prototype round decided; the host keeps no read state.
- **Worker view state words name the helper even with Avustajat off**, so a
  named worker never reads as waiting at its terminal.
- **The phone chip keeps its *Avustajat* word**, as the prototype drew it.

## Checks

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: all
  pass except `TestAgentCommandPathIsPerHomeAndInherited`, which fails on main
  too inside a Habitat agent environment (`agent-path-test-misses-core-tools`).
  New: `resident_linux_test.go` (round states in the panel, wait outcome and
  idle-stop rule, catch-up once per round, rest notice parsing, the spinoff
  route end to end with a fake Taskfleet) and
  `TestStoppedConversationWakesOnItsNamedWorkersRoundReport` (a real daemon
  with fake Pi: no wake while the round works, one wake on the report).
- `node --test internal/daemon/pi-device-test/catch-up.test.mjs`: 14 pass,
  including the shared fixture's new resident case and the catch-up text; `process-extension.test.mjs` checks the named-wait grammar.
- `./scripts/test-focused.sh --area contracts` and `--area web` pass (1428
  unit tests).
- Browser: `named-workers.spec.ts` (new), `settings-experimental.spec.ts`,
  `spinoffs.spec.ts`, `rest-card.spec.ts`, `worker-badges.spec.ts` pass.
  `settings-experimental.spec.ts` already failed on main (its list lacked
  `markdown-block-preview`); fixed while adding `named-workers`.
- Evidence (synthetic): `evidence/chip-desktop-light.png`,
  `evidence/list-desktop-light.png`, `evidence/list-desktop-dark.png`,
  `evidence/list-phone-light.png`.

## Review

Independent `/llm-review` (finder GPT-6 Astra, verifier Claude Fable 5.1) and
`/assess-findings`: four findings, all confirmed and fixed in this commit.
(1) Taskfleet resolves a resident's name in `run wait`, but Habitat's wait
grammar took run ids only, so a cut-off `taskfleet run wait proto-m365` woke
the conversation at once while the round still ran. Both readers now resolve
names against the conversation's own live runs, and the shared grammar and
catch-up fixtures carry named waits. (2) A stalled resident with an open round
lost the stall caveat in the catch-up. (3) Opening a helper whose conversation
could not be read cleared its unseen mark. (4) The archive notice called a
round without a recorded landing unlanded work, though Taskfleet records no
landing for a round that changed nothing. It now says so only on Taskfleet's
own `unlanded`, uses an unconfirmed wording otherwise, and skips dormant
helpers.

## Not verified

- No real resident run: Taskfleet with named workers is not installed. The
  first live check is in KOKEILTAVAA.md once Taskfleet ships.
- The wake path is proven with the daemon's fake Pi, not a real Pi.
- Forced-colours mode was not checked for the new mark.
