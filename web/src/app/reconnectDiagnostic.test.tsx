import { afterEach, expect, it, vi } from "vitest";
import { reconnectFetch } from "./reconnectDiagnostic";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("reports status and timing without request queries or response content", async () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  const response = new Response("private-body-marker", { status: 409 });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  expect(
    await reconnectFetch(
      "/api/v1/events",
      "/api/v1/events?after=private-cursor",
      {},
    ),
  ).toBe(response);
  const entry = JSON.parse(log.mock.calls[1][1]);
  expect(entry).toMatchObject({
    event: "request",
    path: "/api/v1/events",
    outcome: "response",
    status: 409,
    durationMs: expect.any(Number),
    at: expect.any(String),
  });
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/private/);
  expect(await response.text()).toBe("private-body-marker");
});

it("classifies a failed or cancelled request without logging exception text", async () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private-error")));
  await expect(
    reconnectFetch("/api/v1/snapshot", "/api/v1/snapshot", {}),
  ).rejects.toThrow();
  const controller = new AbortController();
  controller.abort();
  await expect(
    reconnectFetch("/api/v1/snapshot", "/api/v1/snapshot", {
      signal: controller.signal,
    }),
  ).rejects.toThrow();
  expect(log.mock.calls.map((call) => JSON.parse(call[1]).outcome)).toEqual([
    "started",
    "network-error",
    "started",
    "aborted",
  ]);
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/private/);
});
