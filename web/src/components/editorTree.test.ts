import { expect, it } from "vitest";
import { type TreeDirectories, treeRows } from "./editorTree";

const directories: TreeDirectories = {
  "": {
    entries: [
      { name: "src", kind: "directory" },
      { name: "readme", kind: "file" },
    ],
  },
  src: { entries: [{ name: "lib", kind: "directory" }] },
  "src/lib": {
    entries: [
      { name: "a.ts", kind: "file" },
      { name: "other", kind: "directory" },
    ],
  },
  "src/lib/other": { entries: [{ name: "a.ts", kind: "file" }] },
};
it("compacts proven chains but preserves real paths, hierarchy and collapsed descendants", () => {
  const rows = treeRows(directories, new Set(["src/lib"]), "");
  expect(rows.map((row) => [row.path, row.depth, row.parent])).toEqual([
    ["src/lib", 0, undefined],
    ["src/lib/a.ts", 1, "src"],
    ["src/lib/other", 1, "src"],
    ["readme", 0, undefined],
  ]);
  expect(rows[0].label).toBe("src/lib");
  expect(treeRows(directories, new Set(), "").map((row) => row.path)).toEqual([
    "src/lib",
    "readme",
  ]);
});
it("preserves link details in filtered rows and never compacts away a directory link", () => {
  const linked: TreeDirectories = {
    "": {
      entries: [
        { name: "outer", kind: "directory" },
        {
          name: "broken",
          kind: "unsupported",
          symlink_target: "absent",
          unavailable_reason: "broken_link",
        },
      ],
    },
    outer: {
      entries: [
        { name: "link", kind: "directory", symlink_target: "../target" },
      ],
    },
    "outer/link": { entries: [{ name: "child", kind: "directory" }] },
  };
  const rows = treeRows(linked, new Set(["outer", "outer/link"]), "");
  expect(rows.map((row) => row.path)).toEqual([
    "outer",
    "outer/link",
    "outer/link/child",
    "broken",
  ]);
  expect(rows[1].symlink_target).toBe("../target");
  expect(treeRows(linked, new Set(), "broken")[0]).toMatchObject({
    symlink_target: "absent",
    unavailable_reason: "broken_link",
  });
});
it.each([{ truncated: true }, { error: true }, { loading: true }])(
  "never infers a chain from an incomplete observation %j",
  (state) => {
    expect(
      treeRows(
        { ...directories, src: { ...directories.src, ...state } },
        new Set(),
        "",
      )[0].path,
    ).toBe("src");
  },
);
it("filters only observed paths, including collapsed descendants and duplicate basenames", () => {
  expect(
    treeRows(directories, new Set(), "A.TS").map((row) => row.label),
  ).toEqual(["src/lib/a.ts", "src/lib/other/a.ts"]);
  expect(
    treeRows(directories, new Set(), "lib/other").map((row) => row.path),
  ).toEqual(["src/lib/other/a.ts"]);
  expect(treeRows(directories, new Set(), "not-loaded")).toEqual([]);
});
