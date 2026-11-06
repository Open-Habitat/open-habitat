import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useLandingRetry } from "./landingRetry";

afterEach(() => vi.useRealTimers());

it("revives on a restored page, not its initial pageshow", () => {
  vi.useFakeTimers();
  const refresh = vi.fn();
  renderHook(() => useLandingRetry("daemon_unavailable", "network", refresh));
  act(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: false }),
    ),
  );
  expect(refresh).not.toHaveBeenCalled();
  act(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  expect(refresh).toHaveBeenCalledTimes(1);
});

it("backs off read attempts and stops after fifteen minutes, even after a wake", () => {
  vi.useFakeTimers();
  const refresh = vi.fn();
  const { result, rerender } = renderHook(
    ({ phase }) => useLandingRetry(phase, "network", refresh),
    { initialProps: { phase: "daemon_unavailable" } },
  );
  for (const delay of [5, 10, 20, 40, 60, 60]) {
    const before = refresh.mock.calls.length;
    act(() => vi.advanceTimersByTime((delay - 1) * 1000));
    expect(refresh).toHaveBeenCalledTimes(before);
    expect(result.current.seconds).toBe(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(refresh).toHaveBeenCalledTimes(before + 1);
    rerender({ phase: "loading" });
    rerender({ phase: "daemon_unavailable" });
  }
  act(() => vi.advanceTimersByTime(15 * 60 * 1000));
  rerender({ phase: "loading" });
  rerender({ phase: "daemon_unavailable" });
  expect(result.current.exhausted).toBe(true);
  const before = refresh.mock.calls.length;
  act(() => {
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("pageshow"));
    vi.advanceTimersByTime(60000);
  });
  expect(refresh).toHaveBeenCalledTimes(before);
});
