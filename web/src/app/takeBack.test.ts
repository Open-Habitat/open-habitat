import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "./history";
import type { Members } from "./multiplayer";
import type { ProcessRecord } from "./processes";
import { processOrigins, takeBackOffers } from "./takeBack";

// Synthetic people and a synthetic conversation: Alice owns it, Bob had
// full rights. Times are milliseconds from an arbitrary origin.
const t0 = Date.parse("2026-01-01T12:00:00.000Z");
const iso = (s: number) => new Date(t0 + s * 1000).toISOString();
const bob = "github:43";
const text = (t: string) => ({
  media_type: "text/plain" as const,
  text: t,
  complete: true,
});

function proc(
  id: string,
  startedS: number,
  over: Partial<ProcessRecord> = {},
): ProcessRecord {
  return {
    id,
    name: id,
    command_preview: `run ${id}`,
    process_token: `pt_${t0 + startedS * 1000}`,
    status: "running",
    started_at: t0 + startedS * 1000,
    ended_at: null,
    exit_code: null,
    signal: null,
    end_reason: null,
    wakes_agent: false,
    run_ids: [],
    ...over,
  };
}
const owner = (s: number, key = `o${s}`): HistoryEntry => ({
  entry_key: key,
  kind: "user",
  timestamp: iso(s),
  content: text("omistajan viesti"),
});
const participant = (s: number, id = `m${s}`): HistoryEntry => ({
  entry_key: `p${s}`,
  kind: "unknown",
  timestamp: iso(s),
  content: text(""),
  participant_message: {
    message_id: id,
    subject: bob,
    display_name: "Bob Example",
    role: "full_rights",
    text: "käynnistä esikatselu",
  },
});
/** A process start call and its result naming the process. */
const started = (
  s: number,
  p: ProcessRecord,
  action = "start",
): HistoryEntry[] => [
  {
    entry_key: `a${s}`,
    kind: "assistant",
    timestamp: iso(s),
    content: text(""),
    blocks: [
      {
        type: "toolCall",
        tool_call_id: `call_${p.id}_${s}`,
        tool_name: "process",
        text: JSON.stringify({ action }),
      },
    ],
  },
  {
    entry_key: `r${s}`,
    kind: "tool",
    timestamp: iso(s),
    tool_call_id: `call_${p.id}_${s}`,
    content: text(""),
    blocks: [
      {
        type: "text",
        text: JSON.stringify({
          action: "start",
          process: { id: p.id, startTime: p.started_at },
        }),
      },
    ],
  },
];
const tookBack = (s: number, event = "full_rights_taken"): HistoryEntry => ({
  entry_key: `l${s}`,
  kind: "unknown",
  timestamp: iso(s),
  content: text(""),
  conversation_line: {
    line_id: "00000000-0000-4000-8000-000000000001",
    kind: "membership",
    event: event as "full_rights_taken",
    subject: bob,
    display_name: "Bob Example",
  },
});
const members = (role: "participant" | "full_rights"): Members =>
  ({
    agent_id: "pi:00000000-0000-4000-8000-000000000000",
    generation: 3,
    members: [
      {
        subject: bob,
        display_name: "Bob Example",
        role,
        state: "joined",
        generation: 3,
        invited_at: iso(0),
        updated_at: iso(0),
      },
    ],
  }) as Members;

