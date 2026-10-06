import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkspaceManagement } from "./WorkspaceManagement";

const workspace = {
  workspace_id: "ws_abcdefgh",
  observation_token: "obs_abcdefgh",
  name: "ordinary",
  kind: "directory",
  visibility: "visible",
  mutation_state: "allowed",
  presence: "present",
  facts: [],
};
afterEach(() => vi.unstubAllGlobals());
it("creates a directory and opens the reported workspace", async () => {
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      schema_version: 1,
      workspace_id: workspace.workspace_id,
      state: "created",
    }),
  });
  vi.stubGlobal("fetch", fetch);
  const created = vi.fn();
  render(
    <WorkspaceManagement
      csrf="csrf"
      userObservationToken="obs_source123"
      refresh={vi.fn()}
      onCreated={created}
    />,
  );
  fireEvent.change(screen.getByLabelText("Hakemiston nimi"), {
    target: { value: "ordinary" },
  });
  fireEvent.click(screen.getByText("Luo työtila"));
  await waitFor(() =>
    expect(created).toHaveBeenCalledWith(workspace.workspace_id),
  );
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
    action: "create",
    user_observation_token: "obs_source123",
    name: "ordinary",
    git: false,
  });
});
it("offers hide without exposing deletion", async () => {
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      schema_version: 1,
      workspace_id: workspace.workspace_id,
      state: "updated",
    }),
  });
  vi.stubGlobal("fetch", fetch);
  const hidden = vi.fn();
  render(
    <WorkspaceManagement
      workspace={workspace}
      csrf="csrf"
      refresh={vi.fn()}
      onHidden={hidden}
    />,
  );
  expect(screen.queryByRole("button", { name: /poista/i })).toBeNull();
  fireEvent.click(screen.getByText("Piilota työtila"));
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  await waitFor(() => expect(hidden).toHaveBeenCalledOnce());
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
    action: "visibility",
    workspace_id: workspace.workspace_id,
    observation_token: workspace.observation_token,
    hidden: true,
  });
});
