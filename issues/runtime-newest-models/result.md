# Result: newest models (Pi 1.5.2, bridge 0.12.0)

The core runtime now pins `@earendil-works/pi-coding-agent` 1.5.2 (and with
it pi-ai 1.5.2), `pi-claude-bridge` 0.12.0 and the Agent SDK it requires,
`@anthropic-ai/claude-agent-sdk` 0.3.321. Pi's catalog brings Claude Fable 5.2
(`claude-fable-5-2`, "Claude Fable 5.2") and GPT-6.1 Terra (`gpt-6.1-terra`,
"GPT-6.1 Terra"); the bridge lists Fable 5.2 with 1M context. The daemon's
"newest in family" grouping already moves Fable 5.1 and older Terra/Sol
versions under *Older models*, so no product code had to name the new ids.

**The next release needs a core runtime rebuild for both architectures
(`--rebuilt`).** The rebuilt arm64 output from this tree is kept at
`/var/tmp/agent-keep/runtime-newest-models/core-arm64-final` on Birch
(`core.tar.gz` sha256 `daff6db3eb00292f99d0ab45b20b027f775fd50a196a61ef82fa2a8f8b335810`);
amd64 must be built on an amd64 host.

## What changed

- `runtime/core/package.json` and its lock, regenerated with the locked Node
  22.21.1's npm (`npm install --package-lock-only --ignore-scripts`); the
  daemon's `pi-device-test` package and lock the same way.
- `BRIDGE_PATCH`: bridge 0.12.0 moved the provider query options one
  indentation level deeper, so the patch's match now has three tabs. The
  widening is unchanged (`tools: []` → `tools: ["WebSearch", "WebFetch"]`)
  and still applies exactly once; the build asserts it.
- Every helper's Pi version guard, `pi_runtime_linux.go`, the release closure
  pins and their tests, the VM product fixture, the launcher and doc
  comments: 1.3.0 → 1.5.2.
- **Web search on current OpenAI models was broken by Pi 1.5.** Pi now
  declares the tools of models that support it (every GPT-6/6.1 model and
  GPT-5.6 Luna, on both the ChatGPT subscription and API keys) in
  `additional_tools` input items and sends no top-level `tools`. The
  extension only looked at `payload.tools`, so it silently offered no search:
  the first live run with the new runtime had GPT-6.1 Terra answer "web search
  isn't available in this session" (`evidence/before-fix-codex-payload.jsonl`
  shows the request). `web-search.mjs` now treats tools declared in those
  items as the conversation's (also for spotting a person's own search tool)
  and adds `web_search` as a top-level tool beside them. A real-Pi test with
  `gpt-6.1-terra` covers it and fails without the fix.
- The review found that Anthropic models with native mid-conversation tool
  changes (Fable 5.x, Opus 4.8–5.5, Sonnet/Haiku 5.5) keep top-level `tools`
  at the initial set and define later tools in `tool_addition` message blocks,
  so a person's own search tool activated mid-conversation would not have
  suppressed the native one. `declaredTools` now reads those blocks too.
- Daemon tests that named ids Pi 1.5 no longer has or defaults it changed:
  Pi's first-key defaults are now `gpt-6.1-sol` (OpenAI) and
  `claude-opus-5-5` (Anthropic); the Codex catalog no longer has `gpt-5.5`,
  and every Codex model now offers `max`, so the rejected-thinking case uses
  `gpt-6.1-sol` with `off`.
- `modelDisplayName` names an OpenAI family id the catalog no longer lists as
  Pi does ("GPT-6.1 Terra" instead of "GPT 6.1-terra"); stories that show the
  current Claude list name Fable 5.2, with Fable 5.1 under older models in the
  picker story. History fixtures that record Fable 5.1 stay as they are.

## Changelog review (Pi 1.3.0 → 1.5.2, bridge 0.9.3 → 0.12.0)

- RPC: only shutdown changed (an extension's `ctx.shutdown()` while idle; a
  single SIGTERM during shutdown no longer cuts cleanup short, a second one
  does). Event serialization is unchanged; live RPC runs still had no
  cumulative `partial` on `message_update`.
- CLI parser, `--approve`/trust and subcommand dispatch: `args.js` and
  `project-trust.js` differ only in help text; `auth login/logout` are new
  under the existing `auth` subcommand, which the launcher already passes
  through.
- Extensions API: 1.5.0 validates tool arguments with pi-schema instead of
  TypeBox; none of our extensions uses `Type.Refine`, codecs or similar.
  `pi-ai`'s index no longer re-exports the catalog helpers; our helpers import
  `models.js` and `getCurrentSystemMessage`, which remain.
- Anthropic message threads (1.5.1, on for `api.anthropic.com` keys): Pi hashes
  the request after extension hooks, so the added search tools are part of the
  thread fingerprint. An answer the extension extends with a *Sources* list no
  longer matches Pi's recorded reply, so the next request starts a new thread
  (a cache miss, not a failure). Not verified live: no Anthropic key.
