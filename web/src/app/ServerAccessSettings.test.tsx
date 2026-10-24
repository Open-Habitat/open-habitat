import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ServerAccessSettings } from "./ServerAccessSettings";
import type { AccessEntry } from "./serverAccess";

afterEach(() => vi.restoreAllMocks());

const bob: AccessEntry = {
  id: "43",
  source: "site_admin",
  state: "joined",
  username: "bob",
  login_hint: "bob",
  administrator: false,
  denied: false,
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const list = (entries: AccessEntry[]) =>
  json({
    schema_version: 1,
    mode: "allowlist",
    runtime_admission: true,
    entries,
  });

it("keeps a change whose reply was lost uncertain until the list is read again, and never resends it", async () => {
  const writes: string[] = [];
  let withdrawn = false;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method === "POST") {
      writes.push(url);
      withdrawn = true;
      return json(
        {
          schema_version: 1,
          error: { code: "outcome_uncertain", message: "x", retryable: false },
        },
        503,
      );
    }
    return list([
      withdrawn ? { ...bob, state: "withdrawn", denied: true } : bob,
    ]);
  });
  render(<ServerAccessSettings csrf="csrf" />);
  fireEvent.click(await screen.findByTestId("access-remove-43"));
  fireEvent.click(screen.getByTestId("access-remove-confirm"));
  const row = () => screen.getByTestId("access-row-43");
  await waitFor(() => expect(row().dataset.pending).toBe("uncertain"));
  expect(row().dataset.state).toBe("joined");
  fireEvent.click(screen.getByTestId("access-refresh-43"));
  await waitFor(() => expect(row().dataset.state).toBe("withdrawn"));
  expect(row().dataset.pending).toBeUndefined();
  expect(writes).toEqual(["/api/v1/server/access/remove"]);
});

it("settles a confirmed restore from the reply and shows a refusal on the row", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/add")) return json({ schema_version: 1, entry: bob });
    if (url.endsWith("/remove"))
      return json(
        {
          schema_version: 1,
          error: { code: "operator_owned", message: "x", retryable: false },
        },
        409,
      );
    expect(init?.method ?? "GET").toBe("GET");
    return list([{ ...bob, state: "withdrawn", denied: true }]);
  });
  render(<ServerAccessSettings csrf="csrf" />);
  fireEvent.click(await screen.findByTestId("access-restore-43"));
  const row = () => screen.getByTestId("access-row-43");
  await waitFor(() => expect(row().dataset.state).toBe("joined"));
  expect(row().dataset.pending).toBeUndefined();
  fireEvent.click(screen.getByTestId("access-remove-43"));
  fireEvent.click(screen.getByTestId("access-remove-confirm"));
  await waitFor(() => expect(row().querySelector("[role=alert]")).toBeTruthy());
  expect(row().dataset.state).toBe("joined");
});
