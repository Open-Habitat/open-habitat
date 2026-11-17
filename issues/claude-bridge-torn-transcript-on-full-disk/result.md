# Result: a damaged claude-bridge transcript no longer breaks every turn

## Where the fault lives

- The Claude bridge is upstream `pi-claude-bridge` 0.12.0, pinned in
  `runtime/core/package.json` with one carried build patch (web tools). It is
  not our code.
- The transcript (`~/.claude/projects/<cwd>/<session>.jsonl`) is **appended
  by Claude Code itself** (the CLI from `@anthropic-ai/claude-agent-sdk`).
  The bridge writes only whole new files (`writeFileSync(..., {flag: "wx"})`).
  So no writer we control appends to that file.
- The bridge's `readTranscript` (`src/session-transcript.ts`) already
  tolerates a torn *final* line. Then Claude Code appends the next record
  straight after the partial bytes, and that line becomes newline-terminated.
  `parseJsonl` (cc-session-io) parses every terminated line strictly, so every
  rebuild path (rows 3/5/6/7 of `syncSharedSession`, which includes every turn
  after a Pi restart, because loaded state is `dirtyTail`) throws the V8
  `JSON.parse` error. That error is the bridge's `errorMessage`, and nothing
  in the browser showed it.

## What changed

1. **Guard around the bridge (writer and reader side).** The daemon's Pi
   companion (`internal/daemon/process-extension.mjs`, `guardBridgeTranscript`)
   runs on `before_agent_start` when the conversation's model is on
   `claude-bridge`. It finds the transcript the bridge will actually read.
   It reads the bridge's process-wide session registry
   (`Symbol.for("claude-bridge:sessionRegistry")`, the same Pi process), whose
   memory is authoritative once the bridge has loaded the session; the saved
   pointer lags it after a restart and for forks. Before the bridge has
   loaded the session, it uses the saved pointer. The path is computed the way
   cc-session-io does. Then:
   - a complete final record without its newline gets the newline, so the
     next append starts on its own line (the newline guard the writer lacks);
   - a torn final line, or any terminated line that does not parse, sets the
     **whole file aside unchanged** as `<session>.jsonl.damaged-<UTC>`.
     Neither Claude Code nor the bridge reads that name. The bridge then takes
     its own missing-transcript path and rebuilds a fresh transcript from Pi's
     history, which it treats as the authority. No interior entry is dropped
     silently: the conversation is in Pi's history and every original byte is
     in the set-aside file;
   - nothing is changed while a Claude Code child of the previous run may
     still be appending (Claude Code opens the file by name for each append).
     The guard first waits, bounded, for the exit the bridge itself waits for
     (the registry's `writers`). It then waits while any process of this user
     carries the session id in its arguments (the SDK passes
     `--resume=<id>`/`--session-id=<id>`; a parked healthy query is such a
     process), or while the file was written in the last 2 s. If that does
     not settle within about 5 s, the file is left alone and the decision is
     `busy`. No new child for the conversation starts before the hook
     returns, because the bridge's query begins after `before_agent_start`;
   - each decision (`newline`, `set_aside`, `busy`, `failed`) is written as
     an `oh-bridge-transcript` custom entry in the Pi session and as a stderr
     line. The model and the browser do not see it.
   - Checks are incremental: the verified byte offset per inode is kept in
     memory, so a long transcript is not parsed in full before every run.
2. **The browser names the failure.** When a failed reply on `claude-bridge`
   carries the reader's JSON parse error, the daemon classifies it as
   `turn_failure: "provider_transcript_damaged"`. This is a new optional field
   in `history.schema.json` and `event.schema.json`. The failed turn shows a
   short row instead of an empty "Epäonnistui": *"Claude-yhteyden oma kopio
   keskustelusta oli vioittunut, esimerkiksi koska levy täyttyi kesken
   kirjoituksen. Viestiäsi ei käsitelty. Lähetä se uudelleen: kopio
   rakennetaan keskusteluhistoriasta, joka on tallessa."* (English in the
   catalog.) Sending again is the right advice because the guard runs before
   the next run.
