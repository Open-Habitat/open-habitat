# Pi 0.85.1 session, message and RPC field reference

## Source key and interpretation

This reference describes the installed Pi 0.85.1 types examined on 3 October 2026.
The [catalogue overview](analysis.md) explains their relationships and the host's
agreed scope. Browser observations are recorded separately in
[browser-observations.md](browser-observations.md).

Source prefixes refer to the ignored installed package tree beneath
`internal/daemon/pi-device-test/node_modules/@earendil-works/pi-coding-agent/`:

| Prefix | Location relative to that package |
|---|---|
| `P/` | The package itself. |
| `A/` | `node_modules/@earendil-works/pi-agent-core/dist/` |
| `I/` | `node_modules/@earendil-works/pi-ai/dist/` |

The research populated that installation with
`npm ci --prefix internal/daemon/pi-device-test`. These are pinned installed
artifacts, not upstream main. The `.d.ts` unions describe the public types;
extension-defined `customType`, tool names and provider IDs remain open sets.

Fields followed by `?` are optional. A required TypeScript property whose value
is `undefined` may disappear on JSON serialization. Examples abbreviate IDs and
strings; `…` marks omitted example fields. Message timestamps are epoch
milliseconds; session-entry timestamps are ISO strings.

A `message_update` carries the response so far; its nested
`assistantMessageEvent.partial` is mutable live content
(`I/types.d.ts:394-463`). Hooks are callbacks and do not automatically become
persisted JSONL or browser events (`P/dist/core/extensions/types.d.ts:813`,
`P/dist/core/session-manager.d.ts:104-107`). No credential-bearing run was used.

## A. Persisted session JSONL (one row per entry)

**Common:** header `{type:"session", version?:number, id:string, timestamp:string, cwd:string, parentSession?:string}`. Every *other* row has `{type, id:string, parentId:string|null, timestamp:string}`; parent pointers form an append-only tree. Example `{ "type":"session","version":3,"id":"00000000-0000-4000-8000-000000000001","timestamp":"2026-01-01T10:00:00Z","cwd":"/work/demo" }`; child `{ "type":"model_change","id":"a1","parentId":null,"timestamp":"2026-01-01T10:00:01Z","provider":"anthropic","modelId":"claude-example" }`. Source: `P/dist/core/session-manager.d.ts:4-35,174-182`. Do not confuse this `version:3` with **agent-core's different generic JSONL storage** (`A/harness/session/jsonl/types.d.ts:3-15`: `v:4,kind:"header",id,storageVersion,createdAt,cwd,parentSessionId?,legacyParentSessionPath?,nextSeq?`). The coding-agent SessionManager is the format our daemon recognizes (`internal/daemon/history_linux.go:157-169`).

| `type` | Added required fields beyond common; optional fields marked `?` | When / example |
|---|---|---|
| `message` | `message: AgentMessage` (role variants below) | User, assistant, tool result, `!` execution or extension message finalized. `{...,"type":"message","message":{"role":"user","content":"Hello","timestamp":1767261600000}}` (`P/dist/core/session-manager.d.ts:23-26,218`). |
| `thinking_level_change` | `thinkingLevel:string` | Reasoning setting `{...,"type":"thinking_level_change","thinkingLevel":"high"}` (`P/dist/core/session-manager.d.ts:27-30`). |
| `model_change` | `provider:string, modelId:string` | Model selection `{...,"type":"model_change","provider":"openai","modelId":"example"}` (`P/dist/core/session-manager.d.ts:31-35`). |
| `compaction` | `summary:string, firstKeptEntryId:string, tokensBefore:number; details?:unknown, usage?:Usage, fromHook?:boolean` | Context summarized; long summary, optional arbitrary extension metadata. `{...,"type":"compaction","summary":"We changed tests…","firstKeptEntryId":"a7","tokensBefore":78000}` (`P/dist/core/session-manager.d.ts:36-47`). |
| `branch_summary` | `fromId:string, summary:string; details?:unknown, usage?:Usage, fromHook?:boolean` | Returning along a different tree branch. `{...,"type":"branch_summary","fromId":"a4","summary":"The alternate path tried X."}` (`P/dist/core/session-manager.d.ts:48-58`). |
| `custom` | `customType:string, data?:unknown` | Extension state only, **not** LLM context. `{...,"type":"custom","customType":"bookmark","data":{"key":"demo"}}` (`P/dist/core/session-manager.d.ts:59-73`). |
| `custom_message` | `customType:string, content:string\|(TextContent\|ImageContent)[], details?:unknown, display:boolean` | Extension injects context-visible content, possibly hidden in TUI. `{...,"type":"custom_message","customType":"note","content":"Remember the test","display":true}` (`P/dist/core/session-manager.d.ts:85-103`). |
| `label` | `targetId:string, label:string\|undefined` | Bookmark/clear a label; `undefined` can serialize without `label`. `{...,"type":"label","targetId":"a2","label":"checkpoint"}` (`P/dist/core/session-manager.d.ts:74-79`). |
| `session_info` | `name?:string` | Session display name `{...,"type":"session_info","name":"Demo"}` (`P/dist/core/session-manager.d.ts:80-84`). |

