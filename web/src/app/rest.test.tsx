import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRest } from "./rest";

const id = "pi:11111111-1111-4111-8111-111111111111";
const quiet = {
  schema_version: 1,
  agent_id: id,
  availability: "available",
  report: {
    stopped: { cause: "idle", at: "2026-10-28T06:10:00Z" },
    interrupted_turn: false,
    processes: [],
    runs: [],
    still_running: [],
  },
};
const reply = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

afterEach(() => vi.unstubAllGlobals());

describe("useRest", () => {
  it("hides a quiet rest, and shows the card once a later read fails", async () => {
    const fetch = vi.fn(async () => reply(quiet));
    vi.stubGlobal("fetch", fetch);
    const rest = { cause: "idle" as const, at: "2026-10-28T06:10:00Z" };
    const { result, rerender } = renderHook(
      ({ working }) =>
        useRest({ id, workspaceId: "w", rest, spinoffsWorking: working }),
      { initialProps: { working: 1 } },
    );
    await waitFor(() => expect(result.current.report).toBeDefined());
    expect(result.current.shown).toBe(false);
    // A run settling is news for the card; an unread report proves nothing.
    fetch.mockImplementation(async () => new Response("", { status: 503 }));
    rerender({ working: 0 });
    await waitFor(() => expect(result.current.shown).toBe(true));
    expect(result.current.failed).toBe(true);
    fetch.mockImplementation(async () => reply(quiet));
    rerender({ working: 1 });
    await waitFor(() => expect(result.current.shown).toBe(false));
  });
});
