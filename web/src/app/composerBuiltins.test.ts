import { describe, expect, it, vi } from "vitest";
import type { CompactionControl } from "../components/ContextView";
import { conversationBuiltins } from "./composerBuiltins";

describe("conversation built-ins", () => {
  const ready = (): CompactionControl => ({
    offer: "ready",
    running: false,
    onCompact: vi.fn(),
  });
  it("offers only existing browser actions, with compact instructions passed intact", () => {
    const control = ready();
    const onNew = vi.fn();
    const actions = conversationBuiltins(control, onNew);
    expect(actions.map((a) => a.name)).toEqual(["compact", "new"]);
    actions[0].run("Keep the test results");
    actions[1].run("");
    expect(control.onCompact).toHaveBeenCalledWith("Keep the test results");
    expect(onNew).toHaveBeenCalledOnce();
  });
  it.each(["busy", "none"] as const)(
    "explains why compaction is unavailable: %s",
    (offer) => {
      const [action] = conversationBuiltins({ ...ready(), offer }, vi.fn());
      expect(action.availability?.state).toBe("disabled");
      expect(action.availability).toHaveProperty("reason");
    },
  );
  it("validates summary instructions using Unicode code points before the draft is cleared", () => {
    const [action] = conversationBuiltins(ready(), vi.fn());
    expect(action.validateArguments?.("🦊".repeat(2000))).toBeUndefined();
    expect(action.validateArguments?.("🦊".repeat(2001))).toBeTruthy();
    expect(action.validateArguments?.("bad\u0000text")).toBeTruthy();
  });
  it("does not offer another compaction while one runs", () => {
    const [action] = conversationBuiltins(
      { ...ready(), running: true },
      vi.fn(),
    );
    expect(action.availability?.state).toBe("disabled");
  });
});
