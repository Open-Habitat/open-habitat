---
created: 2026-11-10
updated: 2026-11-10
type: feature
reporter: jari
status: done
priority: normal
related: ['@pi-web-search-capability']
preparation: ready
lane: web-search
lane_seq: 2
closed: 2026-11-10
closed_by: web-search-native-worker
commits:
- hash: 25d8a4302
  summary: provider-native web search
- hash: 8038aa775
  summary: keep cited sources, stay under pause
- hash: d7c2ac80e
  summary: pause notice
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

## Acceptance Criteria

- [x] ChatGPT-subscription, OpenAI-key and Anthropic-key agents get the provider's own search with no setup (extension in the core runtime, loaded by the daemon and the `pi` launcher).
- [x] A Claude-subscription agent searches through pi-claude-bridge (Claude Code's WebSearch/WebFetch enabled by a build patch), verified live on Birch.
- [x] Live on Birch in disposable homes: a ChatGPT-subscription search, a Claude-bridge search, and a long conversation with tool round trips and compaction.
- [x] Both architectures' core runtime rebuilt from the final inputs; licences and credits recorded.
- [x] Independent review and assessment; findings fixed.

## Resolution

### 2026-11-10T14:00:06Z · @web-search-native-worker

Provider-native search ships in the core runtime: the extension for ChatGPT/OpenAI/Anthropic and a build patch enabling Claude Code's WebSearch/WebFetch in pi-claude-bridge. Verified live on Birch for the ChatGPT and Claude subscriptions; API-key routes only against a synthetic endpoint. The release cut needs both rebuilt core archives (result.md).
