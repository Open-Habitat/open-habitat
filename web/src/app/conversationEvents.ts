import annotations from "../../../contracts/v1/annotations.schema.json";
import command from "../../../contracts/v1/command.schema.json";
import common from "../../../contracts/v1/common.schema.json";
import editorSchema from "../../../contracts/v1/editor.schema.json";
import eventSchema from "../../../contracts/v1/event.schema.json";
import fileOfferSchema from "../../../contracts/v1/file-offer.schema.json";
import historySchema from "../../../contracts/v1/history.schema.json";
import noticeSchema from "../../../contracts/v1/notice.schema.json";
import operation from "../../../contracts/v1/operation.schema.json";
import processEventSchema from "../../../contracts/v1/process-event.schema.json";
import snapshotSchema from "../../../contracts/v1/snapshot.schema.json";
import viewSchema from "../../../contracts/v1/view.schema.json";
import workspaceChangeSchema from "../../../contracts/v1/workspace-change.schema.json";
import type { Event as WireEvent } from "../contracts/v1.generated";
import { liveText } from "../i18n";
import { conversationEventsText } from "../text/conversationEvents";
import type { BashFailure } from "./bashFailure";
import type { HistoryEntry } from "./history";
import { LazyAjv } from "./lazyAjv";

const txt = liveText(conversationEventsText);

const ajv = new LazyAjv({ strict: false, addFormats: true });
ajv.addSchema(processEventSchema);
ajv.addSchema(noticeSchema);
ajv.addSchema(viewSchema);
ajv.addSchema(fileOfferSchema);
ajv.addSchema(editorSchema);
for (const schema of [
  common,
  annotations,
  command,
  operation,
  eventSchema,
  historySchema,
  snapshotSchema,
  workspaceChangeSchema,
])
  ajv.addSchema(schema);
const validate = ajv.getSchema(eventSchema.$id);
export type ConversationEvent = WireEvent & {
  event_id: string;
  emitted_at: string;
  cursor: string;
  server_instance_id: string;
  sequence: number;
  kind: string;
  resource: { agent_id?: string };
  native_key?: string;
  payload: Record<string, unknown>;
};
const cursorPattern = /^ev1:([0-9a-fA-F-]{36}):(0|[1-9][0-9]*)$/;
function cursorParts(cursor: string): { instance: string; sequence: number } {
  const parts = cursorPattern.exec(cursor);
  const sequence = Number(parts?.[2]);
  if (!parts || !Number.isSafeInteger(sequence))
    throw new Error("invalid cursor");
  return { instance: parts[1], sequence };
}
/** A running `!` command's streamed output outlives Pi's turn: only the
 * command's own history entry (kind bash) supersedes it. */
