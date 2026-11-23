# Result (23.11.2026): key-backed search in pi-web-search 0.2.0

`Open-Habitat/pi-web-search` v0.2.0 is released (tag, GitHub release with
the `npm pack` asset, as v0.1.0 was). The core runtime pins it. The
extension's README is the full reference for the formats below; this file
records what the product side (`web-search-key-product`) builds on and the
choices made here.

## How it behaves

- A model whose provider does not search by itself (DeepSeek) gets a Pi tool
  `web_search` when `~/.config/web-search/key.json` holds a usable key for an
  enabled service. Each call is one Brave Web Search API request
  (`X-Subscription-Token`). The results go back to the model as numbered
  title, link, age and description.
- A model that searches natively never gets it. The tool is taken out of the
  active set at `session_start`, `model_select` and every `before_agent_start`,
  so a model switch mid-session moves it in or out, and no request carries
  both kinds of search.
- `--tools` without `web_search`, a person's own search or fetch tool
  (MCP-namespaced ones included), or another extension's `web_search` all
  take precedence. The key file is read at every run and every call, so a
  saved, replaced or removed key applies from the next prompt without
  restarting Pi.

## For the daemon (formats)

- **Key file** `~/.config/web-search/key.json`:
  `{"api_key", "backend": "brave"|"staan", "source": "own"|"site"}`. The
  daemon is the product writer, as with `~/.config/soniox/key.json`. The
  extension ignores other fields, so the daemon may add e.g. `set_at`. It uses
  the file only if it is a regular file owned by the person with no
  group/other bits (no symlink) and at most 4096 bytes. `api_key` must be
  8–512 printable ASCII characters without spaces.
- **Refusal mark** `~/.config/web-search/state.json`, written by the extension
  when Brave refuses the key:
  `{"last_refused_at": "<ISO-8601 UTC>", "backend": "brave", "status": 401, "key_sha256": "<hex>"}`.
  `key_sha256` is the SHA-256 of `api_key`. The daemon shows the refusal only
  when the digest and `backend` match the current key, so a replaced key is
  clean even before the file is removed. The daemon removes the file when it
  saves a key, after the test search has passed. The extension removes it
  after a later successful search with the same key. It is written with
  temp+rename, mode 0600, and only into an existing real directory.
- **Native-search list**: `native-search.json` in the installed package, in
  the core runtime at
  `<runtime>/node_modules/@open-habitat/pi-web-search/native-search.json`
  (the same parent as the bridge's `node_modules/pi-claude-bridge`):
  `{"schema": 1, "providers": [{"provider": "openai-codex", "api": "openai-codex-responses"}, {"provider": "openai", "api": "openai-responses"}, {"provider": "anthropic", "api": "anthropic-messages"}, {"provider": "claude-bridge"}]}`.
  The daemon needs only `provider`. Each of the person's credentials whose Pi
  provider is listed searches natively, and the rest (`deepseek`) need the
  key. `api` narrows an entry to the provider's own API, as the extension
  does.
- **Test search on save**, made by the daemon itself (the extension is not
  run for it):
  `GET https://api.search.brave.com/res/v1/web/search?q=<query>&count=1&text_decorations=false`
  with `Accept: application/json` and `X-Subscription-Token: <key>`, no
  redirects followed. 2xx means it works. 401 or 403, or 422 with
  `error.code` starting `SUBSCRIPTION_TOKEN_`, means refused
  (`search_key_rejected`). 429 or 402 means a limit (`search_limit_reached`).
  Anything else, or a network error, means unavailable (`search_unavailable`).
  These are the extension's own `backends.brave.outcome` rules.

## Decisions for later review

- **The refusal mark names its key by SHA-256**, not by the key or its
  suffix. A save clears it, and a different key never inherits it, even if
  the daemon fails to remove the file. Alternative: a bare `last_refused_at`
  compared with a save time, which would need a `set_at` the speech key file
  does not have.
- **A later successful search clears the mark.** A refusal that has ended
  (Brave had a fault, a plan was renewed) should not stay on the person's
  row. Alternative: only the daemon clears it, so a stale warning stays until
  the next save.
- **The mark is beside the key in `~/.config/web-search/`**, not in
  `~/.local/state`. The daemon already opens that directory safely for the
  key, the speech key's directory handling fits as is, and the daemon (like
  the speech key) ignores XDG variables.
