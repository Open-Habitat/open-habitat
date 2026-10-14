import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Workspace } from "../app/snapshot";
import {
  type HomeConversation,
  HomeWorkspaces,
  homeSections,
} from "./HomeWorkspaces";

const workspace = (id: string): Workspace => ({
  workspace_id: id,
  name: id,
  path: `/home/test/src/${id}`,
  presence: "present",
  kind: "git_main_worktree",
  visibility: "visible",
  mutation_state: "allowed",
  facts: [],
  git_summary: { branch: "main", dirty_count: 2 },
});
const conversation = (
  id: string,
  workspaceId: string,
  fields: Partial<HomeConversation> = {},
): HomeConversation => ({
  id,
  workspaceId,
  href: `/agents/${id}`,
  title: id,
  workspace: workspaceId,
  browserSession: false,
  process: "not_observed",
  ...fields,
});
afterEach(() => vi.unstubAllGlobals());
describe("workspace home", () => {
  it("groups by workspace and orders attention ahead of waiting, working and unknown without hiding just-finished work", () => {
    const sections = homeSections(
      [workspace("one"), workspace("two")],
      [
        conversation("unknown", "one"),
        conversation("working", "one", {
          process: "daemon_managed_live",
          command: "accepted",
        }),
        conversation("waiting", "one", {
          process: "daemon_managed_live",
          command: "idle",
        }),
        conversation("new", "one", {
          process: "confirmed_exited",
          attention: "new",
        }),
      ],
    );
    expect(sections.map((s) => s.workspace.name)).toEqual(["one", "two"]);
    expect(sections[0].open.map((c) => c.id)).toEqual([
      "new",
      "waiting",
      "working",
      "unknown",
    ]);
    expect(sections[1].open).toEqual([]);
  });
  it("rereads only a changed native history and keeps earlier text while pending", async () => {
    let release: ((value: Response) => void) | undefined;
    const read = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            schema_version: 1,
            recap: {
              recap: "Old recap",
              next: "Next",
              through: "one",
              generated_at: 1750000000000,
            },
            latest_message: "one",
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", read);
    const show = (first: string, second: string) => (
      <MemoryRouter>
        <HomeWorkspaces
          workspaces={[workspace("one")]}
          conversations={[
            conversation("first", "one", { revision: first }),
            conversation("second", "one", { revision: second }),
          ]}
        />
      </MemoryRouter>
    );
    const view = render(show("rev1", "rev1"));
    await waitFor(() =>
      expect(screen.getAllByText("Old recap")).toHaveLength(2),
    );
    expect(read).toHaveBeenCalledTimes(2);
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    view.rerender(show("rev2", "rev1"));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(3));
    expect(screen.getAllByText("Old recap")).toHaveLength(2);
    release?.(
      new Response(
        JSON.stringify({
          schema_version: 1,
          recap: {
            recap: "New recap",
            next: "Next",
            through: "two",
            generated_at: 1750000000000,
          },
          latest_message: "two",
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    await waitFor(() => expect(screen.getByText("New recap")).toBeTruthy());
  });
  it("shows the native recap and next line verbatim, including whitespace, with stale marker", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              schema_version: 1,
              recap: {
                recap: "First  line\nSecond",
                next: "Check  this\nnow",
                through: "one",
                generated_at: 1750000000000,
              },
              latest_message: "two",
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    render(
      <MemoryRouter>
        <HomeWorkspaces
          workspaces={[workspace("one")]}
          conversations={[conversation("example", "one", { attention: "new" })]}
        />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(
        screen.getByText(
          (_content, element) =>
            element?.className === "ah-home-recap" &&
            element.textContent === "First  line\nSecond",
        ),
      ).toBeTruthy(),
    );
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === "SPAN" &&
          element.textContent === "Check  this\nnow",
      ),
    ).toBeTruthy();
    expect(screen.getByText("uusia viestejä")).toBeTruthy();
    expect(screen.getByText(/main \+2/)).toBeTruthy();
  });
});
