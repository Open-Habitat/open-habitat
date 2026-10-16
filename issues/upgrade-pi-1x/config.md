# Pi configuration proposal for Jari

Pi 1.3.0 remains the authority. The browser is another client of the same Unix user's runtime, files and sessions, not a second configuration service.

## Default model and thinking

The current browser selector writes `defaultProvider` and `defaultModel` using Pi's `SettingsManager`, then reads them back from `~/.pi/agent/settings.json`. It offers the newest numbered chat candidate in each of luna, terra, sol and astra on `openai-codex`, taking numeric generations from Pi's offline bundled/cached catalog. Missing families are omitted. Older generations and preview aliases are not offered. An older saved default is shown as native state, not silently rewritten by a list request. Catalog membership and credentials do not prove entitlement.

For this upgrade only, the operator makes one small real request per present family and saves the newest working model as the test account's native default (prefer 6.1 Sol if it answers). On the guest all four answered: `gpt-6-luna`, `gpt-5.6-terra` (no 6-terra listed), `gpt-6.1-sol`, `gpt-6-astra`; the saved default is `openai-codex/gpt-6.1-sol`. This is not a background discovery feature. A future browser verification action should explicitly consume usage, test one selected model, and never replay a rejected message automatically. The full picker design awaits `proto-model-discovery` evaluation.

Proposal: add thinking controls through the mapped daemon's native Pi API, using the selected model's supported levels. Pi 1.3 supports `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, clamped per model. Distinguish the active session's `set_thinking_level` from persisted `defaultThinkingLevel`/`modelThinkingLevels`. Do not reset existing levels during an upgrade. Terminal `/model` and `/thinking` can save defaults with Ctrl+S. Native project settings can override startup defaults, and continuing a conversation restores its recorded model/thinking rather than applying a new-session default.

## Provider login: keep identities, no migration

Keep the browser device login, status and selection on `openai-codex` for now. Pi 1.3 still supports that OAuth route and its native `auth.json` entries. Do not copy/rename tokens to the new `openai` provider: different catalog/auth/routing semantics are not interchangeable. Existing `openai-codex` sessions retain their provider. The daemon's generic RPC continuation does not rewrite `openai` sessions either; a person may separately configure `openai` through native Pi. The browser does **not** claim to onboard an openai-only account in this release.

Proposal: when multi-provider browser login is wanted, carry an explicit provider identity through login/status and model selection. Model IDs alone are ambiguous across providers. List only the selected provider's candidates and keep authentication failure distinct from unsupported-model failure. There is no host-owned entitlement or credential database.

## Extensions, tools and trust

People own their native `settings.json`, extensions, packages, skills and project configuration. Pi's resource loader and project-trust rules still apply. Browser RPC starts the CLI, not a separate host SDK agent with a different tool set. Pi 1.3 loads built-in extensions; codemode/tool_search are inactive by default but configured MCP servers can activate them. This upgrade does not enable extra tools or install MCP servers. `--tools` alone is not an MCP isolation policy. An extension has the mapped user's permissions, including access to that user's credentials; Unix UIDs remain the isolation boundary.

Proposal: start with a read-only browser explanation of effective native configuration. Installing executable extensions or changing MCP connections needs a deliberate per-user action and a separate contract, not an opaque JSON settings editor. The host must never execute a different user's resources. Fullscreen is only a native TUI default; the browser continues explicit `--mode rpc`.

## Ownership and contract

- Person through browser: current device login and new-session model default, through the mapped daemon and Pi APIs. Later: explicitly scoped thinking/provider/resource controls.
- Person through terminal: native Pi configuration, login, defaults and sessions; changes remain visible to the browser.
- Fleetrepo: reproducible alder and guest runtime installations/version/integrity pins. Alder's settings change belongs to its separate Fleetrepo task, never this product worker. Guest smoke-test defaults are ordinary mapped-user Pi settings, not root-owned host state.
- Product: validates supported runtime layout/version, translates bounded RPC events and exposes native state. No preference mirror.

No browser schema shape changes are needed for the 1.3 runtime upgrade or four-family filtering; the contract scenario now names 1.3.0. Later provider-aware selection needs `(provider, model)` identities, thinking needs supported/current/default levels and explicit session-versus-default writes, and extension management needs a separately reviewed capability surface. Thinking live projection consumes 1.3's delta-only visible text. Native providers keep signatures and encrypted redacted payloads outside `delta`; those opaque fields never cross the browser contract.