3. **Pi's own session writer.** Pi's loader adds a newline after a partial
   final line at load time. Its live `_persist` appender does not, so after a
   write fails part-way in a running Pi the next entry is glued on. Filed as
   `pi-session-append-glues-after-torn-write` (intake, unlaned).

## Evidence

- `node --test internal/daemon/pi-device-test/bridge-transcript.test.mjs`:
  11/11, run three times. It covers the reproduction: a transcript whose record
  is cut mid-JSON with the next record glued on, which the pinned
  cc-session-io `parseJsonl` rejects as the bridge does. It also covers the
  set-aside with byte-identical kept original, the newline guard, the
  incremental check, the busy file left alone (recently written, a pending
  bridge writer exit, or a live child found in `/proc` by the arguments the
  pinned SDK actually gives it), the bridge's in-memory pointer winning over
  the saved one, the companion hook on the
  bridge only with a recorded decision, and path equality with
  cc-session-io's `getSessionPath` (also for a >200-character cwd).
- Companion regression: `notices`, `catch-up`, `wait-reminder` device tests
  green.
- `TestHistoryNamesADamagedBridgeTranscript` (Go), and
  `./scripts/test-focused.sh --area go --go-package ./internal/daemon`.
- `HistoryView.test.tsx` 39/39 (three runs), including the new named-failure
  test for the timeline turn and the single entry; contracts focused check
  green.
- Not run: a live turn through a real Claude subscription on the test server
  (needs a filled disk on a real installation). The rebuild path the guard
  relies on is the bridge's existing `missing-transcript` path.

## Live check

1. In a browser conversation on a Claude model (claude-bridge) with a few
   turns, find the bridge transcript: the newest
   `~/.claude/projects/<cwd-with-dashes>/<uuid>.jsonl`.
2. Stop the conversation, then append a cut line glued to a whole one:
   `L=$(tail -n1 T); printf '{"type":"user","uuid":"x' >> T; printf '%s\n' "$L" >> T`.
3. Send a message. Expected: the turn answers normally. `T` is gone,
   `T.damaged-<UTC>` holds the original bytes, and the Pi session has an
   `oh-bridge-transcript` entry with `"action":"set_aside"`.
4. Before this change, the same steps gave an empty *Epäonnistui* on every
   turn.

## Review

The diff touches daemon and session state and the contract, so it got an
independent `/llm-review`: GPT-6 Astra as finder, Claude Fable 5.2 as
verifier, 2 calls. The finder raised three findings, and all were confirmed
locally and by the verifier:
- a rename could race a still-exiting Claude Code child;
- the saved pointer can lag the bridge's memory;
- the lost-record errors were promised a rebuild nothing performs.

The first fix attempt was refuted by the verifier on two counts. The SDK
passes `--resume=<id>`, not a bare id, and a project-directory scan could
touch another conversation's live transcript. Both were reworked into the
registry design above, and the classifier no longer names lost-record
errors. The verifier also noted that the pinned Claude Code binary appears to
start a fresh line itself when the tail lacks one. The incident shows glued
lines happened anyway (possibly a newline write that also failed), so the
guard stays. It is noted for the upstream report.

## Proposal for upstream

To `pi-claude-bridge` (`src/session-transcript.ts` / `src/index.ts`):

