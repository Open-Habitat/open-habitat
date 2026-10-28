# Result

Recaps and automatic titles now choose their model through one shared policy,
`internal/daemon/background-model.mjs`, instead of the lowest declared price.
The policy picks the conversation provider's middle-tier family by alias or
name (Claude: newest Sonnet; OpenAI: newest Luna; Gemini: Flash; Mistral:
Medium; older OpenAI: Mini). It falls back to the conversation's own model and
never picks a Fable or Opus class model, not even as the fallback. The family
lists are data at the top of that file.

The recap extension imports the policy as a sibling file, which the daemon
writes beside it. The title helper gets the policy as a data URL, together
with the conversation's model: the running conversation's `startupChoice`, or
for a history title, the newest `model_change` on the native branch.

## Verification

- `node --test internal/daemon/pi-device-test/*.test.mjs`: 29 pass, including
  the new `background-model.test.mjs` (synthetic registry: bridge models that
  all cost 0 pick Sonnet; no middle tier picks the conversation model; Fable and
  Opus are never picked).
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: ok. The
  pinned-Pi recap test now lists Fable (free) first and asserts the asked
  models are `[claude-sonnet-5-5 fake]`. The title test has an Opus-class model
  that must never be called.
- Review: independent `/llm-review` (gpt-6-astra finder) + assessment. One
  confirmed finding was fixed: the title helper's runtime does not load
  pi-claude-bridge, so a bridge conversation had no candidate (see the second
  decision below).

## Decisions for later review

- **Family per provider.** Jari's 2026-10-28 correction set Claude to Sonnet
  and OpenAI to Luna. For the others I picked Gemini Flash and Mistral Medium as
  the middle tier, and OpenAI's older Mini as the last resort. The alternative
  was listing only Sonnet and Luna, which would send every other provider
  straight to the conversation model. A family's smaller variant
  (`flash-lite`, `nano`) ranks after it.
- **Titles for Claude-bridge conversations.** The title helper does not load
  pi-claude-bridge. Loading it would start a Claude Code process for each
  title within a 12-second budget, and no test here can exercise it. Instead,
  when the conversation's provider has no usable model in the registry, the
  policy uses another configured provider's middle tier (e.g. OpenAI Luna).
  Before this change, titles behaved the same way through the cheapest model
  of another provider. A bridge-only person still gets the plain fallback
  title, as before. The alternative is to load the bridge in the title helper
  like `pi_models_helper.mjs` does, and route the call through its isolated
  one-off path (`cacheRetention: 'none'`).
- **Unknown conversation model.** A history title with no `model_change` in
  the branch takes any configured provider's middle tier. A recap always knows
  its model.
- **Conversation model staleness.** A running conversation uses
  `startupChoice`, which the browser's model choice updates. A model changed
  inside Pi by other means is not seen until the next start.
