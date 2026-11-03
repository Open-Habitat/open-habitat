import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const notePresence = vi.fn(async () => undefined);
vi.mock("./conversations", () => ({
  notePresence: (...args: unknown[]) => notePresence(...(args as [])),
}));
const { useRecapHold, useRecapPresentationHold } = await import("./recapHold");

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

describe("automatic recap delivery", () => {
  const presentation = (received = false) =>
    renderHook(
      (props: { draft: string; received: boolean }) => {
        const activity = useRecapHold({
          id: "pi:11111111-1111-4111-8111-111111111111",
          csrf: "c",
          controlled: true,
          draft: props.draft,
          feed: { current: null },
          opened: true,
        });
        const { held, reveal } = useRecapPresentationHold({
          key: "conversation",
          fingerprint: props.received ? "first-recap" : "",
          received: props.received,
          automatic: props.received,
          activity,
        });
        return { held, reveal, note: activity.note };
      },
      { initialProps: { draft: "", received } },
    );

  it("holds the first read through a quiet interval until the draft is cleared and input pauses", () => {
    vi.useFakeTimers();
    const { result, rerender } = presentation();
    act(() => result.current.note());
    rerender({ draft: "unfinished message", received: true });
    expect(result.current.held).toBe(true);
    act(() => vi.advanceTimersByTime(5 * 60_000));
    expect(result.current.held).toBe(true);
    act(() => result.current.note());
    rerender({ draft: "", received: true });
    expect(result.current.held).toBe(true);
    act(() => vi.advanceTimersByTime(61_000));
    expect(result.current.held).toBe(false);
  });

  it("lets an explicit request reveal a held recap during composition", () => {
    vi.useFakeTimers();
    const { result, rerender } = presentation();
    rerender({ draft: "unfinished message", received: true });
    expect(result.current.held).toBe(true);
    act(() => result.current.reveal());
    expect(result.current.held).toBe(false);
  });

  it("keeps an already displayed recap visible when composition begins", () => {
    vi.useFakeTimers();
    const { result, rerender } = presentation(true);
    expect(result.current.held).toBe(false);
    act(() => result.current.note());
    rerender({ draft: "unfinished message", received: true });
    expect(result.current.held).toBe(false);
    act(() => vi.advanceTimersByTime(5 * 60_000));
    expect(result.current.held).toBe(false);
  });
});

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
