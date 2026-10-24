import { expect, it } from "vitest";
import { arrange, type CatalogRepo, exactName } from "./repoCatalog";

const now = Date.parse("2026-10-17T12:00:00Z");
const ago = (days: number) => new Date(now - days * 86400000).toISOString();
const repo = (
  full_name: string,
  days: number | null,
  owner_type: CatalogRepo["owner_type"] = "User",
): CatalogRepo => ({
  full_name,
  private: false,
  description: "",
  pushed_at: days === null ? null : ago(days),
  size_kib: 1,
  default_branch: "main",
  owner_type,
});
const catalog = [
  repo("jari/old", 400),
  repo("jari/fresh", 0.5),
  repo("jari/taken", 0.2),
  repo("org/tool", 1, "Organization"),
  repo("friend/shared", 2),
  repo("jari/never", null),
];

it("lists the latest pushes without workspaces, then own, organisations and others", () => {
  const a = arrange(catalog, {
    login: "Jari",
    query: "",
    since: "0",
    now,
    taken: (r) => r.full_name === "jari/taken",
  });
  if (a.kind !== "browse") throw new Error("browse expected");
  expect(a.recent.map((r) => r.full_name)).toEqual([
    "jari/fresh",
    "org/tool",
    "friend/shared",
  ]);
  expect(a.sections.map((s) => s.owner)).toEqual(["jari", "org", "friend"]);
  // Newest push first; a repository never pushed comes last.
  expect(a.sections[0].fresh.map((r) => r.full_name)).toEqual([
    "jari/taken",
    "jari/fresh",
    "jari/old",
    "jari/never",
  ]);
});

it("says how many repositories the chosen time hides, in sections and search", () => {
  const a = arrange(catalog, {
    login: "jari",
    query: "",
    since: "30",
    now,
    taken: () => false,
  });
  if (a.kind !== "browse") throw new Error("browse expected");
  expect(a.sections[0]).toMatchObject({ total: 4, hidden: 2 });
  const s = arrange(catalog, {
    query: "JARI/",
    since: "90",
    now,
    taken: () => false,
  });
  expect(s).toMatchObject({ kind: "search", hidden: 2 });
  if (s.kind === "search") expect(s.hits).toHaveLength(2);
});

it("recognises an exact GitHub name, also from its URL, and nothing path-like", () => {
  expect(exactName(" raine/workmux ")).toBe("raine/workmux");
  expect(exactName("https://github.com/raine/workmux.git")).toBe(
    "raine/workmux",
  );
  for (const bad of ["raine", "raine/..", "a/b/c", "-x/y", "raine/work mux"])
    expect(exactName(bad)).toBeUndefined();
});

it("keeps the same owner/repo from GitHub and two Gitea accounts apart", () => {
  // tea's stored user can lag a rename at Gitea; "Omat" follows Gitea's
  // owner id (owned), not a login comparison.
  const giteaA = { id: "gitea_a", label: "git.example.test", login: "old" };
  const giteaB = { id: "gitea_b", label: "git.example.test", login: "jari" };
  const repos: CatalogRepo[] = [
    repo("jari/notes", 1),
    { ...repo("jari/notes", 2), source: giteaA, owned: true },
    { ...repo("jari/notes", 3), source: giteaB, owned: false },
  ];
  const a = arrange(repos, {
    login: "jari",
    query: "",
    since: "0",
    now,
    taken: () => false,
  });
  if (a.kind !== "browse") throw new Error("browse expected");
  expect(new Set(a.sections.map((s) => s.key)).size).toBe(3);
  // "Omat" is the source's own account: the second Gitea account sees
  // the repository as someone else's.
  expect(a.sections.map((s) => [s.source?.id ?? "github", s.kind])).toEqual([
    ["github", "Omat"],
    ["gitea_a", "Omat"],
    ["gitea_b", "Yhteistyö"],
  ]);
  const s = arrange(repos, {
    query: "git.example",
    since: "0",
    now,
    taken: () => false,
  });
  if (s.kind !== "search") throw new Error("search expected");
  expect(s.hits.map((r) => r.source?.id)).toEqual(["gitea_a", "gitea_b"]);
});
