import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { CloneJobs } from "./cloneJobs";
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
      // An installation without GitLab answers its list as not offered.
      if (url === "/api/v1/integrations/gitlab/repos")
        return new Response("", { status: 404 });
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
      // An installation without GitLab answers its list as not offered.
      if (url === "/api/v1/integrations/gitlab/repos")
        return new Response("", { status: 404 });
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
  // Two accounts of one server say whose list a repository is from: the
  // owner sections in the browsed list, each row in a search.
  const named = (els: HTMLElement[], label: string) =>
    els.filter((e) => e.textContent?.includes(label)).length;
  const sections = screen.getAllByTestId("repo-owner-ada");
  expect(named(sections, "one.example.test (ada)")).toBe(1);
  expect(named(sections, "one.example.test (bob)")).toBe(1);
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "notes" },
  });
  const hits = screen.getAllByTestId("repository-option-ada/notes");
  expect(named(hits, "one.example.test (ada)")).toBe(1);
  expect(named(hits, "one.example.test (bob)")).toBe(1);
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

const githubRepo = (full_name: string) => ({
  full_name,
  private: false,
  description: "",
  html_url: `https://github.com/${full_name}`,
  pushed_at: "2026-10-20T08:00:00Z",
  size_kib: 10,
  default_branch: "main",
  owner_type: "User",
});

/** The page under a router the test drives, as the app's links do. */
function renderRouted(
  route: string,
  sources: unknown[] | "unavailable",
  github: unknown[] = [],
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/v1/onboarding/github/repos")
        return json({
          schema_version: 1,
          complete: true,
          repositories: github,
        });
      if (url === "/api/v1/integrations/gitea/repos")
        return sources === "unavailable"
          ? new Response("", { status: 502 })
          : json({ schema_version: 1, sources });
      // An installation without GitLab answers its list as not offered.
      if (url === "/api/v1/integrations/gitlab/repos")
        return new Response("", { status: 404 });
      return new Response("", { status: 503 });
    }),
  );
  const router = createMemoryRouter(
    [
      {
        path: "/workspaces/new",
        element: (
          <NewWorkspacePage
            workspaces={[]}
            onCreated={() => {}}
            onOpen={() => {}}
            refresh={() => {}}
          />
        ),
      },
    ],
    { initialEntries: [route] },
  );
  render(<RouterProvider router={router} />);
  return router;
}
const source = (
  connection_id: string,
  base_url: string,
  repositories: unknown[],
) => ({
  connection_id,
  base_url,
  user: "ada",
  state: "ok",
  complete: true,
  repositories,
});
const current = () =>
  screen
    .getAllByTestId("repository-option-ada/notes")
    .filter((r) => r.getAttribute("aria-current") === "page")
    .map((r) => r.getAttribute("data-connection") ?? "github");

// The same owner/name and even the same Gitea id on two servers and on
// GitHub are three repositories: moving between their routes selects exactly
// the one named, and its details say which source it is.
it("a route switch between namesakes selects only the named source", async () => {
  const router = renderRouted(
    `/workspaces/new?gitea=${adaA}/101`,
    [
      source(adaA, A, [giteaRepo(101, "ada/notes", A, true)]),
      source(adaB, B, [giteaRepo(101, "ada/notes", B, true)]),
    ],
    [githubRepo("ada/notes")],
  );
  await waitFor(() =>
    expect(screen.getAllByTestId("repository-option-ada/notes")).toHaveLength(
      3,
    ),
  );
  expect(current()).toEqual([adaA]);
  const shown = () => screen.queryByTestId("repo-details-source")?.textContent;
  expect(shown()).toContain("one.example.test");
  await act(() => router.navigate(`/workspaces/new?gitea=${adaB}/101`));
  expect(current()).toEqual([adaB]);
  expect(shown()).toContain("two.example.test/git");
  await act(() => router.navigate("/workspaces/new?repo=ada%2Fnotes"));
  expect(current()).toEqual(["github"]);
  expect(shown()).toBeUndefined();
  // A connection id the list does not hold selects nothing in its place.
  await act(() => router.navigate(`/workspaces/new?gitea=${bobA}/101`));
  expect(current()).toEqual([]);
  expect(screen.queryByTestId("repository-clone")).toBeNull();
});

