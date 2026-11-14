---
created: 2026-11-14
updated: 2026-11-14
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-14/slash-builtins
lane: unlaned
lane_seq: 1
collision: [web/src/components/composer/Composer.tsx]
preparation: ready
---

# Pi's built-in slash commands missing from the / list; unknown commands break the composer

## Description

Jari 14.11.2026 (test server): typing a slash command that is not in the
composer's `/` list (skills and prompts), for example `/compact`, makes the
composer misbehave ("käyttöliittymä temppuilee"). Pi's own built-in commands
should be in that list too.

Expected:
1. The `/` list offers the built-in commands that work in a browser
   conversation (at least `/compact`, which Habitat already supports from the
   context view), with a one-line description, next to skills and prompts.
2. Typing any `/word` that matches nothing, or a built-in Habitat cannot run,
   never breaks the composer: the text stays editable, the list closes or says
   no match, and sending it behaves predictably (sent as text, or a clear
   notice that the command is not available here).
