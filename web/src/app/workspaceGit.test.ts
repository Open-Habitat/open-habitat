import { afterEach, expect, it, vi } from "vitest";
import {
  fetchFailureReason,
  fetchWorkspaceGit,
  workspaceGit,
} from "./workspaceGit";

const id = "ws_example123";
const reply = {
  schema_version: 1,
  workspace_id: id,
  branch: "main",
  dirty_count: 0,
  files: [],
  files_truncated: false,
  commits: [],
  commits_available: false,
};
afterEach(() => vi.unstubAllGlobals());
it("rejects a different workspace and unknown fields before native facts reach the view", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ...reply, workspace_id: "ws_other123" })),
      ),
  );
  await expect(workspaceGit(id, new AbortController().signal)).rejects.toThrow(
    "Git-tilaa ei voitu vahvistaa",
  );
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ...reply, token: "untrusted" })),
      ),
  );
  await expect(workspaceGit(id, new AbortController().signal)).rejects.toThrow(
    "Git-tilaa ei voitu vahvistaa",
  );
});
it("caps streamed bodies even without Content-Length", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1));
    },
    cancel() {
      cancelled = true;
    },
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
  await expect(workspaceGit(id, new AbortController().signal)).rejects.toThrow(
    "lukurajan",
  );
  expect(cancelled).toBe(true);
});
it("reads the fetch reply as the new state and says plainly why a fetch failed", async () => {
  const base = {
    name: "main",
    ref: "origin/main",
    source: "origin_head",
    ahead: 0,
    behind: 1,
    merged: true,
  };
  const write = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ ...reply, base })));
  vi.stubGlobal("fetch", write);
  const value = await fetchWorkspaceGit(id, "csrf-token");
  expect(value.base?.merged).toBe(true);
  const [url, init] = write.mock.calls[0];
  expect(url).toBe("/api/v1/workspaces/git/fetch");
  expect(init.method).toBe("POST");
  expect(init.headers["X-Agent-Host-CSRF"]).toBe("csrf-token");
  expect(JSON.parse(init.body)).toEqual({ workspace_id: id });
  // An SSH remote fails in the daemon's environment without an agent: the
  // person reads that, not Git's text and not a generic error.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          schema_version: 1,
          error: {
            code: "remote_ssh_unavailable",
            message: "Request could not be completed",
            retryable: false,
            correlation_id: "req_00000000",
          },
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    ),
  );
  const failure = await fetchWorkspaceGit(id, "csrf-token").catch((e) => e);
  expect(fetchFailureReason(failure)).toMatch(/SSH/);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
  const lost = await fetchWorkspaceGit(id, "csrf-token").catch((e) => e);
  expect(fetchFailureReason(lost)).toMatch(/epävarmaksi/);
});
