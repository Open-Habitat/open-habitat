import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { type LandingMode, useLanding } from "./landing";

afterEach(() => vi.useRealTimers());

const start = (mode: LandingMode, at: number) => {
  vi.useFakeTimers({
    now: 0,
    toFake: ["setTimeout", "clearTimeout", "performance"],
  });
  vi.advanceTimersByTime(at);
  return renderHook(({ mode }) => useLanding(mode), {
    initialProps: { mode },
    wrapper: StrictMode,
  });
};

it("never shows a load that finishes within 300 ms of navigation", () => {
  const { result, rerender } = start("loading", 120);
  expect(result.current).toMatchObject({ show: true, revealed: false });
  act(() => vi.advanceTimersByTime(170));
  rerender({ mode: "off" });
  expect(result.current).toMatchObject({ show: false, entering: false });
  act(() => vi.advanceTimersByTime(1000));
  expect(result.current.show).toBe(false);
});

it("reveals at 300 ms from navigation, not from mount, and holds 500 ms once shown", () => {
  const { result, rerender } = start("loading", 200);
  act(() => vi.advanceTimersByTime(99));
  expect(result.current.revealed).toBe(false);
  act(() => vi.advanceTimersByTime(1));
  expect(result.current.revealed).toBe(true);
  act(() => vi.advanceTimersByTime(100));
  rerender({ mode: "off" });
  expect(result.current).toMatchObject({ show: true, revealed: true });
  act(() => vi.advanceTimersByTime(399));
  expect(result.current.show).toBe(true);
  act(() => vi.advanceTimersByTime(1));
  expect(result.current).toMatchObject({ show: false, entering: true });
  act(() => vi.advanceTimersByTime(400));
  expect(result.current.entering).toBe(false);
});

it("shows at once when the bundle arrives after 300 ms and says slow after 8 s", () => {
  const { result } = start("loading", 900);
  expect(result.current.revealed).toBe(true);
  act(() => vi.advanceTimersByTime(7099));
  expect(result.current.slow).toBe(false);
  act(() => vi.advanceTimersByTime(1));
  expect(result.current.slow).toBe(true);
});

it("fails in place, and a retry stays visible with its own slow timer", () => {
  const { result, rerender } = start("loading", 50);
  rerender({ mode: "failed" });
  expect(result.current).toMatchObject({
    show: true,
    revealed: true,
    slow: false,
  });
  act(() => vi.advanceTimersByTime(20000));
  expect(result.current.slow).toBe(false);
  rerender({ mode: "loading" });
  expect(result.current.revealed).toBe(true);
  act(() => vi.advanceTimersByTime(7999));
  expect(result.current.slow).toBe(false);
  act(() => vi.advanceTimersByTime(1));
  expect(result.current.slow).toBe(true);
});

it("times a later load from its own start", () => {
  const { result, rerender } = start("loading", 0);
  rerender({ mode: "off" });
  act(() => vi.advanceTimersByTime(5000));
  rerender({ mode: "loading" });
  expect(result.current.revealed).toBe(false);
  act(() => vi.advanceTimersByTime(300));
  expect(result.current.revealed).toBe(true);
});

it("never renders the destination inside the minimum time, not even for one commit", () => {
  vi.useFakeTimers({
    now: 0,
    toFake: ["setTimeout", "clearTimeout", "performance"],
  });
  const renders: boolean[] = [];
  const { rerender } = renderHook(
    ({ mode }) => {
      const landing = useLanding(mode);
      renders.push(landing.show);
      return landing;
    },
    { initialProps: { mode: "loading" as LandingMode }, wrapper: StrictMode },
  );
  act(() => vi.advanceTimersByTime(350));
  renders.length = 0;
  rerender({ mode: "off" });
  act(() => vi.advanceTimersByTime(440));
  expect(renders.length).toBeGreaterThan(0);
  expect(renders.every(Boolean)).toBe(true);
  act(() => vi.advanceTimersByTime(20));
  expect(renders.at(-1)).toBe(false);
});
