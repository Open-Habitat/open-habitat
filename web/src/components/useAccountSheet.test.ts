import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAccountSheet } from "./useAccountSheet";

afterEach(() => vi.restoreAllMocks());

describe("phone account history", () => {
  it("waits for dismissal before routing, and ignores a repeated close while Back is pending", () => {
    const push = vi
      .spyOn(window.history, "pushState")
      .mockImplementation(() => {});
    const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
    const navigate = vi.fn();
    const { result } = renderHook(() => useAccountSheet(true));
    act(() => result.current.open());
    expect(push).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.act(navigate);
      result.current.back();
    });
    expect(go).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    act(() =>
      window.dispatchEvent(new PopStateEvent("popstate", { state: null })),
    );
    expect(result.current.menuOpen).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
    act(() =>
      window.dispatchEvent(new PopStateEvent("popstate", { state: null })),
    );
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("native Back closes feedback first without traversing history again", () => {
    const push = vi
      .spyOn(window.history, "pushState")
      .mockImplementation(() => {});
    const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
    const { result } = renderHook(() => useAccountSheet(true));
    act(() => result.current.open());
    const menuEntry = push.mock.calls[0][0];
    act(() => result.current.open());
    expect(result.current.feedbackOpen).toBe(true);
    act(() =>
      window.dispatchEvent(new PopStateEvent("popstate", { state: menuEntry })),
    );
    expect(result.current.menuOpen).toBe(true);
    expect(result.current.feedbackOpen).toBe(false);
    expect(go).not.toHaveBeenCalled();
  });
});
