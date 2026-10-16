# Result: process blocks, completion wake-ups and waiting states

Round `design-system/prototypes/rounds/2026-10-16-prosessilohkot/`, built from
`design-system/prototypes/` with

```
node build.mjs rounds/2026-10-16-prosessilohkot
```

into `dist/2026-10-16-prosessilohkot.html` (not versioned). The server side is
in [../extend-process-ui/architecture.md](../extend-process-ui/architecture.md),
new sections from "Completion: how the agent learns" to "Clearing finished
processes".

## The story every direction plays

The Status-skripti conversation, with the tray from the chosen direction
(*Kentän yllä*) now carrying *Poista päättyneet*. In history the agent starts
`testit` (a watcher) and `sivu` (a preview server), both set so that their end
does not wake it, and `haku`, whose end woke the agent at 14.35; `kello` fails
while the agent is explaining. The live turn (run the tests, fix, rerun)
starts `tyypit`, which finishes mid-turn and reaches the agent as **steering**,
and ends by starting `hidas-testi` in the background. The conversation is then
**Odottaa prosessia**. When `hidas-testi` ends, it **wakes** the agent, which
starts a spinoff for the README and waits for it with
`taskfleet run wait <id> --any --timeout 2h`: **Odottaa spinoffia**, shown as
the spinoff and its state, not as a process. When the spinoff merges, the wait
ends and wakes the agent again; it confirms and is *Odottaa sinua*.

The page bar's **Seuraava tapahtuma** runs the next host event at once
(otherwise 9 s and 11 s). **Tilanne** switches between *Spinoff onnistuu*,
*Spinoff ei mergeä* (the wake block shows the conflict and preserved work) and
*Terminaalista ohjattu* (no inventory: the host claims no waiting state, and
the tray says why). Etusivu in the sidebar opens a home page with the same
marks on the cards; the conversation keeps running behind it.

## Axis and directions

The axis is **how loudly a process speaks in the thread**. Content, tray,
states, top bar, recap and home page are the same in all three.

