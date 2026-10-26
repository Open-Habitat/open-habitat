# Result: context-use ring in the conversation top bar

The accepted 'Rengas' prototype (`proto-context-basic`) is implemented: a ring
and percentage before the model chip, Pi's 70 % / 90 % levels, a tick at Pi's
compaction threshold, a spinning arc while Pi compacts, "?" after a compaction
until Pi's next reply, nothing before the first reply, tokens without a share
when the window is unknown, the ring alone on a phone below 70 %, and a
details dialog (a bottom sheet on a phone). Level changes toward the limit,
compaction and its end are announced to screen readers.

## How it reads native state

- The daemon's history reader adds `context_tokens` to each assistant entry
  (history page and the live `history.entry` event): Pi's own
  `calculateContextTokens(usage)` (`totalTokens`, else the sum of the
  counters), omitted for aborted/failed replies and zero usage, as Pi skips
  them. Malformed usage never breaks the entry.
- The browser applies Pi's `getContextUsage()` rule to the history it holds:
  the newest assistant usage after the latest compaction entry; a compaction
  after it means unknown. Compacting now = the live journal's last compaction
  marker is `compaction_start` (the markers already reached the browser).
- The Pi models read (`/api/v1/pi/models`, through the existing helper that
  loads Pi's registry and settings) adds per model `context_window` and
  `compaction_reserve_tokens` (Pi's `getCompactionReserveTokens(model)`,
  including `modelOverrides`), and top-level `auto_compaction`.

Because everything comes from the session file and Pi's registry, the
indicator works after reload and for conversations whose Pi is not running
(archived, closed), and Claude models through the Claude bridge are covered
(the bridge records the same `usage`; its registered window is in the
catalog).

## Evidence

- Go: `TestAssistantContextTokensFollowPi` (usage rule incl. aborted/error,
  malformed), `TestPiModelsNativeDefault` extended against the real pinned Pi
  SDK (window 128000 from Pi's cached catalog, default reserve 16384, a
  per-model override and `enabled:false` from settings). `go test
  ./internal/daemon` green.
- Web unit: `contextUsage.test.ts` (Pi's ordering rule, live compaction,
  provider-specific window), `ContextRing.test.tsx` (thresholds,
  announcements). `test-focused.sh --area web` green; contracts check green.
- Browser: `tests/context-ring.spec.ts` drives the real controller and fake
  Pi through usage → reload → details (axe, focus return) → compaction
  (compacting, after, after reload) → next reply → phone width. The whole
  browser suite (385 passed, 3 skipped) and the lab suite (131 passed) ran
  green with fake Pi now recording usage on every reply.
- Screenshots at device scale factor 2, light and dark, in `evidence/`
  (`capture.spec.ts` produced them; copy it to `web/tests/` to rerun).
  `desktop-compacting` and `desktop-nowindow` are light only.

## Decisions for later review

- **Browser derives the number from history instead of asking Pi
  (`get_session_stats`).** The prototype result suggested asking Pi. That
  only works while Pi runs, needs a new RPC in the allow-list and polling,
  and "reading never starts Pi". Forwarding Pi's per-reply usage and applying
  Pi's three-line rule covers live, reload and archived conversations with no
  new RPC. Difference: Pi adds an estimate of messages after the last usage
  (e.g. a tool result not yet sent to the model); the ring shows the last
  measured size, so it can lag Pi's footer by that tail until the next reply.
- **"Claude Code conversations" = Claude models through Pi's Claude bridge.**
  The host runs no separate Claude Code conversations and does not read
  Claude Code transcripts; the bridge writes Claude Code's usage onto Pi's
  messages, so the same path covers them. If native Claude Code sessions
  become browser conversations later, they need their own reader.
- **Compaction settings are the person's global Pi settings.** A workspace's
  project `.pi/settings.json` override of `compaction` is not read (the
  helper loads settings with `projectTrusted: false`, as for models). Session
  runtime toggles of auto-compaction are not visible either.
- **The window comes from the conversation's model in the catalog.** A model
  not in the catalog (e.g. observed-only when the catalog is unavailable)
  shows tokens without a share. A bare model id is matched to the provider of
  the newest native model change naming it, else the first catalog row.
- **No `tokensBefore` in the "after" state.** The prototype's sentence
  mentioned the size before compaction; it is left out to avoid another
  contract field before `proto-context-detail` decides what the detail level
  shows. The prototype popover's dashed "detail opens here" placeholder is
  also left out of production.
- **Compacting relies on the live journal.** If Pi dies mid-compaction, the
  ring can keep spinning until the next turn starts; judged rare enough not
  to add a liveness check.
- **Fake Pi records usage on every reply** (growing per turn, "konteksti N"
  sets it, "tiivistä" compacts after the turn), so every synthetic
  conversation with a reply now shows the ring.
