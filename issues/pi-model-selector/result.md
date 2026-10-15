# Pi model selection

The browser reads Pi 0.85.1's OpenAI Codex model availability and the global default through the mapped-user daemon. Choosing a model calls Pi's `SettingsManager.setDefaultModelAndProvider`, flushes, and reads the native settings back. The same selector appears in account settings and the conversation details; the unsupported-model notice opens the details. A newly started conversation reads the selected global default through Pi. No host model setting is stored.

## Decisions for later review

- Pi's available-model catalog checks provider authentication, not this particular ChatGPT account's entitlement for every model. The selector explains that a model may still be rejected at send time; no speculative entitlement probe is made.
- The selector changes the **global default for new conversations**, not a running Pi session. After an unsupported-model failure, the user must start a new conversation. A future per-session switch requires a separate decision about native Pi session control and how existing browser/terminal sessions interact.
- This selector is scoped to the signed-in `openai-codex` provider; other providers remain Pi-native terminal configuration until their authentication and product presentation are designed.

## Validation

The disposable Pi native-home test exercises missing credentials, a native device sign-in, selection, readback from `settings.json`, unknown-model rejection and a settings symlink refusal. Browser coverage opens the selector from an unsupported-model notice, changes the default via an intercepted native-shaped response, then starts a new conversation. The browser fixture does not actually run a model inference; the native-home test proves the default write/readback.