> **A transcript that does not parse should rebuild from pi's history
> instead of failing every turn.** `readTranscript` treats only an
> unterminated final line as a crash artifact. Claude Code does not start an
> append on a fresh line, so after a write cut short (ENOSPC/EDQUOT) its next
> record lands on the torn line. That line is then terminated, `parseJsonl`
> throws, and every later query that rebuilds (which is every query after a
> pi restart, since loaded state is `dirtyTail`) fails at once with a bare
> `JSON.parse` message, even after space is freed.
>
> Proposed change: in `syncSharedSession`, treat a transcript that
> `readTranscript` cannot parse like a missing one. Rename it aside as
> `<id>.jsonl.damaged-<timestamp>` (keeping the bytes), clear the session
> state, `debug()` and `diagDump("session_transcript_damaged", …)` the
> decision, and take the existing `missing-transcript` import path. A
> narrower alternative: make `readTranscript` throw a typed
> `TranscriptDamagedError` naming the file and line, so a host can show the
> cause. Both keep the strict reader for intact files.
>
> ```ts
> // session-transcript.ts
> export class TranscriptDamagedError extends Error {
>   constructor(readonly path: string, readonly line: number, cause: unknown) {
>     super(`Claude Code transcript ${path} is damaged at line ${line}`, { cause });
>   }
> }
> // readTranscript: parse line by line; on SyntaxError for a terminated line
> // throw new TranscriptDamagedError(path, lineNo, error).
>
> // index.ts syncSharedSession, beside the statSync ENOENT branch:
> try { if (state) readTranscript(state); }
> catch (error) {
>   if (!(error instanceof TranscriptDamagedError)) throw error;
>   renameSync(error.path, `${error.path}.damaged-${Date.now()}`);
>   diagDump("session_transcript_damaged", { path: error.path, line: error.line });
>   missingFile = true; setSessionStateFor(piSessionId!, null); deleteSessionState(piSessionId!); state = null;
> }
> ```
>
> (Reading the whole file each sync could be limited to the rebuild rows,
> where it is read anyway.)

Once upstream ships this, the companion guard can go: the bridge would
repair itself, also for terminal Pi, which today has no companion. Claude
Code's appender has the same root gap, a missing newline before an append.
That would be reported to Anthropic's Claude Code issue tracker. It is not
filed from here.

## Decisions for later review

- **Set the whole file aside rather than cutting out the torn bytes.** The
  alternatives were splitting the glued line (keep the complete record,
  quarantine only the torn prefix) or dropping the torn line and the records
  that hang off it, as the manual repair did. Splitting still leaves records
  whose parent is lost, and the bridge's parent-chain walk rejects those
  ("not on the primary parent chain"). Repairing record semantics belongs to
  Claude Code's format, which we do not own. A rebuild from Pi's history is
  the bridge's own supported path and needs no knowledge of the format. The
  cost is a prompt-cache miss and the loss of Claude Code's recorded forms of
  oversized tool results for that one rebuild.
- **The companion, not the daemon in Go.** A pre-start check in the daemon
  would cover only starts. The failure also happens in a live Pi after the
  tear. The companion runs in the same process before each run and can
  record the decision in the native session. Terminal Pi through the runtime
  launcher is not covered; that waits for the upstream fix.
- **Reading the bridge's in-process registry.** This uses an upstream
  internal (`SESSION_REGISTRY_KEY`), not a public API. The alternatives were
  the saved pointer only (wrong after every restart until a run succeeds, and
  for forks) or scanning the project directory (a review showed this could
  rename another conversation's transcript under its live writer). If a
  bridge bump drops the registry, the guard falls back to the saved pointer.
  The device tests pin the shape, and the upstream fix would remove the need.
- **Only the main transcript.** Claude Code's subagent transcripts under
  `<session>/subagents/` are not read by the bridge's rebuild, so they are
  not checked; after a set-aside they stay beside the old file.
- **Classification by error text.** `provider_transcript_damaged` is matched
  on V8's `JSON.parse` wording, and only for `claude-bridge`. Another JSON
  failure inside the bridge would also be named this way; the advice (send
  again) is harmless in that case. The bridge's own errors for a well-formed
  transcript that lost records ("boundary … absent", "not on the primary
  parent chain") are not named. Nothing repairs those, so "send again" would
  be false advice.
- **The decision log is invisible in the browser.** The turn now succeeds, so
  no notice is shown. The `oh-bridge-transcript` entry and stderr hold the
  record.
