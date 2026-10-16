import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSettledWarning } from "./useSettledWarning";

afterEach(() => vi.useRealTimers());

it("suppresses short invalidations but exposes sustained failures and cancels on navigation", () => {
  vi.useFakeTimers();
  const { result, rerender, unmount } = renderHook(
    ({ active, scope }) => useSettledWarning(active, scope),
    { initialProps: { active: false, scope: "alice/one" } },
  );
  rerender({ active: true, scope: "alice/one" });
  act(() => vi.advanceTimersByTime(400));
  expect(result.current).toBe(false);
  rerender({ active: false, scope: "alice/one" });
  act(() => vi.advanceTimersByTime(1000));
  expect(result.current).toBe(false);
  rerender({ active: true, scope: "alice/one" });
  act(() => vi.advanceTimersByTime(800));
  expect(result.current).toBe(true);
  rerender({ active: true, scope: "alice/two" });
  expect(result.current).toBe(false);
  act(() => vi.advanceTimersByTime(799));
  expect(result.current).toBe(false);
  act(() => vi.advanceTimersByTime(1));
  expect(result.current).toBe(true);
  rerender({ active: false, scope: "alice/two" });
  expect(result.current).toBe(false);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
