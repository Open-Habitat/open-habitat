---
created: 2026-10-16
updated: 2026-10-16
type: improvement
reporter: jari
status: open
priority: normal
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
---

# Thinking blocks without a title use the first line of their first paragraph

Jari, 2026-10-16 ~19:05 local: thinking block titles work with OpenAI models, which give a title ("Interpreting extension messages"), but Claude's thinking has no title, so the row shows only the generic label. When a block has no title, use roughly the first line of its first paragraph as the title (truncated to one line), for every provider.

## Acceptance Criteria
- [ ] Untitled thinking blocks show the first line of the first paragraph as their title; titled blocks unchanged (component test with OpenAI- and Claude-shaped history).
