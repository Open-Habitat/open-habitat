import { describe, expect, it } from "vitest";
import {
  applyTurnEvent,
  initialTurn,
  parseConversationEvent,
  provisionalItems,
} from "./conversationEvents";

const instance = "a1a1a1a1-0000-4000-8000-000000000001";
const agent = "pi:a1a1a1a1-0000-4000-8000-000000000001";
const cursor = (n: number) => `ev1:${instance}:${n}`;
function frame(
  n: number,
  kind: string,
  payload: Record<string, unknown>,
  resource = { agent_id: agent },
) {
  return JSON.stringify({
    schema_version: 1,
    event_id: `evt_abcdefgh${n}`,
    cursor: cursor(n),
    server_instance_id: instance,
    sequence: n,
    emitted_at: "2026-09-30T20:00:00Z",
    kind,
    resource,
    payload,
    ...(kind === "history.entry" ? { native_key: "native-1" } : {}),
  });
}
const parse = (n: number, kind: string, payload: Record<string, unknown>) =>
  parseConversationEvent(frame(n, kind, payload));
describe("published conversation stream", () => {
  it("hydrates a mid-turn snapshot, orders deltas by content index and replaces the whole tail with native history", () => {
    const first = parse(3, "assistant.delta", {
      text: "Hei",
      content_index: 0,
    });
    let turn = initialTurn(cursor(3), [first]);
    const delta = applyTurnEvent(
      turn,
      parse(4, "assistant.delta", { text: " maailma", content_index: 0 }),
      agent,
    );
    turn = delta.turn;
    turn = applyTurnEvent(
      turn,
      parse(5, "tool.started", {
        tool_call_id: "tool-1",
        tool_name: "bash",
        state: "running",
      }),
      agent,
    ).turn;
    turn = applyTurnEvent(
      turn,
      parse(6, "tool.finished", {
        tool_call_id: "tool-1",
        tool_name: "bash",
        state: "succeeded",
      }),
      agent,
    ).turn;
    expect(provisionalItems(turn).map((item) => item.text)).toEqual([
      "Hei maailma",
      "bash · Valmis",
    ]);
    const settled = applyTurnEvent(
      turn,
      parse(7, "history.entry", {
        entry_key: "native-1",
        entry_kind: "assistant",
        content: {
          media_type: "text/plain",
          text: "Hei maailma",
          complete: true,
        },
      }),
      agent,
    );
    expect(settled.entry?.entry_key).toBe("native-1");
    expect(provisionalItems(settled.turn)).toEqual([]);
  });
  it("keeps messages in tool order, never suppresses a new tail because old native text happens to match", () => {
    let turn = initialTurn(cursor(0));
    turn = applyTurnEvent(
      turn,
      parse(1, "assistant.delta", { text: "Tarkistan", content_index: 0 }),
      agent,
    ).turn;
    turn = applyTurnEvent(
      turn,
      parse(2, "tool.started", {
        tool_call_id: "tool-1",
        tool_name: "bash",
        state: "running",
      }),
      agent,
    ).turn;
    turn = applyTurnEvent(
      turn,
      parse(3, "tool.finished", {
        tool_call_id: "tool-1",
        tool_name: "bash",
        state: "succeeded",
      }),
      agent,
    ).turn;
    turn = applyTurnEvent(
      turn,
      parse(4, "assistant.delta", { text: "Valmis", content_index: 0 }),
      agent,
    ).turn;
    expect(provisionalItems(turn).map((item) => item.text)).toEqual([
      "Tarkistan",
      "bash · Valmis",
      "Valmis",
    ]);
    expect(
      provisionalItems(
        initialTurn(cursor(2), [
          parse(2, "tool.started", {
            tool_call_id: "tool-1",
            tool_name: "bash",
            state: "running",
          }),
        ]),
      ).map((item) => item.kind),
    ).toEqual(["tool"]);
  });
  it("rejects gaps and instance changes, and distinguishes truncated history fallback", () => {
    const turn = initialTurn(cursor(2));
    expect(
      applyTurnEvent(turn, parse(4, "assistant.delta", { text: "lost" }), agent)
        .recover,
    ).toBe("snapshot");
    expect(
      applyTurnEvent(
        turn,
        parse(3, "snapshot.invalidated", { reason: "ring_truncated" }),
        agent,
      ).recover,
    ).toBe("history");
    expect(
      applyTurnEvent(
        turn,
        parse(3, "snapshot.invalidated", { reason: "source_changed" }),
        agent,
      ).recover,
    ).toBe("snapshot");
    const foreign = parseConversationEvent(
      frame(
        3,
        "snapshot.invalidated",
        { reason: "ring_truncated" },
        { agent_id: "pi:22222222-2222-4222-8222-222222222222" },
      ),
    );
    expect(applyTurnEvent(turn, foreign, agent).recover).toBeUndefined();
    expect(() =>
      parseConversationEvent(
        frame(3, "assistant.delta", { text: "ok", content_index: -1 }),
      ),
    ).toThrow();
    expect(() =>
      initialTurn(cursor(2), [parse(3, "assistant.delta", { text: "future" })]),
    ).toThrow();
  });
});
