import { describe, expect, it } from "vitest";
import type { AgentNavModel } from "../components/Navigation";
import { WaitingWalk } from "./nextWaiting";

const row = (agentId: string): AgentNavModel => ({
  agentId,
  href: `/workspaces/ws_aaaaaaaa?conversation=${agentId}`,
  title: agentId,
  activityLabel: "Uusi vastaus",
  controlLabel: "",
});
const step = (agentId: string) => ({ agentId, href: row(agentId).href });

describe("WaitingWalk", () => {
  it("offers the first waiting one in the rail's order, never the current one", () => {
    const walk = new WaitingWalk();
    expect(walk.offer([row("a"), row("b"), row("c")], "a")).toEqual({
      next: row("b"),
      restart: false,
      more: 1,
    });
    expect(walk.offer([row("a")], "a").next).toBeUndefined();
  });

  it("skips the ones visited in this walk and starts again when all are", () => {
    const walk = new WaitingWalk();
    walk.visit(step("x"));
    walk.visit(step("b"));
    walk.visit(step("x"));
    const yours = [row("b"), row("c")];
    expect(walk.offer(yours, "x").next?.agentId).toBe("c");
    walk.visit(step("c"));
    walk.visit(step("x"));
    expect(walk.offer(yours, "x")).toMatchObject({ restart: true });
    expect(walk.forward(yours, "x")?.agentId).toBe("b");
    expect(walk.steps.map((s) => s.agentId)).toEqual(["x"]);
  });

  it("steps back to the conversation before this one and rewinds to it", () => {
    const walk = new WaitingWalk();
    walk.visit(step("a"));
    walk.visit(step("b"));
    walk.visit(step("b"));
    expect(walk.steps).toHaveLength(2);
    expect(walk.back("b")?.agentId).toBe("a");
    expect(walk.steps).toEqual([]);
    expect(walk.back("a")).toBeUndefined();
  });
});
