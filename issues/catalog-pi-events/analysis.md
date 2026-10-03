# Pi conversation data: how the pieces fit together

Pi records a conversation as a tree of session entries. A message entry can
contain several ordered blocks: text, thinking, images or tool calls. While Pi
works, live events describe changes to those messages and the progress of tools.
The browser needs both the saved content and these updates to show the same
conversation during a turn and after returning to it.

This catalogue describes the pinned Pi 0.85.1 examined on 3 October 2026. The
[session, message and RPC reference](analysis-types.md) contains the exact fields,
examples and source locations. The [tool and extension reference](analysis-tools.md)
covers tool arguments, results and hooks. The [browser comparison](browser-observations.md)
records what the host lost at the time of the research.

## From one tool call to its saved result

Suppose the assistant reads `README.md`. Its message contains a `toolCall` block
with an ID, the name `read` and arguments such as `path`. Argument updates may
arrive while the model is still producing the call. Pi then emits
`tool_execution_start`, possible `tool_execution_update` events and
`tool_execution_end`, identifying that call with `toolCallId`.

The saved result is a message with `role: toolResult` and the same `toolCallId`.
Its content can be text or images, with an error flag and tool-specific metadata.
The call, execution progress and result describe one tool use. Their distinct
native types preserve the relationships the browser needs; they do not prescribe
three separate visual blocks.

An assistant message can interleave thinking, text and multiple calls. Content
order and call IDs matter. A `message_update` changes a message in progress;
`contentIndex` identifies a block within it. A `partial` payload contains the
response so far and grows with it. Argument deltas may be incomplete JSON until
the call is complete. See [the live-event reference](analysis-types.md#b-streaming-agentsession-events-not-jsonl-entries).

## Five kinds of information

| Kind | What it represents | How it relates to the conversation |
|---|---|---|
| Session entry | A saved message, model change, summary, label or session metadata | Entries have IDs and parent links. Reading the selected ancestry gives the conversation on that branch. |
| Message and content block | Who said something and its ordered text, thinking, images or calls | These hold the content a person reads, along with metadata such as usage and stop reason. |
| Live event | A content update, tool progress, retry, queue change or lifecycle transition | Updates the current presentation; many events describe the same message or activity. |
| RPC command or response | A request to Pi and its acknowledgement or returned data | A successful prompt acknowledgement says the request was accepted; it does not say the turn finished. |
| Extension hook | A callback inside Pi that can inspect or change an operation | It is not automatically written to history or forwarded through RPC. Provider hooks may carry credentials. |

Pi's `agent_end` can precede an automatic retry; `agent_settled` marks the point
where no automatic continuation remains. Neither is message content. A local
`!` or `!!` command has `bashExecution` content and output updates; it is distinct
from a model-requested `bash` tool call. Compaction and branch summaries have
saved entry forms and runtime message projections, which describe related data
rather than additional copies to display.

## Visible content and internal data

The same name can occur at different levels. A session entry with `type: custom`
persists an extension's own state. A message with `role: custom`, or an entry
with `type: custom_message`, can carry conversation content and has a `display`
flag. Hidden content remains hidden in the browser. These distinctions come
from Pi's [session and message types](analysis-types.md#a-persisted-session-jsonl-one-row-per-entry).

Thinking can be marked redacted. The visible presentation conveys that state;
opaque signatures used for provider continuity are not readable thinking.
Likewise, provider diagnostics, raw errors and arbitrary extension `details`
need to be understood before selecting browser-visible fields. The presence of
a field in a native type does not establish that it is display content.

Extension UI requests also differ in purpose. `select`, `confirm`, `input` and
`editor` ask the person something. `notify`, `setStatus` and `setWidget` provide
information; status or widget updates can also clear earlier content.
`setTitle` and `set_editor_text` request UI changes. Their exact protocol is in
the [RPC reference](analysis-types.md#c-rpc-mode-envelope).

## Using the catalogue in the host

Jari chose Pi's original typed shapes as the basis for the browser.
[carry-typed-pi-events](../carry-typed-pi-events/item.md) owns the contracts,
daemon handling, browser store and readable presentation. It accounts for the
catalogue's types and any excluded fields, preserves bounded content access,
and reconciles live updates with native history. Pi remains the durable history
source.

[design-pi-event-blocks](../design-pi-event-blocks/item.md) owns the finished
presentation. The following groups identify content and distinctions for that
work. They are design inputs, not a fixed component list or a requirement for a
separate card per native type. Grouping, expansion, footers and placement remain
design choices.

| Design input | Information or distinctions to preserve |
|---|---|
| User prompt | Text and image attachments, including their order. |
| Assistant response | Ordered text and code; model, usage and reason for stopping where relevant. |
| Thinking | Thinking content and its redacted state; streamed and completed content. |
| Tool call | Tool identity, arguments and progress; built-in and extension-defined tools. |
| Tool result | Association to the call, text or images, success or error, available diff metadata and truncation. |
| Local command | Command, incremental output, exit or cancellation outcome, truncation and exclusion from model context. |
| Compaction and branch summary | Summary content, what it refers to and available usage information. |
| Session markers | Model or thinking-level changes, session names and labels. |
| Visible extension content | Messages, notifications, status and widgets, including replacement or clearing. |
| Incoming question | Question content and available timeout information for select, confirm, input and editor requests. |
| Error and recovery | Aborted or limited responses, deferred work, retries and an understandable unknown-content fallback. |
| Queue and activity | Steering and follow-up queues, work in progress and settlement. |

The [agreed conversation-control scope](../build-agent-control/item.md) includes
showing incoming questions, while Pi-specific answer and cancel controls remain
outside it. Displaying command output or branch summaries likewise does not
add command execution or tree-navigation controls to the typed-delivery task.
The catalogue describes the data those features could use; their availability
in Pi is separate from a decision to build them in the host.