- **Rate and plan limits (429, 402) leave no mark.** A new key would not fix
  them, and the row's refusal state says "replace the key". 422 counts as a
  refusal only with `SUBSCRIPTION_TOKEN_*`, because Brave has answered an
  invalid key that way while other 422s are malformed requests.
- **The Claude subscription (`claude-bridge`) counts as searching natively
  everywhere.** Open Habitat's runtime turns on the bridge's WebSearch. I did
  not find a reliable way for the extension to see whether a bridge has it,
  since a terminal Pi in Habitat loads the patched bridge without the
  companion. Erring the other way would give one conversation two search
  tools. Plain Pi with an unpatched bridge therefore gets no key search on
  the Claude subscription, which was already the case.
- **OpenAI at minimal reasoning effort gets neither kind of search.** OpenAI
  refuses native search there, and switching tools by effort level would
  change the tool set within a conversation.
- **No fallback to the key after a provider refuses native search.** It
  would put a second search tool into a conversation that has already used
  the first.
- **Staan is reserved, not implemented.** `backend: "staan"` is a valid key
  file, but no tool is offered and no request shape is invented until
  coverage is verified and the API is chosen. The product hides Staan
  meanwhile.
- **The tool is registered at `session_start`, only if no other extension
  has a `web_search`.** Pi 1.5.2 treats a tool-name conflict between
  extensions as a load error and exits. Registering at load would have
  stopped Pi from starting for anyone with their own `web_search`
  extension, in Habitat too, because the runtime always loads this one.

## Checks

- Extension: `npm test` 21/21 under `umask 077`, real pinned Pi against
  synthetic DeepSeek, OpenAI and Brave endpoints: key search, refusal mark
  and clearing, native exclusion, `--tools`, Pi started without `--tools`, a
  foreign `web_search`, key file safety. The same suite passed with
  `PI_WEB_SEARCH_TEST_PACKAGE=git:github.com/Open-Habitat/pi-web-search@v0.2.0`
  (plain-Pi git installation of the published tag).
- Independent review: one finder (gpt-6-astra) on the extension diff. It
  raised five candidates; three were confirmed and fixed: foreign
  `web_search` handling, which led to the startup-conflict fix above,
  MCP-namespaced precedence, and a temp-file race. Two were dropped as
  narrow or self-healing.
- Product: the lock's integrity matches the released asset's sha512.
  `./scripts/test-focused.sh --area go --go-package ./internal/host` passed.
  The verifier source golden was refreshed without a contract bump: the only
  change in the hashed files is the pinned version in `validCoreRuntime`,
  as in the v0.1.0 pin. `scripts/test-profile-runtime-build.py` passed.
  `./scripts/build-core-runtime.sh` built a new core: archive sha256
  `f7c01a300d77…`, 22596 files. The package with `native-search.json` is
  under `runtime/node_modules/@open-habitat/pi-web-search/`, and
  `runtime/web-search/extension.mjs` is unchanged as the entry point.
  `TestReleaseClosureBuiltCore` passed on it. The build ran on the
  infrastructure server, because the agent host's `/var` (shared with
  Open Habitat's data) had too little room.

## Live check

The person-facing part comes with `web-search-key-product`; until then
nothing writes the key file. On an installation with this core, as a person
with a DeepSeek key: write a Brave key to `~/.config/web-search/key.json`
(0600, `"backend": "brave", "source": "own"`). A new DeepSeek conversation
asked about today's news calls `web_search` and cites links. A ChatGPT or
Claude conversation shows no `web_search` tool. With a deliberately wrong
key, the agent says Brave refused the key, and `state.json` appears with the
key's digest.
