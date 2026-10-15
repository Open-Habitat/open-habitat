# Pi model selection

The browser reads Pi 0.85.1's OpenAI Codex model availability and the global default through the mapped-user daemon. Choosing a model calls Pi's `SettingsManager.setDefaultModelAndProvider`, flushes, and reads the native settings back. The same selector appears in account settings and, on demand, the conversation details; the unsupported-model notice opens the details with the choice expanded. A newly started conversation reads the selected global default through Pi. No host model setting is stored.

## Decisions for later review

- Pi's available-model catalog checks provider authentication, not this particular ChatGPT account's entitlement for every model. The selector explains that a model may still be rejected at send time; no speculative entitlement probe is made.
- The selector changes the **global default for new conversations**, not a running Pi session. After an unsupported-model failure, the user must start a new conversation. A future per-session switch requires a separate decision about native Pi session control and how existing browser/terminal sessions interact.
- This selector is scoped to the signed-in `openai-codex` provider; other providers remain Pi-native terminal configuration until their authentication and product presentation are designed. A non-Codex native default is shown without offering models from an unsigned-in provider.
- The helper restores Pi's cached model catalog offline with a provider-scoped refresh. This includes configured and cached models without triggering unrelated providers' key resolvers or network catalog fetches. New catalog entries still require Pi to refresh its native cache.

## Validation

The disposable Pi native-home test exercises missing credentials, a native device sign-in, a cached model entry, selection, readback from `settings.json`, another provider's existing default, unknown-model rejection and a settings symlink refusal. Browser coverage opens the selector from an unsupported-model notice, writes the fixture user's Pi-shaped native settings, and starts a new fake Pi session whose saved assistant metadata identifies the selected model. The browser fixture does not run inference; the native-home test proves the real SDK write/readback. The first full clean gate passed Go/contracts and 158 of 159 browser cases, but the longer details popover intercepted the unrelated status-check button in a receipt-recovery case. The model choices now expand only on demand; both the receipt-recovery case and unsupported-model journey pass in a focused rerun.
