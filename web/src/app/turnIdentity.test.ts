import { describe, expect, it } from "vitest";
import { settleTurnIds, turnIdentity } from "./turnIdentity";

const user = (key: string) => ({ id: key, kind: "user" });
const turn = (key: string) => ({ id: `turn:${key}`, kind: "assistant" });

describe("settleTurnIds", () => {
  it("gives the saved turn the key of the live row it replaces", () => {
    const memory = turnIdentity();
    const before = [user("u1"), turn("u1")];
    expect(settleTurnIds(memory, "c", before, "live-turn-a").liveKey).toBe(
      "live-turn-a",
    );
    const saved = settleTurnIds(
      memory,
      "c",
      [...before, user("u2"), turn("u2")],
      undefined,
    );
    expect(saved.timeline.map((item) => item.id)).toEqual([
      "u1",
      "turn:u1",
      "u2",
      "live-turn-a",
    ]);
    // Later reads of the same history keep the key; the next turn is its own.
    settleTurnIds(memory, "c", saved.timeline, "live-turn-b");
    const next = settleTurnIds(
      memory,
      "c",
      [...before, user("u2"), turn("u2"), user("u3"), turn("u3")],
      undefined,
    );
    expect(next.timeline.map((item) => item.id).slice(3)).toEqual([
      "live-turn-a",
      "u3",
      "live-turn-b",
    ]);
  });

  it("waits for the turn when the row goes before history has it", () => {
    const memory = turnIdentity();
    settleTurnIds(memory, "c", [turn("u1")], "live-turn-a");
    expect(
      settleTurnIds(memory, "c", [turn("u1")], undefined).timeline,
    ).toEqual([turn("u1")]);
    expect(
      settleTurnIds(memory, "c", [turn("u1"), turn("u2")], undefined).timeline,
    ).toEqual([turn("u1"), { id: "live-turn-a", kind: "assistant" }]);
  });

  it("takes over a saved turn a history read showed beside the row", () => {
    const memory = turnIdentity();
    settleTurnIds(memory, "c", [turn("u1")], "live-turn-a");
    settleTurnIds(memory, "c", [turn("u1"), turn("u2")], "live-turn-a");
    expect(
      settleTurnIds(memory, "c", [turn("u1"), turn("u2")], undefined).timeline,
    ).toEqual([turn("u1"), { id: "live-turn-a", kind: "assistant" }]);
  });

  it("does not reuse a taken key for a later row of the same command", () => {
    const memory = turnIdentity();
    settleTurnIds(memory, "c", [], "live-turn-a");
    settleTurnIds(memory, "c", [turn("u1")], undefined);
    expect(
      settleTurnIds(memory, "c", [turn("u1")], "live-turn-a").liveKey,
    ).toBe("live-turn-a#2");
  });

  it("forgets the keys and the live row of another conversation", () => {
    const memory = turnIdentity();
    settleTurnIds(memory, "c", [], "live-turn-a");
    settleTurnIds(memory, "c", [turn("u1")], undefined);
    settleTurnIds(memory, "c", [turn("u1")], "live-turn-b");
    expect(
      settleTurnIds(memory, "d", [turn("u1")], undefined).timeline,
    ).toEqual([turn("u1")]);
  });
});
