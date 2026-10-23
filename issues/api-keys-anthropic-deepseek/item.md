---
created: 2026-10-23
updated: 2026-10-23
type: improvement
reporter: jari
status: open
priority: normal
related: ['@proto-admin-server-onboarding']
preparation: ready
lane: unlaned
collision: [contracts/v1/pi-credentials]
---

# Anthropic and DeepSeek API keys

## Description

Jari 2026-10-23: support Anthropic and DeepSeek API keys alongside the OpenAI key. Pi supports both natively (`ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`; see `pi --help`), but Open Habitat accepts only OpenAI today: `contracts/v1/pi-credentials.schema.json` knows only `openai`, the daemon's `pi_credentials_linux.go` accepts only `provider: "openai"` with an `sk-` key, and the conversation/first-model provider list is `openai-codex | openai | claude-bridge`.

Add both providers end to end in the native way (keys stored in the person's own Pi credentials as Pi stores them, never in a product store): contract, daemon validation and write, provider/model lists and the model chooser, Settings › AI-tilit and the onboarding AI step (`PiCredentials`). Found in `proto-admin-server-onboarding` round 3.

## Acceptance Criteria

- [ ] A person can add, replace and remove an Anthropic and a DeepSeek key; Pi uses it (native evidence with a synthetic key against a fake endpoint where the tests already do this for OpenAI); models of the provider appear in the chooser; contract drift check green; tests at the daemon and browser boundary.
