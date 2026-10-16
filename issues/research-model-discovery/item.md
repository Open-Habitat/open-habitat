---
created: 2026-10-16
updated: 2026-10-16
type: task
reporter: jari
status: open
priority: high
lane: research-models
lane_seq: 1
collision: [issues/research-model-discovery]
preparation: ready
---

# Research: discovering entitled models natively

Research for `proto-model-discovery` (Jari, 2026-10-16). How can the host learn, as the mapped user and through native tools, which models a person's account can actually use, and keep the choice configured natively? Current OpenAI models: `gpt-6-luna`, `gpt-6-terra`, `gpt-6-sol`, `gpt-6-astra`. Pi's catalog also lists models (`gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`) that the Codex route refuses for a ChatGPT account. OpenAI's Codex CLI 0.156.1 refuses `gpt-5.5` the same way, so the refusal is OpenAI's, not Pi's.

Questions:
- What do Pi (installed 0.85.1; npm `@earendil-works/pi-coding-agent` latest is 1.3.0), Codex CLI and the provider APIs offer for listing *entitled* models (for example a Codex backend models endpoint, `pi --list-models`, or a registry refresh)? What changed in Pi 1.x about models and the gpt-6 family?
- Is a cheap probe acceptable as a fallback (cost, rate limits, ToS), and when should it run?
- Where does the choice live natively (Pi `settings.json` default, per-session model, thinking level), and what does the browser contract need?
- How should catalogs, entitlement and staleness be handled without a parallel store (project principle: native tools own their configuration)?
- Should the test server's Pi be upgraded to 1.x? List the risks.

Deliver `issues/research-model-discovery/report.md` with sources and a recommendation, plus a proposed architecture sketch `issues/research-model-discovery/architecture.md` (proposal for Jari, not an ADR).

## Acceptance Criteria
- [ ] report.md with sourced findings and a recommendation.
- [ ] architecture.md: discovery mechanism, where results live, contract additions, failure and staleness handling.
