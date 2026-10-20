---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: open
priority: normal
lane: host-context
lane_seq: 2
collision: [host-context]
---

# File links do not appear in agent replies

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20: clickable file links (path:line opening in the editor) never appeared in replies, or he did not know how to ask for them. Check both ends: does the agent write paths in a form the UI recognises (relative workspace paths, path:line, backticks), and does detection work for real Pi/Claude/GPT output (code spans, markdown links, absolute ~/src paths)? Make detection robust to the forms models actually produce and tell the agent in the host context to reference files as workspace-relative path:line. Done: real-model sample replies in a lab render links; test cases from those samples.
