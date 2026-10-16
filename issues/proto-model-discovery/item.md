---
created: 2026-10-16
updated: 2026-10-16
type: task
reporter: jari
status: done
priority: high
lane: proto-models
lane_seq: 1
collision: [design-system/prototypes/rounds/proto-model-discovery]
preparation: ready
closed: 2026-10-16
---

# Prototype: model discovery and choice

Jari, 2026-10-16: "tehdään tähän sellainen mallien discovery ja valinta." OpenAI's current models are `gpt-6-luna`, `gpt-6-terra`, `gpt-6-sol` and `gpt-6-astra`. The product should (a) detect which models the person's account can actually use, (b) offer the person a choice among them, and (c) carry the related configuration. Prototype first, as for every new feature. The server-side capability is researched in parallel in `research-model-discovery`.

Evidence from 2026-10-16: Pi's catalog lists models the account cannot use. `gpt-5.5`, `gpt-5.4` and `gpt-5.4-mini` are listed but refused on the Codex route with a ChatGPT account, by Pi 0.85.1 and by OpenAI's own Codex CLI 0.156.1 alike ("The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account"). `gpt-6-astra` answers. Catalog presence is not entitlement (`issues/pi-not-answering-live/result.md`).

Prototype: where the person sees and chooses models (settings default, the conversation's model popover, a new conversation, and recovery from the unsupported-model notice); how detected, unavailable and unknown models look; per-provider groups (OpenAI subscription vs API key, later Claude); the thinking level next to the model; what happens when detection fails or is stale; and how a new model family appears. Follow `design-system/prototypes/AGENTS.md` ("Prototyyppiworker"). Keep consistent with `proto-settings-admin` (round `2026-10-15-asetukset`) and `proto-agent-harnesses` (`2026-10-16-agentit`).

## Acceptance Criteria
- [x] Round verified with check.mjs (light, dark, phone, interactions).
- [x] `result.md` per the prototype worker rules, listing which host facts the view assumes, so it can be matched against `research-model-discovery`.