// One source failing is said beside the others' lists, which stay whole; the
// whole Gitea read failing leaves GitHub's list as it is.
it("a failing source is reported on its own and hides no other list", async () => {
  renderRouted(
    "/workspaces/new",
    [
      {
        connection_id: adaA,
        base_url: A,
        user: "ada",
        state: "failed",
        failure: "token_rejected",
        complete: false,
        repositories: [],
      },
      source(adaB, B, [giteaRepo(102, "ada/tools", B, true)]),
    ],
    [githubRepo("ada/notes")],
  );
  await waitFor(() =>
    expect(screen.getAllByTestId("repository-source-note")).toHaveLength(1),
  );
  expect(
    screen.getByTestId("repository-source-note").hasAttribute("data-failed"),
  ).toBe(true);
  expect(screen.getByTestId("repository-option-ada/notes")).toBeTruthy();
  expect(
    screen
      .getByTestId("repository-option-ada/tools")
      .getAttribute("data-connection"),
  ).toBe(adaB);
  cleanup();
  renderRouted("/workspaces/new", "unavailable", [githubRepo("ada/notes")]);
  await waitFor(() =>
    expect(screen.getAllByTestId("repository-source-note")).toHaveLength(1),
  );
  expect(
    screen
      .getByTestId("repository-option-ada/notes")
      .getAttribute("data-source"),
  ).toBe("github");
});

const glRepo = (id: number, full_name: string, extra: object = {}) => ({
  id,
  full_name,
  visibility: "private",
  description: "",
  html_url: `https://gitlab.example.test/${full_name}`,
  activity_at: "2026-10-20T08:00:00Z",
  size_kib: null,
  default_branch: "main",
  empty: false,
  archived: false,
  personal: false,
  own: false,
  ...extra,
});
const gl = "gitlab_0123456789abcdef01234567";

// GitLab's projects join the common list under their whole namespace
// (Koko polku); the details name the group path and whether push works,
// and the clone names the connection and GitLab's id, never a path.
it("lists GitLab projects by their whole namespace and clones one by its id", async () => {
  const writes: { url: string; body: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST")
        writes.push({ url, body: String(init.body ?? "") });
      if (url === "/api/v1/onboarding/github/repos")
        return json({ schema_version: 1, complete: true, repositories: [] });
      if (url === "/api/v1/integrations/gitea/repos")
        return new Response("", { status: 404 });
      if (url === "/api/v1/integrations/gitlab/repos")
        return json({
          schema_version: 1,
          sources: [
            {
              connection_id: gl,
              base_url: "https://gitlab.example.test",
              user: "aino",
              state: "ok",
              complete: true,
              elsewhere: { count: 2, origin: "http://gitlab.internal" },
              repositories: [
                glRepo(7, "konepaja/verkkokauppa/infra/terraform", {
                  visibility: "internal",
                }),
                glRepo(8, "konepaja/verkkokauppa/infra/ansible"),
                glRepo(9, "aino/dotfiles", { personal: true, own: true }),
              ],
            },
          ],
        });
      if (url === "/api/v1/integrations/gitlab/tokens")
        return json({
          schema_version: 1,
          connections: [
            {
              connection_id: gl,
              api: "ok",
              token: {
                push: "no",
                scopes: ["read_api"],
                expires_at: null,
                fine: false,
              },
            },
          ],
        });
      if (url === "/api/v1/onboarding/github/clones" && init?.method === "POST")
        return json({
          schema_version: 1,
          job: {
            job_id: "0123456789abcdef0123456789abcdef",
            full_name: "konepaja/verkkokauppa/infra/terraform",
            source: { provider: "gitlab", connection_id: gl, repository_id: 7 },
            mode: "full",
            state: "running",
            stage: "reserving",
            started_at: "2026-10-27T10:00:00Z",
          },
        });
      if (url === "/api/v1/onboarding/github/clones")
        return json({
          schema_version: 1,
          jobs: [],
          interrupted: [],
          interrupted_complete: true,
        });
      return new Response("", { status: 503 });
    }),
  );
  const store = new CloneJobs();
  render(
    <MemoryRouter initialEntries={[`/workspaces/new?gitlab=${gl}/7`]}>
      <NewWorkspacePage
        csrf="csrf"
        store={store}
        workspaces={[]}
        onCreated={() => {}}
        onOpen={() => {}}
        refresh={() => {}}
      />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(
      screen.getByTestId("repo-owner-konepaja/verkkokauppa/infra"),
    ).toBeTruthy(),
  );
  const section = screen.getByTestId("repo-owner-konepaja/verkkokauppa/infra");
  expect(section.textContent).toContain("Aliryhmä");
  expect(section.getAttribute("data-source")).toBe("gitlab");
  expect(screen.getByTestId("repo-owner-aino").textContent).toContain("Omat");
  expect(screen.getByTestId("repo-details-group").textContent).toBe(
    "konepaja › verkkokauppa › infra",
  );
  await waitFor(() =>
    expect(screen.getByTestId("repo-details-push").textContent).toContain(
      "write_repository",
    ),
  );
  expect(
    screen.getAllByTestId("repository-source-note")[0].textContent,
  ).toContain("2 projektia jäi pois");
  fireEvent.click(screen.getByTestId("repository-clone"));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(JSON.parse(writes[0].body)).toEqual({
    action: "start",
    source: "gitlab",
    connection_id: gl,
    repository_id: 7,
    mode: "full",
  });
});
