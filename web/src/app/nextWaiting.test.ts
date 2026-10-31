import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentNavModel } from "../components/Navigation";
import { WaitingRound } from "./nextWaiting";

const row = (agentId: string): AgentNavModel => ({
  agentId,
  href: `/workspaces/ws_aaaaaaaa?conversation=${agentId}`,
  title: agentId,
  activityLabel: "Uusi vastaus",
  controlLabel: "",
});
const ids = (round: WaitingRound) => round.steps?.map((s) => s.agentId);

afterEach(() => {
  vi.useRealTimers();
});

describe("WaitingRound", () => {
  it("starts from the origin and walks the waiting ones in the rail's order", () => {
    const round = new WaitingRound();
    expect(round.start(row("o"), [row("o")])).toBeUndefined();
    expect(round.steps).toBeNull();
    const first = round.start(row("o"), [row("a"), row("o"), row("b")]);
    expect(first?.agentId).toBe("a");
    expect(ids(round)).toEqual(["o", "a", "b"]);
    round.open("a");
    expect(round.pos).toBe(1);
    expect(round.move(1, () => true)?.agentId).toBe("b");
  });

  it("steps back one at a time, never past the origin", () => {
    const round = new WaitingRound();
    round.start(row("o"), [row("a"), row("b")]);
    round.open("a");
    round.open("b");
    expect(round.move(-1, () => true)?.agentId).toBe("a");
    round.open("a");
    expect(round.move(-1, () => true)?.agentId).toBe("o");
    round.open("o");
    expect(round.move(-1, () => true)).toBeUndefined();
    expect(round.steps).not.toBeNull();
  });

  it("tells handled here from handled elsewhere and skips the latter", () => {
    const round = new WaitingRound();
    round.start(row("o"), [row("a"), row("b"), row("c")]);
    round.open("a");
    // a was read here; b was answered on another device; c still waits.
    const waiting = ["c"];
    const waits = (id: string) => waiting.includes(id);
    expect([0, 1, 2, 3].map((i) => round.stateOf(i, waits))).toEqual([
      "origin",
      "handled",
      "elsewhere",
      "waits",
    ]);
    expect(round.move(1, waits)?.agentId).toBe("c");
    round.open("c");
    expect(round.move(-1, waits)?.agentId).toBe("a");
  });

  it("past the last step ends the round, leads to the origin and says how many were handled", () => {
    vi.useFakeTimers();
    const round = new WaitingRound();
    round.start(row("o"), [row("a"), row("b")]);
    round.open("a");
    round.open("b");
    // b still asks: one handled of two.
    const home = round.move(1, (id) => id === "b");
    expect(home?.agentId).toBe("o");
    expect(round.steps).toBeNull();
    expect(round.note).toMatch(/1/);
    vi.advanceTimersByTime(5000);
    expect(round.note).toBe("");
  });

  it("appends ones that start waiting later and keeps the frozen order", () => {
    const round = new WaitingRound();
    round.start(row("o"), [row("a"), row("b")]);
    const listener = vi.fn();
    round.subscribe(listener);
    round.sync([row("c"), row("b")]);
    expect(ids(round)).toEqual(["o", "a", "b", "c"]);
    expect(listener).toHaveBeenCalledTimes(1);
    round.sync([row("c")]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("says once of each step handled elsewhere", () => {
    vi.useFakeTimers();
    const round = new WaitingRound();
    round.start(row("o"), [row("a"), row("b")]);
    round.open("a");
    round.announce((id) => id === "a" || id === "b");
    expect(round.note).toBe("");
    round.announce((id) => id === "a");
    expect(round.note).toContain("b");
    vi.advanceTimersByTime(5000);
    round.announce((id) => id === "a");
    expect(round.note).toBe("");
  });

  it("drops archived or vanished steps, keeps its place, and ends itself when only the origin is left", () => {
    vi.useFakeTimers();
    const round = new WaitingRound();
    round.start(row("o"), [row("a"), row("b"), row("c")]);
    round.open("a");
    round.open("b");
    const listed = (ids: string[], archived: string[] = []) => [
      ...ids.map((agent_id) => ({ agent_id })),
      ...archived.map((agent_id) => ({ agent_id, archive: "archived" })),
    ];
    // The origin is too new to be listed yet: that is not gone.
    round.prune(listed(["a", "b", "c"]));
    expect(ids(round)).toEqual(["o", "a", "b", "c"]);
    // b (here) is archived: the place falls back to a, so next is c.
    round.prune(listed(["o", "a", "c"], ["b"]));
    expect(ids(round)).toEqual(["o", "a", "c"]);
    expect(round.pos).toBe(1);
    expect(round.move(1, () => true)?.agentId).toBe("c");
    // c drops out of the listing and a is archived: nothing is left to walk.
    round.prune(listed(["o"], ["a"]));
    expect(round.steps).toBeNull();
    expect(round.note).toMatch(/3/);
  });

  it("ends when its origin is archived and counts the archived as handled", () => {
    const round = new WaitingRound();
    round.start(row("o"), [row("a"), row("b")]);
    round.open("a");
    round.prune([{ agent_id: "a" }, { agent_id: "b", archive: "archived" }]);
    expect(ids(round)).toEqual(["o", "a"]);
    expect(round.move(1, (id) => id === "x")?.agentId).toBe("o");
    expect(round.note).toMatch(/2/);
    const again = new WaitingRound();
    again.start(row("o"), [row("a"), row("b")]);
    again.open("a");
    again.prune([{ agent_id: "o", archive: "archived" }, { agent_id: "a" }]);
    expect(again.steps).toBeNull();
    expect(again.note).toMatch(/1/);
  });
});
