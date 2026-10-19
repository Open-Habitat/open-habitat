# Result: composer commands, completion and file picker

Research and one prototype round, 2026-10-19 (taskfleet run `01m59m76bagfp93gs1mchrev11`).
Nothing here changes production code. The round is in
`design-system/prototypes/rounds/2026-10-19-kentan-lisat/`, and its screenshots are in
`shots/` next to this file.

## Feasibility

### What the pinned Pi offers

The daemon pins `@earendil-works/pi-coding-agent` **1.3.0**
(`internal/daemon/pi_runtime_linux.go` refuses any other manifest version;
`internal/daemon/pi-device-test/package.json`). The sources below are that package's
`docs/` and `dist/`. I checked the behaviour by running the same bundle in RPC mode with a
disposable home: `HOME=$(mktemp -d /var/tmp/oh-pi-XXXX)/home`, a throwaway git workspace,
one user skill and one project prompt template, `--no-session`, and no credentials.

**Command list: `get_commands`.** (`docs/rpc-commands.md` "Discoverable commands";
`dist/modes/rpc/rpc-mode.js:540`.) It returns `{ name, description, source, sourceInfo }`
for three kinds:

- `extension`: commands registered with `pi.registerCommand()`. The built-ins `llama` and
  `mcp` are always present, and so is the daemon's own `oh-conversation-recap`, which the
  daemon already looks for in `recap_linux.go`;
- `prompt`: prompt templates;
- `skill`: skills, named `skill:<name>`.

`sourceInfo` carries `path`, `source` (`builtin`/`auto`/`local`/`cli`), `scope`
(`user`/`project`/`temporary`) and `origin`. The live run returned exactly
`llama`, `mcp` and `skill:demo-skill` (scope `user`, source `auto`).

The project template in `<ws>/.pi/prompts/` did **not** appear. Pi loads project
resources only after the project is trusted (`docs/prompt-templates.md`: "Project
configuration loads only after project trust is granted"). The list is therefore
already filtered by Pi's own trust decision, which is the native truth we should show.

Pi's built-in TUI commands (`/model`, `/new`, `/compact`, `/tree`, `/settings`…) are
**not** in the list. The docs say so ("handled only in interactive mode and would not
execute if sent via `prompt`"). Several of them have separate RPC calls (`new_session`,
`compact`, `set_model`, `fork`, `export_html`), and the browser already covers some of
them with its own UI (model picker, new conversation).

There is **no executability field.** The browser has to decide for itself whether a
command can run from it.

**Running a command: through `prompt`, and only at the start of a message.**
`agent-session.js:1595–1650`: when the text starts with `/`, Pi first tries
`_tryExecuteExtensionCommand`. Extension commands run immediately, even while Pi is
working, and the reply's `disposition` is `"handled"`. After that, `_expandSkillCommand`
(`if (!text.startsWith("/skill:")) return text`) and `expandPromptTemplate`
(`if (!text.startsWith("/")) return text`) expand skills and templates. A `/name` in the
middle of a sentence is plain text that the model reads as a mention. Claude Code
behaves the same way (below).

So: **inserting** a command is a text operation, and **running** it means sending a message
that starts with it. The daemon's send path forwards the text to `prompt` unchanged, and no
code filters a leading `/`. Skills and templates therefore already work from today's
browser if you type them in full.

Extension commands that open Pi's own dialogs (`/mcp`, `/llama`) would send
extension-UI requests over RPC (`docs/rpc-extension-ui.md`), and the daemon does not
serve those. For now the browser should show them as "only in Pi's terminal" rather than
offer to run them.

**`!` and `!!` in Pi's TUI.** (`docs/usage.md` "Run a terminal command";
`dist/modes/interactive/interactive-mode.js:2472, 2689–2700, 5869–5935`.)

- An editor whose text starts with `!` switches to bash mode, which only changes the
  border colour (`isBashMode`, `updateEditorBorderColor`). The `!` stays in the text.