- `cacheWarming` now defaults to `idle` (keeps a prompt cache warm for up to
  30 minutes between runs when Pi expects it to pay off). It is the person's
  Pi setting and we write none; noted because API-key users pay for warms.
- Compaction and branch summaries use the model's output limit; manual
  compaction behaves the same over RPC.
- Bridge 0.10.0 ignores project `.claude/settings*.json` and project
  `provider` options; we write neither. 0.11.0 moved AskClaude to its own
  package; we never enabled it. 0.12.0 dropped its system-prompt guard and
  requires Pi ≥ 1.5.1.

## Verification

- Build: `./scripts/build-core-runtime.sh` natively on Birch (arm64) succeeds;
  the patched bridge line occurs once in the payload.
- `OH_CORE_ARTIFACT_DIR=… go test ./internal/host -run 'TestReleaseClosure|TestReleaseCoreAgentTools'`
  including `TestReleaseClosureBuiltCore` on the built archive: pass.
- `node --test internal/daemon/pi-device-test/*.test.mjs` (real Pi 1.5.2):
  74 pass, including the new Terra web-search case and the `tool_addition` case.
- `go test ./internal/daemon/...` (with `requirements-ci.txt`'s Python):
  pass; `OH_CORE_RUNTIME=… TestMCPBuiltRuntimeAgent` on the built runtime:
  pass; launcher trust tests (`TestLauncher*`, `TestProjectTrust*`,
  `TestListOnlyPinnedPi*`): pass.
- `python3 scripts/test-profile-runtime-build.py`: pass.
- `./scripts/test-focused.sh --area web` and `--area contracts`: pass.
- Not run: `scripts/test-native-pi-notice.sh` needs the
  `open-habitat-vm-tools:prereq` image, which this host does not have; the
  same notice path runs in `pi-device-test/notices.test.mjs`.

### Live on Birch

Disposable `HOME` (and with it `~/.pi/agent` and `~/.claude`) holding copies
of Jari's ChatGPT and Claude logins; neither token was near expiry (66 h and
6 h), so no refresh could rotate his real login. The copies were deleted
afterwards. Each run went through a built arm64 payload's own
`runtime/agent-bin/pi` over RPC (`evidence/`); that build predates the review
fix, which changed only the extension:

- `claude-bridge/claude-fable-5-2`: answered as Fable 5.2; Claude Code ran
  WebSearch twice and WebFetch twice; a read tool round trip; a real
  compaction (`tokensBefore` 13,729) after which the bridge rebuilt its
  session once, as expected, and the next answer recalled a file value and
  fetched a page. Between turns the bridge reused its session (no rebuild
  after a search turn).
- `openai-codex/gpt-6.1-terra`: answered; native web search with source links
  on three turns, a read round trip, and a real compaction (`tokensBefore`
  15,397) followed by a search.

After the review fix the arm64 runtime was rebuilt; through its launcher
GPT-6.1 Terra again ran native `web_search_call`s and Fable 5.2 answered a
search with sources, and `TestReleaseClosureBuiltCore` passed on the archive.

### Review

Major dependency bump of what every agent runs, so an independent
`/llm-review` (finder gpt-6-astra, verifier claude-fable-5-1) plus
`/assess-findings`: one confirmed should-fix (the `tool_addition` case
above), fixed here with a test; nothing dropped or deferred.

## Decisions for later review

- **Saved Fable 5.1 choices stay.** A person whose saved default is
  `claude-fable-5-1` keeps it; it shows under *Older models*, which opens when
  it holds the selection. Alternative: migrate saved Fable 5.1 to 5.2.
  Rejected because the choice is the person's, Pi's own settings are never
  written by Habitat except on explicit selection, and a newer model can cost
  and behave differently.
- **The Claude sign-in default stays Claude Opus 5.5 with medium thinking,**
  not Fable 5.2. Jari chose Opus over Fable as the sign-in default on
  20.10.2026 (`claude-default-model`); Fable 5.2 being newer does not change
  that reasoning, and Opus 5.5 is still the newest Opus. Recap/title models
  (newest Sonnet or Luna, never Fable/Opus) need no change; dictation is
  Soniox, not a model from either provider.
- **`@aliou/pi-processes` stays at 0.10.9.** Its peer range accepts Pi 1.5.2
  and the process and notice tests pass; raising it is unrelated scope.
- **The browser host's model fixture stays synthetic** (`test/browser-host/pi_models.go`
  keeps its invented `gpt-6-nova` and `gpt-5.6-terra`): it exercises
  grouping and ordering, not the real catalog, which the daemon tests cover
  against real Pi. Only its stale comment about Pi's first-key default
  changed.
- **The search tool on `additional_tools` requests is top-level,** not
  another `additional_tools` item. Pi's comment says such items cannot replace
  a top-level tool, and the live Codex run accepted the shape; an item would
  instead interleave with Pi's own incremental tool notices.