The union contains **no standalone persisted `toolCall` or `toolResult` entry type**: they live inside `message` (`P/dist/core/session-manager.d.ts:23-26,104-107`; `I/types.d.ts:256-264,330-347`). Session entries may hold very long summaries or base64 image data. Tree navigation selects an ancestry, not every appended branch (`P/dist/core/session-manager.d.ts:174-182`).

### Message roles and content blocks

| Discriminator | Exact shape / meaning | Example |
|---|---|---|
| `role:"user"` | `content:string\|(TextContent\|ImageContent)[], timestamp:number`; human prompt, potentially multiple images. | `{"role":"user","content":[{"type":"text","text":"Explain"},{"type":"image","mimeType":"image/png","data":"iVBORw0…"}],"timestamp":1767261600000}` (`I/types.d.ts:302-306`). |
| `role:"assistant"` | `content:(TextContent\|ThinkingContent\|ToolCall)[], api:Api, provider:ProviderId, model:string, usage:Usage, stopReason:StopReason, timestamp:number; responseModel?, responseId?, providerThinkingLevel?, diagnostics?, deferred?, errorMessage?, rawStopReason?, endTurn?`. Content is ordered; provider response metadata/diagnostics can be sensitive. | `{"role":"assistant","content":[{"type":"text","text":"Done."}],"api":"anthropic-messages","provider":"anthropic","model":"demo","usage":{"input":15,"output":4,"cacheRead":0,"cacheWrite":0,"totalTokens":19,"cost":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"total":0}},"stopReason":"stop","timestamp":1767261600001}` (`I/types.d.ts:307-329`). |
| `role:"toolResult"` | `toolCallId:string, toolName:string, content:(TextContent\|ImageContent)[], isError:boolean, timestamp:number; details?:any, usage?:Usage, addedToolNames?:string[]` (tool result, not a model reply). | `{"role":"toolResult","toolCallId":"t1","toolName":"read","content":[{"type":"text","text":"hello"}],"isError":false,"timestamp":1767261600002}` (`I/types.d.ts:330-346`). |
| `role:"bashExecution"` | `command:string, output:string, exitCode:number\|undefined, cancelled:boolean, truncated:boolean, timestamp:number; fullOutputPath?, excludeFromContext?`; interactive `!`/`!!`, not the model's `bash` tool. | `{"role":"bashExecution","command":"pwd","output":"/work/demo","exitCode":0,"cancelled":false,"truncated":false,"timestamp":1767261600003}` (`P/dist/core/messages.d.ts:13-27`). |
| `role:"custom"` | `customType:string, content:string\|(TextContent\|ImageContent)[], display:boolean, timestamp:number; details?:unknown`; extension `sendMessage`. | `{"role":"custom","customType":"notice","content":"Build finished","display":true,"timestamp":1767261600004}` (`P/dist/core/messages.d.ts:28-39`). |
| `role:"branchSummary"` | `summary:string, fromId:string\|null, timestamp:number`; runtime projection of a branch summary, **not** direct persisted message entry. | `{"role":"branchSummary","summary":"Tried B","fromId":"a4","timestamp":1767261600005}` (`P/dist/core/messages.d.ts:40-45`; `P/dist/core/session-manager.d.ts:148-166`). |
| `role:"compactionSummary"` | `summary:string, tokensBefore:number, timestamp:number`; runtime projection, not direct persisted message entry. | `{"role":"compactionSummary","summary":"Earlier work…","tokensBefore":78000,"timestamp":1767261600006}` (`P/dist/core/messages.d.ts:46-51`; `P/dist/core/session-manager.d.ts:148-166`). |

