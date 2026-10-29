import { describe, expect, it } from "vitest";
import type { ConversationMetadata } from "./conversationStore";
import type { Session } from "./conversations";
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
  }: {
    attention?: [string, "new" | "seen"][];
    sessions?: Session[];
    phase?: "authenticated" | "stale";
    catalog?: Agent[];
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
    phase,
  });
}
const ids = (rows: { agentId: string }[]) => rows.map((r) => r.agentId);

describe("rail Nyt groups", () => {
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
    expect(ids(now.running)).toEqual([
      "working",
      "idle",
      "background",
      "worker-busy",
    ]);
    expect(now.yours[0].question).toBe(true);
    expect(now.yours[1].question).toBe(false);
    // Background work says what it waits for.
    expect(now.running[2].detail).toContain("npm test");
  });

  it("carries the host's last change and keeps a crashed Pi in sight as failed", () => {
    const now = run([
      agent("idle", {
        run_active: false,
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
    expect(ids(now.running)).toEqual(["idle", "crashed"]);
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
    const listed = (rest: Agent["rest"]) =>
      run([{ ...crashed, rest }], {
        sessions: [
          {
            agent_id: "browser",
            workspace_id: "ws_example00",
            state: "stopped",
          },
        ],
      }).running;
    expect(listed(crashed.rest)[0].failed).toBe(true);
    // Woken by the person's typing, Pi is up again: not failed any more.
    expect(
      listed({ cause: "crash", at: "2026-10-29T10:05:00Z", awake: true })[0]
        .failed,
    ).toBeUndefined();
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
    expect(now.hints.get("ws_example01")).toMatchObject({
      kind: "background",
      count: 2,
    });
  });
});
