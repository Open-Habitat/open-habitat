import { describe, expect, it } from "vitest";
import { ConversationPager } from "./conversationPager";
import {
  type ConversationMetadata,
  ConversationStore,
} from "./conversationStore";
import type { Session, Status } from "./conversations";
import { railNow } from "./railNow";
import type { Agent, Snapshot, Workspace } from "./snapshot";

function agent(id: string, extra: Partial<Agent> = {}): Agent {
  return {
    agent_id: id,
    workspace_id: "ws_example00",
    history: "readable",
    process: "terminal_observed_live",
    control: "read_only",
    title: { display: id },
    live_tail: [],
    ...extra,
  };
}
function workspace(id: string, name: string): Workspace {
  return {
    workspace_id: id,
    name,
    kind: "directory",
    visibility: "visible",
    mutation_state: "allowed",
    presence: "present",
    facts: [],
  };
}
const visible = [
  workspace("ws_example00", "kotisivu"),
  workspace("ws_example01", "budjetti"),
];
function run(
  agents: Agent[],
  {
    attention = [],
    sessions = [],
    phase = "authenticated",
    catalog = agents,
    selectedAgentId,
  }: {
    attention?: [string, "new" | "seen"][];
    sessions?: Session[];
    phase?: "authenticated" | "stale";
    catalog?: Agent[];
    selectedAgentId?: string;
  } = {},
) {
  const metadata: ConversationMetadata = {
    agents: new Map(),
    statuses: new Map(),
    staleStatuses: new Set(),
    historyReadFailures: new Set(),
    attention: new Map(attention),
  };
  return railNow({
    agents,
    snapshot: { agents: catalog, workspaces: visible } as Snapshot,
    workspaces: visible,
    metadata,
    daemonSessions: sessions,
    selectedAgentId,
    phase,
  });
}
const ids = (rows: { agentId: string }[]) => rows.map((r) => r.agentId);

