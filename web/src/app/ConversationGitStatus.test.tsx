import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { fetchedNews, useGitStatus } from "./ConversationGitStatus";
import type { Workspace } from "./snapshot";
import type { WorkspaceGit } from "./workspaceGit";

const reply: WorkspaceGit = {
  schema_version: 1,
  workspace_id: "ws_example123",
  branch: "main",
  dirty_count: 0,
  files: [],
  files_truncated: false,
  commits: [],
  commits_available: true,
};
let finishFetch: (value: WorkspaceGit) => void = () => {};
vi.mock("./workspaceGit", async (actual) => ({
  ...(await actual<typeof import("./workspaceGit")>()),
  workspaceGit: vi.fn(async () => reply),
  fetchWorkspaceGit: vi.fn(
    () =>
      new Promise<WorkspaceGit>((resolve) => {
        finishFetch = resolve;
      }),
  ),
}));
const workspace = {
  workspace_id: "ws_example123",
  name: "aurinkokello",
  kind: "git_main_worktree",
  git_summary: { branch: "main", dirty_count: 0 },
} as Workspace;

it("a reading during Päivitä tila does not leave the fetch busy for good", async () => {
  const { result } = renderHook(() => useGitStatus(workspace, "csrf"));
  act(() => result.current.setOpen(true));
  act(() => result.current.details.onFetch());
  expect(result.current.details.fetching).toBe(true);
  // Closing and reopening reads again while the fetch runs.
  act(() => result.current.setOpen(false));
  act(() => result.current.setOpen(true));
  await act(async () => finishFetch({ ...reply, behind: 0 }));
  await waitFor(() => expect(result.current.details.fetching).toBe(false));
  expect(result.current.details.fetchMessage).toBe(
    "Etätiedot haettu. Vertailutietoja ei ole saatavilla.",
  );
});

it("reports known incoming totals, including zero, without claiming unknown comparisons are empty", () => {
  expect(fetchedNews({ ...reply, upstream: "origin/main", behind: 8 })).toBe(
    "Etätiedot haettu. origin/main: 8 tulossa.",
  );
  expect(fetchedNews({ ...reply, upstream: "origin/main", behind: 0 })).toBe(
    "Etätiedot haettu. origin/main: 0 tulossa.",
  );
  expect(fetchedNews({ ...reply, upstream: "origin/main" })).toBe(
    "Etätiedot haettu. Vertailutietoja ei ole saatavilla.",
  );
});
