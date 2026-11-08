import { describe, expect, it } from "vitest";
import {
  applyTurnEvent,
  initialTurn,
  liveTailFragments,
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
  it("keeps completion, stop and metadata frames out of the answer, but retains failures and retries", () => {
    let turn = initialTurn(cursor(0));
    const frames: [string, Record<string, unknown>][] = [
      ["assistant.delta", { text: "Native answer", content_index: 0 }],
      ["pi.lifecycle", { signal: "turn_end" }],
      ["pi.lifecycle", { signal: "agent_end" }],
      ["pi.marker", { marker: "session_info_changed", text: "New title" }],
      ["pi.marker", { marker: "thinking_level_changed", text: "high" }],
      ["pi.lifecycle", { signal: "agent_settled" }],
    ];
    for (const [index, [kind, payload]] of frames.entries()) {
      turn = applyTurnEvent(turn, parse(index + 1, kind, payload), agent).turn;
      // Check every intermediate frame, not just the final native replacement.
      expect(provisionalItems(turn).map((item) => item.kind)).toEqual([
        "assistant",
      ]);
    }
    for (const [index, signal] of [
      "message_error",
      "message_aborted",
      "auto_retry_start",
    ].entries()) {
      turn = applyTurnEvent(
        turn,
        parse(7 + index, index === 2 ? "pi.retry" : "pi.lifecycle", { signal }),
        agent,
      ).turn;
    }
    expect(
      provisionalItems(turn).flatMap((item) =>
        item.kind === "signal" ? [item.text] : [],
      ),
    ).toEqual(["message_error", "auto_retry_start"]);
  });
  it("keeps a compaction's markers when the answer before it is saved, and says them only as the compaction notice", () => {
    let turn = initialTurn(cursor(0));
    const frames: [string, Record<string, unknown>][] = [
      ["assistant.delta", { text: "Vastaus", content_index: 0 }],
      ["pi.marker", { marker: "compaction_start", text: "threshold" }],
      [
        "pi.marker",
        { marker: "compaction_end", text: "threshold", outcome: "failed" },
      ],
      [
        "history.entry",
        {
          entry_key: "native-1",
          entry_kind: "assistant",
          content: {
            media_type: "text/plain",
            text: "Vastaus",
            complete: true,
          },
        },
      ],
    ];
    frames.forEach(([kind, payload], index) => {
      turn = applyTurnEvent(turn, parse(index + 1, kind, payload), agent).turn;
    });
    expect(turn.fragments.map((f) => f.payload.marker)).toEqual([
      "compaction_start",
      "compaction_end",
    ]);
    expect(provisionalItems(turn)).toEqual([]);
  });
  it("retains the recorded invocation through event validation and entry replacement", () => {
    const result = applyTurnEvent(
      initialTurn(cursor(0)),
      parse(1, "history.entry", {
        entry_key: "native-1",
        entry_kind: "user",
        skill: { name: "review" },
        content: {
          media_type: "text/plain",
          text: "My extra text",
          complete: true,
        },
        blocks: [{ type: "text", text: "# Review\n\nRecorded instruction." }],
      }),
      agent,
    );
    expect(result.entry?.skill).toEqual({ name: "review" });
    expect(result.entry?.content.text).toBe("My extra text");
    expect(result.entry?.blocks?.[0].text).toBe(
      "# Review\n\nRecorded instruction.",
    );
    expect(
      applyTurnEvent(
        initialTurn(cursor(0)),
        parse(1, "history.entry", {
          entry_key: "native-1",
          entry_kind: "user",
          skill: { name: "native\rname\nrecord" },
          content: { media_type: "text/plain", text: "", complete: true },
        }),
        agent,
      ).entry?.skill?.name,
    ).toBe("native\rname\nrecord");
    expect(() =>
      parse(2, "history.entry", {
        entry_key: "native-1",
        entry_kind: "user",
        skill: { name: 42 },
        content: { media_type: "text/plain", text: "", complete: true },
      }),
    ).toThrow();
  });
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
    // A finished run may deliver its saved messages only now. The first
    // one leaves the answer streamed after its call until the answer's own
    // entry, so the answer never blinks out in between.
    const saved = (n: number, key: string, blocks: unknown[]) =>
      applyTurnEvent(
        turn,
        parse(n, "history.entry", {
          entry_key: key,
          entry_kind: "assistant",
          content: { media_type: "text/plain", text: "", complete: true },
          blocks,
        }),
        agent,
      ).turn;
    turn = saved(5, "native-1", [
      { type: "text", text: "Tarkistan" },
      { type: "toolCall", tool_call_id: "tool-1", tool_name: "bash" },
    ]);
    expect(provisionalItems(turn).map((item) => item.text)).toEqual([
      "bash · Valmis",
      "Valmis",
    ]);
    turn = saved(6, "native-2", [{ type: "text", text: "Valmis" }]);
    expect(provisionalItems(turn)).toEqual([]);
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

describe("long live turns", () => {
  it("extends streamed text in place so a long answer never reaches the bound", () => {
    let turn = initialTurn(cursor(0));
    let text = "";
    for (let n = 1; n <= 400; n++) {
      const word = `sana${n} `;
      text += word;
      const result = applyTurnEvent(
        turn,
        parse(n, "assistant.delta", { text: word, content_index: 0 }),
        agent,
      );
      expect(result.recover).toBeUndefined();
      turn = result.turn;
    }
    expect(turn.fragments).toHaveLength(1);
    expect(turn.fragments[0].event_id).toBe("evt_abcdefgh1");
    expect(provisionalItems(turn)).toMatchObject([
      { id: "live-text-evt_abcdefgh1", kind: "assistant", text },
    ]);
    // Another block or kind starts its own fragment.
    turn = applyTurnEvent(
      turn,
      parse(401, "assistant.thinking.delta", { text: "x", content_index: 0 }),
      agent,
    ).turn;
    turn = applyTurnEvent(
      turn,
      parse(402, "assistant.delta", { text: "y", content_index: 1 }),
      agent,
    ).turn;
    expect(turn.fragments.map((f) => f.kind)).toEqual([
      "assistant.delta",
      "assistant.thinking.delta",
      "assistant.delta",
    ]);
  });
  it("gives up only a tail of liveTailFragments structural fragments, never a part of one", () => {
    let turn = initialTurn(cursor(0));
    const bound = liveTailFragments;
    expect(bound).toBe(1000);
    for (let n = 1; n <= bound; n++)
      turn = applyTurnEvent(
        turn,
        parse(n, "pi.marker", { marker: "entry_appended" }),
        agent,
      ).turn;
    expect(turn.fragments).toHaveLength(bound);
    expect(turn.truncated).toBe(false);
    const result = applyTurnEvent(
      turn,
      parse(bound + 1, "pi.marker", { marker: "entry_appended" }),
      agent,
    );
    expect(result.recover).toBe("history");
    expect(result.turn).toMatchObject({
      sequence: bound + 1,
      fragments: [],
      truncated: true,
    });
    // The stream stayed contiguous: giving up the tail is no missed event.
    expect(result.turn.missed).toBeFalsy();
    // A long run continues. Its tool results are not shown mid-message, but
    // the next model turn starts a message whole and is shown again.
    let next = applyTurnEvent(
      result.turn,
      parse(bound + 2, "tool.finished", {
        tool_call_id: "late",
        tool_name: "bash",
        state: "succeeded",
      }),
      agent,
    ).turn;
    expect(provisionalItems(next)).toEqual([]);
    next = applyTurnEvent(
      next,
      parse(bound + 3, "pi.lifecycle", { signal: "turn_start" }),
      agent,
    ).turn;
    next = applyTurnEvent(
      next,
      parse(bound + 4, "assistant.delta", {
        text: "Jatkan",
        content_index: 0,
      }),
      agent,
    ).turn;
    expect(next.truncated).toBe(false);
    expect(provisionalItems(next).map((item) => item.text)).toEqual(["Jatkan"]);
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
  it("replaces status and widget updates, clears them, and omits unknown types", () => {
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
    expect(provisionalItems(turn)).toEqual([]);
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

it("process hints advance the journal without claiming output delivery; notifications reload native history", () => {
  const turn = initialTurn(cursor(0));
  const hint = parse(1, "process.output", {
    owner_generation: "og_example",
    process_id: "proc_example",
  });
  const next = applyTurnEvent(turn, hint, agent);
  expect(next.turn.sequence).toBe(1);
  expect(next.turn.fragments).toEqual([]);
  const notification = parse(2, "process.notification", {
    kind: "success",
    process_id: "proc_example",
    process_name: "testit",
    command_preview: "npm test",
    exit_code: 0,
    signal: null,
    end_reason: "exit",
    delivery: "wake",
    run_ids: [],
  });
  const result = applyTurnEvent(next.turn, notification, agent);
  expect(result.recover).toBe("history");
  expect(result.entry).toBeUndefined();
  expect(result.turn.fragments).toEqual([]);
  expect(() =>
    parse(3, "process.output", {
      owner_generation: "og_example",
      lines: ["not a hint"],
    }),
  ).toThrow();
});
