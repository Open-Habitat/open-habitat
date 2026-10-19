# Result: browser shell prototype round

**Prototype:** https://glasspad.example.test/p/cmhidxxvqklr5f6e4vmi7zil4e/

The round lives in `design-system/prototypes/rounds/2026-10-19-selainpaate/`. Build it with
`node build.mjs rounds/2026-10-19-selainpaate` in `design-system/prototypes/`. Keys 1–3
switch direction. Screenshots of the key states are in [shots/](shots/). `check.mjs` passes
in light, dark and phone with a clean console.

`research-shell-editor` has not landed its `report.md` on main. The feasibility and
security facts below are therefore **assumptions**, each named where it is used. Nothing
was measured on a host in this round.

## What every direction shares

The content and behaviour are the same in all three directions. Only the shell's place
differs.

- **What a shell is.** It is an ordinary `bash` running as the person's Unix user in the
  workspace directory, with the prompt `jari@open-habitat-test:~/Sources/open-habitat (main)$`.
  The fixture is this repository: `git log`, `git status`, `go test ./...`,
  `npm run --prefix web lint|test`, a running `vite` and `tmux ls` all respond. `help` lists
  what the prototype knows.
- **Persistence (assumption, an architecture decision for Jari).** Each browser shell is a
  window in a tmux session named after the workspace (`open-habitat:0 bash`,
  `open-habitat:1 vite`). Closing the browser leaves it running on the server. Coming back
  reattaches, and tmux redraws the screen. The *Sulje selain ja palaa* demo shows this: vite
  keeps logging while away, and the toast says the shells continued.
- **The person's own tmux sessions.** A session the person made earlier (the fixture's
  `main` with a `watch df -h ~` window) is listed but not attached until the person chooses
  *Liity*. Leaving it is *Irrota* (detach: the session keeps running), never *Lopeta*.
- **Closing.** × on an idle shell ends it (the tmux window closes). If a command is
  running, a confirmation names the command and the tmux window, and points out that hiding
  or navigating away would keep the shell running. `exit` or Ctrl+D ends the shell with a
  toast.
- **Busy mark.** A tab or row shows a spinner while a command runs (tmux
  `#{pane_current_command}` is not the shell) and `$` at the prompt. The tooltip names the
  command.
- **First open.** Before the first shell in a session, a dialog says what a shell can do: it
  runs as `jari` with the same rights as the agents, meaning all home files, keys and
  logins. It also says that the shell keeps running when the browser closes. The
  *Uudelleentunnistus* demo toggle turns the button into *Vahvista GitHubilla* with a
  waiting state. *Ei vielä päätteitä* resets to that first-open state.
- **Copy and paste.**
  - Selecting text shows a chip with *Kopioi* and *Vie keskusteluun*.
  - Ctrl+C copies when there is a selection and sends SIGINT otherwise. Ctrl+V and
    Ctrl+Shift+V paste. On a Mac, Cmd+C and Cmd+V stay with the browser.
  - A paste of more than one line waits behind a "Liitetäänkö 3 riviä?" bar that previews
    the lines (*Leikepöydällä 3 riviä* demo). A single line is pasted directly.
- **To the conversation.** *Vie keskusteluun* puts the selection into a conversation's
  composer as a fenced block and does not send it. In Paneeli that is the conversation above
  the shell. In the other two directions it opens the workspace's conversation.
- **Keyboard.**
  - Tab and Esc belong to the shell: Tab completes paths, and Esc never closes anything.
  - Ctrl+` moves between the terminal and its surroundings: tabs in Paneeli and Oma näkymä,
    the sidebar row in Rivi.
  - On tabs, ←/→ switch, Enter or ↓ goes back into the terminal, and Delete closes.
  - A hint row under the terminal says all of this on desktop.
- **Phone.**
  - A key row replaces the hint: Esc, Tab, sticky Ctrl and Alt, the four arrows, `| - / ~`
    and *Liitä*.
  - The keys do not steal focus, so the on-screen keyboard stays up.
  - Output wraps at the terminal width.
- **Connection loss.** *Yhteys katkeaa* shows the app's single top banner. The terminal is
  dimmed and marked "Vain luku, kunnes yhteys palaa", and the shell keeps running on the
  server.
- **The background-work strip.** The shell is not an agent process and does not appear in
  the background-work strip (Merkit). The agent cannot see or type into the person's shell.
  The two are different authorities: the strip shows what Pi started, and the shell is what
  the person started.

## The axis: where the shell belongs

| # | Direction | Where it belongs | When it is right | What it costs |
| --- | --- | --- | --- | --- |
| 1 | **Paneeli** | The conversation. A dock under the composer with the workspace's shells as tabs. It is toggled from the top bar's terminal button (with a count) or Ctrl+`, can be resized and maximised, and *Piilota* keeps the shells running. On a phone it covers the conversation, with ‹ to go back. | The shell is mostly used *while* talking to Pi: checking what Pi did, running the tests it mentioned, watching vite. The selection goes straight into the composer below. | The conversation and the terminal share the height. On a laptop, both are cramped at the same time. Shells of other workspaces are out of sight. |
| 2 | **Rivi** | The workspace. Shells are rows in the sidebar under the workspace's conversations, with a terminal icon and a busy mark. A hover button next to + opens a new one. Own tmux sessions sit under *Muut tmux-istunnot* with *Liity*. A shell opens into the whole main column the way a conversation does. | Shells are first-class work in a workspace, alongside the conversations. The sidebar already answers "what is running where". | The sidebar grows with each shell. The terminal and the conversation are never visible together. A shell is one click away but not side by side with Pi. |
| 3 | **Oma näkymä** | The person. *Pääte* under Etusivu (with a count) opens one view with every shell as tabs, grouped by tmux session, much like a tmux client. *Uusi* asks for a workspace. A conversation's top bar has a terminal button that opens its workspace's shell there. | The person works the way they would over SSH: one terminal place, sessions across workspaces, and the browser as a tmux client. It needs the fewest new concepts in the sidebar. | The shell is furthest from the conversation, and moving between them is navigation. Workspace scoping is weaker: the group label is the only hint. |