describe("rail Nyt groups", () => {
  for (const replyFirst of [false, true]) {
    it(`keeps Ei nyt on a settled background reply (status first: ${replyFirst})`, async () => {
      const id = "pi:11111111-1111-4111-8111-111111111111";
      const life = "22222222-2222-4222-8222-222222222222";
      let finish!: (value: Status) => void;
      const store = new ConversationStore(
        "person",
        new ConversationPager(),
        50,
        () =>
          new Promise<Status>((resolve) => {
            finish = resolve;
          }),
      );
      const status = (active: boolean, sequence: number) =>
        ({
          agent_id: id,
          run_active: active,
          state: active ? "accepted" : "idle",
          journal_cursor: `ev1:${life}:${sequence}`,
        }) as Status;
      const row = agent(id, {
        run_active: true,
        process: "daemon_managed_live",
      });
      const snapshot = {
        agents: [row],
        workspaces: visible,
        identity: { web_identity_id: "person" },
        event_cursor: `ev1:${life}:4`,
      } as Snapshot;
      const render = () =>
        railNow({
          agents: snapshot.agents,
          snapshot,
          workspaces: visible,
          metadata: store.readMetadata(),
          daemonSessions: [],
          phase: "authenticated",
        });
      store.applySnapshot(snapshot);
      store.applyStatus(id, status(true, 4));
      expect(render().running[0].turnAction).toBeUndefined();
      if (replyFirst) store.applyStatus(id, status(false, 8));
      store.routeEvent({
        resource: { agent_id: id },
        kind: "turn.settled",
        payload: { state: "settled", native_key: "reply" },
        cursor: `ev1:${life}:8`,
        server_instance_id: life,
        sequence: 8,
        event_id: "settled",
      } as never);
      snapshot.agents = [
        {
          ...row,
          run_active: false,
          last_reply: { id: "reply", at: "2026-11-10T00:00:00Z" },
        },
      ];
      snapshot.event_cursor = `ev1:${life}:8`;
      store.applySnapshot(snapshot);
      // Hold the replacement read: a known-stale active status must not
      // suppress the action already justified by the settled snapshot.
      expect(store.statusStale(id)).toBe(true);
      expect(render().yours[0].turnAction).toBe("not_now");
      finish(status(false, 8));
      await Promise.resolve();
      await Promise.resolve();
      expect(render().yours[0].turnAction).toBe("not_now");
      store.applyStatus(id, status(true, 9));
      expect(render().yours[0].turnAction).toBeUndefined();
      store.dispose();
    });
  }
  it("lists every other conversation in Hiljaiset, newest first, across process stops", () => {
    const finished = Array.from({ length: 7 }, (_, n) =>
      agent(`quiet-${n}`, {
        run_active: false,
        changed_at: new Date((n + 1) * 86400000).toISOString(),
      }),
    );
    // A finished worktree conversation is quiet too (Jari 1.11.2026).
    const worktree = agent("worker", {
      worktree_id: "wt_worker",
      process: "confirmed_exited",
      changed_at: new Date(3.5 * 86400000).toISOString(),
    });
    const excluded = [
      agent("archived", { archive: "archived", process: "confirmed_exited" }),
      agent("working", { run_active: true }),
      agent("unread", { process: "confirmed_exited" }),
    ];
    const options = {
      selectedAgentId: "quiet-0",
      attention: [["unread", "new"]] as [string, "new"][],
    };
    const before = run([...excluded, worktree, ...finished], options);
    expect(ids(before.quiet)).toEqual([
      "quiet-6",
      "quiet-5",
      "quiet-4",
      "quiet-3",
      "worker",
      "quiet-2",
      "quiet-1",
      "quiet-0",
    ]);
    expect(before.quiet.find((a) => a.selected)?.agentId).toBe("quiet-0");
    expect(before.quiet.some((a) => a.kept)).toBe(false);
    for (const cause of ["idle", "restart"] as const) {
      const stopped = finished.map((a) => ({
        ...a,
        process: "confirmed_exited",
        rest: { cause, awake: false, at: "2026-10-31T00:00:00Z" },
      }));
      expect(
        ids(run([...excluded, worktree, ...stopped], options).quiet),
      ).toEqual(ids(before.quiet));
    }
    expect(
      run(excluded, {
        selectedAgentId: "archived",
        ...{ attention: options.attention },
      }).quiet,
    ).toEqual([]);
  });
  it("puts the person's turn first and keeps only live work below it", () => {
    const now = run(
      [
        agent("working", { run_active: true }),
        agent("asks", { run_active: false, pending_question: { id: "q" } }),
        agent("idle", { run_active: false }),
        agent("background", {
          run_active: false,
          waiting_on: [
            { process_id: "p", name: "npm test", kind: "process", run_ids: [] },
          ],
        }),
        agent("replied", { process: "confirmed_exited" }),
        agent("finished", { process: "confirmed_exited" }),
        agent("worker-busy", { process: "not_observed", spinoffs_working: 1 }),
        agent("archived", { run_active: true, archive: "archived" }),
        agent("hidden-workspace", {
          run_active: true,
          workspace_id: "ws_hidden000",
        }),
      ],
      { attention: [["replied", "new"]] },
    );
    expect(ids(now.yours)).toEqual(["asks", "replied"]);
    // Catalog order, not activity order: rows do not jump between turns.
    expect(ids(now.running)).toEqual(["working", "background", "worker-busy"]);
    expect(now.yours[0].question).toBe(true);
    expect(now.yours[1].question).toBe(false);
    // Background work says what it waits for.
    expect(now.running[1].detail).toContain("npm test");
  });

  it("drops a conversation whose turn ended and brings it back when its agent works", () => {
    // rail-running-after-done: Pi stays open after its turn, waiting for a
    // message. That is not work, read or not.
    const ended = agent("ended", {
      process: "daemon_managed_live",
      run_active: false,
    });
    const sessions: Session[] = [
      { agent_id: "ended", workspace_id: "ws_example00", state: "live" },
    ];
    const done = run([ended], { sessions });
    expect(ids(done.running)).toEqual([]);
    expect(ids(done.yours)).toEqual([]);
    expect(done.hints.size).toBe(0);
    // Unread, the reply is the person's turn.
    expect(
      ids(run([ended], { sessions, attention: [["ended", "new"]] }).yours),
    ).toEqual(["ended"]);
    // Written to again, it works.
    const again = run([{ ...ended, run_active: true }], { sessions });
    expect(ids(again.running)).toEqual(["ended"]);
    expect(again.running[0].activityLabel).toBe("Työskentelee");
    // Its worker works on after the turn: in sight, and saying so.
    const worker = run([{ ...ended, spinoffs_working: 1 }], { sessions });
    expect(ids(worker.running)).toEqual(["ended"]);
    expect(worker.running[0].activityLabel).toBe("Worker työskentelee");
  });

  it("gives the person the turn over a service the agent left running", () => {
    // rail-background-service-not-running (Jari 12.11.2026): a file server
    // the agent started in an earlier turn, still running and waking it,
    // does not hold a conversation that has handed the turn back.
    const at = new Date(Date.UTC(2026, 10, 12, 10, 48)).toISOString();
    const sessions: Session[] = [
      { agent_id: "served", workspace_id: "ws_example00", state: "live" },
    ];
    const service = {
      process_id: "proc_6b7c",
      name: "hilla-dell-script-review",
      kind: "process" as const,
      run_ids: [],
      before_turn: true as const,
    };
    const served = agent("served", {
      process: "daemon_managed_live",
      run_active: false,
      last_reply: { id: "r1", at },
      waiting_on: [service],
    });
    const read = run([served], { sessions, attention: [["served", "seen"]] });
    expect(ids(read.yours)).toEqual(["served"]);
    expect(ids(read.running)).toEqual([]);
    expect(read.yours[0]).toMatchObject({
      turnMark: "read",
      turnAction: "not_now",
      backgroundService: "hilla-dell-script-review",
    });
    expect(read.yours[0].detail).toContain(
      "Taustalla käynnissä: hilla-dell-script-review",
    );
    expect(read.yours[0].detail).not.toContain("Odottaa taustatyötä");
    expect(read.hints.get("ws_example00")).toMatchObject({ kind: "attention" });
    // Unread, the same; Ei nyt moves it to Hiljaiset like any reply.
    expect(
      ids(run([served], { sessions, attention: [["served", "new"]] }).yours),
    ).toEqual(["served"]);
    const dismissed = run(
      [{ ...served, turn_mark: { state: "not_now", reply_id: "r1", at } }],
      { sessions, attention: [["served", "seen"]] },
    );
    expect(ids(dismissed.quiet)).toEqual(["served"]);

    // While the agent's turn is open, the conversation works.
    const open = run([{ ...served, run_active: true }], { sessions });
    expect(ids(open.running)).toEqual(["served"]);
    expect(open.running[0].activityLabel).toBe("Työskentelee");

    // A process started within the latest turn is what the turn ended to
    // wait for: the agent continues by itself.
    const waiting = { ...service, before_turn: undefined };
    const build = run([{ ...served, waiting_on: [waiting] }], {
      sessions,
      attention: [["served", "seen"]],
    });
    expect(ids(build.running)).toEqual(["served"]);
    expect(build.running[0].activityLabel).toBe("Odottaa taustatyötä");
    expect(build.running[0].backgroundService).toBeUndefined();
    // So is a Taskfleet wait for a worker, whenever it was started.
    const worker = run(
      [
        {
          ...served,
          waiting_on: [{ ...service, kind: "taskfleet_wait", run_ids: ["r"] }],
        },
      ],
      { sessions, attention: [["served", "seen"]] },
    );
    expect(ids(worker.running)).toEqual(["served"]);
    // A turn waiting for a build while an old service also runs still waits.
    const both = run([{ ...served, waiting_on: [service, waiting] }], {
      sessions,
      attention: [["served", "seen"]],
    });
    expect(ids(both.running)).toEqual(["served"]);
    expect(both.running[0]).toMatchObject({
      backgroundService: "hilla-dell-script-review",
    });
  });

  it("keeps a worker waiting at its own prompt in sight without pulsing", () => {
    const now = run([
      agent("worker-idle", { process: "not_observed", spinoffs_idle: 1 }),
      agent("worker-mixed", {
        process: "not_observed",
        spinoffs_working: 1,
        spinoffs_idle: 1,
      }),
    ]);
    expect(ids(now.running)).toEqual(["worker-idle", "worker-mixed"]);
    expect(now.running[0].activityLabel).toBe("Worker odottaa sinua");
    expect(now.running[0].spinoffWorking).toBe(false);
    expect(now.running[1].activityLabel).toBe("Worker työskentelee");
    expect(now.running[1].spinoffWorking).toBe(true);
  });

  it("carries the host's last change and keeps a crashed Pi in sight as failed", () => {
    const now = run([
      agent("working", {
        run_active: true,
        changed_at: "2026-10-29T10:00:00.000Z",
      }),
      agent("crashed", {
        process: "not_observed",
        rest: { cause: "crash", at: "2026-10-29T10:05:00Z" },
      }),
      agent("rested", {
        process: "not_observed",
        rest: { cause: "idle", at: "2026-10-29T10:05:00Z" },
      }),
    ]);
    expect(ids(now.running)).toEqual(["working", "crashed"]);
    expect(now.running[0].changedAt).toBe(Date.parse("2026-10-29T10:00:00Z"));
    expect(now.running[0].workspaceName).toBe("kotisivu");
    expect(now.running[0].failed).toBeUndefined();
    expect(now.running[1].changedAt).toBeUndefined();
    expect(now.running[1].failed).toBe(true);
    expect(now.running[1].detail).toContain("Pi kaatui");
    // A failed row is not live work in its workspace's hint.
    expect(now.hints.get("ws_example00")?.count).toBe(1);
  });

  it("shows a crashed browser conversation as failed though its handle is listed", () => {
    const crashed = agent("browser", {
      run_active: false,
      capabilities: {
        agent_resume: { state: "supported", reason_code: "browser_origin" },
      },
      rest: { cause: "crash", at: "2026-10-29T10:05:00Z" },
    });
    const listed = (rest: Agent["rest"], runActive = false) =>
      run([{ ...crashed, rest, run_active: runActive }], {
        sessions: [
          {
            agent_id: "browser",
            workspace_id: "ws_example00",
            state: "stopped",
          },
        ],
      }).running;
    expect(listed(crashed.rest)[0].failed).toBe(true);
    // Woken by the person's typing, Pi is up again: not failed any more,
    // and in Käynnissä only once it works.
    const awake: Agent["rest"] = {
      cause: "crash",
      at: "2026-10-29T10:05:00Z",
      awake: true,
    };
    expect(listed(awake)).toEqual([]);
    expect(listed(awake, true)[0].failed).toBeUndefined();
  });

  it("keeps a turn cut by a daemon restart in sight until it is continued", () => {
    const rest: Agent["rest"] = {
      cause: "restart",
      at: "2026-10-31T10:21:00Z",
    };
    const now = run([
      agent("cut", { process: "not_observed", rest, interrupted_turn: true }),
      agent("rested", { process: "not_observed", rest }),
    ]);
    expect(ids(now.running)).toEqual(["cut"]);
    expect(now.running[0].failed).toBe(true);
    expect(now.running[0].detail).toContain("Työ katkesi kesken");
    expect(now.hints.get("ws_example00")).toBeUndefined();
    // Woken by typing, or told with the person's message, it is not cut any more.
    expect(
      run([
        agent("cut", {
          process: "not_observed",
          rest: { ...rest, awake: true },
          interrupted_turn: true,
        }),
      ]).running,
    ).toEqual([]);
    // A stop the person asked for cut it by choice.
    expect(
      run([
        agent("stopped", {
          process: "not_observed",
          rest: { ...rest, cause: "person" },
          interrupted_turn: true,
        }),
      ]).running,
    ).toEqual([]);
    // A crash that cut the turn says it crashed.
    expect(
      run([
        agent("crashed", {
          process: "not_observed",
          rest: { ...rest, cause: "crash" },
          interrupted_turn: true,
        }),
      ]).running[0].detail,
    ).toContain("Pi kaatui");
  });

  it("shows an error turn and a failed worker as failed, and work that runs again as working", () => {
    const now = run(
      [
        agent("error-turn", { run_active: false, failure: "turn_error" }),
        // Its worker made it live; the failed run keeps it in sight.
        agent("worker-failed", {
          process: "not_observed",
          failure: "worker_failed",
        }),
        agent("retrying", { run_active: true, failure: "turn_error" }),
        agent("replied", { run_active: false, failure: "turn_error" }),
      ],
      { attention: [["replied", "new"]] },
    );
    expect(ids(now.yours)).toEqual(["replied"]);
    expect(now.yours[0].failed).toBe(true);
    expect(now.yours[0].detail).toContain("Vuoro päättyi virheeseen");
    expect(ids(now.running)).toEqual(["worker-failed", "retrying"]);
    expect(ids(now.quiet)).toEqual(["error-turn"]);
    expect(now.quiet[0].failed).toBe(true);
    expect(now.running[0].failed).toBe(true);
    expect(now.running[1].failed).toBeUndefined();
    // Failed rows are not live work in the hint; the working one is.
    expect(now.hints.get("ws_example00")).toMatchObject({
      kind: "attention",
      count: 1,
    });
  });

  it("keeps the rows through a lost connection without claiming they work", () => {
    const now = run([agent("working", { run_active: true })], {
      phase: "stale",
    });
    expect(ids(now.running)).toEqual(["working"]);
    expect(now.running[0].activity).not.toBe("working");
    expect(now.running[0].spinoffWorking).toBe(false);
  });

  it("opens browser, resumable and worktree conversations in their workspace", () => {
    const agents = [
      agent("native", { run_active: true }),
      agent("browser", { run_active: true, worktree_id: "wt_example00" }),
      agent("resumable", {
        run_active: true,
        capabilities: {
          agent_resume: { state: "supported", reason_code: "supported" },
        },
      }),
    ];
    expect(
      run(agents, {
        sessions: [
          { agent_id: "browser", workspace_id: "wt_example00", state: "live" },
        ],
      }).running.map((r) => r.href),
    ).toEqual([
      "/agents/native",
      "/workspaces/ws_example00?conversation=browser",
      "/workspaces/ws_example00?conversation=resumable",
    ]);
  });

  it("drops a conversation the catalog removed unless this tab runs it", () => {
    const now = run(
      [
        agent("removed", { process: "confirmed_exited" }),
        agent("started", { process: "confirmed_exited" }),
      ],
      {
        attention: [
          ["removed", "new"],
          ["started", "new"],
        ],
        sessions: [
          { agent_id: "started", workspace_id: "ws_example00", state: "live" },
        ],
        catalog: [],
      },
    );
    expect(ids(now.yours)).toEqual(["started"]);
  });

  it("puts a new conversation in Sinun vuorosi until its first message is written", () => {
    // Opened with +: its Pi waits for the first message, no history yet.
    const fresh = agent("fresh", {
      history: "missing",
      process: "daemon_managed_live",
      run_active: false,
      title: { display: "Uusi keskustelu", source: "new_conversation" },
    });
    const sessions: Session[] = [
      { agent_id: "fresh", workspace_id: "ws_example00", state: "live" },
    ];
    let now = run([fresh], { sessions });
    expect(ids(now.yours)).toEqual(["fresh"]);
    expect(ids(now.quiet)).toEqual([]);
    // Written and at work, it runs; a crash before the history stays failed.
    now = run([{ ...fresh, run_active: true }], { sessions });
    expect(ids(now.running)).toEqual(["fresh"]);
    now = run(
      [
        {
          ...fresh,
          process: "confirmed_exited",
          rest: { cause: "crash", awake: false, at: "2026-11-07T00:00:00Z" },
        },
      ],
      { sessions },
    );
    expect(now.running[0]).toMatchObject({ agentId: "fresh", failed: true });
    // Ei nyt names no reply and moves it to Hiljaiset.
    now = run(
      [
        {
          ...fresh,
          turn_mark: { state: "not_now", at: "2026-11-07T00:00:00Z" },
        },
      ],
      { sessions },
    );
    expect(ids(now.quiet)).toEqual(["fresh"]);
  });

  it("hints each workspace with its strongest state", () => {
    const now = run(
      [
        agent("a", { run_active: true }),
        agent("b", { run_active: false, pending_question: { id: "q" } }),
        agent("c", { workspace_id: "ws_example01", run_active: false }),
        agent("d", {
          workspace_id: "ws_example01",
          run_active: false,
          waiting_on: [
            { process_id: "p", name: "w", kind: "taskfleet_wait", run_ids: [] },
          ],
        }),
      ],
      {},
    );
    expect(now.hints.get("ws_example00")).toMatchObject({
      kind: "attention",
      count: 1,
    });
    // A conversation that only waits for a message is not counted.
    expect(now.hints.get("ws_example01")).toMatchObject({
      kind: "background",
      count: 1,
    });
  });
});

