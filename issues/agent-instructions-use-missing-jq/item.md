---
created: 2026-11-22
updated: 2026-11-22
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: kokeiltavaa:2026-11-22/agent-instructions-use-missing-jq
lane: unlaned
preparation: ready
---

# Agent system instructions tell the agent to use jq, which the installation lacks

## Description

Test server (pilot.833, 22.11.2026): the helpers section of Habitat's agent instructions lists own helpers with 'taskfleet run list --json | jq …', but 'which jq' is empty. Either jq becomes a runtime requirement or the instruction works without it (a taskfleet filter or python3).
