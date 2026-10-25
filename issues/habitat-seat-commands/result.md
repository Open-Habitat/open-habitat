# Result: seat commands in Habitat (narrowed 2026-10-25)

Jari narrowed this issue to two things: opening a file in the person's Habitat
editor, and research into the clipboard. Both are delivered. The clipboard is
research plus a proposal; it was not built.

## 1. Open a file in the person's editor (built)

- **Agent side.** `open-habitat agent editor offer --path <workspace path>
  [--line N] [--workspace ws_] [--current | --conversation pi:UUID]
  --idempotency-key UUID [--dry-run]` on the own-UID agent listener
  (`/agent/v1/editor/offers`). The agent gets no editor grant: the command
  publishes a card and never opens anything. The reply says the card was
  published, never that it was seen.
- **Confinement.** Before anything is published, the daemon requires a
  canonical workspace-relative path (no `/`, `..`, `.`, `//` or control
  characters, and no `.git` or `.agent-host`, following the browser editor's
  own path rule). The path must name a regular file the person owns, beneath
  the workspace, reached with `RESOLVE_BENEATH` and no symlink. A conversation
  offer must name that conversation's workspace.
- **No editor.** When the person's editor preference is VS Code and the
  operator has no trusted code-server, the reply is `editor_unavailable`. The
  browser text editor always exists. The daemon cannot see whether the
  installation has an editor origin; the skill says so.
- **Delivery.** A conversation offer is a native notice carrying `editor`,
  written through Pi's own notice writer like the view offers. An account
  offer, for SSH or tmux workers, is a transient `editor.offered` event.
- **Browser.** The card has one button, *Avaa editorissa*. It goes through the
  workspace editor's existing `FileLinkContext` open, so both engines open the
  file at its line and their own checks apply again. Account offers share the
  corner tray. The workspace editor registers which workspace it can open. An
  offer for another workspace shows *Siirry työtilaan* (a worktree place leads
  to its main checkout's page). An offer on a page without an editor says the
  editor is not available here.
- Contracts: `editor.schema.json#/$defs/offer`, `notice.editor` (never
  together with `view`), and the `editor.offered` event. The skill text, native
  host context, help and `CONFORMANCE.md` are updated.

### Checks

- `./scripts/test-focused.sh --area contracts`: pass (including negative path
  cases).
- `go test ./internal/daemon` (whole package): pass. `./internal/cli` and
  `./test/browser-host`: pass. The new tests are `TestEditorOffer*` and
  `TestEditorAccountOfferIsPublishedOnce`, covering confinement (absolute,
  traversal, `./`, `//`, newline, `.git`, directory, outside and inside
  symlinks, missing file, unknown workspace), the no-editor case, the
  conversation notice, workspace mismatch, idempotency and dry run. CLI:
  `TestEditorOfferArgumentsRefuseBeforeSocket`.
- `--area web`: 120 files and 756 tests pass. `EditorOffers.test.tsx` covers
  the press reaching the file link at its line, no button without an editor
  for the workspace, the tray's elsewhere, route and ready states with
  dismissal, and recency.
- `--area browser --spec agent-editor-offers.spec.ts`: 2 tests pass. The first
  is a conversation offer: nothing opens until the press, axe finds no
  violations, and the press opens the browser editor with the offered line
  active. The second is an account offer through the real agent route: refused
  paths publish nothing, and a valid offer opens from the tray at its line.
- Whole browser suite (`npm run test:browser`, before the review fixes):
  377 passed, 3 skipped, 7 failed. The failures were
  `browser-editor-concurrent` ×3, `browser-editor` preference across browsers,
  `site-ai-key` key copies, and `start-here` ×2. All seven, plus
  `agent-editor-offers`, passed together in a rerun after the review fixes
  (13 passed). They were load-dependent failures in the full run, so none was
  filed. `browser-editor-concurrent` had already been seen flaking under full
  load on 2026-10-25 (`html-view-owner-first`).

All of this is same-UID synthetic evidence. Opening at a line in a real
code-server through the offer is not exercised, though it uses the
already-tested file-link path. A distinct-UID run was not done.

## 2. Clipboard (research)

[research-clipboard.md](research-clipboard.md) has the research, with a
Finnish summary. In short: no native client is needed. Every browser allows a
write in the trusted app's click handler (Chromium also allows it for the
active tab; Firefox and Safari need a gesture every time). Manual selection is
the fallback. The open question is secrecy, not authority: the text must stay
out of Pi history, the event journal's replay ring, logs and replies. That
calls for a small in-memory, expiring, single-use store in the daemon and a
take route. This is new surface, so it is proposed as its own issue instead of
being built here.

## Review

`/llm-review` (finder gpt-6-astra; the claude-fable-5-1 verifier CLI exited 1
on Birch, so evidence is local only) raised 2 candidates. Both were confirmed
and fixed in the branch: a worktree account offer led to a missing workspace
page, and `.git` / `.agent-host` paths passed the offer but the browser editor
refuses them. `/assess-findings`: 2 FIX, nothing else.

## Decisions for later review

1. **The verb is `offer`, not `open`** (`agent editor offer`), because the
   command only publishes a card. This matches `agent view offer`. The
   alternative `agent editor open` reads as if it opened something.
2. **`--workspace` is optional only with `--current`**, which takes it from the
   checked launch context. A conversation offer for another workspace is
   refused (`workspace_mismatch`), because the card opens in that
   conversation's editor.
3. **Confinement is the browser editor's rule for both engines**: no symlinks
   even inside the workspace, and no `.git` or `.agent-host`. VS Code would
   follow an inside symlink, but an offer must open in whichever editor the
   person uses. The agent can always offer the real path.
4. **"No editor" means VS Code chosen and no code-server installed.** The
   daemon refuses then, instead of publishing a card nobody can open. A phone
   would still open the text editor; that case was not worth a softer rule.
   The installation's editor origin is invisible to the daemon, as with views.
5. **Account offers are transient** (open browsers only, gone after reload)
   with in-memory idempotency (256 keys per daemon run). Alternatives were an
   export-like file store (rejected: a second store of offers with no product
   need) or a list on load (needs that store).
6. **An account offer for another workspace leads to that workspace's page**,
   not straight into a conversation. The editor exists only beside a
   conversation, and choosing one for the person was not obvious. A worktree
   place leads to its main checkout's page.
7. **Account editor offers share the view tray** and its five-newest/24-hour
   bound, but they do not need a view origin.
8. **Clipboard was not built** (see above): a secret store, its route and its
   expiry rules are a decision of their own.

## Proposed follow-up

- *Agent clipboard offer: Copy button for agent-supplied text without history
  or log* (feature): build the design in research-clipboard.md, covering the
  CLI on stdin, an in-memory expiring single-use daemon store, the
  `clipboard.offered` event without the text, a card with Kopioi and Näytä,
  `ClipboardItem` with a promise, and a manual-selection fallback.