- On submit, `!cmd` runs with `excludeFromContext = false` and `!!cmd` with `true`. If a
  command is already running, the TUI refuses with "A bash command is already running.
  Press Esc to cancel it first."
- The command runs as a `user_bash` event, which extensions may intercept, and then
  through `session.executeBash` in the session's cwd. Output streams into a
  `BashExecutionComponent` in the transcript. While the agent is streaming, the
  component waits in the pending area.
- `recordBashResult` stores a `bashExecution` message: `command`, `output`, `exitCode`,
  `cancelled`, `truncated`, `fullOutputPath`, `excludeFromContext`. While Pi is
  streaming, Pi queues the message and appends it at `agent_end`, "to avoid breaking
  tool_use/tool_result ordering".
- **Output reaches the model only on the next prompt**, as a user message
  ``Ran `cmd` ``` + fenced output (`docs/rpc-commands.md` "How bash results reach the
  LLM"). The command does not start a model turn by itself. With `!!`, the output is
  stored in the session but never sent to the model.
- Output is truncated to the last 50 KB / 2000 lines (`DEFAULT_MAX_BYTES`, `truncateTail`),
  with the full log in `fullOutputPath` under the temp directory.

**The same over RPC: `bash` and `abort_bash`.** These are the RPC equivalents of the
TUI path. The live run showed:

```
[2.51] {"type":"bash_execution_update","id":"b1","delta":"out1\n"}
[2.70] {"id":"s1","type":"response","command":"get_state",...}   ← answered while b1 runs
[4.52] {"id":"b1","type":"response","command":"bash","success":true,"data":{"output":"out1\nout2\n","exitCode":3,"cancelled":false,"truncated":false}}
[6.50] {"id":"a1","type":"response","command":"abort_bash","success":true}
[6.50] {"id":"b2","type":"response","command":"bash","success":true,"data":{"output":"","cancelled":true,"truncated":false}}
[8.00] get_messages → two bashExecution messages; the second has "excludeFromContext":true
[8.50] prompt "!ls" → rejected for missing API key: over RPC `!` is just text sent to the model
```

The run established the following:

- streaming output is correlated by request id;
- the `bash` response arrives only when the command ends;
- **other commands are answered while bash runs**, because the JSONL reader does not await
  the handler (`rpc/jsonl.js`, `rpc-mode.js:627`);
- `abort_bash` cancels every running bash (`_bashAbortControllers` is a set);
- `!` and `!!` are TUI syntax, so a browser has to call `bash` itself.

One thing was not verified live: how `bash` interleaves with a model turn that is
already streaming. That would need a model credential, which this run deliberately
did not use. The code path (`recordBashResult` → `_pendingBashMessages`, flushed at
`agent_end`) is the evidence.

**The daemon already reads the result.** It renders a `bashExecution` history entry
(`history_blocks_linux.go:153`), shown as "Sinä · paikallinen komento" with "ei mallin
kontekstissa" and the exit code (`web/src/app/HistoryView.tsx:862`). It also turns
`bash_execution_update` events into journal `bash.output` deltas
(`pi_events_linux.go:65`, `web/src/app/conversationEvents.ts:301`). A command the
person ran with `!` in a terminal Pi already shows up correctly in the browser.

**File completion in Pi's TUI.** (`docs/usage.md`: "Type `@` to search for a file",
"Press `Tab` to complete a path"; `pi-tui/dist/autocomplete.js:123–160, 600–640`.) Pi
runs `fd --base-directory <cwd> --max-results 100 --type f --type d --follow --hidden
--exclude .git`, so it respects `.gitignore` and **follows symlinks**, and then scores
fuzzily. The result is inserted as text (`@path`, quoted when it contains separators).
Pi does **not** expand `@path` into file contents in the editor; the model reads the
file with its own tools. (Only the CLI's `@file` arguments embed content, and RPC mode
rejects them, per `docs/cli.md`.) A browser `@` completion therefore inserts text and
nothing more, as Pi does.

### Claude Code, for comparison

From `https://code.claude.com/docs/en/interactive-mode` (fetched 2026-10-19), sections
"Quick commands", "Commands", "Complete a command mid-prompt" and "Shell mode with `!`
prefix":

