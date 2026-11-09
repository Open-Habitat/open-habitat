import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as conversations from "./conversations";
import {
  restoreToDraft,
  useHeldMessages,
  waitingMessages,
  writeHeld,
} from "./heldMessages";
import type { HistoryEntry } from "./history";

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
  // One whose outcome is unknown has its text back in the field instead.
  it("keeps a delivered message visible and an uncertain one out", () => {
    const view = waitingMessages(
      [
        { command_id: a, text: "epävarma", posted: true, uncertain: true },
        { command_id: b, text: "perillä", posted: true, delivered: 1 },
      ],
      [],
      "stopped",
    );
    expect(view).toEqual([
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

// Jari 9.11.2026: a held message whose outcome turned unknown stayed as a
// dashed bubble while a warning claimed its text was in the field.
describe("an outcome learnt from the receipt", () => {
  const key = "nah:person:held:pi:outcome";
  const setup = (receipt: string | undefined, draft = "") => {
    writeHeld(key, [{ command_id: a, text: "isot liitteet", posted: true }]);
    vi.spyOn(conversations, "sendReceipt").mockResolvedValue(
      receipt as conversations.Receipt | undefined,
    );
    const changeDraft = vi.fn();
    const props = {
      id: "pi:outcome",
      identity: "person",
      workspaceId: "ws",
      current: {
        state: "stopped",
        held: [],
      } as unknown as conversations.Status,
      entries: [] as HistoryEntry[],
      draft,
      changeDraft,
      refresh: async () => {},
      onLogin: () => {},
    };
    const hook = renderHook((p) => useHeldMessages(p), { initialProps: props });
    return { ...hook, changeDraft, props };
  };
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });
  it("gives an unknown one back to the field instead of drawing it", async () => {
    const { result, changeDraft } = setup(undefined);
    await waitFor(() =>
      expect(result.current.uncertain).toEqual(["isot liitteet"]),
    );
    expect(result.current.waiting).toEqual([]);
    expect(changeDraft).toHaveBeenCalledWith("isot liitteet");
  });
  it("ends an unknown one the person sends again", async () => {
    const { result } = setup(undefined, "isot liitteet");
    await waitFor(() => expect(result.current.uncertain).toHaveLength(1));
    act(() => result.current.release("isot liitteet\n\nping"));
    expect(result.current.uncertain).toEqual([]);
  });
  it("clears the field once history shows the unknown one arrived", async () => {
    const { result, rerender, changeDraft, props } = setup(undefined);
    await waitFor(() => expect(result.current.uncertain).toHaveLength(1));
    changeDraft.mockClear();
    rerender({
      ...props,
      draft: "isot liitteet",
      entries: [
        {
          entry_key: "u1",
          kind: "user",
          content: { text: "isot liitteet\nAttachment path: /x" },
        } as unknown as HistoryEntry,
      ],
    });
    await waitFor(() => expect(result.current.uncertain).toEqual([]));
    expect(changeDraft).toHaveBeenCalledWith("");
  });
  it("says why an undelivered one is back, until the next send", async () => {
    const { result, changeDraft } = setup("undelivered");
    await waitFor(() => expect(result.current.noticeLasts).toBe(true));
    expect(result.current.notice).toMatch(/keskeytyi/);
    expect(result.current.waiting).toEqual([]);
    expect(result.current.uncertain).toEqual([]);
    expect(changeDraft).toHaveBeenCalledWith("isot liitteet");
  });
});
