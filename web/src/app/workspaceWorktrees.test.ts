import { afterEach, expect, it, vi } from "vitest";
import listing from "../../../contracts/v1/examples/workspace-worktrees.json";
import cleaned from "../../../contracts/v1/examples/workspace-worktrees-cleaned.json";
import {
  cleanMergedWorktrees,
  listWorktrees,
  removeWorktree,
  type Worktree,
} from "./workspaceWorktrees";
import { worktreeRefusalText } from "./worktreeText";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
afterEach(() => vi.unstubAllGlobals());
const row = listing.worktrees[1] as Worktree;

it("names a worktree by registry entry and token, and the typed name only when forced", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(json(listing))
    .mockResolvedValueOnce(
      json({
        schema_version: 1,
        state: "removed",
        workspace_id: row.workspace_id,
        entry: row.entry,
        branch: "wt-edit",
        branch_kept: "not_merged",
      }),
    )
    .mockResolvedValueOnce(json(cleaned));
  vi.stubGlobal("fetch", fetch);
  expect((await listWorktrees("csrf", "ws_example123")).worktrees).toHaveLength(
    4,
  );
  await removeWorktree(row, "force", "csrf", "wt-edit");
  await cleanMergedWorktrees(
    { listing_token: listing.listing_token, workspace_id: "ws_example123" },
    "csrf",
  );
  const bodies = fetch.mock.calls.map((c) => JSON.parse(c[1].body));
  expect(bodies).toEqual([
    { action: "worktree_list", workspace_id: "ws_example123" },
    {
      action: "worktree_remove",
      workspace_id: row.workspace_id,
      entry: row.entry,
      observation_token: row.observation_token,
      disposal: "force",
      confirmation: "wt-edit",
    },
    {
      action: "worktree_clean_merged",
      listing_token: listing.listing_token,
      workspace_id: "ws_example123",
    },
  ]);
  expect(fetch.mock.calls[0][1].headers["X-Agent-Host-CSRF"]).toBe("csrf");
  // A non-forced removal never carries a confirmation, even when given one.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      json({
        schema_version: 1,
        state: "pruned",
        workspace_id: row.workspace_id,
        entry: row.entry,
      }),
    ),
  );
  await removeWorktree(row, "prune", "csrf", "x");
  expect(
    JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1]?.body as string),
  ).not.toHaveProperty("confirmation");
});

it("rejects replies outside the contract, for another worktree, and unnamed refusals", async () => {
  for (const reply of [
    { ...listing, workspace_id: "ws_other12345" },
    {
      ...listing,
      worktrees: [{ ...listing.worktrees[0], path: "relative/path" }],
    },
    { ...listing, worktrees: [{ ...listing.worktrees[0], extra: true }] },
  ]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(reply)));
    await expect(listWorktrees("csrf", "ws_example123")).rejects.toMatchObject({
      code: "invalid_reply",
    });
  }
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      json({
        schema_version: 1,
        state: "removed",
        workspace_id: row.workspace_id,
        entry: "other",
      }),
    ),
  );
  await expect(removeWorktree(row, "remove", "csrf")).rejects.toMatchObject({
    code: "invalid_reply",
  });
  for (const [code, want] of [
    ["worktree_changed", "worktree_changed"],
    ["commit_failed", "commit_failed"],
    // A writer still held after the daemon's bounded wait is a refusal
    // that names the holder, not a server that did not answer.
    ["workspace_clone_running", "workspace_clone_running"],
    ["something_else", "unavailable"],
  ]) {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          json({ schema_version: 1, error: { code, message: "x" } }, 409),
        ),
    );
    await expect(removeWorktree(row, "commit", "csrf")).rejects.toMatchObject({
      code: want,
    });
  }
});

it("words a writer holder's refusal by the operation that holds it", () => {
  expect(worktreeRefusalText("workspace_clone_running")).toMatch(
    /GitHub-repositorion tuonti|Importing a GitHub repository/,
  );
  expect(worktreeRefusalText("workspace_clone_running")).not.toBe(
    worktreeRefusalText("unavailable"),
  );
});