describe("raise and Ei nyt", () => {
  const at = (minute: number) =>
    new Date(Date.UTC(2026, 10, 6, 9, minute)).toISOString();
  const idle = (id: string, extra: Partial<Agent> = {}) =>
    agent(id, { process: "confirmed_exited", run_active: false, ...extra });

  it("keeps a read reply in Sinun vuorosi until Ei nyt, and back with the next reply", () => {
    const read = idle("read", { last_reply: { id: "r1", at: at(1) } });
    let now = run([read], { attention: [["read", "seen"]] });
    expect(ids(now.yours)).toEqual(["read"]);
    expect(now.yours[0]).toMatchObject({
      turnMark: "read",
      turnAction: "not_now",
    });
    const dismissed = {
      ...read,
      turn_mark: { state: "not_now" as const, at: at(2), reply_id: "r1" },
    };
    now = run([dismissed], { attention: [["read", "seen"]] });
    expect(ids(now.yours)).toEqual([]);
    expect(now.quiet[0]).toMatchObject({
      agentId: "read",
      turnAction: "raise",
    });
    // Ei nyt said on another device answers a reply never shown here.
    now = run([dismissed], { attention: [["read", "new"]] });
    expect(ids(now.yours)).toEqual([]);
    expect(now.quiet[0].attentionLabel).toBeUndefined();
    // A seen entry whose reply the snapshot no longer names does not wait.
    now = run([idle("read")], {
      attention: [["read", "seen"]],
    });
    expect(ids(now.yours)).toEqual([]);
    const replied = { ...dismissed, last_reply: { id: "r2", at: at(5) } };
    now = run([replied], { attention: [["read", "new"]] });
    expect(ids(now.yours)).toEqual(["read"]);
  });

  it("leads Sinun vuorosi with the newest raise until a reply takes its place", () => {
    const reply = idle("reply", { last_reply: { id: "r1", at: at(1) } });
    const older = idle("older", { turn_mark: { state: "raised", at: at(2) } });
    const newer = idle("newer", { turn_mark: { state: "raised", at: at(3) } });
    let now = run([reply, older, newer], {
      attention: [["reply", "new"]],
    });
    expect(ids(now.yours)).toEqual(["newer", "older", "reply"]);
    expect(now.yours[0]).toMatchObject({
      turnMark: "raised",
      turnAction: "lower",
      activityLabel: "Nostit Sinun vuoroosi",
    });
    expect(now.yours[2]).toMatchObject({ turnAction: "not_now" });
    // The agent answered after the raise: the reply stands in its place.
    const answered = { ...older, last_reply: { id: "r9", at: at(4) } };
    now = run([answered], { attention: [["older", "seen"]] });
    expect(now.yours[0]).toMatchObject({
      agentId: "older",
      turnMark: "read",
      turnAction: "not_now",
    });
  });

  it("shows a raised conversation at work in Käynnissä and offers nothing there", () => {
    const working = agent("working", {
      run_active: true,
      turn_mark: { state: "raised", at: at(2) },
    });
    const asks = agent("asks", { pending_question: { id: "q1" } as never });
    const now = run([working, asks]);
    expect(ids(now.running)).toEqual(["working"]);
    expect(now.running[0].turnAction).toBeUndefined();
    expect(now.running[0].turnMark).toBeUndefined();
    expect(
      now.yours.find((r) => r.agentId === "asks")?.turnAction,
    ).toBeUndefined();
  });
});
