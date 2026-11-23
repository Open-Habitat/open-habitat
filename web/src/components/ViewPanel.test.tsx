import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ViewFrame } from "./ViewPanel";

afterEach(() => vi.useRealTimers());

function load() {
  const frame = screen.getByTestId("view-frame") as HTMLIFrameElement;
  if (!frame.contentWindow) throw new Error("missing frame window");
  const post = vi.spyOn(frame.contentWindow, "postMessage");
  fireEvent.load(frame);
  const challenge = post.mock.calls[0][0].challenge as string;
  post.mockRestore();
  return { frame, challenge };
}

function reply(source: Window | null, challenge: string, blocked = false) {
  act(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        source,
        origin: "null",
        data: { type: "oh-view-status", challenge, blocked },
      }),
    ),
  );
}

it("recovers without replaying a spent handoff; foreign and stale replies do not mask failure", () => {
  vi.useFakeTimers();
  const reopen = vi.fn();
  const { rerender } = render(
    <ViewFrame
      src="https://view.example/_open-habitat/handoff?token=spent"
      title="Example"
      onReopen={reopen}
    />,
  );
  const first = load();
  reply(window, first.challenge);
  act(() => vi.advanceTimersByTime(3000));
  expect(screen.getByTestId("view-blocked")).toBeTruthy();
  fireEvent.click(screen.getByTestId("reopen-view"));
  expect(reopen).toHaveBeenCalledOnce();
  // Only the caller supplies a fresh grant; the frame never guesses a URL.
  expect(screen.queryByTestId("view-frame")).toBeNull();
  rerender(
    <ViewFrame
      src="https://view.example/_open-habitat/handoff?token=fresh"
      title="Example"
      onReopen={reopen}
    />,
  );
  const second = load();
  reply(second.frame.contentWindow, first.challenge);
  act(() => vi.advanceTimersByTime(3000));
  expect(screen.getByTestId("view-blocked")).toBeTruthy();
});

it("accepts the current document, then replaces it on a blocked nested frame report", () => {
  vi.useFakeTimers();
  render(
    <ViewFrame
      src="https://view.example/index.html"
      title="Example"
      onReopen={() => {}}
    />,
  );
  const { frame, challenge } = load();
  reply(frame.contentWindow, challenge);
  act(() => vi.advanceTimersByTime(10000));
  expect(screen.queryByTestId("view-blocked")).toBeNull();
  reply(frame.contentWindow, challenge, true);
  expect(screen.queryByTestId("view-frame")).toBeNull();
});
