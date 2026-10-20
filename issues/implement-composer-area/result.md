# Result: the Rivillä composer area

Implemented 2026-10-20 (taskfleet run `01m5bwtn1d6ef14zet4hfbpvj9`) from round
`design-system/prototypes/rounds/2026-10-19-koko-alakerta/` direction 1 (Rivillä),
`proto-composer-combined` (Alarivi, caret completion, buttons) and
`proto-composer-commands` (Feasibility: `get_commands`, RPC `bash`/`abort_bash`, `@`).
Verified in the synthetic lab only; not yet on the test server.

## What the person gets

- **The field's bottom row.** Left: **Komennot** and **Tiedosto** (and the new
  conversation's model pill). Right: while Pi works the **mode chip** (↪ Ohjaa ⇄ /
  Työn jälkeen; its tooltip is Vieressä's menu text), **Stop** beside **Send**. On a
  phone the two buttons drop their labels while Pi works.
- **Keys as in Pi's TUI.** Enter sends; while Pi works Enter sends the chosen way and
  Alt+Enter once the other way. Esc in the field with no list open stops what Stop
  stops: Pi's turn first, otherwise a running `!` command.
- **The queue** is a card above the field, one row per message (Ohjaus / Työn jälkeen,
  text, "seuraavassa välivaiheessa" / "kun vuoro päättyy"), with **Palauta kenttään**
  in place of Tyhjennä jono. Stop takes the queue back into the field before it stops
  Pi (Pi keeps its queue over an abort; its TUI restores it on Esc the same way).
- **`/` and `@` at the caret**: Pi's own command list (skills, templates, extension
  commands; `/mcp` and `/llama` listed as "vain Pi:n päätteessä"), the workspace's
  files with Git marks, changed files first. A mid-line `/` opens with nothing
  selected, so Enter still sends. Tab inserts the top match; Esc closes and keeps
  the text. The buttons open the same list with a search; a command from a button
  goes to the start of the message.
- **Ctrl/⌘+P** opens the palette (Muutetut / Tiedostot / Komennot) with a preview
  (Git's diff of a changed file, or its first lines), Tab marks several files,
  Ctrl/⌘+P again moves to the next tab, and from an open `@` list it carries the
  typed query along.
- **`!` and `!!`** typed at the start: the field tints, says "Komento työtilassa
  ~/src/… · Pi näkee tulosteen" (or "vain sinulle, ei Pi:lle"), Send becomes **Aja**.
  The command runs at once, even while Pi works; the field clears; a "Sinä · komento"
  block streams its output until Pi's own history entry takes over; the bottom row
  shows "! make serve 0:05" with its Stop.

## How it is built

- **Daemon** (`internal/daemon/`): `bash_linux.go` relays `!` to the conversation's Pi
  as RPC `bash`; `pi_bash_linux.go` routes its late reply by request ID past the
  correlated request queue, so sends and stops are answered while a command runs.
  One command per conversation; one typed while Pi is not running waits for the Pi
  it starts (the existing held-start path) and is never run later if that start
  fails or it is taken back. `commands_linux.go` answers `/` from the running Pi or
  a short-lived `pi --mode rpc --no-session` in the workspace (no conversation, no
  session file). `workspace_composer_files_linux.go` lists files from Git's view or
  a bounded walk and serves one bounded preview, as the person. The event journal
  keeps a running command's output across Pi's turn boundaries.
- **Gateway**: only relays `/commands`, `/bash`, `/abort_bash` and the three
  workspace reads.
- **Contract**: `contracts/v1/composer.schema.json` (command list, file list, preview,
  bash request/reply, status `bash`), scenario CT-039, examples, negative checks.
- **Web**: `web/src/components/composer/` (Composer, ChoiceList, Palette, CommandRun,
  completion rules, stories); `BrowserConversation` wires the sources and the
  `!` relay.

## Checks run

- Go: `go test ./internal/daemon ./internal/gateway ./test/browser-host` passed;
  focused composer tests with `-race`; `TestListOnlyPinnedPiAnswersCommandsWithoutSession`
  ran the pinned Pi 1.3.0 `--no-session` helper (0.4 s, no session written).
- Contracts: `python3 scripts/validate-contracts.py`, `go generate ./internal/contracts`,
  `scripts/check-generated.sh` clean.
- Web: `./scripts/test-focused.sh --area web` (lint, types, 261 unit, 187 component).
- Lab Playwright (`--workers=2`): `lab-composer-area.spec.ts` (7 flows: Enter / Alt+Enter /
  chip / Palauta kenttään; Esc stops Pi and restores the queue; `!make serve` + run
  chip + Esc; `!!`; `/` and `@` at the caret and the Komennot button; Ctrl+P palette
  with two marked files; phone row) and the whole lab suite. `lab-open-at-end`
  "controlled conversation reopens at latest" fails identically on `main` (checked in a
  separate checkout of main) and is not caused by this change.
- Screenshots: `shots/` from `web/lab/capture-composer-area.mjs`, named like the
  round's (`<desk|phone>-<theme>-<n>-<state>`) for side-by-side comparison with
  `issues/proto-composer-area/shots/*-v1-*`.
- Review: `/llm-review` (finder GPT-6 Astra, verifier Claude Fable 5.1) found four
  defects, all fixed in the branch: a held command could be dispatched twice; Stop could
  overtake the bash write and leave the command unstoppable; the preview path was
  read as a Git pathspec; a bounded walk claimed completeness.

## Decisions for later review

- **Default mode is Ohjaa.** Production defaulted to Työn jälkeen without a recorded
  decision; the chosen round and Pi's TUI steer on Enter. Alternative: keep Työn
  jälkeen. The chosen mode is kept for the conversation until changed.
- **The command list is re-read when a list opens, reused for 30 s** while the view
  stays open (in component state, not a store). Without it every `/` typed in a
  stopped conversation starts a list-only Pi. Alternative: read on every open.
- **Browser actions `/uusi` and `/malli` are left out** of the `/` list. The round
  called this a reasonable simplification; a new conversation already has its button
  and the model its pill.
- **Terminal-only commands are a small allowlist (`mcp`, `llama`)**, because Pi's list
  has no executability field. An unknown extension command is offered and Pi decides.
- **A `!` command's state lives in the daemon's memory** (held, running, last
  outcome) like held messages and receipts; its output and result are Pi's history
  entry. After a daemon restart a running command's outcome is unknown.
- **A `!` typed while Pi is starting is held and runs once Pi is ready**; if the start
  fails or the command is taken back it is marked "ei ajettu" and never run later.
  Alternative: refuse `!` until Pi runs.
- **The preview** is Git's diff of a changed file or the first 40 lines / 8 KiB of a
  regular file, read as the person with no symlink or mount crossing. Binary files
  show no content.
- **The history entry of a finished command keeps its existing look** ("Sinä ·
  paikallinen komento"); only the live block uses the round's "Sinä · komento".
- **The field's focus ring is drawn on the box** that holds the field and its row,
  not on the textarea, so one ring surrounds both.
- **Stop in the composer stops one thing**: Pi's turn while it works, otherwise the
  running command, otherwise held messages (as the round's Rivillä shows one Stop).
