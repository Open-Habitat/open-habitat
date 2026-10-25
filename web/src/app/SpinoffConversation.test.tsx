import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { SpinoffProvider } from "./SpinoffConversation";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("waits for the native session instead of polling a missing parent", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockResolvedValue({ status: 404, ok: false });
  vi.stubGlobal("fetch", fetch);
  const parent = "pi:12345678-1234-4123-8123-123456789abc";
  const view = (recheck: string) => (
    <MemoryRouter>
      <SpinoffProvider parent={parent} recheck={recheck}>
        <span />
      </SpinoffProvider>
    </MemoryRouter>
  );
  const { rerender, unmount } = render(view("missing"));
  await act(() => vi.advanceTimersByTimeAsync(30000));
  // Not every 3 s while the daemon has no readable session.
  expect(fetch).toHaveBeenCalledTimes(1);
  rerender(view("present"));
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(fetch).toHaveBeenCalledTimes(2);
  unmount();
});
