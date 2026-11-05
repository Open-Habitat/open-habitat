import { afterEach, expect, it, vi } from "vitest";
import { LoadDiagnostic } from "./loadDiagnostic";

afterEach(() => vi.unstubAllGlobals());
it("keeps the first failure, counts attempts, sends only on recovery and never retries a lost report", async () => {
  const fetch = vi.fn().mockRejectedValue(new TypeError("network"));
  vi.stubGlobal("fetch", fetch);
  const d = new LoadDiagnostic();
  d.attempt();
  d.failed("session", "network", 0, "stale", 12);
  d.attempt();
  d.failed("snapshot", "http", 503, "stale", 20);
  expect(fetch).not.toHaveBeenCalled();
  d.recovered("csrf");
  d.recovered("csrf");
  await Promise.resolve();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
    read: "session",
    reason: "network",
    attempts: 2,
    read_duration_ms: 12,
    phase: "stale",
  });
  d.failed("snapshot", "http", 503, "landing", 25);
  d.recovered("csrf");
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("drops a login-crossing episode and bounds numbers", () => {
  const fetch = vi.fn().mockResolvedValue(new Response());
  vi.stubGlobal("fetch", fetch);
  const d = new LoadDiagnostic();
  d.failed("snapshot", "invalid", 0, "landing", 1e10);
  d.clear();
  d.recovered("csrf");
  expect(fetch).not.toHaveBeenCalled();
  d.failed("snapshot", "invalid", 0, "landing", 1e10);
  for (let i = 0; i < 10005; i++) d.attempt();
  d.recovered("csrf");
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
    attempts: 10000,
    read_duration_ms: 86400000,
  });
});
