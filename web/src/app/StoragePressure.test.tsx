import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { StoragePressureProvider, useStorageStatus } from "./StoragePressure";

// The bell's storage item, its facts as attributes and its recheck a button.
function StorageProbe() {
  const item = useStorageStatus();
  if (!item) return null;
  return (
    <button
      type="button"
      data-testid="quota-state"
      data-full={item.data?.full}
      data-critical={item.data?.critical}
      data-tone={item.tone}
      data-unavailable={item.data?.unavailable}
      onClick={() =>
        item.actions.find((a) => a.testId === "quota-recheck")?.onPress?.()
      }
    />
  );
}

const response = (usage: number) =>
  new Response(
    JSON.stringify({
      schema_version: 1,
      usage_bytes: usage,
      limit_bytes: 100 * 1024 ** 2,
    }),
  );
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("retains a full observation on read failure but discards it on identity change", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(response(100 * 1024 ** 2));
  const view = (identity: string) => (
    <MemoryRouter>
      <StoragePressureProvider key={identity} enabled>
        <StorageProbe />
      </StoragePressureProvider>
    </MemoryRouter>
  );
  const { rerender } = render(view("alice"));
  expect(
    (await screen.findByTestId("quota-state")).getAttribute("data-full"),
  ).toBe("true");
  fetch.mockRejectedValue(new Error("offline"));
  fireEvent.click(screen.getByTestId("quota-state"));
  await waitFor(() =>
    expect(
      screen.getByTestId("quota-state").getAttribute("data-unavailable"),
    ).toBe("true"),
  );
  expect(screen.getByTestId("quota-state").getAttribute("data-full")).toBe(
    "true",
  );
  rerender(view("bob"));
  expect(screen.queryByTestId("quota-state")).toBeNull();
  expect(
    fetch.mock.calls.every(
      ([_, options]) => !options?.method || options.method === "GET",
    ),
  ).toBe(true);
});

it.each([
  [84, null],
  [85, "warning"],
  [94, "warning"],
  [95, "danger"],
  [100, "danger"],
])("at %i percent the storage item is %s", async (percent, tone) => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    response(percent * 1024 ** 2),
  );
  render(
    <MemoryRouter>
      <StoragePressureProvider enabled>
        <StorageProbe />
        <span data-testid="read" />
      </StoragePressureProvider>
    </MemoryRouter>,
  );
  if (tone === null) {
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByTestId("quota-state")).toBeNull();
    return;
  }
  const item = await screen.findByTestId("quota-state");
  expect(item.getAttribute("data-tone")).toBe(tone);
  expect(item.getAttribute("data-critical")).toBe(String(percent === 95));
});

it("polls only after the previous read finishes, then warns at 90 percent", async () => {
  vi.useFakeTimers();
  let resolve!: (r: Response) => void;
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValue(response(90 * 1024 ** 2));
  render(
    <MemoryRouter>
      <StoragePressureProvider enabled>
        <StorageProbe />
      </StoragePressureProvider>
    </MemoryRouter>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve(response(50 * 1024 ** 2));
  });
  expect(screen.queryByTestId("quota-state")).toBeNull();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId("quota-state").getAttribute("data-full")).toBe(
    "false",
  );
});
