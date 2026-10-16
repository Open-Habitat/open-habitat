import { afterEach, expect, it, vi } from "vitest";
import { workspaceGit } from "./workspaceGit";

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
