import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { NewWorkspacePage } from "./NewWorkspacePage";
import type { Workspace } from "./snapshot";

afterEach(() => {
  vi.unstubAllGlobals();
});
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

// Typing past an exact owner/repo aborts its lookup; typing it again must
// look it up again rather than wait on the aborted one forever.
it("looks an exact name up again after its lookup was aborted", async () => {
  const lookups: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/onboarding/github/repos")
        return json({ schema_version: 1, complete: true, repositories: [] });
      if (url.startsWith("/api/v1/onboarding/github/repository?")) {
        const name = decodeURIComponent(url.split("full_name=")[1]);
        lookups.push(name);
        if (lookups.length === 1)
          // The first lookup hangs until it is aborted.
          return new Promise<Response>((_, reject) =>
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            ),
          );
        return json({ schema_version: 1, full_name: name, state: "not_found" });
      }
      return new Response("", { status: 503 });
    }),
  );
  render(
    <MemoryRouter initialEntries={["/workspaces/new"]}>
      <NewWorkspacePage
        workspaces={[]}
        onCreated={() => {}}
        onOpen={() => {}}
        refresh={() => {}}
      />
    </MemoryRouter>,
  );
  const search = screen.getByRole("searchbox");
  fireEvent.change(search, { target: { value: "public/repo" } });
  await waitFor(() => expect(lookups).toEqual(["public/repo"]));
  fireEvent.change(search, { target: { value: "public/other" } });
  await waitFor(() => expect(lookups).toEqual(["public/repo", "public/other"]));
  fireEvent.change(search, { target: { value: "public/repo" } });
  await waitFor(() =>
    expect(lookups).toEqual(["public/repo", "public/other", "public/repo"]),
  );
  await waitFor(() =>
    expect(
      screen.getByTestId("repository-lookup").getAttribute("data-state"),
    ).toBe("not_found"),
  );
});

const A = "https://one.example.test";
const B = "https://two.example.test/git";
const adaA = "gitea_aaaaaaaaaaaaaaaaaaaaaaaa";
const bobA = "gitea_bbbbbbbbbbbbbbbbbbbbbbbb";
const adaB = "gitea_cccccccccccccccccccccccc";
const giteaRepo = (
  id: number,
  full_name: string,
  base: string,
  owned: boolean,
) => ({
  id,
  full_name,
  private: true,
  description: "",
  html_url: `${base}/${full_name}`,
  updated_at: "2026-10-20T08:00:00Z",
  size_kib: 10,
  default_branch: "main",
  empty: false,
  archived: false,
  owned,
});
const ws = (name: string, extra: Partial<Workspace>): Workspace => ({
  workspace_id: `ws_${name}`,
  path: `/home/example/src/${name}`,
  name,
  kind: "git_main_worktree",
  visibility: "visible",
  mutation_state: "allowed",
  presence: "present",
  facts: [],
  ...extra,
});

function renderCatalog(
  route: string,
  workspaces: Workspace[],
  onOpen = vi.fn(),
) {
  const writes: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method && init.method !== "GET") writes.push(url);
      if (url === "/api/v1/onboarding/github/repos")
        return json({ schema_version: 1, complete: true, repositories: [] });
      if (url === "/api/v1/integrations/gitea/repos")
        return json({
          schema_version: 1,
          sources: [
            {
              connection_id: adaA,
              base_url: A,
              user: "ada",
              state: "ok",
              complete: true,
              repositories: [giteaRepo(101, "ada/notes", A, true)],
            },
            {
              connection_id: bobA,
              base_url: A,
              user: "bob",
              state: "ok",
              complete: false,
              incomplete: "interrupted",
              repositories: [giteaRepo(101, "ada/notes", A, false)],
            },
            {
              connection_id: adaB,
              base_url: B,
              user: "ada",
              state: "ok",
              complete: true,
              repositories: [
                giteaRepo(101, "ada/notes", B, true),
                giteaRepo(102, "ada/tools", B, true),
              ],
            },
          ],
        });
      return new Response("", { status: 503 });
    }),
  );
  render(
    <MemoryRouter initialEntries={[route]}>
      <NewWorkspacePage
        workspaces={workspaces}
        onCreated={() => {}}
        onOpen={onOpen}
        refresh={() => {}}
      />
    </MemoryRouter>,
  );
  return { writes, onOpen };
}

// ~/src/notes is A's ada/notes, cloned as ada. Both of A's accounts see it
// as that workspace; B's ada/notes is another repository whose directory is
// taken. Opening it from bob's row writes nothing.
it("keeps two servers and two accounts apart and matches by origin", async () => {
  const notes = ws("notes", {
    git_remote: "other",
    gitea_origin: { base_url: A, full_name: "ada/notes" },
  });
  const tools = ws("tools", { git_remote: "other" });
  const { writes, onOpen } = renderCatalog(
    `/workspaces/new?gitea=${bobA}/101`,
    [notes, tools],
  );
  await waitFor(() =>
    expect(screen.getAllByTestId("repository-option-ada/notes")).toHaveLength(
      3,
    ),
  );
  const rows = Object.fromEntries(
    screen
      .getAllByTestId("repository-option-ada/notes")
      .map((r) => [
        r.getAttribute("data-connection"),
        r.getAttribute("data-workspace"),
      ]),
  );
  expect(rows).toEqual({ [adaA]: "same", [bobA]: "same", [adaB]: "taken" });
  // An SSH or otherwise uncomparable origin is not called this repository.
  expect(
    screen
      .getByTestId("repository-option-ada/tools")
      .getAttribute("data-workspace"),
  ).toBe("unknown");
  // Two accounts of one server say whose list a row is from.
  const labels = screen
    .getAllByTestId("repository-option-ada/notes")
    .map((r) => r.textContent ?? "");
  expect(
    labels.filter((l) => l.includes("one.example.test (ada)")),
  ).toHaveLength(1);
  expect(
    labels.filter((l) => l.includes("one.example.test (bob)")),
  ).toHaveLength(1);
  expect(screen.getByTestId("repo-details").getAttribute("data-state")).toBe(
    "workspace",
  );
  fireEvent.click(screen.getByTestId("cloned-workspace-open"));
  expect(onOpen).toHaveBeenCalledWith(notes);
  expect(writes).toEqual([]);
  // bob's list is incomplete and says so, without hiding the others.
  expect(screen.getAllByTestId("repository-source-note")).toHaveLength(1);
});

it("refuses to clone over a directory whose origin is another or unknown", async () => {
  const notes = ws("notes", {
    git_remote: "other",
    gitea_origin: { base_url: A, full_name: "ada/notes" },
  });
  renderCatalog(`/workspaces/new?gitea=${adaB}/101`, [notes]);
  await waitFor(() =>
    expect(screen.getByTestId("repo-details").getAttribute("data-state")).toBe(
      "taken",
    ),
  );
  cleanup();
  renderCatalog(`/workspaces/new?gitea=${adaB}/102`, [
    ws("tools", { git_remote: "other" }),
  ]);
  await waitFor(() =>
    expect(screen.getByTestId("repo-details").getAttribute("data-state")).toBe(
      "unknown",
    ),
  );
});
