---
created: 2026-11-21
updated: 2026-11-21
type: improvement
status: done
priority: normal
provenance: other
provenance_detail: research run measurement
source_ref: taskfleet:01m7yk0n7jprp9pdkvf539ybt1/finding:microsoft-server-name-hashes-tool-names
originating_run: 01m7yk0n7jprp9pdkvf539ybt1
originating_run_kind: research
closed: 2026-11-21
---

# Microsoft MCP server name makes Pi hash 92 of 100 tool names, hiding them from tool search

## Description

## Observed

Measured on 21.11.2026 with Pi 1.5.2 and the pinned Microsoft MCP server
0.170.1, synthetic account `aino.virtanen@contoso.test`.

Pi names an MCP tool `mcp__<server>__<tool>` and, when that is longer than
64 characters, cuts it and appends a hash. Habitat names a Microsoft
account's server after the whole address
(`habitat-microsoft-aino-virtanen-contoso-test`), so 92 of the 100 tools an
account offers at Full lose the end of their own name:
`list-folder-files` becomes
`mcp__habitat_microsoft_aino_virtanen_contoso_test__list_1a45ca8a`.

Pi's tool search (`searchTools()`, `tool_search`) weighs a query word in the
tool name three times its weight in the description. With the name cut off,
`searchTools("list folder files")` does not return `list-folder-files` in
its top 8 at all; with a short server name (`microsoft`) it is first. In a
scripted Pi run (cheap model, nothing signed in) the agent spent eight
scripts hunting through `list_845765b8`-style names before it found the
SharePoint tools. A longer address only makes it worse.

## Why it matters

This is one of the reasons an agent asked for a SharePoint file reaches for
mail-folder tools: the right tools lose their strongest search signal.

## Direction

Give the account's server a short name that keeps every tool name under 64
characters (for example `ms-…`, with a number for a second account) and put
the address in the entry's `description`, which Pi shows in the
`mcp_servers` system-prompt section and in `describeNamespace()`. The
topic-area design in `issues/agent-account-instructions-clarity/research-topics.md`
already assumes such names; this item stands on its own if that design waits.

## Resolution

### 2026-11-21T14:46:36Z · @issuectl

Fixed by 1eb971e6: Microsoft areas are named ms-<area>, so tool names are no longer hashed.
