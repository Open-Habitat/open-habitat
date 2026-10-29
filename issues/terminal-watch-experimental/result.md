# Result: read-only mirror of a terminal Pi's tmux pane (Katso)

Behind *Päätteen Pi:n katselu* (Asetukset › Kokeelliset ominaisuudet), off by
default. When it is on and a terminal-started conversation's Pi runs in the
person's own tmux, the read-only footer says in one sentence where it runs
("Pi kirjoittaa tähän tmux-ikkunassa `work:2`.") and offers **Katso
päätteessä**. That opens a read-only tab in the terminal panel. Without tmux the
footer says only "Pi kirjoittaa tähän päätteessä." and offers no button. With
the switch off, nothing changes and the writer route is never asked.

## Socket proof (done first, as the specification required)

On the test server (`open-habitat-test-nbg1`, tmux 3.4, systemd 255, kernel
6.8) a tmux server was started as `maintainer` in the host mount namespace.
The daemon's own mount namespace (`nsenter` into the running
`open-habitat-daemon@maintainer`, PrivateTmp: its `/tmp` was empty) and a
fresh `systemd-run` with the unit's sandbox (`User=`, `NoNewPrivileges=yes`,
`ProtectSystem=full`, `PrivateTmp=yes`, `UMask=0077`) both ran
`tmux -S /proc/<pane-pid>/root/tmp/tmux-<uid>/<socket> display-message` and
`capture-pane` with exit 0. The same check passed on Birch. The sandbox was not
widened.

## What the implementation does

- `GET /api/v1/workspaces/terminals/writer?workspace_id=&conversation=` (gateway
  and daemon) answers `place: tmux|terminal|none`, plus the tmux session,
  window index and window name for `tmux`. It carries no path, socket, pane or
  PID.
- The WebSocket takes `&conversation=<id>` as a third target kind. The daemon
  then finds everything itself again: the history, its Pi, that Pi's `TMUX`
  and `TMUX_PANE`, and the socket through `/proc/<pid>/root`. It checks that
  the socket is the daemon UID's, that the Pi descends from the pane's process,
  and that the process is still the same (start time). The view is the
  Taskfleet `capture-pane` redraw of that pane: no client, no keys, no resize.
  It ends when that Pi process ends.
- Scope: both the conversation's and the Pi's directories are inside the
  workspace or its worktrees, the same rule as Taskfleet windows.

## Decisions for later review

1. **Naming the writer without a descriptor.** Pi 1.3 appends to its session
   with `appendFileSync` (it never keeps the file open) and sets
   `process.title = "pi"`, which overwrites `--session <path>` in
   `/proc/<pid>/cmdline`. The existing census therefore almost never proves which
   conversation a terminal Pi writes; in practice it says *unknown*. The
   prototype's "writer's PID from the census" assumed otherwise.
   Chosen: a Pi holding the file or naming it is the writer. Otherwise the
   writer is the only Pi (not a daemon child) working in the conversation's
   directory, if the conversation changed after that Pi started and no other
   conversation in the directory has changed since. Anything less certain
   answers `none`.
   Alternatives: Jari's `@agent-session` pane option (dotfiles-only), a Pi
   extension or upstream change recording the session (not available), or
   offering the mirror of any Pi in the directory (it would mirror the wrong Pi
   for older conversations).
   Conversations written by the daemon's own browser Pi children do not count
   as "another conversation".
   Cost: a resumed conversation is named only after its Pi writes to it, and a
   `/new` inside the same Pi makes both conversations unnamed. One case is
   **misnamed**, and the independent review confirmed it: Pi A sits idle in the
   directory, a second Pi B writes conversation X there and exits, and X is
   then named as A's, so Katso shows A's pane. Nothing the host can observe
   tells the two apart. The alternative was to mirror only on descriptor or
   argv proof, which in practice means never. Because the view is read-only and
   shows the person's own Pi, I kept the rule. The write fence (`piWriter`) is
   unchanged; this naming is only for showing a pane.
   Within the same Pi, a `/new` or `/resume` ends an open view once Pi writes
   the other conversation: the view repeats the census every five seconds.
2. **The mirror shows Pi's pane, not the whole window, and ends with Pi.** The
   prototype kept the mirror on the shell prompt after Pi quit. The daemon's
   route to the socket goes through Pi's own `/proc` entry, and after Pi exits
   the pane is no longer this conversation's. Alternative: keep watching the
   window through the tmux server's PID. Rejected because it would show an
   arbitrary shell under the conversation's name.
3. **A Pi in tmux whose pane cannot be proven reads as `terminal`.** This covers
   a socket that is not the daemon UID's, a forged or stale `TMUX_PANE`, or a
   socket path too long for a Unix address. The footer then says only that Pi
   runs in a terminal.
4. **Out of scope:** the prototype recommendation's closed-case resume (start
   `pi --session` in a browser shell). The issue asks only for Katso while Pi
   runs; resume needs its own `resume=` endpoint.
5. **Wording.** Jari's quoted three sentences became one: "Pi kirjoittaa tähän
   tmux-ikkunassa `work:2`." The tab tooltip says "tmux work · vain luku", and
   its × says "Irrota: Pi jatkaa tmuxissa".

## Tests

- `internal/daemon/terminal_writer_linux_test.go`: the naming rules with real
  `exec -a pi` processes (start time against changes, another conversation, two
  Pis, an own child, a descriptor holder, a non-Pi holder), forged `TMUX`
  values, and the whole path on a real tmux server. That run checks the
  answer's names and that it carries no socket, pane or PID, the out-of-scope
  conversation, ready, the pane content, that typed bytes are not echoed in the
  pane, no resize, no client, the end with Pi, the end when Pi switches to another
  conversation, and a pane the Pi is not in.
- `internal/gateway/terminal_linux_test.go`: the writer query shape, the
  conversation WebSocket target and its refusals.
- `web/src/app/terminals.test.ts`: the URL and the validation of the writer
  answer.
- `web/tests/terminal-watch.spec.ts` (`@terminal-watch`): switch off means no
  button and no writer request; switch on means button, read-only tab, pane
  text and typing not shown. Switching off in Settings over the open view ends
  the mirror, and Pi's end closes the panel and the offer.

## Review

The review was an independent `/llm-review` (finder GPT-6 Astra, verifier
Claude Fable 5.1) followed by `/assess-findings`. Three findings were fixed: the
view followed Pi into another conversation, switching the experiment off did
not end an open view, and the ancestry and lifetime reads did not check the
process owner. The misnaming in decision 1 was kept, with its reason.