Content variants (examples anonymous): `text` `{type:"text",text:string,textSignature?:string}` e.g. `{"type":"text","text":"Hi"}`; `thinking` `{type:"thinking",thinking:string,thinkingSignature?:string,redacted?:boolean}` e.g. `{"type":"thinking","thinking":"Check the file"}`; `image` `{type:"image",data:string,mimeType:string}` e.g. `{"type":"image","mimeType":"image/png","data":"iVBORw0…"}` (base64 can dwarf text); `toolCall` `{type:"toolCall",id:string,name:string,arguments:Record<string,any>,thoughtSignature?:string,namespace?:string}` e.g. `{"type":"toolCall","id":"t1","name":"read","arguments":{"path":"README.md"}}`. Source: `I/types.d.ts:232-264`. `Usage` requires `input, output, cacheRead, cacheWrite, totalTokens` numbers and `cost:{input,output,cacheRead,cacheWrite,total}` numbers; `cacheWrite1h?`, `reasoning?` are extra numeric counts, with reasoning a subset of output. `StopReason` = `pending|stop|length|toolUse|error|aborted|deferred`; `deferred` carries optional `{provider,modelId,api,id,expiresAt?,pollAfterMs?,data?:JsonValue}`. Source: `I/types.d.ts:265-301`. The separate image-generation `AssistantImages` API has `output:(text|image)[],api,provider,model,stopReason:stop|error|aborted,timestamp,responseId?,usage?,errorMessage?`; it is **not** a coding-agent conversation role (`I/types.d.ts:347-364`).

## B. Streaming agent/session events (not JSONL entries)

Core event union: `A/types.d.ts:370-415`; session extension: `P/dist/core/agent-session.d.ts:39-101`. `message` means the entire possibly huge AgentMessage above, `result`/`partialResult` are `AgentToolResult` (`content`, `details`, optional `usage,addedToolNames,terminate`: `A/types.d.ts:316-338`). These payloads can grow on every delta; their size includes the accumulated content, not only the latest change.

