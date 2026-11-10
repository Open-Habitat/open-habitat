# Result (2026-11-10)

Every agent on an installation now searches the web through the provider the
person already uses. Nothing to set up, and nothing written to the person's
settings.

- **ChatGPT subscription and OpenAI keys:** `runtime/core/web-search.mjs` adds
  the Responses `web_search` tool to the request.
- **Anthropic keys:** the same extension adds the server-side `web_search` and
  `web_fetch` tools.
- **Claude subscription:** the core runtime build patches pi-claude-bridge so
  its Claude Code runs its own WebSearch and WebFetch.

The extension reaches all three entry points: the daemon's browser
conversations (`piArgs`), and the `runtime/agent-bin/pi` launcher used by
Habitat terminals and Taskfleet's Pi workers. The release verifier refuses a
core runtime without it.

## Why the bridge had no search, and the fix

pi-claude-bridge 0.9.3 starts Claude Code with `tools: []` on the provider
path. Pi's own tools reach Claude over the bridge's MCP server, so Claude Code
needs none of its built-ins there, and the bridge never made an exception for
search. Upstream 0.11.0 still hard-codes it and offers no setting.

`BRIDGE_PATCH` in `scripts/core-runtime-build.py` changes that line to
`tools: ["WebSearch", "WebFetch"]`. The build fails if the patch does not
apply exactly once. The SDK's `tools` is an allowlist, and `bypassPermissions`
was already set, so the widening is exactly those two tools. The bridge already
skips a tool call it does not serve, and Claude Code then runs the tool inside
the same query.

Upstream issue text, for elidickinson/pi-claude-bridge (not filed; the
conductor or Jari files it):

> **Provider path: allow Claude Code's WebSearch/WebFetch.** The provider path
> runs `query()` with `tools: []`, so a Pi session on claude-bridge has no web
> search, while the same model in Claude Code does. Pi has no search tool of
> its own. Enabling `tools: ["WebSearch", "WebFetch"]` works with no other
> change: `processStreamEvent`/`processAssistantMessage` already skip tool_use
> for unserved names without ending the Pi stream, Claude Code runs the tool
> and the next message streams into the same turn. Verified with 0.9.3 across
> search, fetch, Pi tool round trips and compaction. Proposal: a
> `provider.builtinTools` config (default `[]`) passed through to `tools`. The
> debug line "CC rejects it and retries" is then wrong for those names.

## Live verification on Birch

Every run used a disposable `HOME`/`PI_CODING_AGENT_DIR`, and for Claude a
disposable Claude config directory, holding copies of Jari's credentials.
Neither access token was near expiry, so no refresh could rotate his real
login. The copies were deleted afterwards. Logs are in `evidence/`.

- **ChatGPT subscription** (`openai-codex/gpt-5.6-luna`, release Pi 1.3.0 plus
  the extension):
  - Search: four native search actions (search, open_page, find_in_page).
  - Tool round trip: a bash tool call between searches, with search added to
    both requests.
  - Long conversation: continued over several turns, then a real compaction
    over RPC (`tokensBefore` 21,688). After it, file values were recalled and
    a fresh search answered.
  - Built launcher: a search through the final arm64 build's own
    `runtime/agent-bin/pi`.
- **Claude subscription**, through a built arm64 payload's launcher
  (`claude-sonnet-5`; the review fixes changed only the extension, and a
  search through the final build's launcher was checked again):
  - Searches: Claude Code ran WebSearch ×3 and WebFetch ×2.
  - Tool round trips: bash ×3 and read ×1 between the searches.
  - Compaction: a real compaction (`tokensBefore` 15,162), then a search after it.
  - Bridge health: no leak warnings in the bridge log.
  - Baseline: the unpatched release bridge answered `NO-SEARCH` to the same
    request.
- **Not verified live:** the OpenAI and Anthropic API-key routes, because no
  key was available. They are covered by real-Pi tests against a synthetic
  endpoint (`internal/daemon/pi-device-test/web-search.test.mjs`). Whether
  Anthropic accepts a replayed history with Pi's dropped server-tool blocks is
  unverified. Public evidence says it does: failures in the wild came from
  keeping `server_tool_use` without its result, and Pi drops both. If it ever
  fails, the error names `web_search` and the extension stops offering search
  for that process.

## Runtime builds

The core runtime closure changed: the new extension file and the patched
bridge file. The final inputs (commit d7c2ac80e; its runtime inputs equal those built) were rebuilt natively on both
architectures. The archives and their `artifact.json` are on Alder under
`/var/tmp/agent-keep/web-search-native/{arm64,amd64}`. The release cut takes
them as `--rebuilt arm64=… --rebuilt amd64=…`. The `core.tar.gz` digests are
arm64 `48714192d8425a9150f495981671b8a515152421c6d3d66126b842df5a5264f4` and
amd64 `84fe9f500a8baeb7e05715b812c414a7362ce95fda78cba58d404b798f59a933`. The
two closures record identical digests for the extension and the patched
bridge. No systemd unit, socket or Fleetrepo change is needed.

## Existing people's settings

Nothing needs converging. The extension is loaded by flag, so existing people
get it on the next conversation or terminal `pi` after the upgrade. One
related observation was filed through intake as `unreasonably-bored-meeting`.
Claude model selection writes a generation-specific bridge path into the
person's `settings.json`, so a plain `pi` over SSH keeps loading the old,
unpatched bridge. Browser conversations and the launcher load the current
bridge first and are unaffected.

## Decisions for later review

- **Payload injection rather than a separate search tool.** Alternatives:
  pi-web-search's design, where a `web_search` tool makes its own request, or
  pinning pi-web-access. The model searches inside its own turn with no second
  model call, and it is about 120 lines we own. The cost: it relies on Pi
  tolerating unknown output items, which it does in 1.3.0 and is tested
  against the pinned Pi.
- **Patch the bridge at build time.** Alternatives: wait for upstream, or a
  runtime monkey-patch through the bridge's `__test.setQuery`. A one-line
  build patch is visible, checked to apply once, and follows the pin; the
  upstream text is above.
- **Anthropic: the basic tool versions, 5 searches + 4 fetches per turn.**
  Later versions default to searching from code execution, which not every
  model supports and which is not ZDR-eligible. The caps keep a turn under the
  server's pause limit. A turn that still pauses says so in the answer
  ("Ask to continue"), because Pi cannot resume it.
- **Back off for the process after a refusal.** An organisation can turn web
  search off for its API key, and a model may lack it; either fails the whole
  request with a 400. The extension cannot retry that request. After an error
  naming web search/fetch, it stops offering search in that Pi process, so the
  person sees one error and the next message works. Alternative: an opt-out
  setting; none was added, since nothing writes the person's settings.
- **No opt-out.** Search spends the person's plan allowance or key (OpenAI
  and Anthropic bill searches separately), as Jari's zero-setup decision
  accepts. A person who installs their own search tool takes precedence
  automatically.
- **"Sources:" list and pause notice in English.** They are appended to the
  model's own message. The model answers in the conversation's language, but
  these two labels do not. Alternative: localize from the daemon's language
  setting, which the extension cannot see today.
- **Requests without tools are left alone** (`--no-tools`, helper calls with
  another model). Only the conversation model's own requests get search.
