import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import common from "../../../contracts/v1/common.schema.json";
import annotations from "../../../contracts/v1/annotations.schema.json";
import command from "../../../contracts/v1/command.schema.json";
import operation from "../../../contracts/v1/operation.schema.json";
import eventSchema from "../../../contracts/v1/event.schema.json";
import snapshotSchema from "../../../contracts/v1/snapshot.schema.json";
import type { Event as WireEvent } from "../contracts/v1.generated";
import type { HistoryEntry } from "./history";

const ajv = new Ajv({ strict: false });
addFormats(ajv);
for (const schema of [
  common,
  annotations,
  command,
  operation,
  eventSchema,
  snapshotSchema,
])
  ajv.addSchema(schema);
const validate = ajv.getSchema(eventSchema.$id);
export type ConversationEvent = WireEvent & {
  event_id: string;
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
export function parseConversationEvent(raw: string): ConversationEvent {
  if (raw.length > 1024 * 1024) throw new Error("oversize event");
  const value: unknown = JSON.parse(raw);
  if (!validate?.(value)) throw new Error("invalid event");
  const frame = value as ConversationEvent;
  const cursor = cursorParts(frame.cursor);
  if (
    cursor.instance !== frame.server_instance_id ||
    cursor.sequence !== frame.sequence
  )
    throw new Error("mismatched cursor");
  return frame;
}
export type LiveTurn = {
  cursor: string;
  instance: string;
  sequence: number;
  fragments: ConversationEvent[];
  truncated: boolean;
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
  if (event.kind === "history.entry") {
    const payload = event.payload;
    const entry: HistoryEntry = {
      entry_key: payload.entry_key as string,
      kind: payload.entry_kind as HistoryEntry["kind"],
      content: payload.content as HistoryEntry["content"],
    };
    return { turn: { ...next, fragments: [], truncated: false }, entry };
  }
  if (
    [
      "assistant.delta",
      "tool.started",
      "tool.finished",
      "tool.updated",
    ].includes(event.kind)
  ) {
    if (turn.fragments.length >= 128) return { turn: next, recover: "history" };
    return { turn: { ...next, fragments: [...turn.fragments, event] } };
  }
  return { turn: next };
}
export function provisionalItems(turn: LiveTurn) {
  if (turn.truncated) return [];
  const items: { id: string; kind: string; text: string; index?: number }[] =
    [];
  const tools = new Map<string, number>();
  for (const event of turn.fragments) {
    if (event.kind === "assistant.delta") {
      const index =
        typeof event.payload.content_index === "number"
          ? event.payload.content_index
          : 0;
      const last = items.at(-1);
      if (last?.kind === "assistant" && last.index === index)
        last.text += event.payload.text;
      else
        items.push({
          id: `live-text-${event.event_id}`,
          kind: "assistant",
          text: event.payload.text as string,
          index,
        });
    } else if (event.kind.startsWith("tool.")) {
      const key = event.payload.tool_call_id as string;
      const text = `${event.payload.tool_name} · ${event.payload.state}`;
      const position = tools.get(key);
      if (position === undefined) {
        tools.set(key, items.length);
        items.push({ id: `live-tool-${key}`, kind: "tool", text });
      } else items[position].text = text;
    }
  }
  return items;
}