1. **Merkintänä.** The start is an ordinary `process` tool row inside the
   hidden work; its status column follows the process (*Käynnissä*, *Valmis*,
   *Virhe · koodi 1*, for the wait the spinoff's state). A completion is one
   quiet row of the session-marker family: mark, name, outcome, how it arrived
   (*Ohjaus kesken työn* / *Herätti agentin*) and time. Decides: the thread
   records that something happened; the tray and the state mark carry the rest.
2. **Korttina.** The tool row stays in the work, and the turn that started
   background work leaves a live card under its reply (*Käynnisti taustalle*:
   state, last output line, a bell when its end will wake the agent, *Näytä*).
   A completion is a card with the outcome and the last three output lines
   (the spinoff's: commits, `+6 −1`, files, or the conflict), *Näytä
   prosessi* / *Avaa spinoff*. Decides: background work is visible in the
   conversation without opening the work, at the cost of height.
3. **Viestinä.** The start is as in 1. A completion is a message from the
   process (or the spinoff) to the agent on the sender's side, dashed and
   sunken, because natively it is exactly that: a custom message the model
   reads. The agent's next turn visibly answers it. Decides: the thread's
   grammar explains why the agent started working without the user.

Shared in all three: a steering notification stays visible when the work is
hidden (it is not the agent's work), and splits the work around it in
history. A notification read from history carries no *Ohjaus* / *Herätti*
label, because the host cannot know it from history (see the sketch); the
labels appear on live blocks only.

## Proposed state-model additions

| Activity | When (host facts) | Label · short | Mark | Sidebar order | Top bar | Recap | Home card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `waiting` (existing) | a pending question, whether or not a run is active | Odottaa sinua · odottaa | hollow ring | after the new ones | chip | — | counts in "odottaa sinua" |
| `working` (existing, widened) | a run is active, started by the browser **or by Pi** (a wake-up), no pending question | Työskentelee · työssä | spinner | 1 | chip | — | — |
| `waiting_process` (new) | no run; the inventory is available; a running process will start a run when it ends (its start call set `turn` for success or failure) | Odottaa prosessia · odottaa prosessia | terminal glyph, accent | 1.4 | button chip naming the process (`hidas-testi`, `+1` for more); opens it in the tray | line "Agentti jatkaa itse, kun `hidas-testi` päättyy." | own count, line under the text |
| `waiting_spinoff` (new) | as above, and one of those processes is a recognised `taskfleet run wait` whose runs are not all terminal | Odottaa spinoffia · odottaa spinoffia | spinoff glyph, accent (same as proto-spinoff-agents) | 1.5 | button chip with the spinoff's state mark | line naming the spinoff with its state and clock | same |
| `waiting` (existing) | no run, and no running process can wake the agent (a server set to `context` does not count) | Odottaa sinua · odottaa | hollow ring | 2 | chip | — | — |
| unchanged | no inventory (terminal control, Pi stopped, extension missing) | today's labels | — | — | chip tooltip says why waiting is not known | — | — |

The two new activities sort with background work, before *Odottaa sinua*,
because the agent returns by itself; the home page summary counts them
separately ("3 odottaa prosessia tai spinoffia") so they never inflate "odottaa
sinua". A pending question wins over everything, as today.

## Host facts the view assumes

All are proposals in the sketch; none exist today.

- A typed history and live block `process_event` from the extension's
  `ad-process:notification` custom message: kind, process ID and name,
  redacted command, exit code, signal, end reason, and `delivery`
  (`steer` / `wake` / `context`) only when the daemon observed it live; null
  from history.
- Pi-started runs count as working (`agent_start` without a browser command,
  idle at `agent_settled`), with steering and Stop in the composer.
- `wakes_agent` per running record, from the start call's normalised `notify`
  (success or failure `turn`), and `waiting_on` in the snapshot.
- Recognition of a strict `taskfleet run wait` command by the daemon, the
  spinoff's title, branch and state from Taskfleet as the user, and the wait's
  own outcome (met, timeout, failed) kept apart from the spinoff's current
  state.
- `clear-finished` mapped onto the extension's clear (records and logs);
  history keeps the blocks, whose output then says it was removed.
- The spinoff's read-only view comes from proto-spinoff-agents; here *Avaa
  spinoff* only says where it goes.

## Consistency with proto-spinoff-agents

That round was in progress in its own worktree; its commits up to
`afd467b8` were read, not merged. Shared and kept the same: the state name
*Odottaa spinoffia*, its spinoff glyph in accent colour, its sort position 1.5,
the top-bar chip that names the spinoff with the spinoff's own state mark, the
spinoff state vocabulary (*Työskentelee*, *Mergetty*, *Ei mergetty · työ
tallessa*) and the wait command shape. That round explicitly left the wake
block's design to this one. The spinoff round's "Odottaa pääagenttia" belongs
to the spinoff, not the parent, and does not appear here.

## Questions for Jari

1. Which voice: Merkintänä, Korttina or Viestinä?
2. Is *Odottaa prosessia* the right word for the agent that will return by
   itself, and should those conversations sort with working ones (proposed) or
   after *Odottaa sinua*?
3. Labels on history blocks need one upstream change in pi-processes (record
   in the notification whether Pi was idle). Ask upstream, or accept that the
   label shows only for completions the browser saw live?
4. Should log watches count towards *Odottaa prosessia*? It needs the
   extension to report whether a one-shot watch has already fired; without it
   they are left out.

## Decisions for later review

- *Poista päättyneet* has no confirmation; its tooltip says logs are removed
  and history stays. Finished records are reaped automatically anyway.
- Only processes whose end starts a turn make the agent "wait". A preview
  server or watcher started with `context` keeps the conversation *Odottaa
  sinua*; the tray splits running processes into *Agentti odottaa* and *Muut
  käynnissä*, and a bell marks a process whose end wakes the agent.
- The waiting chip in the top bar is a button that opens what is waited for
  (the process in the tray); in proto-spinoff-agents it opens the spinoff.
- Stopping the wait process stops only the waiting, never the spinoff, and
  its tooltip says so.
- A foreground `taskfleet run wait` run with `bash` is shown as a plain long
  `bash` row while the agent is *Työskentelee*; only the background process
  form gets the spinoff presentation.
- When several runs are waited on with `--any`, the sketch lists each; the
  prototype shows the single-run case only.
- The home page is a minimal stand-in (state mark, title, one line, waiting
  line); its real layout is the accepted *Työtilaosiot* direction.
- The production lab was not run: no process UI exists in production, and the
  state presentation was read from `web/src/components/agentPresentation.ts`
  and the library that mirrors it.
- Library proposal: none required now. The round overrides `toolRow`,
  `liveToolRow`, `lanka` (to split work around a steering notification),
  `markerR`, `stateChip`, `paintTop`, `detailsList` and `script` in its own
  scope. If a direction is chosen, `lib/` would gain `processes.js/css` (tray,
  output, blocks) and `STATES` the two waiting states; `lanka` would gain the
  work split for in-turn notifications, and the live renderer a non-work
  block kind.

## Verification and review

`check.mjs` on the built page: three directions in light, dark and phone;
clicks in direction 1 (waiting chip opens `hidas-testi` in the tray, *Poista
päättyneet*, open the live turn's work, open the `process` start row), in
direction 2 (tray, *Näytä* on the start card) and in direction 3 at phone
width (tray, clear); console clean. A separate Playwright walk drove the whole
story in every direction (procwait → tray → spinwait → home page → back →
done), the *Spinoff ei mergeä* scenario in dark, *Terminaalista ohjattu*, and
phone; no console errors.

The architecture changes touch credentials (raw commands in notifications),
the Unix-user boundary (Taskfleet read as the user) and run authority, so they
had one targeted `/llm-review` (finder gpt-6-astra, verifier
claude-fable-5-1). All six findings were confirmed against the installed Pi,
pi-processes and daemon source and are fixed: idle stays at `agent_settled`;
a wake is an initial message after `agent_start`, not before; history cannot
tell a wake from a steer; spent one-shot log watches would leave the agent
"waiting" forever, so watches do not count; a pending question wins over
working; a finished wait is not a finished spinoff. The prototype was changed
to match (no labels on history blocks, a live steering block added). The
prototype code itself got a focused self-review only (synthetic content, no
production code).
