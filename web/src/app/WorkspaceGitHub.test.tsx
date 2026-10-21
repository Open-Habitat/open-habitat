import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import * as github from "./github";
import { WorkspaceGitHub } from "./WorkspaceGitHub";

const workspace = {
  workspace_id: "ws_abcdefgh",
  observation_token: "obs_abcdefgh",
  name: "local",
  kind: "git_main_worktree",
  git_remote: "none" as const,
  visibility: "visible",
  mutation_state: "allowed",
  presence: "present",
  facts: [],
} as import("./snapshot").Workspace;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("requires exact confirmation, observes again between separate create and origin mutations", async () => {
  let stage = "create";
  const fetch = vi
    .fn()
    .mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        stage = "origin";
        return {
          ok: true,
          json: async () => ({
            schema_version: 1,
            stage: "create",
            state: "confirmed",
            full_name: "owner/repo",
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          schema_version: 1,
          full_name: "owner/repo",
          workspace_id: workspace.workspace_id,
          visibility: "private",
          stage,
          observation_token: "fresh_token123",
        }),
      };
    });
  vi.stubGlobal("fetch", fetch);
  render(
    <WorkspaceGitHub csrf="csrf" workspace={workspace} refresh={vi.fn()} />,
  );
  fireEvent.change(
    within(screen.getByTestId("publish-owner")).getByRole("textbox"),
    {
      target: { value: "owner" },
    },
  );
  fireEvent.change(
    within(screen.getByTestId("publish-repository")).getByRole("textbox"),
    {
      target: { value: "repo" },
    },
  );
  fireEvent.click(screen.getByTestId("publish-inspect"));
  await waitFor(() =>
    expect(screen.getByTestId("publish-commit")).toBeTruthy(),
  );
  fireEvent.change(
    within(screen.getByTestId("publish-confirmation")).getByRole("textbox"),
    {
      target: { value: "owner/Repo" },
    },
  );
  expect(
    (screen.getByTestId("publish-commit") as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.change(
    within(screen.getByTestId("publish-confirmation")).getByRole("textbox"),
    {
      target: { value: "owner/repo" },
    },
  );
  fireEvent.click(screen.getByTestId("publish-commit"));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(JSON.parse(fetch.mock.calls[1][1].body).action).toBe("create");
  expect(screen.queryByTestId("publish-commit")).toBeNull();
  fireEvent.click(screen.getByTestId("publish-inspect"));
  await waitFor(() =>
    expect(
      screen.getByTestId("publish-commit").getAttribute("data-stage"),
    ).toBe("origin"),
  );
});
it("hides publication for a checkout with an observed GitHub origin or uncertain remote", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const { rerender } = render(
    <WorkspaceGitHub
      csrf="csrf"
      workspace={{ ...workspace, git_remote: "github" }}
      refresh={vi.fn()}
    />,
  );
  expect(screen.queryByTestId("publish-heading")).toBeNull();
  rerender(
    <WorkspaceGitHub
      csrf="csrf"
      workspace={{ ...workspace, git_remote: "unknown" }}
      refresh={vi.fn()}
    />,
  );
  expect(screen.queryByTestId("publish-heading")).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});
it("offers a distinct continuation check for an origin without tracking refs", () => {
  render(
    <WorkspaceGitHub
      csrf="csrf"
      workspace={{
        ...workspace,
        git_remote: "github",
        publish_continuation: true,
      }}
      refresh={vi.fn()}
    />,
  );
  expect(
    screen.getByTestId("publish-heading").getAttribute("data-continuation"),
  ).toBe("true");
  expect(screen.getByTestId("publish-inspect")).toBeTruthy();
});
it("shows native clone progress and confirms via a fresh checkout observation", async () => {
  vi.spyOn(github, "catalog").mockResolvedValue({
    schema_version: 1,
    complete: true,
    repositories: [
      {
        full_name: "owner/repo",
        private: true,
        description: "",
        html_url: "https://github.com/owner/repo",
        pushed_at: null,
        size_kib: 12,
        default_branch: "main",
        owner_type: "User",
      },
    ],
  });
  vi.spyOn(github, "observe")
    .mockResolvedValueOnce({
      schema_version: 1,
      full_name: "owner/repo",
      state: "absent",
    })
    .mockResolvedValueOnce({
      schema_version: 1,
      full_name: "owner/repo",
      state: "confirmed",
    });
  vi.spyOn(github, "cloneStream").mockImplementation(
    async (_name, _csrf, onProgress) => {
      onProgress({
        schema_version: 1,
        sequence: 1,
        job_id: "0123456789abcdef0123456789abcdef",
        kind: "progress",
        stage: "receiving",
        percent: 27,
        received_bytes: 4096,
      });
    },
  );
  const refresh = vi.fn();
  render(<WorkspaceGitHub csrf="csrf" refresh={refresh} />);
  fireEvent.click(screen.getByTestId("repository-load"));
  await screen.findByRole("combobox");
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "owner/repo" },
  });
  fireEvent.click(screen.getByTestId("repository-import"));
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(github.observe).toHaveBeenCalledTimes(2);
  expect(refresh).toHaveBeenCalledOnce();
  expect(github.cloneStream).toHaveBeenCalledOnce();
});
it("does not retry an uncertain create automatically", async () => {
  const fetch = vi
    .fn()
    .mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? { ok: false }
        : {
            ok: true,
            json: async () => ({
              schema_version: 1,
              full_name: "owner/repo",
              workspace_id: workspace.workspace_id,
              visibility: "private",
              stage: "create",
              observation_token: "fresh_token123",
            }),
          },
    );
  vi.stubGlobal("fetch", fetch);
  render(
    <WorkspaceGitHub csrf="csrf" workspace={workspace} refresh={vi.fn()} />,
  );
  fireEvent.change(
    within(screen.getByTestId("publish-owner")).getByRole("textbox"),
    {
      target: { value: "owner" },
    },
  );
  fireEvent.change(
    within(screen.getByTestId("publish-repository")).getByRole("textbox"),
    {
      target: { value: "repo" },
    },
  );
  fireEvent.click(screen.getByTestId("publish-inspect"));
  await waitFor(() =>
    expect(screen.getByTestId("publish-commit")).toBeTruthy(),
  );
  fireEvent.change(
    within(screen.getByTestId("publish-confirmation")).getByRole("textbox"),
    {
      target: { value: "owner/repo" },
    },
  );
  fireEvent.click(screen.getByTestId("publish-commit"));
  await waitFor(() =>
    expect(screen.getByTestId("publish-inspect")).toHaveProperty(
      "disabled",
      false,
    ),
  );
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("status")).toBeTruthy();
  expect(screen.queryByTestId("publish-commit")).toBeNull();
});
