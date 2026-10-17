import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PersonalStorage } from "./PersonalStorage";

afterEach(() => vi.restoreAllMocks());

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
  expect((await screen.findByRole("img")).getAttribute("aria-label")).toBe(
    "Käytössä 1 GiB / 8 GiB",
  );
  expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/account/storage");
});
