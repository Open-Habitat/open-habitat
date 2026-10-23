# Result: Anthropic and DeepSeek API keys

A person can add, replace and remove an Anthropic and a DeepSeek key beside the
OpenAI key, in Settings › AI-tilit and in the onboarding AI step's *Käytä
API-avainta tilauksen sijaan*. The keys live only in the person's
`~/.pi/agent/auth.json`, written by Pi's own `AuthStorage` as Pi's `/login`
writes them: `{"anthropic": {"type": "api_key", "key": "sk-ant-…"}}` and
`{"deepseek": {"type": "api_key", "key": "sk-…"}}` (pinned Pi 1.3.0,
`dist/core/auth-storage.js`; providers `anthropic` and `deepseek` in
`pi-ai/dist/providers/`).

## Evidence

- `TestPiCredentialsAnthropicAndDeepSeekNative` (daemon, real pinned Pi SDK and
  CLI): saves both keys, checks the native `api_key` form and that replies carry
  only the four-character suffix; the first key of each provider becomes Pi's
  default with Pi's own default model (`claude-opus-4-8`, `deepseek-v4-pro`);
  the model catalog lists both providers' models with newest-per-family
  grouping; Pi's CLI then sends the stored Anthropic key as `x-api-key` to
  `/v1/messages` and the DeepSeek key as `Bearer` to `/v1/chat/completions` of
  a synthetic endpoint (base URLs overridden in `models.json`); removal falls
  back to the remaining key and with no credential the account returns to
  onboarding.
- `TestPiCredentialsKeepsAnthropicSubscription`: a Claude Pro/Max OAuth record
  under `anthropic` is neither replaced nor deleted, and does not count as a key.
- Agent listener, gateway and CLI tests cover the per-provider removal routes
  and the required `--provider` on `agent credential update|delete`.
- Browser: `account-settings.spec.ts` adds Anthropic and DeepSeek keys, picks an
  Anthropic model from the chooser (`default_provider` becomes `anthropic`),
  and removes the Anthropic key while DeepSeek's stays.

## Decisions for later review

- **One literal-key shape for all three providers**: `^sk-[A-Za-z0-9_-]{20,200}$`.
  Pi itself accepts any string; the check exists only so that nothing Pi would
  run (`!…`) or expand (`$NAME`) is written. Anthropic keys (`sk-ant-api03-…`,
  about 108 characters) and DeepSeek keys (`sk-` + 32 hex) both fit. There is
  no provider-specific prefix check, so an OpenAI key pasted into the Anthropic
  row is stored and fails at first use, as it would with Pi's `/login`.
- **A provider's first key becomes the default** for new conversations, as the
  OpenAI key already did. Adding a DeepSeek key while an Anthropic key is the
  default therefore switches to DeepSeek; replacing a key changes nothing.
- **Removing the default's key** falls back to the ChatGPT subscription, then to
  another stored key in the order OpenAI, Anthropic, DeepSeek, and otherwise
  leaves Pi's default alone (the onboarding gate then applies).
- **Pi's own Anthropic sign-in is protected.** Pi stores a Claude Pro/Max OAuth
  login under the same `anthropic` id as the key. Saving or removing an
  Anthropic key refuses such a record (fixed `native_unavailable` reply) rather
  than replacing it. The browser's Claude subscription goes through the Claude
  bridge and is unaffected.
- **Chooser**: *Anthropic API* and *DeepSeek API* segments appear only when that
  provider has models, so the switch looks as before for people without those
  keys. *API-avain* is renamed *OpenAI API*.
- **Contract**: `pi-credentials` carries `anthropic` and `deepseek` beside
  `openai`; removal is `DELETE /api/v1/pi/credentials/{openai|anthropic|deepseek}`;
  provider enums of models, startup choice, model update and conversation create
  include both. The gateway allowlists exactly these three removal routes.
- **Agent CLI**: `agent credential update|delete` now require `--provider`; no
  default provider, since a removal must name its target.
- **Prototype rounds** `2026-10-23-palvelin-aloitus-2/-3` pass
  `providers={['openai']}` to `PiCredentials` so they look as they did; the AI
  step's layout is left to the redesign round.
- **Not done**: no browser case for adding a key during onboarding, because the
  browser host's onboarding status uses a separate fake Pi; the Go test proves
  that a key alone makes Pi usable.