**My recommendation: Paneeli**, with Rivi's sidebar marks as a later refinement if shells
turn out to be long-lived work. The reasoning comes from the product: the browser exists to
reach the person's agents. Jari's own words make the shell the person's only way onto the
server, and in practice that means checking and finishing what Pi did in the same workspace.
Paneeli keeps the shell next to that conversation. It makes *Vie keskusteluun* a direct
gesture, and it adds no navigation level. Oma näkymä is the most honest model of tmux, but
it treats the shell as a separate place, which this product deliberately is not. Rivi is
the best for "what is running" at a glance, but it puts the shell and the conversation in
competition for the main column.

## What Jari decides

1. **Direction:** Paneeli, Rivi or Oma näkymä (or a riff around one).
2. **Architecture: how a shell survives the browser.**
   - Assumed in the prototype: every browser shell is a tmux window. The daemon runs
     `tmux new-session -A -s <workspace>` / `new-window` as the person and attaches a PTY
     relay over the existing per-user socket. tmux is a mature native component, and the
     same windows show in `tmux ls` (and over SSH if it is ever enabled).
   - Alternative: the daemon holds a plain PTY with a ring buffer. That means no tmux, and
     the browser's own scrollback works, but it adds a new process holder and buffer to the
     daemon, which is the kind of store `AGENTS.md` asks a concrete need for.
   - Cost of tmux: scrollback is tmux's copy mode, not the browser's. The prototype assumes
     tmux runs with the status bar off and mouse mode on, so wheel scrolling works.
   - This is an authority question, so it is Jari's. The research report should settle
     the facts.
3. **Security: re-authentication before the first shell.**
   - The prototype shows both (toggle).
   - My view: re-authentication adds little, because a stolen browser session can already
     ask Pi to run any command as the person. The real boundary is the Unix user, as with
     the agents.
   - The first-open dialog is still worth keeping as information.
   - If re-authentication is wanted, it has to be through GitHub (the only sign-in), it
     leaves the page, and it should last for the browser session.
4. **The person's own tmux sessions:** list them and allow attaching (as prototyped), or
   only show sessions the browser created.

## Decisions for later review

- **Terminal follows the theme** (sunken surface, syntax tokens, JetBrains Mono). The
  alternative was an always-dark terminal. The product's quiet two-theme design and the
  tokens rule ("no hard colours in a view") favour following the theme.
- **Ctrl+C copies when there is a selection, otherwise it interrupts. Ctrl+V pastes.** This
  is the Windows Terminal and VS Code convention. Ctrl+Shift+C/V also work. The alternative
  was strict xterm behaviour, where Ctrl+V sends `^V`, which most people do not expect in
  a browser.
- **Multi-line paste asks first, single line does not.** The alternatives were bracketed
  paste only (the shell decides) or always asking. Asking only for several lines catches
  the accidental "pasted a script" case without friction.
- **Ctrl+` moves focus out of and into the terminal**, because Tab and Esc must reach the
  shell. VS Code toggles its panel with the same key. Ctrl+PageUp/PageDown were rejected
  because browsers reserve them.
- **Tab names are tmux window names** (`bash`, `bash-2`, `vite`), not workspace names. The
  workspace is shown separately: the panel heading, the group label or the sidebar section.
- **Hiding is not closing.** *Piilota* and navigating away keep shells running. Only ×,
  `exit` and Ctrl+D end one. Own tmux sessions are only ever detached.
- **Phone key row:** Esc, Tab, Ctrl, Alt, arrows, `| - / ~` and Liitä. Ctrl and Alt are
  sticky for one key. Function keys were left out.
- **A dev server on the server (vite at 127.0.0.1:5173) is not reachable from the
  browser.** The prototype does not offer port forwarding. If wanted, it is a separate
  feature with its own authority question, because the gateway would have to proxy to a
  per-user port.

## What the view assumes from the host

- A list of the person's tmux sessions and windows: name, index, the current command in the
  pane, the current directory, and whether it was created by Open Habitat. This comes from
  `tmux list-windows -a -F …` run by the daemon as the person.
- Commands to create, attach, detach and kill a window, plus a bidirectional PTY stream
  with resize, over the per-user daemon socket. The gateway only proxies it.
- No new store: shells are whatever tmux reports.

## Library proposal

None needed now. The round overrides `APP.list`, `APP.actions` and `paintRail`, and it adds
*Uusi pääte* to the workspace `…` menu through a DOM observer, because `wsMenu` is private
to `lib/account.js`. If Paneeli is chosen, the dock and terminal pieces move to `lib/shell.*`,
and `account.js` should expose a hook for extra workspace-menu items.
