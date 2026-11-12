---
created: 2026-11-12
updated: 2026-11-12
type: task
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-11-12/models
lane: unlaned
preparation: ready
closed: 2026-11-12
---

# Update runtime to the newest OpenAI and Anthropic models (Pi 1.5.2, bridge 0.12.0)

## Description

Jari 12.11.2026: the model lists still show Claude Fable 5.1 although Fable
5.2 was released on 9.11.2026; update the system to the newest OpenAI and
Anthropic models. The shipped core runtime pins
`@earendil-works/pi-coding-agent` 1.3.0 (models: claude-fable-5, -5-1;
gpt-6-astra/luna/sol, gpt-6.1-sol) and `pi-claude-bridge` 0.9.3. npm now has
pi-coding-agent/pi-ai 1.5.2 (10.11.: adds claude-fable-5-2, gpt-6.1-terra)
and pi-claude-bridge 0.12.0 (adds claude-fable-5-2). Bump the runtime pins and
whatever product defaults/fixtures name older models.
