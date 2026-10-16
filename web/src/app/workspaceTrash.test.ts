import { afterEach, expect, it, vi } from "vitest";
import check from "../../../contracts/v1/examples/workspace-deletion-check.json";
import trash from "../../../contracts/v1/examples/workspace-trash.json";
import {
  checkWorkspaceDeletion,
  deleteTrashEntry,
  deleteWorkspace,
  listTrash,
  restoreTrashEntry,
  WorkspaceTrashError,
} from "./workspaceTrash";

const workspace = {
  workspace_id: "ws_example123",
  observation_token: "obs_example123",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
afterEach(() => vi.unstubAllGlobals());

it("sends IDs and entry names only, with CSRF, and accepts contract replies", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(json(check))
    .mockResolvedValueOnce(json(trash))
    .mockResolvedValueOnce(
      json({ schema_version: 1, state: "deleted", entry: "example.2" }),
    );
  vi.stubGlobal("fetch", fetch);
  const result = await checkWorkspaceDeletion(workspace, "csrf-token");
  expect(result.outcome).toBe("blocked");
  expect(result.blockers.map((b) => b.kind)).toContain("taskfleet_run");
  expect((await listTrash("csrf-token")).entries[1].restore).toBe("name_taken");
  await deleteTrashEntry("example.2", "example", "csrf-token");
  const [url, init] = fetch.mock.calls[0];
  expect(url).toBe("/api/v1/workspaces");
  expect(init.method).toBe("POST");
  expect(init.headers["X-Agent-Host-CSRF"]).toBe("csrf-token");
  expect(JSON.parse(init.body)).toEqual({
    action: "delete_check",
    ...workspace,
  });
  expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({
    action: "trash_delete",
    entry: "example.2",
    confirmation: "example",
  });
});

it("rejects replies outside the contract or for another target", async () => {
  for (const reply of [
    { ...check, workspace_id: "ws_other12345" },
    { ...check, outcome: "gone" },
    { ...check, facts: { ...check.facts, path: "/home/x" } },
    {
      ...check,
      blockers: [{ kind: "process", pid: 1, path: "relative/path" }],
    },
  ]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(reply)));
    await expect(
      checkWorkspaceDeletion(workspace, "csrf-token"),
    ).rejects.toMatchObject({ code: "invalid_reply" });
  }
  // A check reply is not a delete result, and a trash entry reply must be
  // for the entry asked about.
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        json({ schema_version: 1, state: "deleted", entry: "other" }),
      ),
  );
  await expect(
    deleteTrashEntry("example", "example", "csrf-token"),
  ).rejects.toMatchObject({ code: "invalid_reply" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(check)));
  await expect(listTrash("csrf-token")).rejects.toMatchObject({
    code: "invalid_reply",
  });
});

it("exposes only known refusal codes, never the host's text", async () => {
  const refusal = (code: string, status = 409) =>
    json(
      {
        schema_version: 1,
        error: {
          code,
          message: "<b>host text</b>",
          retryable: false,
          correlation_id: "req_00000000",
        },
      },
      status,
    );
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(refusal("workspace_not_clean")),
  );
  const error = await deleteWorkspace(workspace, "permanent", "csrf").catch(
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(WorkspaceTrashError);
  expect(error).toMatchObject({ code: "workspace_not_clean" });
  expect((error as Error).message).not.toContain("host text");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(refusal("something_new")));
  await expect(restoreTrashEntry("example", "csrf")).rejects.toMatchObject({
    code: "unavailable",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(refusal("workspace_exists", 400)),
  );
  await expect(restoreTrashEntry("example", "csrf")).rejects.toMatchObject({
    code: "unavailable",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("", { status: 401 })),
  );
  await expect(listTrash("csrf")).rejects.toMatchObject({
    code: "identity_lost",
  });
});

it("caps streamed bodies even without Content-Length", async () => {
  const chunk = new Uint8Array(256 * 1024).fill(32);
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent++ > 8) controller.close();
      else controller.enqueue(chunk);
    },
  });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(body, { headers: { "Content-Type": "application/json" } }),
      ),
  );
  await expect(listTrash("csrf")).rejects.toMatchObject({
    code: "invalid_reply",
  });
});
