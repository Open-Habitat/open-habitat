# Browser representation observed on 3 October 2026

This is the implementation comparison from the original Pi catalogue, recorded
in commit `b966ccd`. Its parent, [73821cd](https://github.com/maintainer/native-agent-host/tree/73821cdd9aab7d2b74ea54c59ebbfecf2a5afbf7),
is the product source snapshot for the file and line references below. These are
source-code observations, not a new browser run or a list of defects known to
remain in later releases. The original research used no credential-bearing run.

The table explains why typed delivery was needed. The current work belongs to
[carry-typed-pi-events](../carry-typed-pi-events/item.md); the
[catalogue overview](analysis.md) separates Pi's data model from presentation
choices. A field missing from the old browser representation is not by itself
a requirement to expose it: signatures, diagnostics and extension metadata have
different purposes from visible content.

Native history is read from `.pi/agent/sessions`, version 3 headers, bounded per-file and displayed only on active leaf ancestry (`internal/daemon/history_linux.go:25-29,157-169,220-329`). A separate windowed reader follows the same `nativeText` projection (`internal/daemon/history_window_linux.go:105-112`). Contract accepts only five history kinds (`contracts/v1/history.schema.json:35-82`). The browser chooses corresponding components (`web/src/app/HistoryView.tsx:104-180`, `web/src/components/Conversation.tsx:141-223,365-385,592-720`).

| Pi entry / event | Observed browser representation | Gap |
|---|---|---|
| User message text; text blocks | `user` → `UserMessage` | Array flattened into string, structure/signatures lost (`internal/daemon/history_linux.go:296-325`; `web/src/app/HistoryView.tsx:116-118`). |
| User `image` | Encoded raw unsupported block inside `user` text | No image preview, MIME/base64 treated as text; potentially huge (`internal/daemon/history_linux.go:312-323`). |
| Assistant `text` | `assistant` → Markdown | Text block boundaries, signatures, stop reason, usage, model, errors not represented (`internal/daemon/history_linux.go:280-325`; `web/src/app/HistoryView.tsx:119-139`). |
| Assistant `thinking` / redacted thinking | Unsupported raw block string inside assistant | No distinct thinking view or redaction semantics (`internal/daemon/history_linux.go:312-323`). |
| Assistant `toolCall` | `Työkalu: <name>` line inside assistant | Arguments, ID, namespace, ordering/association to result discarded (`internal/daemon/history_linux.go:315-316`). |
| `toolResult` text/image/details/isError/usage | `tool` → `ToolRow`/`ToolOutput`, first text line parsed as tool name | Tool name retained in flat prefix, but details/error flag/image/usage lost; arbitrary result may not be safe to parse by first line (`internal/daemon/history_linux.go:289-325`; `web/src/app/HistoryView.tsx:141-165`). |
| `bashExecution`, `custom`, custom extension message | `unknown` with raw message payload (bash content cannot be parsed via `content` field) | No local-command block, visibility semantics or typed extension rendering (`internal/daemon/history_linux.go:280-327`; `web/src/app/HistoryView.tsx:169-179`). |
| `model_change` | `model_change` → `ModelChange` provider/model string | No structured model metadata (`internal/daemon/history_linux.go:278-279`; `web/src/app/HistoryView.tsx:166-168`). |
| `thinking_level_change`, `compaction`, `branch_summary`, `label`, `session_info`, `custom`, `custom_message` | `unknown` → `UnknownEvent` with raw JSON text | Summary, marker, metadata and display:false are not visually distinguished; raw data can be large (`internal/daemon/history_linux.go:326-327`; `web/src/app/HistoryView.tsx:169-179`). |
| `agent_start`, `turn_start`, `message_update:text_delta`, `tool_execution_start/end` | Live run/turn activity, `assistant.delta`, `tool.started/finished` | Only text delta and tool ID/name/state; no streamed structured args/result (`internal/daemon/pi_events_linux.go:29-54`; `web/src/app/conversationEvents.ts:114-179`). |
| `message_update` other nested types, `tool_execution_update`, retry/compaction events | Retained in short private tail subject to truncation but not promoted as semantic journal events | Thinking, tool-arg deltas, partial result, retry and compaction progress not shown (`internal/daemon/pi_events_linux.go:57-109`; `web/src/app/conversationEvents.ts:114-125`). |
| `queue_update` | `queue.changed` + queue UI | Strings preserved after validation, not a conversation block (`internal/daemon/pi_events_linux.go:110-133`; `web/src/components/Conversation.tsx:1037-1095`). |
| `extension_ui_request` select/confirm/input | Question panel; validated prompt/options | Title/message distinction, timeout, placeholder lost; editor converted to unknown question (`internal/daemon/pi_events_linux.go:135-207`; `web/src/components/Conversation.tsx:271-363`). |
| `extension_ui_request` notify/status/widget/title/editor text | Safe text in `unknown.native`, not a question | No dedicated status/widget/notification renderer (`internal/daemon/pi_events_linux.go:165-171`; `contracts/v1/event.schema.json:34-55`). |
| `agent_settled` | `turn.settled`, history refreshed | Settlement is lifecycle, not message content (`internal/daemon/pi_events_linux.go:211-241`). |
| `RpcResponse` and other commands | Controller consumes command acknowledgments privately | Not conversation rows; may produce receipt/uncertain states (`internal/daemon/pi_rpc_linux.go`; `web/src/components/Conversation.tsx:1097-1160`). |

The live private tail retains at most 64 frames and replaces frames over 8,192 bytes with `{type,truncated:true}`; model errors are redacted in browser-visible status (`internal/daemon/pi_events_linux.go:57-101`). Tool output/history content is chunked by the product's own content contract, not a lossless Pi export (`contracts/v1/history.schema.json:35-82,101-130`; `internal/daemon/history_linux.go:330-345`). This browser projection therefore cannot serve as an archival source of Pi message metadata.
