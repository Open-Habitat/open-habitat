# Result: open a terminal-started conversation in the browser's terminal

Round 1, 28.10.2026 (overnight, the conductor's own commission). Prototype:
`issues/proto-open-in-terminal/prototypes/avaa-paatteessa/index.html`, with Jari's guide
in [NOTES.md](prototypes/avaa-paatteessa/NOTES.md).

## What the round shows

A conversation started over SSH in the person's own tmux (`work`, window 2) is read-only in
the browser because the terminal Pi writes it. Today the browser's footer says only
"Jatkaminen estetty: keskustelulla on aktiivinen kirjoittaja" (`web/src/app/HistoryView.tsx:1823`),
and once that Pi is closed the conversation still cannot be continued from the browser:
`continuationProof` requires the browser-origin marker that only browser-started children
write (`internal/daemon/continuation_linux.go:68`, `internal/daemon/held_linux.go:421`).

**Axis: how far the browser goes.** The content, sidebar, top bar (Käynnissä päätteessä ·
Vain luku) and the terminal dock (the chosen Paneeli) are the same in every direction. A
page control switches between three host situations: Pi running in tmux, Pi running in a
terminal without tmux, and Pi closed. A second control quits Pi "in the SSH terminal"
mid-view.

| Direction | Pi running in tmux | Pi closed | Pi without tmux |
| --- | --- | --- | --- |
| **Kerro** | Footer names the tmux session and window and offers `tmux attach -t work:2` to copy | Footer offers `cd ~/src/aurinkokello && pi --session 019a3c7e` to copy and a plain Avaa pääte | Says where it runs (`pts/4`) |
| **Katso** | Katso päätteessä opens a read-only mirror tab of the tmux window; keys are refused with a visible note | Avaa päätteessä opens a browser shell with the resume command typed at the prompt; the person presses Enter | Button disabled, reason given |
| **Jatka** | Jatka päätteessä attaches the dock to the same tmux window as a second client; typing goes to Pi, and the message appears in the history above | Jatka päätteessä starts `pi --session` in a new browser shell right away; the footer becomes "Käynnissä selaimen päätteessä" | Button disabled; says to close Pi there and continue here |

Checked by `prototypes/avaa-paatteessa/verify.mjs`: the file is rebuilt, and every direction
is run at 1440 and 390 px in light and dark, through all three situations and the quit. It
checks the interactions, the read-only refusal, the disabled states, overflow and the
picker, with no console errors and no network requests. It passed: 12 passes and 40
screenshots, kept in `evidence/` as AVIF.

## Host facts each direction needs

| Fact | Exists? | Where, or what is missing | Needed by |
| --- | --- | --- | --- |
| A terminal Pi is writing this conversation | Yes | Writer census `piWriter` (`internal/daemon/pi_writer_linux.go:37`), batch form in the snapshot sets `process: terminal_observed_live` (`internal/daemon/snapshot_linux.go:414`); the history view gets `writer_present` (`web/src/app/HistoryView.tsx:1488`) | All |
| That writer's PID | No | `inspectOwnedPi` (`pi_writer_linux.go:118`) finds the process from a pinned `/proc` directory but returns only a verdict. It would also have to return the PID, still under the same-UID checks | All |
| Its tmux socket and pane | No | `TMUX` (socket path, server PID, session) and `TMUX_PANE` (`%12`) in `/proc/<pid>/environ` of the same-UID process, read from the same pinned directory. This works for anyone who runs Pi in tmux. The research report's `@agent-session` pane option is a dotfiles convention and is not needed | All (Kerro shows it) |
| tty when not in tmux | No | `/proc/<pid>/fd/0` link or `stat` tty field; display only | Kerro (nice to have) |
| Reaching the person's tmux server | **No, blocked today** | The daemon runs with `PrivateTmp=yes` (`systemd/open-habitat-daemon@.service:14`), so the default socket `/tmp/tmux-<uid>/default` is not visible to it. Candidate route: `/proc/<server-pid>/root/tmp/tmux-<uid>/default`. On Birch (tmux 3.4) this was checked within one mount namespace only. Crossing the daemon's PrivateTmp is **unverified** and needs a test in the real unit. Sockets under `$XDG_RUNTIME_DIR` (`TMUX_TMPDIR`) are visible already, as Taskfleet's are | Kerro (for the `work:2` name), Katso, Jatka |
| Session:window name and attached clients | After the socket | `display-message -p -t %12 '#{session_name}:#{window_index} #{session_attached}'`; a pane ID is accepted as a session target (verified on tmux 3.4) | Kerro, Katso, Jatka |
| Read-only mirror of a foreign tmux window | Yes, for Taskfleet | `terminalHost.watch` redraws a window with `capture-pane` and never attaches (`internal/daemon/terminal_linux.go:934`); the dock has `TerminalTab.readOnly` (`web/src/components/TerminalPanel.tsx:26`). A new target kind is needed, named by the conversation's agent ID; the daemon resolves the pane itself, and the browser never sends a socket or pane | Katso |
| Interactive attach to the person's own tmux | No | `serve` attaches only on the product server (`terminal_linux.go:823`). Attaching to a foreign server is new. tmux then sizes the window to the latest active client (`window-size latest`), so a phone narrows the SSH view | Jatka (running) |
| A browser shell that starts a command | No | The endpoint takes only `shell=new` or a number (`terminal_linux.go:613`). It would need e.g. `resume=pi:<id>`: the daemon resolves the session path and cwd from native history and runs `pi --session <path>` in a new product tmux session in that workspace. `pi --session <path\|id>` is in Pi's CLI | Jatka (closed), Katso (closed, with `send-keys -l` instead of running) |
| Continuing in the browser composer | No, by rule | A terminal history alone cannot grant browser control (`continuation_linux.go:68`). The browser-shell route keeps that rule: the person runs native Pi themselves, and the conversation stays read-only in the browser while that Pi writes it | — |

## Recommendation

**Katso**, but with the closed case taken from **Jatka**: when Pi is closed, start
`pi --session` in a new browser shell at once.

- Watching reuses the Taskfleet watch path almost unchanged (`capture-pane`, no client, no
  size changes, no keys) and gives the phone what it most lacks: seeing what the terminal
  Pi is doing. It never types into a session someone may be using over SSH at that moment.
- Attaching interactively (Jatka while running) has two real costs. Window sizing moves
  between the SSH client and the phone. Two people's keystrokes, or one person's on two
  devices, also land in the same Pi editor. Taskfleet windows are read-only for the same
  kind of reason.
- For a closed conversation, typing the command and waiting for Enter (Katso) adds a step
  without adding safety. The command only reopens the person's own conversation in their
  own workspace. Starting it directly is the honest "Jatka".
- All of it depends on reaching the tmux socket across PrivateTmp, which has to be proved
  first. If it fails, Kerro's text (session name from `TMUX`, no live mirror) plus the
  closed-case Jatka still work, because neither needs the foreign socket. The closed-case
  resume needs only the browser shell and native history.

A sensible implementation order: (1) PID and environ from the census, and Kerro's footer
text; (2) `resume=` for closed conversations; (3) the socket proof, then the mirror.

## Decisions for later review

1. **Find the pane from the process environment, not from `@agent-session`.**
   Alternatives: Jari's `tmux-agent-session` pane option, or asking Pi upstream to record
   it. Why: the environment works for anyone who runs Pi in tmux and needs no extension.
   It is read only for processes of the daemon's own UID, as the census already does.
2. **Pi without tmux: show only, offer no action.** Alternative: offer to stop that Pi
   (signal it) so the browser can continue. Rejected: it would end a process someone may
   be typing into.
3. **A closed terminal conversation continues as native Pi in a browser shell, not under
   browser control.** Alternative: let the browser take control of terminal histories once
   no writer is observed. Rejected here: that changes the ownership rule recorded for
   continuation, which is an architecture decision for Jari.
4. **Jatka attaches to the person's own tmux as a second client.** This is not a new
   authority between people: the daemon is the same Unix user, and the browser shell can
   already run `tmux attach` itself once the socket is visible. It is a product choice
   with the sizing and shared-typing costs above. Taskfleet's windows stay read-only.
5. **Reaching a socket through `/proc/<pid>/root` crosses the daemon's own systemd
   sandbox (PrivateTmp), not a person boundary.** If Jari would rather keep the daemon
   strictly inside its sandbox, the alternative is to ask people to set
   `TMUX_TMPDIR=$XDG_RUNTIME_DIR` (the daemon sees `/run/user/<uid>`), or to stay with
   Kerro. Worth an explicit yes/no before implementation.
6. **The mirror and attach are offered only when the writer's cwd is inside the
   conversation's workspace**, the same scope rule as Taskfleet windows
   (`taskfleetWindows`, `terminal_linux.go:426`).

## Questions for Jari

- Which direction (or the recommended mix)?
- Do you use tmux on Birch's SSH sessions? If not, only the closed-case resume helps you
  today.
- Is crossing the daemon's PrivateTmp to reach your tmux acceptable (decision 5)?
