# Result: browser-shell Ctrl-D spec under load

The issue suspected the product, and it was the product. A new shell's
surface mounts and takes focus while its socket is still connecting.
`BrowserShell.send` dropped every key until the daemon's `ready` message
had arrived and React had re-rendered the phase as `open`. The test waited
for the server to list the second shell, which happens before `ready`, and
then typed into that gap. A person who clicks *+* and starts typing loses
keys the same way. Under load the gap grows.

Keys typed into a connecting surface are now kept with the connection
(at most 4 KiB) and sent once the shell is ready, unless the ready message
says the terminal is read-only. Readiness and read-only are recorded on the
connection in the `ready` callback, so keys typed after `ready` but before
React re-renders the phase go straight to the socket. An independent review
(`/llm-review`) caught that the first version dropped keys in that gap. The phone's on-screen keys and
the multi-line paste dialog keep their old guard.

The spec now types as soon as the new surface has focus, before it checks
the server's shell list. That is the race a person meets.

## Evidence

- Spec against the old `BrowserShell.tsx`: 1 of 3 runs failed with the
  issue's symptom (prompt shown, typed command missing). The spec cannot
  force the order, so a regression fails often but not always.
- With the fix: `browser-shell.spec.ts` `--repeat-each 5` under four `yes`
  processes 60/60, alone 12/12; the Ctrl-D case `--repeat-each 30` under
  twelve `yes` processes with six workers 30/30.
- `scripts/test-focused.sh --area web` passed.

## Decisions for later review

- **Keys typed while connecting are kept and delivered, including while an
  existing shell is reattaching after a dropped connection.** The
  alternative was to keep them only for a brand-new shell. During a
  reconnect the surface shows *Yhdistetään päätteeseen…*, and delivering
  the keys afterwards is what an ssh or tmux attach does. The keys go to
  the same shell the person was typing into.
- **4 KiB cap.** Typing ahead is a few keystrokes. Anything larger (a big
  paste into a connecting terminal) is dropped as before, rather than
  queued without limit.
