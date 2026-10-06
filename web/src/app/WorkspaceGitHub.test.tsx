import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkspaceGitHub } from "./WorkspaceGitHub";

const workspace = {
  workspace_id: "ws_abcdefgh",
  observation_token: "obs_abcdefgh",
  name: "local",
  kind: "git_main_worktree",
  visibility: "visible",
  mutation_state: "allowed",
  presence: "present",
  facts: [],
} as import("./snapshot").Workspace;
afterEach(() => vi.unstubAllGlobals());
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
  fireEvent.change(screen.getByLabelText("Omistaja"), {
    target: { value: "owner" },
  });
  fireEvent.change(screen.getByLabelText("Repo"), {
    target: { value: "repo" },
  });
  fireEvent.click(screen.getByText("Tarkista GitHub ja Git"));
  await waitFor(() => expect(screen.getByText("Suorita create")).toBeTruthy());
  fireEvent.change(screen.getByLabelText("Vahvista owner/repository"), {
    target: { value: "owner/Repo" },
  });
  expect(
    (screen.getByText("Suorita create") as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText("Vahvista owner/repository"), {
    target: { value: "owner/repo" },
  });
  fireEvent.click(screen.getByText("Suorita create"));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(JSON.parse(fetch.mock.calls[1][1].body).action).toBe("create");
  expect(screen.queryByText("Suorita origin")).toBeNull();
  fireEvent.click(screen.getByText("Tarkista GitHub ja Git"));
  await waitFor(() => expect(screen.getByText("Suorita origin")).toBeTruthy());
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
  fireEvent.change(screen.getByLabelText("Omistaja"), {
    target: { value: "owner" },
  });
  fireEvent.change(screen.getByLabelText("Repo"), {
    target: { value: "repo" },
  });
  fireEvent.click(screen.getByText("Tarkista GitHub ja Git"));
  await waitFor(() => expect(screen.getByText("Suorita create")).toBeTruthy());
  fireEvent.change(screen.getByLabelText("Vahvista owner/repository"), {
    target: { value: "owner/repo" },
  });
  fireEvent.click(screen.getByText("Suorita create"));
  await waitFor(() =>
    expect(screen.getByText(/Vaiheen tulos on epävarma/)).toBeTruthy(),
  );
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(screen.queryByText("Suorita create")).toBeNull();
});
