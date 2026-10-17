import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  restoreToDraft,
  useHeldMessages,
  waitingMessages,
  writeHeld,
} from "./heldMessages";

const a = "aaaaaaaa-0000-4000-8000-00000000000a";
const b = "aaaaaaaa-0000-4000-8000-00000000000b";
const c = "aaaaaaaa-0000-4000-8000-00000000000c";

describe("waiting messages", () => {
  it("draws each held message once, the daemon's order first", () => {
    // b was posted by this tab and is now held; c is still being posted; a
    // came from another tab. A message must never appear twice.
    const view = waitingMessages(
      [
        { command_id: b, text: "toinen", posted: true },
        { command_id: c, text: "kolmas", posted: false },
      ],
      [
        { command_id: a, text: "ensimmäinen" },
        { command_id: b, text: "toinen" },
      ],
      "starting",
    );
    expect(view.map((v) => [v.command_id, v.state])).toEqual([
      [a, "waiting"],
      [b, "waiting"],
      [c, "waiting"],
    ]);
  });

  it("marks held messages failed after a failed start, but not unposted ones", () => {
    const view = waitingMessages(
      [{ command_id: c, text: "kolmas", posted: false }],
      [{ command_id: a, text: "ensimmäinen" }],
      "start_failed",
    );
    expect(view.map((v) => v.state)).toEqual(["failed", "waiting"]);
  });

  // The hook drops a delivered message once native history shows it; until
  // then its bubble stays, so the native message replaces it without a gap.
  it("keeps an uncertain message and a delivered one visible", () => {
    const view = waitingMessages(
      [
        { command_id: a, text: "epävarma", posted: true, uncertain: true },
        { command_id: b, text: "perillä", posted: true, delivered: 1 },
      ],
      [],
      "stopped",
    );
    expect(view).toEqual([
      { command_id: a, text: "epävarma", state: "uncertain" },
      { command_id: b, text: "perillä", state: "waiting" },
    ]);
  });
});

it("returns taken-back messages ahead of the draft, in order", () => {
  expect(restoreToDraft(["yksi", "kaksi"], "luonnos")).toBe(
    "yksi\n\nkaksi\n\nluonnos",
  );
  expect(restoreToDraft(["yksi"], "  ")).toBe("yksi");
});

describe("a delivered message's grace", () => {
  it("ends at an absolute deadline however often history changes", () => {
    vi.useFakeTimers();
    try {
      const key = "nah:person:held:pi:grace";
      writeHeld(key, [
        { command_id: a, text: "perillä", posted: true, delivered: Date.now() },
      ]);
      const props = {
        id: "pi:grace",
        identity: "person",
        workspaceId: "ws",
        current: undefined,
        entries: [] as never[],
        draft: "",
        changeDraft: () => {},
        refresh: async () => {},
        onLogin: () => {},
      };
      const { result, rerender } = renderHook((p) => useHeldMessages(p), {
        initialProps: props,
      });
      expect(result.current.waiting).toHaveLength(1);
      act(() => {
        vi.advanceTimersByTime(9000);
      });
      rerender({ ...props, entries: [] as never[] });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current.waiting).toHaveLength(0);
    } finally {
      vi.useRealTimers();
      sessionStorage.clear();
    }
  });
});
