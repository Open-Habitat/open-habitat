---
created: 2026-11-10
updated: 2026-11-10
type: feature
reporter: jari
status: open
priority: normal
related: ['@pi-web-search-capability']
preparation: ready
lane: web-search
lane_seq: 2
---

# Provider-native web search for every agent, Claude subscription included

## Description

Jari 10.11.2026 (decisions in `pi-web-search-capability`): every Open Habitat
installation's agents get web search with no setup through the provider the
person already uses. A small Habitat-owned Pi extension in the core runtime,
built on existing community extensions as its base (credit and licence
checked), injects provider-native search: OpenAI Responses `web_search` for
`openai-codex` (ChatGPT subscription) and `openai`, Anthropic server-side web
search/fetch for `anthropic` API keys. **The Claude subscription must work
too**: pi-claude-bridge currently starts Claude Code without its built-in
WebSearch/WebFetch on the provider path; enable them there (configuration,
a patch carried in the pinned runtime, or an upstream change), so a
Claude-subscription person searches like everyone else. Other providers get
nothing from this route (key-based search follows separately).
Research and the live probe: `issues/pi-web-search-capability/research.md`.
