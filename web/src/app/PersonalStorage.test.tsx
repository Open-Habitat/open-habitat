import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import trash from "../../../contracts/v1/examples/workspace-trash.json";
import { PersonalStorage } from "./PersonalStorage";
import * as trashAPI from "./workspaceTrash";

vi.mock("./WorktreeCleanup", () => ({ WorktreeCleanup: () => null }));

afterEach(() => vi.restoreAllMocks());

it("closes stale confirmation and waits for a fresh listing before another delete", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({ schema_version: 1, usage_bytes: 0, limit_bytes: 100 }),
      { status: 200 },
    ),
  );
  const listing = {
    ...trash,
    entries: [trash.entries[0]],
  } as trashAPI.TrashList;
  let resolveListing!: (value: trashAPI.TrashList) => void;
  vi.spyOn(trashAPI, "listTrash")
    .mockResolvedValueOnce(listing)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveListing = resolve;
        }),
    )
    .mockResolvedValue({ ...listing, entries: [] });
  vi.spyOn(trashAPI, "inspectTrashEntry").mockRejectedValue(
    new Error("unavailable"),
  );
  const remove = vi
    .spyOn(trashAPI, "deleteTrashEntry")
    .mockRejectedValueOnce(new trashAPI.WorkspaceTrashError("trash_changed"))
    .mockResolvedValue({
      schema_version: 1,
      state: "deleted",
      entry: listing.entries[0].entry,
    });
  render(<PersonalStorage csrf="csrf-token" />);
  fireEvent.click(await screen.findByTestId("purge-trash"));
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByTestId("purge-workspace"));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByTestId("purge-trash").hasAttribute("disabled")).toBe(true);
  expect(screen.getByTestId("open-empty-trash").hasAttribute("disabled")).toBe(
    true,
  );
  resolveListing({ ...listing, listing_token: "b".repeat(64) });
  await waitFor(() =>
    expect(screen.getByTestId("purge-trash").hasAttribute("disabled")).toBe(
      false,
    ),
  );
  fireEvent.click(screen.getByTestId("purge-trash"));
  fireEvent.click(screen.getByTestId("purge-workspace"));
  await waitFor(() => expect(remove).toHaveBeenCalledTimes(2));
  expect(remove.mock.calls.map((call) => call[1])).toEqual([
    listing.listing_token,
    "b".repeat(64),
  ]);
});

it("shows only the signed-in person's quota", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        schema_version: 1,
        usage_bytes: 2 ** 30,
        limit_bytes: 8 * 2 ** 30,
      }),
      { status: 200 },
    ),
  );
  render(<PersonalStorage />);
  expect((await screen.findByRole("img")).firstElementChild).toHaveProperty(
    ["style", "width"],
    "12.5%",
  );
  expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/account/storage");
});

it("says when the installation has no per-user limits", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        schema_version: 1,
        limits: "not_in_use",
        filesystem: { capacity_bytes: 64 * 2 ** 30, free_bytes: 16 * 2 ** 30 },
      }),
      { status: 200 },
    ),
  );
  render(<PersonalStorage />);
  const shared = await screen.findByTestId("storage-limits-not-in-use");
  expect(shared.textContent).toContain("ei ole käyttäjäkohtaisia");
  expect(screen.queryByRole("img")).toBeNull();
});
