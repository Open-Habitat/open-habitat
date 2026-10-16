# Result: agent processes in the browser

Round `design-system/prototypes/rounds/2026-10-16-prosessit/`, built from
`design-system/prototypes/` with

```
node build.mjs rounds/2026-10-16-prosessit
```

into `dist/2026-10-16-prosessit.html` (not versioned). The server-side proposal
is [../extend-process-ui/architecture.md](../extend-process-ui/architecture.md).

## Axis and directions

The axis is **where the processes live relative to the conversation**. All
three directions have the same four synthetic processes in the Status-skripti
conversation (`testit` = `ptw` watcher, `sivu` = preview server, `haku`
finished with a truncated tail and a redacted token, `kello` failed with a
traceback), the same output view, the same stop and the same host states.

1. **Merkki yläpalkissa.** A chip "2 käynnissä" in the top bar beside the model
   chip; it appears only when the conversation has processes. It opens a
   popover list; a process opens its output in a large window over the
   conversation. Decides: processes are a glance-and-dip side matter; reading
   output means leaving the conversation for a moment.
2. **Sivupaneeli.** A terminal icon with a count badge among the top-bar
   actions toggles a panel docked to the right of the conversation: list on
   top, the selected process's output below. On the phone it covers the
   conversation and drills from the list into the output with a back arrow.
   Decides: watching a server or a test watcher while reading the agent's work
   is a real side-by-side job; it costs 400 px of conversation width.
3. **Kentän yllä.** One quiet row in the conversation column above the recap
   card and the composer, "2 prosessia käynnissä · testit, sivu", that opens
   into the list; a row expands its output inline. Decides: processes belong
   to the conversation and are seen where the user is about to write; an open
   tray takes vertical room from the conversation.

Shared in all three: the agent's own `process` tool calls in the history show
the process's current state and a *Näytä prosessi* button that opens it in the
direction's place; Tiedot lists the availability ("2 käynnissä, 2
päättynyttä", or the reason it is unavailable).

## What the output view does

Combined stdout and stderr in arrival order; stderr lines are marked with a
quiet "2" in the gutter, not an error colour, because many tools (here
`http.server`) log there. Live output follows the end. Scrolling up or the
pause button stops following without pausing the process; a pill "N uutta
riviä · Seuraa" counts new lines and returns to the end. A truncated tail says
"Alusta jätetty pois 1 186 riviä · näytetään viimeiset 60", and an ended
process ends with "Päättyi 14.35 · koodi 0" or "Pysäytetty 14.37 (SIGTERM)".
Lines are not wrapped, as in the output box. The watcher really re-runs in the
prototype when the live turn's patch lands.

Stop is immediate, without confirmation, like the agent's Stop: "Pysäytetään…"
then "Pysäytetty". The toast says the agent is not told. The page-bar
**Tilanne** select shows the other host states: *Pysäytys jumittuu* (the next
stop ends in "Ei pysähtynyt" with *Pakota lopetus*), *Ei prosesseja*, *Pi ei
käynnissä*, *Terminaalista ohjattu* and *Ei laajennusta*. Each direction
decides where those show: the chip hides for all of them (reason only in
Tiedot), the panel always explains, the tray shows a dashed line only when
processes may exist out of reach (Pi stopped, terminal).

## Host facts the view assumes

All are proposals in the architecture sketch, none exist today:

- an inventory per browser-controlled conversation with `available` or
  `unavailable` plus a reason (`pi_not_running`, `terminal_control`,
  `extension_missing`), never an empty list in place of unavailable;
- per process: name, redacted command preview, the extension's status
  vocabulary (`running`, `terminating`, `terminate_timeout`, `exited`,
  `killed`), start and end time, exit code or signal; no PID, path or raw
  command;
- a bounded combined-output tail with stream tags and the count of omitted
  lines, live lines over SSE while a view is open, and a refetch on any gap;
- stop with SIGTERM and the extension's 3 s timeout, and a forced SIGKILL;
  `owner_generation` plus a per-process token fence both.

## Questions for Jari

1. Which place: chip, panel or tray?
2. When the user stops a process, should the agent be told? The extension
   deliberately suppresses its exit notification for an intentional stop.
3. The bridge: is a host-shipped companion Pi extension with a private socket
   inside the daemon service acceptable (the sketch's recommendation), or
   should we first ask Pi upstream for a generic extension-call RPC command?

## Decisions for later review

- The round covers only browser-controlled Pi children; terminal
  conversations show "Ohjataan terminaalista", following the evidence note.
- No confirmation on stop; a hung stop offers *Pakota lopetus* instead.
- No *clear finished* control: the extension's clear also deletes logs, and
  finished records are reaped automatically.
- stderr is marked, not coloured red.
- The "Pi ei käynnissä" text does not claim the processes stopped after a
  crash; the sketch records that a crash can leave orphans in the service
  cgroup until the daemon stops.
- The sketch found a latent defect for implementation: `piRPC.close()` gives Pi
  100 ms before SIGKILL, too short for the extension to stop its detached
  process groups. Recorded as a requirement of the implementation issue, not
  filed separately, because no browser path closes a Pi that can have
  processes today.
- Library proposal: none needed; the round overrides `APP.actions`,
  `detailsList` and `toolBody` in its own scope. If a direction is chosen,
  `lib/` would gain a `processes.js/css` with the shared row and output view.

## Verification and review

`check.mjs` on the built page: three directions in light, dark and phone, plus
clicks (panel: open `haku`, stop), console clean. A separate Playwright script
clicked through every direction on desktop and phone: popover and window,
pause and *Seuraa*, stop, the hung stop and forced stop, every Tilanne state,
and the watcher re-run after the live turn; no console errors.

The architecture sketch touches authority, credentials and the Unix-user
boundary, so it had one targeted `/llm-review` (finder gpt-6-astra, verifier
claude-fable-5-1). Both findings held and are fixed in the sketch: process IDs
can be reissued within one Pi child, so the stop is also fenced by a
per-process token; and the command-preview redaction now covers credential
options and known token prefixes and says it is best effort. The prototype
code itself got a focused self-review only (synthetic content, no production
code). The model-performance entry was not logged: SSH from alder to itself
was refused (known issue `assess-models-alder-self-ssh`).
