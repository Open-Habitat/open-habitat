import { afterEach, expect, it, vi } from "vitest";
import { reconnectDiagnostic, reconnectFetch } from "./reconnectDiagnostic";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

it("reports status and timing without request queries or response content", async () => {
  sessionStorage.setItem("oh:debug-reconnect", "true");
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
  sessionStorage.setItem("oh:debug-reconnect", "true");
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

it("keeps reconnect diagnostics silent unless explicitly enabled", () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  for (const setting of [undefined, "false", "1"]) {
    if (setting === undefined) sessionStorage.removeItem("oh:debug-reconnect");
    else sessionStorage.setItem("oh:debug-reconnect", setting);
    reconnectDiagnostic({ event: "recover" });
  }
  expect(log).not.toHaveBeenCalled();
  sessionStorage.setItem("oh:debug-reconnect", "true");
  reconnectDiagnostic({ event: "recover" });
  expect(log).toHaveBeenCalledOnce();
  expect(JSON.parse(log.mock.calls[0][1])).toMatchObject({ event: "recover" });
});

it("does not let disabled browser storage break recovery", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("storage disabled");
  });
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  expect(() => reconnectDiagnostic({ event: "recover" })).not.toThrow();
  expect(log).not.toHaveBeenCalled();
});
