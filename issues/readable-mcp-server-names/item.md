---
created: 2026-11-12
updated: 2026-11-12
type: improvement
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-12/mcp-names
lane: unlaned
preparation: ready
---

# Readable per-account Pi MCP server names instead of hex-encoded addresses

## Description

Jari 12.11.2026: the Pi MCP server names Habitat registers per account are
unreadable, e.g. `habitat-microsoft-706572736f6e406578616d706c652e74657374`
(the address hex-encoded, because Pi accepts only letters, digits, `_` and
`-`). They appear in the agent text. Decision: readable names, e.g.
`habitat-microsoft-aino-virtanen-contoso-test`, with a short suffix only when
two accounts would collide; existing registrations move to the new name
automatically (no re-sign-in). Same for other per-account native names that
use the same scheme (Atlassian/Trello piMCP, any others).