| Type(s) | Exact additional fields; when | Example (other fields omitted only in illustration) |
|---|---|---|
| `agent_start`, `turn_start` | no additional fields; beginning of run / model turn. | `{"type":"turn_start"}` (`A/types.d.ts:377-384`). |
| `agent_end` | `messages:AgentMessage[]`; session adds **required** `willRetry:boolean`; may end one run before retry. `agent_settled` has no fields and means no automatic continuation remains. | `{"type":"agent_end","messages":[],"willRetry":false}` (`A/types.d.ts:380-381`; `P/dist/core/agent-session.d.ts:40-48`). |
| `turn_end` | `message:AgentMessage,toolResults:ToolResultMessage[]`; completion of one model turn, which may be followed by another. | `{"type":"turn_end","message":{"role":"assistant", "content":[], "…":"see above"},"toolResults":[]}` (`A/types.d.ts:383-388`). |
| `message_start`, `message_end` | `message:AgentMessage`; user, assistant or result lifecycle. | `{"type":"message_start","message":{"role":"user","content":"Hi","timestamp":1767261600000}}` (`A/types.d.ts:389-398`). |
| `message_update` | `message:AgentMessage,assistantMessageEvent:AssistantMessageEvent`; streaming response so far. | `{"type":"message_update","message":{"role":"assistant","content":[],"…":"see above"},"assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"Hi","partial":{"role":"assistant","content":[],"…":"see above"}}}` (`A/types.d.ts:392-395`; `I/types.d.ts:394-463`). |
| `tool_execution_start` | `toolCallId:string,toolName:string,args:any`; before execution. | `{"type":"tool_execution_start","toolCallId":"t1","toolName":"read","args":{"path":"README.md"}}` (`A/types.d.ts:399-403`). |
| `tool_execution_update` | same plus `partialResult:any`; live output. | `{"type":"tool_execution_update","toolCallId":"t1","toolName":"bash","args":{"command":"echo hi"},"partialResult":{"content":[{"type":"text","text":"hi"}],"details":{}}}` (`A/types.d.ts:404-409`). |
| `tool_execution_end` | `toolCallId:string,toolName:string,result:any,isError:boolean`; finished, possibly error. | `{"type":"tool_execution_end","toolCallId":"t1","toolName":"read","result":{"content":[{"type":"text","text":"hi"}],"details":{}},"isError":false}` (`A/types.d.ts:410-415`). |
| `queue_update` | `steering:readonly string[],followUp:readonly string[]`; queued prompt text, not mere counts. | `{"type":"queue_update","steering":["Stop after this"],"followUp":[]}` (`P/dist/core/agent-session.d.ts:49-52`). |
| `compaction_start`, `compaction_end` | start `reason:manual\|threshold\|overflow`; end same plus `result:CompactionResult\|undefined,aborted:boolean,willRetry:boolean,errorMessage?:string`. | `{"type":"compaction_end","reason":"threshold","aborted":false,"willRetry":false,"result":{"…":"compaction result"}}` (`P/dist/core/agent-session.d.ts:53-70`). |
| `entry_appended`, `session_info_changed`, `thinking_level_changed` | respectively `entry:SessionEntry`, `name:string\|undefined`, `level:ThinkingLevel`. | `{"type":"thinking_level_changed","level":"high"}` (`P/dist/core/agent-session.d.ts:56-64`). |
| `auto_retry_start`, `auto_retry_end` | start `attempt,maxAttempts,delayMs:number,errorMessage:string`; end `success:boolean,attempt:number,finalError?:string`. | `{"type":"auto_retry_start","attempt":1,"maxAttempts":3,"delayMs":1000,"errorMessage":"rate limited"}` (`P/dist/core/agent-session.d.ts:72-82`). |
| `summarization_retry_scheduled`, `summarization_retry_attempt_start`, `summarization_retry_finished` | scheduled `attempt,maxAttempts,delayMs:number,errorMessage:string`; attempt either `source:"branchSummary"` or `source:"compaction",reason:manual\|threshold\|overflow`; finished no additional fields. | `{"type":"summarization_retry_attempt_start","source":"compaction","reason":"overflow"}` (`P/dist/core/agent-session.d.ts:83-97`). |
| `bash_execution_update` | `id?:string,delta:string`; streaming user `!` command output. | `{"type":"bash_execution_update","delta":"done\n"}` (`P/dist/core/agent-session.d.ts:98-101`). |

Nested `assistantMessageEvent` union (`I/types.d.ts:394-463`): all types have `type`; `start` has `partial:AssistantMessage`; `text_start|thinking_start|toolcall_start` have `contentIndex:number,partial`; corresponding `_delta` additionally has `delta:string`; `text_end|thinking_end` have `contentIndex,content:string,partial`; `toolcall_end` has `contentIndex,toolCall:ToolCall,partial`; `done` has `reason:stop|length|toolUse|deferred,message:AssistantMessage`; `error` has `reason:aborted|error,error:AssistantMessage`. Illustrations: `{"type":"thinking_delta","contentIndex":0,"delta":"check","partial":{"…":"assistant so far"}}`, `{"type":"toolcall_end","contentIndex":1,"toolCall":{"type":"toolCall","id":"t1","name":"read","arguments":{"path":"a"}},"partial":{"…":"assistant so far"}}`, `{"type":"error","reason":"aborted","error":{"…":"assistant with stopReason aborted"}}`. Text/thinking start blocks are initially empty (redacted thinking may already be complete); toolcall argument deltas may be partial JSON; `_end` is authoritative (`I/types.d.ts:394-409`). These are streaming *updates*, not separate persisted content rows.

