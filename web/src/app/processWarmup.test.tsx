import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BRIDGE_WARMUP_MS, useBridgeExpected } from "./processWarmup";

afterEach(() => {
  vi.useRealTimers();
});
const unavailable = () => ({ availability: "unavailable" });

describe("a process bridge after Pi starts", () => {
  it("is expected while Pi starts and until an inventory after the start answers", () => {
    const before = unavailable();
    const { result, rerender } = renderHook(
      ({ notRunning, inventory }) => useBridgeExpected(notRunning, inventory),
      { initialProps: { notRunning: true, inventory: before as object } },
    );
    expect(result.current).toBe(true);
    rerender({ notRunning: false, inventory: before });
    expect(result.current).toBe(true);
    rerender({ notRunning: false, inventory: unavailable() });
    expect(result.current).toBe(true);
    rerender({ notRunning: false, inventory: { availability: "available" } });
    expect(result.current).toBe(false);
  });
  it("does not trust an available inventory read before the start", () => {
    const old = { availability: "available" };
    const { result, rerender } = renderHook(
      ({ notRunning, inventory }) => useBridgeExpected(notRunning, inventory),
      { initialProps: { notRunning: true, inventory: old } },
    );
    rerender({ notRunning: false, inventory: old });
    expect(result.current).toBe(true);
  });
  it("reports a bridge still missing after the warm-up, however often it is polled", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ notRunning, inventory }) => useBridgeExpected(notRunning, inventory),
      { initialProps: { notRunning: true, inventory: unavailable() } },
    );
    rerender({ notRunning: false, inventory: unavailable() });
    for (let t = 0; t < BRIDGE_WARMUP_MS; t += 2000) {
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      rerender({ notRunning: false, inventory: unavailable() });
    }
    expect(result.current).toBe(false);
  });
  it("is not expected for a conversation opened with Pi already running", () => {
    const { result } = renderHook(() =>
      useBridgeExpected(false, unavailable()),
    );
    expect(result.current).toBe(false);
  });
});
