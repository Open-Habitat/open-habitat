import { describe, expect, it } from "vitest";
import type { Agent } from "./snapshot";
import { unreadReplies } from "./unreadReplies";

function agent(id: string, extra: Partial<Agent> = {}): Agent {
  return {
    agent_id: id,
    workspace_id: "ws_example00",
    history: "readable",
    process: "confirmed_exited",
    control: "read_only",
    title: { display: id },
    live_tail: [],
    ...extra,
  };
}

describe("unread reply navigation", () => {
  it("resolves browser and native routes, including worktree sessions", () => {
    const agents = [
      agent("native"),
      agent("browser", { worktree_id: "wt_example00" }),
      agent("resumable", {
        capabilities: {
          agent_resume: { state: "supported", reason_code: "supported" },
        },
      }),
    ];
    const attention = new Map<string, "new" | "seen">(
      agents.map((a) => [a.agent_id, "new"]),
    );
    expect(
      unreadReplies(
        agents,
        attention,
        [{ agent_id: "browser", workspace_id: "wt_example00" }],
        agents,
      ),
    ).toEqual([
      "/agents/native",
      "/workspaces/ws_example00?conversation=browser",
      "/workspaces/ws_example00?conversation=resumable",
    ]);
    // Opening the first reply leaves the remaining destinations actionable.
    attention.set("native", "seen");
    expect(unreadReplies(agents, attention, [], agents)).toHaveLength(2);
  });

  it("ignores seen, removed and archived conversations, not just stale attention keys", () => {
    const agents = [
      agent("seen"),
      agent("removed"),
      agent("archived", { archive: "archived" }),
      agent("recently-archived"),
      agent("unread"),
    ];
    const attention = new Map<string, "new" | "seen">([
      ["seen", "seen"],
      ...agents.slice(1).map((a) => [a.agent_id, "new"] as const),
      ["orphan", "new"],
    ]);
    expect(
      unreadReplies(
        agents,
        attention,
        [],
        agents
          .filter((a) => a.agent_id !== "removed")
          .map((a) =>
            a.agent_id === "recently-archived"
              ? { ...a, archive: "archived" }
              : a,
          ),
      ),
    ).toEqual(["/agents/unread"]);
  });
});
