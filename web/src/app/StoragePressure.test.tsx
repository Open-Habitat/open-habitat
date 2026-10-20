import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import {
  StoragePressureNotice,
  StoragePressureProvider,
} from "./StoragePressure";

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
        <StoragePressureNotice />
      </StoragePressureProvider>
    </MemoryRouter>
  );
  const { rerender } = render(view("alice"));
  await screen.findByText(/Tallennustilasi on täynnä/);
  fetch.mockRejectedValue(new Error("offline"));
  fireEvent.click(
    screen.getByRole("button", { name: "Tarkista vapautettu tila" }),
  );
  await screen.findByText(/tämä on viimeisin tieto/);
  expect(screen.getByText(/Tallennustilasi on täynnä/)).toBeTruthy();
  rerender(view("bob"));
  expect(screen.queryByText(/Tallennustilasi on täynnä/)).toBeNull();
  expect(
    fetch.mock.calls.every(
      ([_, options]) => !options?.method || options.method === "GET",
    ),
  ).toBe(true);
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
        <StoragePressureNotice />
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
  expect(screen.queryByText(/Tallennustilasi on lähes täynnä/)).toBeNull();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(screen.getByText(/Tallennustilasi on lähes täynnä/)).toBeTruthy();
});
