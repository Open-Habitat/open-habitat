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
  it("rejects a frame larger than one MiB in UTF-8 even when its string is shorter", () => {
    const raw = frame(1, "assistant.delta", {
      text: "ä".repeat(530_000),
      content_index: 0,
    });
    expect(raw.length).toBeLessThan(1024 * 1024);
    expect(new TextEncoder().encode(raw).length).toBeGreaterThan(1024 * 1024);
    expect(() => parseConversationEvent(raw)).toThrow("oversize event");
  });
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
  it("keeps thinking distinct from text at the same block index and replaces it with history", () => {
    let turn = initialTurn(cursor(0));
    for (const [n, kind, text] of [
      [1, "assistant.thinking.delta", "Let me"],
      [2, "assistant.thinking.delta", " check"],
      [3, "assistant.delta", "Done"],
    ] as const) {
      turn = applyTurnEvent(
        turn,
        parse(n, kind, { text, content_index: 0 }),
        agent,
      ).turn;
    }
    expect(
      provisionalItems(turn).map(({ kind, text }) => [kind, text]),
    ).toEqual([
      ["thinking", "Let me check"],
      ["assistant", "Done"],
    ]);
    const persisted = applyTurnEvent(
      turn,
      parse(4, "history.entry", {
        entry_key: "native-1",
        entry_kind: "assistant",
        content: { media_type: "text/plain", text: "Done", complete: true },
        blocks: [
          { type: "thinking", text: "Let me check" },
          { type: "text", text: "Done" },
        ],
      }),
      agent,
    );
    expect(persisted.entry?.blocks?.[0].type).toBe("thinking");
    expect(provisionalItems(persisted.turn)).toEqual([]);
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

describe("typed live Pi projection", () => {
  it("joins call arguments, execution progress and result by id without duplicate rows after native history", () => {
    let turn = initialTurn(cursor(0));
    const steps: [string, Record<string, unknown>][] = [
      ["assistant.toolcall.delta", { content_index: 1, text: '{"path":' }],
      [
        "assistant.toolcall.end",
        {
          content_index: 1,
          tool_call_id: "call1",
          tool_name: "read",
          text: '{"path":"demo"}',
        },
      ],
      [
        "tool.started",
        { tool_call_id: "call1", tool_name: "read", state: "running" },
      ],
      [
        "tool.updated",
        {
          tool_call_id: "call1",
          tool_name: "read",
          state: "running",
          text: "progress",
        },
      ],
      [
        "tool.finished",
        {
          tool_call_id: "call1",
          tool_name: "read",
          state: "succeeded",
          text: "done",
        },
      ],
    ];
    steps.forEach(([kind, payload], i) => {
      turn = applyTurnEvent(turn, parse(i + 1, kind, payload), agent).turn;
    });
    expect(
      provisionalItems(turn).filter((item) => item.kind === "tool"),
    ).toMatchObject([
      {
        name: "read",
        state: "succeeded",
        arguments: '{"path":"demo"}',
        output: "done",
      },
    ]);
    turn = applyTurnEvent(
      turn,
      parse(6, "history.entry", {
        entry_key: "native-1",
        entry_kind: "tool",
        tool_call_id: "call1",
        content: { media_type: "text/plain", text: "done", complete: true },
      }),
      agent,
    ).turn;
    expect(provisionalItems(turn)).toEqual([]);
  });
  it("replaces status and widget updates, clears them, and shows unknown types without payload", () => {
    let turn = initialTurn(cursor(0));
    for (const [n, kind, payload] of [
      [
        1,
        "extension.visible",
        { method: "setStatus", key: "build", text: "running", clear: false },
      ],
      [
        2,
        "extension.visible",
        { method: "setStatus", key: "build", text: "done", clear: false },
      ],
      [
        3,
        "unknown.native",
        {
          native_type: "new_type",
          content: {
            media_type: "text/plain",
            text: "Pi event not supported",
            complete: true,
          },
        },
      ],
      [
        4,
        "extension.visible",
        { method: "setStatus", key: "build", text: "", clear: true },
      ],
    ] as const)
      turn = applyTurnEvent(turn, parse(n, kind, payload), agent).turn;
    expect(provisionalItems(turn).map((item) => item.text)).toEqual([
      "Pi-tapahtumaa ei tueta · new_type",
    ]);
  });
});

it("coalesces cumulative tool output snapshots without exhausting the browser tail and separates repeated content indexes", () => {
  let turn = initialTurn(cursor(0));
  for (let i = 1; i <= 140; i++)
    turn = applyTurnEvent(
      turn,
      parse(i, "tool.updated", {
        tool_call_id: "call1",
        tool_name: "bash",
        state: "running",
        text: `output ${i}`,
      }),
      agent,
    ).turn;
  expect(turn.fragments).toHaveLength(1);
  expect(provisionalItems(turn)[0].output).toBe("output 140");
  for (const [n, kind, payload] of [
    [141, "assistant.toolcall.delta", { content_index: 1, text: "one" }],
    [
      142,
      "assistant.toolcall.end",
      {
        content_index: 1,
        tool_call_id: "call2",
        tool_name: "read",
        text: "one",
      },
    ],
    [143, "assistant.toolcall.delta", { content_index: 1, text: "two" }],
    [
      144,
      "assistant.toolcall.end",
      {
        content_index: 1,
        tool_call_id: "call3",
        tool_name: "write",
        text: "two",
      },
    ],
  ] as const)
    turn = applyTurnEvent(turn, parse(n, kind, payload), agent).turn;
  expect(
    provisionalItems(turn)
      .filter((item) => item.kind === "tool")
      .map((item) => item.name),
  ).toEqual(["bash", "read", "write"]);
  const ids = provisionalItems(turn).map((item) => item.id);
  expect(new Set(ids).size).toBe(ids.length);
});

it("replaces provisional local output with saved command history", () => {
  const turn = applyTurnEvent(
    initialTurn(cursor(0)),
    parse(1, "bash.output", { text: "running" }),
    agent,
  ).turn;
  expect(provisionalItems(turn).map((item) => item.text)).toEqual(["running"]);
  const saved = applyTurnEvent(
    turn,
    parse(2, "history.entry", {
      entry_key: "native-1",
      entry_kind: "bash",
      content: {
        media_type: "text/plain",
        text: "Local command",
        complete: true,
      },
      blocks: [
        { type: "text", text: "echo test" },
        { type: "text", text: "running" },
      ],
      exit_code: 0,
    }),
    agent,
  );
  expect(saved.entry?.kind).toBe("bash");
  expect(provisionalItems(saved.turn)).toEqual([]);
});