describe("take-back offers", () => {
  it("offer only the processes the person's turns started, with the message they came from", () => {
    const preview = proc("proc_0001", 11);
    const mine = proc("proc_0002", 21);
    const entries = [
      owner(0),
      participant(10, "msg-bob"),
      ...started(11, preview),
      owner(20),
      ...started(21, mine),
      tookBack(30),
    ];
    const [offer, ...rest] = takeBackOffers(
      entries,
      [],
      [preview, mine],
      members("participant"),
    );
    expect(rest).toHaveLength(0);
    expect(offer.rows.map((r) => r.process.id)).toEqual(["proc_0001"]);
    expect(offer.rows[0].origin).toMatchObject({
      by: "participant",
      message_id: "msg-bob",
      text: "käynnistä esikatselu",
    });
    // The owner's own process is counted, never offered.
    expect(offer.unknown).toHaveLength(0);
    expect(offer.others).toBe(1);
  });

  it("trust the start call over the clock", () => {
    // The start time falls after the owner's next message (a late start
    // report), but the call sits in Bob's turn.
    const p = proc("proc_0003", 25);
    const entries = [participant(10), ...started(11, p), owner(20)];
    expect(processOrigins(entries, [p]).get(`${p.id}:${p.started_at}`)).toEqual(
      expect.objectContaining({ by: "participant" }),
    );
  });

  it("keep the starting turn when a later turn writes to or renames the process", () => {
    const p = proc("proc_000b", 11);
    const entries = [
      participant(10),
      ...started(11, p),
      owner(20),
      ...started(21, p, "write"),
    ];
    expect(processOrigins(entries, [p]).get(`${p.id}:${p.started_at}`)).toEqual(
      expect.objectContaining({ by: "participant" }),
    );
  });

  it("give a continued request's processes to its author, also when the message is not loaded", () => {
    const p = proc("proc_000c", 31);
    const q = proc("proc_000d", 41);
    const cont = (s: number, request: string): HistoryEntry => ({
      ...tookBack(s),
      conversation_line: {
        line_id: "00000000-0000-4000-8000-000000000002",
        kind: "continue",
        mode: "tools",
        request,
        subject: bob,
        display_name: "Bob Example",
      },
    });
    const entries = [
      participant(10, "msg-bob"),
      owner(20),
      cont(30, "msg-bob"),
      ...started(31, p),
      owner(35),
      cont(40, "msg-not-loaded"),
      ...started(41, q),
    ];
    const origins = processOrigins(entries, [p, q]);
    expect(origins.get(`${p.id}:${p.started_at}`)).toEqual(
      expect.objectContaining({ by: "participant", message_id: "msg-bob" }),
    );
    expect(origins.get(`${q.id}:${q.started_at}`)).toEqual(
      expect.objectContaining({ by: "participant", subject: bob, text: "" }),
    );
  });

  it("still offer after a reload when only processes of unknown origin run", () => {
    const early = proc("proc_000e", -100);
    const [offer] = takeBackOffers(
      [owner(0), tookBack(30)],
      [],
      [early],
      undefined,
    );
    expect(offer?.unknown.map((r) => r.process.id)).toEqual(["proc_000e"]);
  });

  it("fall back to the turn open at the start time, and call a start before the loaded history unknown", () => {
    const inBob = proc("proc_0004", 15);
    const early = proc("proc_0005", -100);
    const origins = processOrigins(
      [participant(10), owner(20)],
      [inBob, early],
    );
    expect(origins.get(`${inBob.id}:${inBob.started_at}`)?.by).toBe(
      "participant",
    );
    expect(origins.get(`${early.id}:${early.started_at}`)?.by).toBe("unknown");
    // Unknown is offered, not taken for the owner's.
    const [offer] = takeBackOffers(
      [participant(10), owner(20), tookBack(30)],
      [],
      [inBob, early],
      undefined,
    );
    expect(offer.rows.map((r) => r.process.id)).toEqual(["proc_0004"]);
    expect(offer.unknown.map((r) => r.process.id)).toEqual(["proc_0005"]);
  });

  it("keep a process stopped since the take-back struck through, drop one that ended before it", () => {
    const stopped = proc("proc_0006", 11, {
      status: "killed",
      ended_at: t0 + 40_000,
    });
    const before = proc("proc_0007", 12, {
      status: "exited",
      ended_at: t0 + 20_000,
      exit_code: 0,
    });
    const running = proc("proc_0008", 13);
    const entries = [
      participant(10),
      ...started(11, stopped),
      ...started(12, before),
      ...started(13, running),
      tookBack(30),
    ];
    const [offer] = takeBackOffers(
      entries,
      [],
      [stopped, before, running],
      undefined,
    );
    expect(offer.rows.map((r) => r.process.id).sort()).toEqual([
      "proc_0006",
      "proc_0008",
    ]);
    expect(offer.running).toBe(1);
  });

  it("show history's take-back only while something of theirs runs; this tab's at once, even with nothing", () => {
    const ended = proc("proc_0009", 11, { status: "exited", ended_at: t0 });
    const entries = [participant(10), ...started(11, ended), tookBack(30)];
    expect(takeBackOffers(entries, [], [ended], undefined)).toHaveLength(0);
    const offers = takeBackOffers(
      entries,
      [{ kind: "took", subject: bob, name: "Bob Example", at: t0 + 31_000 }],
      [ended],
      undefined,
    );
    expect(offers).toHaveLength(1);
    expect(offers[0].fromAction).toBe(true);
    expect(offers[0].rows).toHaveLength(0);
  });

  it("end the offer when the person has full rights again", () => {
    const p = proc("proc_000a", 11);
    const entries = [participant(10), ...started(11, p), tookBack(30)];
    expect(
      takeBackOffers(entries, [], [p], members("full_rights")),
    ).toHaveLength(0);
    expect(
      takeBackOffers(
        [...entries, tookBack(40, "full_rights_given")],
        [],
        [p],
        undefined,
      ),
    ).toHaveLength(0);
  });
});
