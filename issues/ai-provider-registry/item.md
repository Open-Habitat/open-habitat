---
created: 2026-11-24
updated: 2026-11-28
type: feature
reporter: Jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-24/ai-provider-registry
lane: ai-providers
lane_seq: 1
preparation: pending
---

# AI options: a provider registry with GLM, Kimi, MiniMax, Qwen and other Pi providers, global and China endpoints

## Description

## What Jari asked (24.11.2026)

Add the Chinese model providers (GLM, Kimi, MiniMax, Qwen) as AI options in
the product, so that Open Habitat can later be introduced in China. Agreed
direction: yes, and as a general provider registry rather than one more
hard-coded name.

## Why

- **China.** Anthropic and OpenAI do not serve mainland China or Hong Kong, so
  the headline "ChatGPT or Claude subscription" does not exist there. Today the
  only browser option that works from the mainland is a DeepSeek key
  (private launch-channel research, 24.11.2026).
- **Beyond China.** GLM, Kimi, MiniMax and Qwen sell inexpensive coding plans
  meant for third-party agents. They give every team a cheap, terms-safe API
  key, which multiplayer conversations now require, and a fallback if the
  Claude-subscription bridge stops working.
- **Pi already supports them.** Built-in providers with global and China
  endpoints: Moonshot/Kimi (`MOONSHOT_API_KEY`, `KIMI_API_KEY`), Z.ai GLM
  coding plan (`ZAI_API_KEY`, `ZAI_CODING_CN_API_KEY`), MiniMax
  (`MINIMAX_API_KEY`, `MINIMAX_CN_API_KEY`), Qwen token plans (team and
  individual, each with a CN variant), Xiaomi MiMo, OpenRouter. DashScope
  pay-as-you-go and SiliconFlow are open Pi pull requests (#11369, #11370).
  Source: Pi `packages/coding-agent/docs/providers.md`.

## What is in the way

The provider set is hard-coded in several places, each listing openai,
anthropic and deepseek (plus openai-codex and claude-bridge where relevant):
`internal/daemon/pi_credentials_linux.go` (`piKeyProviders` and the result
struct), `internal/daemon/ai_refusal_linux.go`,
`internal/daemon/recap_settings_linux.go` (`recapModelPattern`),
`internal/cli/agent_integrations_linux.go`, `internal/cli/agent_models_linux.go`,
the onboarding contract `contracts/v1/server-onboarding.schema.json`
(`deepseek_key`, site key `openai|anthropic|deepseek`), `docs/product.md`,
and the web texts and model field (`web/src/text/aiSignIn.ts`,
`onboardingSettings.tsx`, `models.tsx`, `components/ModelField.tsx`).

## Direction

- One provider registry the daemon, CLI, contract and browser read, derived
  from or checked against the providers Pi actually has, with the region
  endpoint (global / China) as part of the choice.
- The administrator chooses which providers are offered, as today.
- The server's shared key may come from any registered provider.
- The contract change goes through `contracts/v1` review, since it changes the
  browser/host contract.

## Before it is advertised

Agent quality on these models is a separate question from wiring. A short
evaluation of real Open Habitat tasks (files, Git, integrations, workers) on
DeepSeek, GLM, Kimi, MiniMax and Qwen should say which ones can carry the
"coding-grade" promise before any Chinese-language announcement names them.

### 2026-11-28 · @jari (via conductor)

We want to support Chinese developers. Research the providers' models and plans (subscription vs API key), add Google and xAI Grok, and prototype how every model surface looks with them, subscription and API-key flows visible.
