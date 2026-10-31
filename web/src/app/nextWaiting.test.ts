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
  it("walks the other waiting ones in the rail's order, without the conversation it started from", () => {
    const round = new WaitingRound();
    expect(round.start("o", [row("o")])).toBeUndefined();
    expect(round.steps).toBeNull();
    const first = round.start("o", [row("a"), row("o"), row("b")]);
    expect(first?.agentId).toBe("a");
    expect(ids(round)).toEqual(["a", "b"]);
    round.open("a");
    expect(round.pos).toBe(0);
    expect(round.move(1, () => true)?.agentId).toBe("b");
  });

  it("steps back one at a time, never before the first step", () => {
    const round = new WaitingRound();
    round.start("o", [row("a"), row("b")]);
    round.open("a");
    round.open("b");
    expect(round.move(-1, () => true)?.agentId).toBe("a");
    round.open("a");
    expect(round.move(-1, () => true)).toBeUndefined();
    expect(round.steps).not.toBeNull();
  });

  it("tells handled here from handled elsewhere and skips the latter", () => {
    const round = new WaitingRound();
    round.start("o", [row("a"), row("b"), row("c")]);
    round.open("a");
    // a was read here; b was answered on another device; c still waits.
    const waiting = ["c"];
    const waits = (id: string) => waiting.includes(id);
    expect([0, 1, 2].map((i) => round.stateOf(i, waits))).toEqual([
      "handled",
      "elsewhere",
      "waits",
    ]);
    expect(round.move(1, waits)?.agentId).toBe("c");
    round.open("c");
    expect(round.move(-1, waits)?.agentId).toBe("a");
  });

  it("past the last step ends the round where the person is and says how many were handled", () => {
    vi.useFakeTimers();
    const round = new WaitingRound();
    round.start("o", [row("a"), row("b")]);
    round.open("a");
    round.open("b");
    // b still asks: one handled of two. The round leads nowhere.
    expect(round.move(1, (id) => id === "b")).toBeUndefined();
    expect(round.steps).toBeNull();
    expect(round.note).toMatch(/1/);
    vi.advanceTimersByTime(5000);
    expect(round.note).toBe("");
  });

  it("appends ones that start waiting later, the start included, and keeps the frozen order", () => {
    const round = new WaitingRound();
    round.start("o", [row("a"), row("b")]);
    const listener = vi.fn();
    round.subscribe(listener);
    round.sync([row("c"), row("b")]);
    expect(ids(round)).toEqual(["a", "b", "c"]);
    expect(listener).toHaveBeenCalledTimes(1);
    round.sync([row("c")]);
    expect(listener).toHaveBeenCalledTimes(1);
    // The conversation it started from joins once it waits, like any other.
    round.sync([row("o")]);
    expect(ids(round)).toEqual(["a", "b", "c", "o"]);
  });

  it("says once of each step handled elsewhere", () => {
    vi.useFakeTimers();
    const round = new WaitingRound();
    round.start("o", [row("a"), row("b")]);
    round.open("a");
    round.announce((id) => id === "a" || id === "b");
    expect(round.note).toBe("");
    round.announce((id) => id === "a");
    expect(round.note).toContain("b");
    vi.advanceTimersByTime(5000);
    round.announce((id) => id === "a");
    expect(round.note).toBe("");
  });

  it("drops archived or vanished steps, keeps its place, and ends itself when none is left", () => {
    vi.useFakeTimers();
    const round = new WaitingRound();
    round.start("o", [row("a"), row("b"), row("c")]);
    round.open("a");
    round.open("b");
    const listed = (ids: string[], archived: string[] = []) => [
      ...ids.map((agent_id) => ({ agent_id })),
      ...archived.map((agent_id) => ({ agent_id, archive: "archived" })),
    ];
    // c is too new to be listed yet: that is not gone.
    round.prune(listed(["a", "b"]));
    expect(ids(round)).toEqual(["a", "b", "c"]);
    // b (here) is archived: the place falls back to a, so next is c.
    round.prune(listed(["a", "c"], ["b"]));
    expect(ids(round)).toEqual(["a", "c"]);
    expect(round.pos).toBe(0);
    expect(round.move(1, () => true)?.agentId).toBe("c");
    // c drops out of the listing and a is archived: nothing is left to walk.
    round.prune(listed([], ["a"]));
    expect(round.steps).toBeNull();
    expect(round.note).toMatch(/3/);
  });

  it("with the first step archived under the person, Seuraava leads to the new first", () => {
    const round = new WaitingRound();
    round.start("o", [row("a"), row("b")]);
    round.open("a");
    round.prune([{ agent_id: "a", archive: "archived" }, { agent_id: "b" }]);
    expect(ids(round)).toEqual(["b"]);
    expect(round.pos).toBe(-1);
    expect(round.move(-1, () => true)).toBeUndefined();
    expect(round.move(1, () => true)?.agentId).toBe("b");
  });
});