## C. RPC mode envelope

`RpcCommand` is stdin JSONL `{id?:string,type:<command>,...}`; stdout responses `{id?:string,type:"response",command:string,success:true|false,data?:...,error?:string}` plus session events above and extension UI requests. A successful prompt acknowledgment is **not** a completed turn. Source: `P/dist/modes/rpc/rpc-types.d.ts:1-14,162-395`; `P/dist/modes/rpc/rpc-mode.d.ts:1-20`. Examples: request `{"id":"r1","type":"prompt","message":"Hello"}`, ack `{"id":"r1","type":"response","command":"prompt","success":true}`, failure `{"id":"r1","type":"response","command":"set_model","success":false,"error":"Unknown model"}`. Each command below is a distinct RPC discriminator, **not** a distinct visible conversation block (`P/dist/modes/rpc/rpc-types.d.ts:14-136,162-395`).

| Commands | Required arguments; optional with `?` | Successful `data` (absent unless listed) |
|---|---|---|
| `prompt`, `steer`, `follow_up` | `message:string, images?:ImageContent[]`; prompt additionally `streamingBehavior?:steer\|followUp` | none |
| `abort`, `clear_queue`, `new_session` | new `parentSession?:string`; otherwise none | clear `{steering:string[],followUp:string[]}`; new `{cancelled:boolean}` |
| `get_state` | none | `RpcSessionState`: `model?:Model,thinkingLevel,isStreaming,isCompacting,steeringMode,followUpMode,sessionFile?,sessionId,sessionName?,autoCompactionEnabled,messageCount,pendingMessageCount` |
| `set_model`, `cycle_model`, `get_available_models` | set `provider:string,modelId:string`; others none | model; cycle `{model,thinkingLevel,isScoped}\|null`; available `{models:Model[]}` |
| `set_thinking_level`, `cycle_thinking_level`, `get_available_thinking_levels` | set `level:ThinkingLevel`; others none | cycle `{level}\|null`; available `{levels:ThinkingLevel[]}` |
| `set_steering_mode`, `set_follow_up_mode` | `mode:all\|one-at-a-time` | none |
| `compact`, `set_auto_compaction`, `set_auto_retry`, `abort_retry` | compact `customInstructions?:string`; setters `enabled:boolean`; abort none | compact `CompactionResult` |
| `bash`, `abort_bash` | bash `command:string,excludeFromContext?:boolean`; abort none | bash `BashResult` |
| `get_session_stats`, `export_html` | export `outputPath?:string`; stats none | `SessionStats`; export `{path:string}` |
| `switch_session`, `fork`, `clone`, `get_fork_messages` | switch `sessionPath:string`; fork `entryId:string`; others none | switch/clone `{cancelled:boolean}`; fork `{text:string,cancelled:boolean}`; get `{messages:{entryId:string,text:string}[]}` |
| `get_entries`, `get_tree`, `get_last_assistant_text`, `get_messages`, `get_commands` | entries `since?:string`; others none | entries `{entries:SessionEntry[],leafId:string\|null}`; tree `{tree:SessionTreeNode[],leafId:string\|null}`; last `{text:string\|null}`; messages `{messages:AgentMessage[]}`; commands `{commands:RpcSlashCommand[]}` |
| `set_session_name` | `name:string` | none |

