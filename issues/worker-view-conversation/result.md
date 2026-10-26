# Worker view — result

A Taskfleet worker opens in place of its parent conversation as Jari's
accepted Kehys with *Pääte keskustelussa*: the worker band (Worker · link back
to the parent · agent · profile · "Vain luku · kysy pääagentin kautta"), the
worker's own native conversation in production's conversation components
labelled *Pääagentti · tehtävä*, *Worker · välivastaus*, *Worker · vastaus*,
no composer, and the worker's terminal inside the conversation: a card under
the task while the history cannot be read, one row at the end once it can, and
the whole view on demand. A finished worker shows its result card instead.
Pi and Claude Code workers both work; screenshots (device scale 2) are in
`evidence/`: a Claude worker before its session exists, after it appears, and
landed, each at 1440 px light and 390 px dark.

## Host facts and where they come from

- **The worker's conversation.** Pi: Taskfleet's `node_transcripts` path,
  read as before (openat2 beneath home, no symlinks, own UID, session id and
  cwd must match), now decoded into history-contract entries. Claude Code:
  `~/.claude/projects/<worktree with every non-alphanumeric as ->/<uuid>.jsonl`,
  the most recently written session whose records all name that session and
  whose first working directory is the worktree; read from its last 8 MiB.
- **The brief.** `~/.taskfleet/runs/<run>/prompt.md` (own UID, no symlinks,
  ≤ 64 KiB, first 16000 bytes).
- **Profile** from `run show`'s `manifest.selection.profile`; **harness** and
  **awaiting_input** from `run list`/`run show`.
- **The terminal.** `run show`'s `attach.identity` (socket `tmux-<hash>.sock`
  in a `taskfleet` directory, window `@n`) as the browser shell's token, plus
  the workspace that holds the run's worktree. The terminal route re-finds the
  window itself; the token is only a pointer.
- Contract: `spinoffs.schema.json` runs gain `harness`, `profile`,
  `awaiting_input`, `terminal`, `terminal_workspace`, `brief`; transcripts
  carry `harness` and `entries` (`history.schema.json#/$defs/entry`, extracted
  from the history page) instead of flattened `messages`. Only the selected
  run (`?run=`) reads files; the list reads nothing new.

## Decisions for later review

- **Claude session found by worktree directory, not by Taskfleet.** Taskfleet
  records no Claude session (`support: unsupported`). The worktree path is the
  run's own, so the directory identifies the run. Alternative: wait for
  Taskfleet to record Claude sessions (a Taskfleet change). A person who opens
  their own `claude` in a worker's worktree would see that session in the
  worker view; accepted as unlikely.
- **Tool arguments inline, bounded at 8 KiB.** The main history keeps them
  behind block reads; the worker view has no block-read route, and the live
  event stream already carries arguments. Alternative: a worker block-read
  route, which would let long arguments and results load in full. Results are
  cut at 8 KiB, texts at 16 KiB, the whole transcript at 2 MiB encoded and 200
  entries, keeping the newest.
- **Claude Code tools mapped onto Pi's cards.** `Bash/Read/Write/Edit` become
  `bash/read/write/edit` with `file_path/old_string/new_string` renamed to
  `path/oldText/newText`; other tools keep their names and show as generic
  tool rows. Sidechains (Claude's own sub-agents) and meta records are not
  shown. One reply's content blocks, which Claude writes as separate records of
  the same message, are one entry, as Pi stores them.
- **The brief comes from Taskfleet's `prompt.md`**, an internal run file, not a
  CLI field. It is shown before history exists and when only the newest part
  of a long history is read; a complete history's first message is labelled
  the task instead, so it never shows twice.
- **The ask-through-the-main-agent notice is the band action (variant 3),
  opening a small popover** with the harness-dependent sentence (live Pi: the
  main agent can message it; live Claude: it cannot be messaged mid-work but
  the main agent sees its state; finished: the main agent has its report) and
  *Kysy pääkeskustelussa ›*, which returns to the parent. Round 2 noted that a
  title-only action is easy to miss; the popover makes it readable on a phone.
  It does not draft a question into the parent's composer.
- **Prompt waits** (`awaiting_input`) show a notice card that says the prompt
  is answered in the native terminal (`taskfleet run attach`), not by the main
  agent. The prompt text itself is not read (it exists only in the pane).
- **No issue field.** The band shows harness and profile; the run title stands
  for the task. Neither Taskfleet nor the contract carries an issue slug.
- **A worker outside `~/src`** (e.g. `~/Sources/fleetrepo`) has a conversation
  but no terminal: the browser shell only knows workspaces under `~/src`.
- **Pi transcripts over 8 MiB** stay unavailable, as before (Pi needs the
  header line); Claude sessions are read from their tail instead.
- **Claude project directory names over 200 characters** get a hash suffix in
  Claude Code that is not reproduced here, so such a worker shows only its
  terminal.
- **Polling stays at 3 s** for the selected run and re-reads and re-decodes the
  native file each time. No cache, per the native-truth rule.

## Verification

On Birch, Go under `umask 077`, short `TMPDIR` under `/var/tmp`:

- `go test ./internal/daemon` passed (whole package), plus new tests for the
  Claude decoder (grouping, sidechain/meta, tool results, Edit mapping,
  withheld thinking), confinement (other session, cwd outside the worktree,
  symlinked file and directory, foreign owner, sibling worktree), newest
  session, tail read, Pi inline arguments, the encoded-size bound, the
  terminal pointer and its own workspace, and the selected run's facts
  through the HTTP handler. A throwaway check decoded this run's own live
  Claude Code session (200 newest entries, bash/read/write tools).
- Contracts: `validate-contracts.py` valid, `check-generated.sh` clean.
- Web: `./scripts/test-focused.sh --area web` passed (778 tests), including a
  worker-view component test (brief and terminal card before history, the
  conversation after, a growing last reply, no composer).
- Browser: new `worker-view.spec.ts` (@worker-view @a11y) through the real
  gateway and daemon with a synthetic Claude worker; `spinoffs.spec.ts` (5)
  passed; one whole-suite `npm run test:browser`: 402 passed, 3 skipped
  (before the review fixes; the touched specs were rerun after them).
- Review: `/llm-review` (gpt-6-astra finder; the claude-fable-5-1 verifier
  call failed with no output) found four defects, all confirmed locally and
  fixed: the wire-size bound, a growing reply not redrawn, a recorded skill's
  description read from a transcript-named path, and a cross-repository
  worker's terminal asked through the parent's workspace.
- Not covered: a live Taskfleet tmux window in the browser host (the spec sees
  the terminal route's refusal; the watch itself is existing, tested code).