- **`!` shell mode** "Adds the command and its output to the conversation context …
  and have Claude respond to it". It shows live output and supports `Ctrl+B` to move a
  long command to the background. `Tab` completes from earlier `!` commands, and a token
  containing `/` gets live path completion. Escape, Backspace or `Ctrl+U` on an empty
  prompt leaves the mode. Pasting `!…` into an empty prompt enters it. Commands typed
  in shell mode run outside the sandbox. The main difference from Pi is that in Claude
  Code the model *responds* to the output. In Pi the output only joins the next
  prompt's context.
- **`/` menu** lists built-in commands, skills, plugin commands and MCP prompts. It
  completes mid-prompt too, but "only commands whose names start with those letters
  match, so a file path such as `/tmp/notes.md` doesn't keep a list open", and "Claude
  Code runs a command itself only when the command starts your message". In fullscreen,
  "the matches open as a list while you type, with no row highlighted, so `Enter` still
  sends your prompt as typed". `Tab` inserts the top match.
- **`@` mentions** trigger file path autocomplete. The list responds to the mouse in
  fullscreen.
- `Ctrl+R` searches prompt history, and `Ctrl+S` stashes the draft.

Both TUIs agree on three points. Typed sigils open the completion at the caret. Running
a command needs it at the start of the message. And the file reference is inserted as text.

### What the daemon would have to add

The rules this must stay within (`AGENTS.md`, `internal/AGENTS.md`): the daemon runs as
the person; the gateway gains no authority; no new stores or caches; reading never
starts Pi; the browser names workspaces by ID, never by path; and native error text never
crosses the contract.

**1. Command list for `/`.** The daemon already calls `get_commands` (for the recap).
A read endpoint would return `{name, description, source, scope}` without
`sourceInfo.path` (the browser does not need home paths) and filter out the
`oh-conversation-recap` command. The obstacle is that **reading never starts Pi**, and a
new conversation has no Pi yet, which is exactly when someone types `/`. There are three
ways to handle that:

- (a) complete only when the conversation's Pi is running. The list would then be empty
  in new or idle conversations, and nothing explains the gap.
- (b) re-implement Pi's skill, template and trust discovery in Go. That is a second truth
  that drifts from Pi's, so it is rejected.
- (c) a short-lived **list-only Pi helper**: `pi --mode rpc --no-session` in the
  workspace, as the person, asked `get_commands` and killed. It starts no conversation,
  writes no session, and the title helper (`title_linux.go`) is a precedent.

