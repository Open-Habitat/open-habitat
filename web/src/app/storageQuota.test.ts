import { afterEach, expect, it, vi } from "vitest";
import {
  changeStorage,
  ownStorage,
  storageAdministration,
} from "./storageQuota";

afterEach(() => vi.restoreAllMocks());
it("reads own quota without selecting a subject", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        schema_version: 1,
        usage_bytes: 1024,
        limit_bytes: 2048,
      }),
    ),
  );
  expect(await ownStorage()).toMatchObject({
    usage_bytes: 1024,
    limit_bytes: 2048,
  });
  expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/account/storage");
});
it("validates administrator capacity and writes via CSRF", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          schema_version: 1,
          users: [
            {
              id: "42",
              username: "alice",
              administrator: true,
              usage_bytes: 2048,
              limit_bytes: 1024,
            },
          ],
          filesystem: { capacity_bytes: 1024, free_bytes: 0 },
          overcommitted: true,
        }),
      ),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  expect((await storageAdministration()).overcommitted).toBe(true);
  await changeStorage("csrf", "42", 1024);
  expect(fetchMock.mock.calls[1][1]).toMatchObject({
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Agent-Host-CSRF": "csrf",
    },
    body: '{"subject":"42","limit_bytes":1024}',
  });
});
it("rejects malformed quota response", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        schema_version: 1,
        usage_bytes: "secret",
        limit_bytes: 2048,
      }),
    ),
  );
  await expect(ownStorage()).rejects.toThrow("Invalid storage response");
});
