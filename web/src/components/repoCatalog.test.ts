import { expect, it } from "vitest";
import { arrange, type CatalogRepo, exactName, size } from "./repoCatalog";

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
  expect(a.sections.map((s) => [s.owner, s.kind])).toEqual([
    ["jari", "Omat"],
    ["org", "Organisaatio"],
    ["friend", "Yhteistyö"],
  ]);
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

it("writes sizes the way the prototype does", () => {
  expect(size(910 * 1048576)).toBe("910 MiB");
  expect(size(4300 * 1048576)).toBe("4,2 GiB");
  expect(size(2.3 * 1048576)).toBe("2,3 MiB");
});
