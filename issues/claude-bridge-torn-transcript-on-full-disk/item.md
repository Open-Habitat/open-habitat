---
created: 2026-11-17
updated: 2026-11-21
type: bug
reporter: jari
status: testing
priority: high
provenance: chat
source_ref: chat:2026-11-16/claude-bridge-torn-transcript
lane: unlaned
lane_seq: 1
preparation: ready
---

# Full disk leaves a torn line in the claude-bridge transcript; every later turn fails at once with an empty 'Epäonnistui'

## Description

16.11.2026 on the staging installation, after the home quota filled up: conversations that use the claude-bridge provider broke permanently. The bridge keeps its own Claude transcript (~/.claude/projects/<cwd>/<session>.jsonl) separate from the Pi session; the write stopped mid-line, and the next entry was appended straight after the partial line. The bridge reads the transcript on every turn, so every message failed within milliseconds (JSON parse error "Expected ',' or '}' … position 130"). It did not recover after space was freed. The browser showed only an empty "Epäonnistui"; the parse error was in the session but not shown. Another agent repaired four transcripts by hand (main conversation and three subagents) by removing the torn line and two dangling entries; originals kept privately.

Related: session-partial-last-line-locks-conversation (fixed 29.10. for Pi's own session file) covered Pi's history, not the bridge's transcript.

Expected: (1) writers start every new entry on its own line (a torn tail is never glued to the next entry); (2) the bridge (or Habitat around it) tolerates or repairs a torn final line, as Pi's damaged-history handling does, and says so; (3) a failed turn shows the actual error class to the person instead of an empty 'Epäonnistui'.

## Comments

### 2026-11-21T07:57:35Z · @conductor

21.11.2026: reported upstream with Jari's approval: https://github.com/elidickinson/pi-claude-bridge/issues/281 (proposal from result.md, offer of a PR with tests). When upstream ships a fix, remove the companion guard.
