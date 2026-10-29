# Result: terminal Pi watch removed

The commit that added the watch (895e9ef7) was reverted onto current main,
and its remaining traces were removed by hand:

- Daemon: `terminal_writer_linux.go` and its test are gone, so nothing reaches
  a tmux socket through `/proc/<pid>/root` any more. The `conversation=`
  WebSocket target, the writer route and `ownPiSessions` are gone. `watch()`
  is again Taskfleet-only (`display-message` and `capture-pane` on the
  daemon-listed Taskfleet socket).
- Gateway: the `/api/v1/workspaces/terminals/writer` route and the
  `conversation=` relay are gone; the terminal socket takes only `shell=` or
  `taskfleet=`.
- Contract: the `writer` definition, the `conversation` field on `ready`, its
  examples and scenario text and the validator's negative cases.
- Web: the HistoryView footer sentence and *Katso päätteessä*, the
  BrowserShell `watch` tab, the TerminalPanel tmux tooltip, `readTerminalWriter`,
  the experimental card with its picture and CSS, the settings search row, the
  feature id, `terminal-watch.spec.ts` and the browser host's
  `/fixture/terminal-pi`.

## Decisions for later review

1. **A stored `terminal-watch: true` is ignored, not dropped.** The web
   already ignores an experimental id it does not list, and the daemon stores
   any well-formed id. Dropping it would need daemon code that knows feature
   names, which it deliberately does not. Alternative: a one-time cleanup in
   the daemon; not worth a code path for a pre-release preference key.
2. **No `internal/AGENTS.md` rule to remove.** The issue mentions a rule the
   feature added there; 895e9ef7 did not touch any `AGENTS.md`, and no rule
   about the watch or the PrivateTmp crossing exists in the instructions. The
   existing "Observing a terminal Pi gives the daemon no ownership" line
   predates the feature and still holds.
3. Tests and examples that used `terminal-watch` as a sample feature id now
   use `worker-row-sentence` / `next-waiting-row`, so no reader takes the id
   for a live feature.

## Checks

Contracts (`test-focused.sh --area contracts`), `go test` for
`internal/daemon`, `internal/gateway` and `test/browser-host`, web static and
unit (`--area web`), and browser specs `settings-experimental`,
`browser-shell` and `native-history` (OH_PORT_BASE=9400) pass.

## Review

Independent `/llm-review`: finder GPT-6 Astra found nothing; a focused
boundary question to Claude Fable 5.1 confirmed that the gateway forwards and
the daemon accepts only `shell=` or `taskfleet=` on the terminal socket, that
the writer route is unregistered everywhere, and that `watch()` stays
read-only. `/assess-findings` had no findings to triage. Nothing else depended
on the census additions (`ownPiSessions` was used only by the removed writer;
`ownPiPIDs` predates the feature and still serves the write fence and the
snapshot).