export function commandOutput<T extends { kind: string }>(fragments: T[]): T[] {
  return fragments.filter((fragment) => fragment.kind === "bash.output");
}
export function parseConversationEvent(raw: string): ConversationEvent {
  // SSE is bounded by bytes, not UTF-16 code units. A non-ASCII frame can
  // exceed the transport cap while its JavaScript string length still fits.
  if (
    raw.length > 1024 * 1024 ||
    new TextEncoder().encode(raw).length > 1024 * 1024
  )
    throw new Error("oversize event");
  const value: unknown = JSON.parse(raw);
  if (!validate(value)) throw new Error("invalid event");
  const frame = value as ConversationEvent;
  const cursor = cursorParts(frame.cursor);
  if (
    cursor.instance !== frame.server_instance_id ||
    cursor.sequence !== frame.sequence
  )
    throw new Error("mismatched cursor");
  return frame;
}
// The daemon's live-tail frame bound (and the snapshot's live_tail maxItems):
// a run's structure stays live until it settles, about eight fragments per
// tool call, so the bound covers runs of over a hundred tool calls.
export const liveTailFragments = 1000;
const textKinds = new Set([
  "assistant.delta",
  "assistant.thinking.delta",
  "assistant.toolcall.delta",
  "bash.output",
]);
export type LiveTurn = {
  cursor: string;
  instance: string;
  sequence: number;
  fragments: ConversationEvent[];
  // The provisional fragments are incomplete and are not shown.
  truncated: boolean;
  // Events for this agent were missed; native history is read again.
  missed?: boolean;
};
export function initialTurn(
  cursor: string,
  tail: ConversationEvent[] = [],
): LiveTurn {
  const { instance, sequence } = cursorParts(cursor);
  // Snapshot and tail are copied under the same server journal lock. Do not
  // mistake a provisional tail for native history or a command receipt.
  if (
    tail.some(
      (event) =>
        event.server_instance_id !== instance || event.sequence > sequence,
    )
  )
    throw new Error("invalid tail");
  return { cursor, instance, sequence, fragments: tail, truncated: false };
}
export function applyTurnEvent(
  turn: LiveTurn,
  event: ConversationEvent,
  agentId: string,
): { turn: LiveTurn; entry?: HistoryEntry; recover?: "snapshot" | "history" } {
  if (
    event.server_instance_id !== turn.instance ||
    event.sequence !== turn.sequence + 1
  )
    return { turn, recover: "snapshot" };
  const next = { ...turn, cursor: event.cursor, sequence: event.sequence };
  if (event.kind === "snapshot.invalidated") {
    if (event.resource.agent_id && event.resource.agent_id !== agentId)
      return { turn: next };
    return {
      turn: next,
      recover:
        event.payload.reason === "ring_truncated" ? "history" : "snapshot",
    };
  }
  if (event.resource.agent_id !== agentId) return { turn: next };
  if (event.kind === "process.notification")
    return { turn: next, recover: "history" };
  if (event.kind === "history.entry") {
    const payload = event.payload;
    const entry: HistoryEntry = {
      entry_key: payload.entry_key as string,
      skill: payload.skill as HistoryEntry["skill"],
      notice: payload.notice as HistoryEntry["notice"],
      restart: payload.restart as HistoryEntry["restart"],
      wait_reminder: payload.wait_reminder as HistoryEntry["wait_reminder"],
      kind: payload.entry_kind as HistoryEntry["kind"],
      content: payload.content as HistoryEntry["content"],
      blocks: payload.blocks as HistoryEntry["blocks"],
      tool_call_id: payload.tool_call_id as string | undefined,
      is_error: payload.is_error as boolean | undefined,
      failure_cause: payload.failure_cause as BashFailure | undefined,
      stop_reason: payload.stop_reason as string | undefined,
      model: payload.model as string | undefined,
      context_tokens: payload.context_tokens as number | undefined,
      entry_type: payload.entry_type as HistoryEntry["entry_type"],
      exit_code: payload.exit_code as number | undefined,
      cancelled: payload.cancelled as boolean | undefined,
      output_truncated: payload.output_truncated as boolean | undefined,
      exclude_from_context: payload.exclude_from_context as boolean | undefined,
      truncated_blocks: payload.truncated_blocks as boolean | undefined,
      native_revision: payload.native_revision as string | undefined,
    };
    // Saved assistant blocks supersede their streamed content. A saved tool
    // result supersedes only that call; other concurrent calls remain live.
    // A message whose calls already ran was streamed before their execution:
    // what came after (the next message) stays until its own entry arrives,
    // as when a finished run delivers all its entries at once.
    const calls = new Set(
      entry.blocks?.flatMap((block) =>
        block.type === "toolCall" && block.tool_call_id
          ? [block.tool_call_id]
          : [],
      ),
    );
    const ran = turn.fragments.findIndex(
      (fragment) =>
        fragment.kind.startsWith("tool.") &&
        calls.has(fragment.payload.tool_call_id as string),
    );
    const fragments =
      entry.kind === "tool" && entry.tool_call_id
        ? turn.fragments.filter(
            (fragment) =>
              fragment.payload.tool_call_id !== entry.tool_call_id &&
              !(
                fragment.kind === "assistant.toolcall.delta" &&
                turn.fragments.some(
                  (end) =>
                    end.kind === "assistant.toolcall.end" &&
                    end.payload.tool_call_id === entry.tool_call_id &&
                    end.payload.content_index ===
                      fragment.payload.content_index,
                )
              ),
          )
        : entry.kind === "assistant"
          ? ran < 0
            ? commandOutput(turn.fragments)
            : [
                ...commandOutput(turn.fragments.slice(0, ran)),
                ...turn.fragments.slice(ran),
              ]
          : entry.kind === "bash"
            ? turn.fragments.filter(
                (fragment) => fragment.kind !== "bash.output",
              )
            : turn.fragments;
    return { turn: { ...next, fragments, truncated: false }, entry };
  }
  if (
    [
      "assistant.delta",
      "assistant.thinking.delta",
      "tool.started",
      "tool.finished",
      "tool.updated",
      "assistant.toolcall.delta",
      "assistant.toolcall.end",
      "bash.output",
      "pi.lifecycle",
      "pi.marker",
      "pi.retry",
      "extension.visible",
      "unknown.native",
    ].includes(event.kind)
  ) {
    // A new model turn starts a provisional message from its beginning, so a
    // tail given up earlier in a long run is complete again from here.
    if (
      turn.truncated &&
      event.kind === "pi.lifecycle" &&
      event.payload.signal === "turn_start"
    )
      return { turn: { ...next, fragments: [event], truncated: false } };
    const fragments =
      event.kind === "tool.updated"
        ? turn.fragments.filter(
            (fragment) =>
              !(
                fragment.kind === "tool.updated" &&
                fragment.payload.tool_call_id === event.payload.tool_call_id
              ),
          )
        : turn.fragments;
    // Streamed text extends the fragment it continues, keeping that
    // fragment's identity, so the bound counts structure rather than seconds.
    const last = fragments.at(-1);
    if (
      last &&
      textKinds.has(event.kind) &&
      last.kind === event.kind &&
      last.payload.content_index === event.payload.content_index &&
      typeof last.payload.text === "string" &&
      typeof event.payload.text === "string"
    )
      return {
        turn: {
          ...next,
          fragments: [
            ...fragments.slice(0, -1),
            {
              ...last,
              payload: {
                ...last.payload,
                text: last.payload.text + event.payload.text,
              },
            },
          ],
        },
      };
    if (fragments.length >= liveTailFragments)
      return {
        turn: { ...next, fragments: [], truncated: true },
        recover: "history",
      };
    return { turn: { ...next, fragments: [...fragments, event] } };
  }
  return { turn: next };
}
export function provisionalItems(turn: LiveTurn) {
  if (turn.truncated) return [];
  const items: {
    id: string;
    kind: string;
    text: string;
    index?: number;
    callId?: string;
    name?: string;
    state?: string;
    arguments?: string;
    output?: string;
    failureCause?: BashFailure;
  }[] = [];
  const tools = new Map<string, number>();
  const calls = new Map<number, number>();
  const extensions = new Map<string, number>();
  for (const event of turn.fragments) {
    if (
      event.kind === "assistant.delta" ||
      event.kind === "assistant.thinking.delta"
    ) {
      const index =
        typeof event.payload.content_index === "number"
          ? event.payload.content_index
          : 0;
      const last = items.at(-1);
      const kind =
        event.kind === "assistant.thinking.delta" ? "thinking" : "assistant";
      if (last?.kind === kind && last.index === index)
        last.text += event.payload.text;
      else
        items.push({
          id: `live-text-${event.event_id}`,
          kind,
          text: event.payload.text as string,
          index,
        });
    } else if (
      event.kind === "assistant.toolcall.delta" ||
      event.kind === "assistant.toolcall.end"
    ) {
      const index = event.payload.content_index as number;
      const position = calls.get(index);
      const argument = (event.payload.text as string | undefined) ?? "";
      if (position === undefined) {
        calls.set(index, items.length);
        items.push({
          id: `live-call-${event.event_id}`,
          kind: "tool",
          text: txt.toolCall,
          index,
          arguments: argument,
        });
      } else {
        items[position].arguments = event.kind.endsWith("end")
          ? argument
          : (items[position].arguments ?? "") + argument;
      }
      if (event.kind.endsWith("end")) {
        const slot = calls.get(index);
        calls.delete(index); // indices restart with each assistant message
        if (slot === undefined) continue;
        const item = items[slot];
        item.name = event.payload.tool_name as string;
        item.text = txt.called(item.name);
        item.state = "called";
        const key = event.payload.tool_call_id as string;
        item.callId = key;
        tools.set(key, slot);
      }
    } else if (event.kind === "bash.output") {
      const last = items.at(-1);
      if (last?.kind === "bash") {
        last.text += event.payload.text as string;
      } else
        items.push({
          id: `live-bash-${event.event_id}`,
          kind: "bash",
          text: event.payload.text as string,
        });
    } else if (event.kind === "extension.visible") {
      const key = `${event.payload.method}:${event.payload.key}`;
      const position = extensions.get(key);
      if (position !== undefined) items[position].kind = "hidden";
      extensions.delete(key);
      if (!event.payload.clear) {
        extensions.set(key, items.length);
        items.push({
          id: `live-extension-${key}`,
          kind: "extension",
          name: key,
          text: event.payload.text as string,
        });
      }
    } else if (
      event.kind === "pi.lifecycle" ||
      event.kind === "pi.marker" ||
      event.kind === "pi.retry"
    ) {
      const signal = (event.payload.signal ?? event.payload.marker) as string;
      if (
        ![
          "turn_start",
          "turn_end",
          "agent_start",
          "agent_end",
          "agent_settled",
          "entry_appended",
          // Native metadata already belongs to the title/settings, not to a
          // temporary stage below the answer while history catches up.
          "session_info_changed",
          "thinking_level_changed",
          // A stop is not a failure; the stopped turn's own mark says it.
          "message_aborted",
        ].includes(signal)
      )
        items.push({
          id: `live-signal-${event.event_id}`,
          kind: "signal",
          text: `${signal}${event.payload.text ? ` · ${event.payload.text}` : ""}`,
        });
    } else if (event.kind.startsWith("tool.")) {
      const key = event.payload.tool_call_id as string;
      const label =
        (txt.toolStates as Record<string, string>)[
          event.payload.state as string
        ] ?? txt.toolStateUnknown;
      const text = `${event.payload.tool_name} · ${label}`;
      const position = tools.get(key);
      if (position === undefined) {
        tools.set(key, items.length);
        items.push({
          id: `live-tool-${key}`,
          kind: "tool",
          text,
          name: event.payload.tool_name as string,
          callId: key,
          state: event.payload.state as string,
          arguments: event.payload.arguments as string | undefined,
          output: event.payload.text as string | undefined,
          failureCause: event.payload.failure_cause as BashFailure | undefined,
        });
      } else {
        items[position].text = text;
        items[position].state = event.payload.state as string;
        items[position].failureCause = event.payload.failure_cause as
          | BashFailure
          | undefined;
        items[position].name = event.payload.tool_name as string;
        if (event.payload.arguments)
          items[position].arguments = event.payload.arguments as string;
        if (event.payload.text)
          items[position].output = event.payload.text as string;
      }
    }
  }
  return items.filter((item) => item.kind !== "hidden");
}