I recommend (c) for a conversation without a running Pi and the running Pi otherwise.
It does touch the "reading never starts Pi" rule, so it is **Jari's decision**.
The helper costs about one second (the live run's first reply came at 1.5 s).

**2. File list for `@` and the picker.** This is a new daemon read for one workspace,
named by workspace ID and optional worktree token. Run as the person:
`git -C <ws> ls-files -z --cached --others --exclude-standard`. Tracked files plus
untracked ones that are not ignored is the same set that tmux-file-picker's `fd` sees
and that Pi's `fd` sees, but without needing `fd` installed. Add `git status
--porcelain=v1 -z` to mark changed files and put them first, which is the tmux
`--git` mode. If the directory is not a git repository, fall back to a bounded Go walk.
The walk opens directories without following symlinks and skips `.git` and dot
directories.

Limits:

- at most ~20 000 paths read and ~200 returned per query, matched in the daemon so that a
  monorepo does not ship its whole tree;
- paths relative to the workspace root and capped at 1 KB each;
- a timeout of ~2 s, reported as "not available" and never as an empty list;
- no file contents.

Ponnahdus's preview would read the first ~40 lines of one file, or `git diff` for a
changed one, through the same workspace resolution. That is the same authority the
workspace git detail view already has (`workspace_git_detail_linux.go`).

The daemon keeps no cache and rebuilds the list on each query. `git ls-files` on a
20 000-file tree takes tens of milliseconds, so a cache would need a measured problem
first. Unlike Pi's `fd --follow`, symlinks are not followed outside the workspace.

**3. Running `!`.** I recommend that **Pi runs it, not the daemon.** The daemon would send
RPC `bash {id, command, excludeFromContext}` and `abort_bash`, and relay
`bash_execution_update`, which it already turns into journal `bash.output`.

Reasons:

- the result is Pi's own `bashExecution` message in Pi's session file, which the
  history reader already renders, so no second record is created;
- Pi decides when the output joins the model context, including the deferral while Pi is
  working;
- a terminal Pi on the same session sees the same entry;
- Pi's `user_bash` extension hook keeps working;
- it adds no new process owner to the daemon.

A command typed in the browser runs as the person, in the conversation's cwd, with the
same authority as Pi's own bash tool. The browser can already ask Pi to run any command,
so this is no new authority. It is still a new *direct* command surface, so it counts
as an architecture decision, and **Jari decides it**.

Implementation consequences to keep in mind:

- `piRPC.requestQueue` holds its mutex until it gets the correlated reply and poisons the
  channel on any other frame. A long `bash` reply would block every send and Stop. `bash`
  therefore needs a separate pending-reply path, where the write is acknowledged at once
  and the final reply is routed by id. That is the main daemon change.
- One command at a time per conversation, as in the TUI. Stop maps to `abort_bash`, which
  cancels all running commands. Stop is explicit, and nothing is repeated
  automatically: an uncertain reply means "result unknown", consistent with
  `internal/AGENTS.md`.
- `!` is a write, so it starts Pi when needed after the ownership proof, exactly as a send
  does.
- Output in the contract is the live delta stream plus the stored result. The stored
  result is truncated by Pi at 50 KB; `fullOutputPath` is a temp path and stays out of
  the contract.
- Long-running commands such as servers or watchers belong in the **processes tray**.
  That is the `@aliou/pi-processes` extension, which the agent drives through its
  `process` tool and which the tray reads. A `!` command lives inside Pi's process and
  dies with it or with Stop. The prototype shows a hint after a few seconds: ask Pi to
  start it as a process. We do not build a "move to background" of our own (Claude
  Code's `Ctrl+B`); if Pi gains one, we adopt it.

Running `!` with the daemon as the process owner instead (`exec` as the person in the
workspace, with output in the event journal) would work without Pi, but it fails the
"no new stores" rule. The output would then exist only in the daemon's journal or in a
new store, the model would never see it, and the terminal Pi would not know about it.
I rejected that option.

**4. Gateway.** No change. The new reads and the `bash` write are ordinary per-request
proxied daemon routes with the existing CSRF and write checks.

### Related open work

`research-shell-editor` (a browser shell and file editor) overlaps with `!` and with
file preview. The `!` design here is deliberately a one-line command whose output goes
into the conversation, not a terminal. If the browser shell research lands on a real PTY
(ttyd, VS Code web), interactive and long-running commands go there, and `!` stays the
"show Pi this output" path.

## Prototype round: Kentän lisät

The round is in `design-system/prototypes/rounds/2026-10-19-kentan-lisat/` and is built with
`node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-19-kentan-lisat`.
It extends the chosen composer (`lib/composer.js`) without touching `lib/`: the round
listens on the same field, intercepts keys before the composer's Enter handler and adds
its own pieces around the field.

The content is the same in all three directions:

- a Pi `get_commands` list (four skills, three templates, `mcp` and `llama` shown as
  "only in Pi's terminal") plus two browser actions, `/uusi` and `/malli`;
- the aurinkokello workspace as `git ls-files` lists it, with two modified files and one
  untracked file first;
- canned `!` outputs: `git status`, `git diff --stat`, `ls`, `pytest -q` (exit 1),
  `python3 scripts/status_rows.py --since 2026-10-06`, and `make serve`, which never ends.

The page bar says what to try.

**Axis: where you choose.** It is a question of where choosing happens: at the caret, in
a summoned window, or from visible controls. All three directions cover `!`, `/`, `@`
and Ctrl/⌘+P, and all three keep the field a plain `<textarea>`, so IME and ordinary
editing still work. Insertions go through `execCommand('insertText')`, so Ctrl+Z undoes
them like typing. Key handling skips composition (`isComposing`). Escape closes only the
list and leaves the text alone.

| # | Direction | Where you choose | `!` | When it's the right choice | Its cost |
|---|---|---|---|---|---|
| 1 | **Kursorissa** | A small list just above the caret, opened by typed `/` or `@`. Ctrl/⌘+P opens the same list without an `@`, and what you type next filters it. | As in Pi: the `!` stays in the text, and the field gets a tint and a label row ("Komento työtilassa …", "Pi näkee tulosteen"). `!!` = only for you. The field clears after a run. | The same muscle memory as Pi's and Claude Code's TUIs. Least chrome and the most text-like. | Nothing visible tells a new user that `!`, `/` and `@` exist. On a phone, the symbols sit deep in the keyboard. |
| 2 | **Ponnahdus** | Ctrl/⌘+P, or a typed `/` or `@`, opens a palette over the conversation, like tmux's popup for `prefix C-f`. It has its own search field, tabs (Muutetut, Tiedostot, Komennot), a preview (diff for changed files, file head, command source and what running does), and fzf-style multi-select with Tab. Esc returns to the field at the same caret. | `!` is consumed, and the field becomes a prompt: `$` sigil, sunken background, a "Pi näkee tulosteen / Vain sinulle" chip. Typing `!!` (the `!` right after the entering one) flips it, as in Pi; a later `!` is ordinary text. The mode stays on across runs until Backspace in an empty field. Output reads as a terminal transcript. | Closest to Jari's tmux picker. Picking several files with a look at the diff is the strongest file workflow. | It takes over the screen even for a one-word completion and pulls focus out of the field. On a phone it becomes a full-screen sheet without the preview. |
| 3 | **Painikkeet** | A row inside the field: Komento (toggle), Komennot and Tiedosto open a menu above the field with its own search. Typed `!`, `/` and `@` still work as shortcuts. | Explicit toggle, plus a "Pi näkee tulosteen" checkbox in the row; typed `!`/`!!` in an empty field set the same. The mode stays on across runs until toggled off or Backspace in an empty field. | Discoverable on a phone and for anyone who has not used a TUI. Every action is visible and touchable. | A permanent row of chrome in the composer, which the composer rounds otherwise kept bare ("Pikanäppäinohjetta ei ole"). |

The parts all three share are what the research says is true of Pi:

- the `!` block ("Sinä · komento") streams output, has its own **Pysäytä** button (Esc in
  the field also stops), and shows the exit code;
- the block says when Pi will see the output: "with your next message; the command alone
  does not start a reply". `!!` says "not in Pi's context". If Pi is working, the block
  says the output is attached after the turn;
- a second `!` while one runs is refused, as in Pi;
- `make serve` shows, after a few seconds, a hint to ask Pi for a process if the job
  should keep running (processes tray);
- a `/` command is inserted, not run, and runs only when the message starts with it;
- mid-line `/` opens with no row highlighted, so Enter still sends the text as written,
  and the list says the command is only a mention there;
- `/mcp` and `/llama` are listed but marked "vain Pi:n päätteessä";
- browser actions (`/uusi`, `/malli`) run at once and are labelled so;
- files are inserted as `@path` in a message, and shell-quoted without `@` in command mode,
  as `tmux-file-picker` does with a non-agent pane.

**What the views assume from the host:** a per-conversation command list
`{name, description, source, scope}`, a per-workspace file list with git marks
(Ponnahdus also needs a bounded preview: file head or `git diff` for one path), a `bash`
write with a streamed `bash.output` and a stop. All of this is under "What the daemon
would have to add" above.

**Checks.** `check.mjs` ran every direction in light, dark and phone with the live turn
settled, and the console was clean. The round's own `shots.mjs` types through the key
states, because `check.mjs` only clicks: 50 screenshots, console clean. `shots/` holds a
selection of 18 of them; regenerate all with `node rounds/2026-10-19-kentan-lisat/shots.mjs
dist/2026-10-19-kentan-lisat.html --out dist/shots` from `design-system/prototypes/`. Naming is
`<mode>-v<direction>-<state>`; states 1–9 are `/` at the start, `/` mid-line, `@`, Ctrl+P,
command mode, a finished `pytest -q`, a long-running `make serve`, `!!`, and the
Painikkeet menu.

### Recommendation

**Kursorissa** as the base, with the picker key opening **Ponnahdus's palette**.

The composer rounds so far chose a bare field. Jari, the main user, types at a keyboard,
and both TUIs he uses work exactly like Kursorissa, so typed `/` and `@` should complete
in place without taking over the screen. The one place where a window earns its cost is
the deliberate "pick some files" moment, which is what `prefix C-f` is for. There the
palette's diff preview and multi-select are worth the overlay.

For `!` I recommend Kursorissa's Pi way: the `!` stays in the text, and `!!` hides the
output from Pi. Pi's TUI behaves the same way, so a session moved between terminal and
browser stays consistent.

Painikkeet is the better choice only if phone use or people new to TUIs become the
priority. Its row could be added later as a phone-only affordance.

If Jari wants the combination, the next step is a riff round on it.

### What Jari decides

1. **Direction:** Kursorissa, Ponnahdus, Painikkeet, or the recommended combination.
2. **Architecture: who runs `!`.** The recommendation is that Pi runs it through RPC
   `bash`/`abort_bash`, with the daemon only relaying (Feasibility §3). That is a new
   direct command surface in the browser, though not new authority. The rejected
   alternative is the daemon running it as the person.
3. **Architecture: the command list when Pi is not running.** The recommendation is a
   short-lived list-only Pi helper (Feasibility §1). It bends "reading never starts Pi"
   for a `--no-session` helper that starts no conversation.

## Decisions for later review

- **Picker key Ctrl/⌘+P**, not Ctrl+F. Ctrl+F is the browser's find, which people use to
  search a conversation, and on macOS Ctrl+F also moves the cursor in text fields. Ctrl/⌘+P
  is VS Code's "go to file". The key overrides print only while the page has focus.
  Alternatives were Ctrl+F (the tmux habit) and a two-key chord; I chose Ctrl/⌘+P for the
  smallest collision.
- **Mid-line `/` opens with nothing highlighted** (Claude Code's fullscreen behaviour), so
  Enter sends. Tab inserts the top match. The alternative, highlighting the first row as
  Pi's TUI does, would let Enter swallow a sentence ending in a path or a fraction.
- **Extension commands that need Pi's TUI are listed but disabled with a reason**, not
  hidden. The command list has no executability field, so this needs a small
  allowlist/denylist in the daemon or the browser. Hiding them would make the list differ
  from Pi's without saying why.
- **Browser actions in the `/` list** (`/uusi`, `/malli`) run immediately and are marked
  "Selain". This shows the insert/run distinction concretely. Leaving them out is a
  reasonable simplification.
- **File list = `git ls-files --cached --others --exclude-standard`**, files only and no
  directories, changed files first. Symlinks are not followed, and there are no contents
  except Ponnahdus's bounded preview. Pi's own completion uses `fd --follow` and includes
  directories; the daemon should not follow links out of the workspace.
- **`!` output does not trigger a Pi reply.** That is Pi's semantics, and the block says
  so. Claude Code's opposite behaviour (the model responds) would need a follow-up prompt
  the daemon composes, which is a product choice for later.
- **One `!` at a time per conversation, Esc stops.** This matches Pi's TUI. RPC would
  allow several, but `abort_bash` stops all of them.
- **No background mode of our own for `!`.** Long jobs belong in the processes tray via
  Pi's `process` tool. A hint says so.
- **`@path` is inserted as text.** Pi reads the file itself, and the browser attaches no
  content.
- **In command mode the picker inserts shell-quoted paths without `@`**, as
  `tmux-file-picker` does for non-agent panes.

