import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const notePresence = vi.fn(async () => undefined);
vi.mock("./conversations", () => ({
  notePresence: (...args: unknown[]) => notePresence(...(args as [])),
}));
const { useRecapHold } = await import("./recapHold");

afterEach(() => {
  notePresence.mockClear();
  vi.useRealTimers();
});

const hold = () =>
  renderHook(() =>
    useRecapHold({
      id: "pi:11111111-1111-4111-8111-111111111111",
      csrf: "c",
      controlled: true,
      draft: "",
      feed: { current: null },
      opened: true,
    }),
  );

describe("presence beyond the composer", () => {
  it("reports input anywhere on the page, such as the terminal dock, without holding the recap", () => {
    const { result } = hold();
    const terminal = document.createElement("textarea");
    document.body.append(terminal);
    act(() => {
      terminal.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    });
    expect(notePresence).toHaveBeenCalledTimes(1);
    // The recap's own hold follows the composer and the stream only.
    expect(result.current.recent).toBe(false);
    act(() => {
      terminal.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    });
    expect(notePresence).toHaveBeenCalledTimes(1);
    terminal.remove();
  });
  it("reports a focused editor frame, whose input the page never sees", () => {
    vi.useFakeTimers();
    hold();
    const frame = document.createElement("iframe");
    document.body.append(frame);
    frame.focus();
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(notePresence).toHaveBeenCalledTimes(1);
    frame.remove();
  });
});
