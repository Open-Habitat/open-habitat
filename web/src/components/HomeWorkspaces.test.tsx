import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Workspace } from "../app/snapshot";
import {
  type HomeConversation,
  HomeWorkspaces,
  homeSections,
  useCardArchiveAction,
} from "./HomeWorkspaces";

it("an already rendered card archives using the current page callback", async () => {
  const undoRoutes: string[] = [];
  const { result, rerender } = renderHook(
    ({ route }) =>
      useCardArchiveAction(async () => {
        undoRoutes.push(route);
        return true;
      }),
    { initialProps: { route: "/workspaces" } },
  );
  const pressed = result.current.run;
  // Navigation commits before the card's retained press handler runs.
  rerender({ route: "/workspaces/ws_current" });
  await act(async () => {
    pressed?.("conversation");
  });
  expect(undoRoutes).toEqual(["/workspaces/ws_current"]);
});

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
  it("keeps failed archive feedback on its card and blocks work with a reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("recap unavailable")),
    );
    const onArchive = vi.fn().mockResolvedValue(false);
    const show = (working: boolean) => (
      <MemoryRouter>
        <HomeWorkspaces
          workspaces={[workspace("one")]}
          conversations={[
            conversation("one-agent", "one", {
              title: "Työ",
              command: working ? "accepted" : "idle",
            }),
          ]}
          archiveReason={(c) =>
            c.command === "accepted" ? "Odota agentin vuoron päättymistä." : ""
          }
          onArchive={onArchive}
        />
      </MemoryRouter>
    );
    const view = render(show(true));
    const archive = screen.getByTestId("archive-conversation");
    expect(archive).toHaveProperty("disabled", true);

    const reasonId = archive.getAttribute("aria-describedby");
    expect(reasonId).toBeTruthy();
    expect(document.getElementById(reasonId ?? "")).toBeTruthy();
    view.rerender(show(false));
    fireEvent.click(screen.getByTestId("archive-conversation"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByText("Työ")).toBeTruthy();
    expect(onArchive).toHaveBeenCalledTimes(1);
  });
  it("groups by workspace and orders attention ahead of working, waiting and unknown without hiding just-finished work", () => {
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
        conversation("process", "one", {
          process: "daemon_managed_live",
          command: "idle",
          runActive: false,
          waitingOn: [
            { process_id: "p", name: "test", kind: "process", run_ids: [] },
          ],
        }),
        conversation("spinoff", "one", {
          process: "daemon_managed_live",
          command: "idle",
          runActive: false,
          waitingOn: [
            {
              process_id: "s",
              name: "test",
              kind: "taskfleet_wait",
              run_ids: [],
            },
          ],
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
      "working",
      "process",
      "spinoff",
      "waiting",
      "unknown",
    ]);
    expect(sections[1].open).toEqual([]);
  });
  it("names only the waits the turn ended for, not a service left running", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("recap unavailable")),
    );
    const wait = (name: string, before_turn?: true) => ({
      process_id: name,
      name,
      kind: "process" as const,
      run_ids: [],
      before_turn,
    });
    const card = (waitingOn: ReturnType<typeof wait>[]) => (
      <MemoryRouter>
        <HomeWorkspaces
          workspaces={[workspace("one")]}
          conversations={[
            conversation("example", "one", {
              process: "daemon_managed_live",
              command: "idle",
              runActive: false,
              waitingOn,
            }),
          ]}
        />
      </MemoryRouter>
    );
    const view = render(card([wait("serve", true), wait("build")]));
    const live = () =>
      view.container.querySelector(".ah-home-live")?.textContent ?? null;
    expect(live()).toContain("build");
    expect(live()).not.toContain("serve");
    // A service alone is not background work the card describes.
    view.rerender(card([wait("serve", true)]));
    expect(live()).toBeNull();
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
            latest_message_at: null,
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
          latest_message_at: null,
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    await waitFor(() => expect(screen.getByText("New recap")).toBeTruthy());
  });
  it("shows the native recap and next line verbatim, including whitespace", async () => {
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
                generated_at: Date.now() - 60000,
              },
              latest_message: "one",
              // The age counts from the conversation's last message.
              latest_message_at: new Date(
                Date.now() - 5 * 60000 - 1000,
              ).toISOString(),
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

    expect(screen.getByText(/main \+2/)).toBeTruthy();
    expect(screen.getByTestId("recap-age").textContent).toBe("5 min sitten");
  });
  it("does not present a recap that later native messages outdated", async () => {
    const read = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            schema_version: 1,
            recap: {
              recap: "Outdated recap",
              next: "Old next",
              through: "one",
              generated_at: 1750000000000,
            },
            latest_message: "two",
            latest_message_at: null,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", read);
    const view = render(
      <MemoryRouter>
        <HomeWorkspaces
          workspaces={[workspace("one")]}
          conversations={[conversation("example", "one", { attention: "new" })]}
        />
      </MemoryRouter>,
    );
    await waitFor(() => expect(read).toHaveBeenCalled());
    const card = await screen.findByTestId("conversation-card-example");
    await waitFor(() =>
      expect(card.querySelector(".ah-home-pending")).toBeTruthy(),
    );
    expect(card.querySelector(".ah-home-recap")).toBeNull();
    expect(card.querySelector("time")).toBeNull();
    view.unmount();
  });
});