`RpcSlashCommand` = `{name:string,description?:string,source:"extension"|"prompt"|"skill",sourceInfo:SourceInfo}` (`P/dist/modes/rpc/rpc-types.d.ts:137-147`). `Model` includes `id,name,api,provider,baseUrl,reasoning,input,cost,contextWindow,maxTokens` and optional model/provider tuning, not just a display label (`I/types.d.ts:702-737`). `CompactionResult` = `{summary:string,firstKeptEntryId:string,tokensBefore:number,estimatedTokensAfter?:number,usage?:Usage,details?:unknown}` (e.g. `{"summary":"Earlier work…","firstKeptEntryId":"a7","tokensBefore":78000}`); `BashResult` = `{output:string,exitCode:number|undefined,cancelled:boolean,truncated:boolean,fullOutputPath?:string}` (e.g. `{"output":"ok","exitCode":0,"cancelled":false,"truncated":false}`); `SessionStats` = `{sessionFile:string|undefined,sessionId:string,userMessages:number,assistantMessages:number,toolCalls:number,toolResults:number,totalMessages:number,tokens:{input:number,output:number,cacheRead:number,cacheWrite:number,total:number},cost:number,contextUsage?:ContextUsage}` (e.g. `{ "sessionId":"demo","userMessages":1,"assistantMessages":1,"toolCalls":0,"toolResults":0,"totalMessages":2,"tokens":{"input":5,"output":3,"cacheRead":0,"cacheWrite":0,"total":8},"cost":0 }`, omitting undefined `sessionFile`). These are RPC data, not history message kinds (`P/dist/core/compaction/compaction.d.ts:18-27`; `P/dist/core/bash-executor.d.ts:15-26`; `P/dist/core/agent-session.d.ts:173-191`).

**Extension UI RPC** (`P/dist/modes/rpc/rpc-types.d.ts:396-467`): every outbound request has `type:"extension_ui_request",id:string,method`; response is `{type:"extension_ui_response",id,value:string}` for text/selection, `{...,confirmed:boolean}` for confirm, or `{...,cancelled:true}`. Per-method fields, example:

| method | Additional fields; example |
|---|---|
| `select` | `title:string,options:string[],timeout?:number` — `{"type":"extension_ui_request","id":"q1","method":"select","title":"Choose","options":["A","B"]}` |
| `confirm` | `title:string,message:string,timeout?:number` — `{"type":"extension_ui_request","id":"q2","method":"confirm","title":"Proceed?","message":"Overwrite?"}` |
| `input` | `title:string,placeholder?:string,timeout?:number` — `{"type":"extension_ui_request","id":"q3","method":"input","title":"Name"}` |
| `editor` | `title:string,prefill?:string` — `{"type":"extension_ui_request","id":"q4","method":"editor","title":"Edit","prefill":"draft"}` |
| `notify` | `message:string,notifyType?:info\|warning\|error` — `{"type":"extension_ui_request","id":"q5","method":"notify","message":"Saved"}` |
| `setStatus` | `statusKey:string,statusText:string\|undefined` — `{"type":"extension_ui_request","id":"q6","method":"setStatus","statusKey":"build","statusText":"Running"}` |
| `setWidget` | `widgetKey:string,widgetLines:string[]\|undefined,widgetPlacement?:aboveEditor\|belowEditor` — `{"type":"extension_ui_request","id":"q7","method":"setWidget","widgetKey":"hint","widgetLines":["Ready"]}` |
| `setTitle` | `title:string` — `{"type":"extension_ui_request","id":"q8","method":"setTitle","title":"Demo"}` |
| `set_editor_text` | `text:string` — `{"type":"extension_ui_request","id":"q9","method":"set_editor_text","text":"Try this"}` |

A `setStatus`/`setWidget` with `undefined` text/lines can clear previous content; it is not a select question. All extension-provided text is unbounded by these TS declarations (`P/dist/modes/rpc/rpc-types.d.ts:396-453`).

## D. Extension events and tool-specific shapes

[Companion field tables and examples](analysis-tools.md) cover every named extension event (`project_trust`, resource/session lifecycle, provider hooks, prompt/turn/message/tool hooks, model/thinking selection, user bash and input) and every built-in tool (`read`, `bash`, `powershell`, `edit`, `write`, `grep`, `find`, `ls`, custom). The two important boundaries: provider hooks may carry credentials and are **not** display blocks; extension tool names and custom message types are unbounded strings (`P/dist/core/extensions/types.d.ts:518-537,714-724,813`).
