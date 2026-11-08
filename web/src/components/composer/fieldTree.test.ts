import { describe, expect, it } from "vitest";
import type { TreeFolder } from "../../app/composerReads";
import type { Choice } from "./ChoiceList";
import {
  autoSelect,
  foldersAbove,
  foldersToRead,
  revealFolding,
  searchChoices,
  sideways,
  toggleFolder,
  treeChoices,
  unfolded,
} from "./fieldTree";

const listing = (path: string, entries: TreeFolder["entries"]): TreeFolder => ({
  path,
  entries,
  truncated: false,
});
const text = {
  loading: "loading",
  more: "more",
  failed: "failed",
  failedFolders: new Set<string>(),
};
const workspace = new Map<string, TreeFolder>([
  [
    "",
    listing("", [
      { kind: "folder", path: "docs/" },
      { kind: "folder", path: "src/", changed: 2 },
      { kind: "file", path: "AGENTS.md" },
    ]),
  ],
  [
    "src/",
    listing("src/", [
      { kind: "folder", path: "src/astro/", changed: 1 },
      { kind: "file", path: "src/shadow.py", git: "modified" },
    ]),
  ],
]);
const shown = (rows: Choice[] | null) =>
  (rows ?? []).map((r) =>
    r.type === "status"
      ? `${r.depth}:${r.text}${r.folder ? `(${r.folder})` : ""}`
      : r.type === "folder"
        ? `${r.depth}:${r.path}${r.open ? " open" : ""}`
        : r.type === "file"
          ? `${r.depth}:${r.path}`
          : r.type,
  );

describe("the in-field folder tree", () => {
  it("opens the folders holding a change and asks for the deepest one it lacks", () => {
    const rows = treeChoices(workspace, unfolded, text);
    expect(shown(rows)).toEqual([
      "0:docs/",
      "0:src/ open",
      "1:src/astro/ open",
      "2:loading(src/astro/)",
      "1:src/shadow.py",
      "0:AGENTS.md",
    ]);
    expect(foldersToRead(rows ?? [])).toEqual(["src/astro/"]);
    // One read brings the folders above it, so a chain asks once.
    expect(
      foldersToRead([
        { type: "status", text: "", folder: "a/" },
        { type: "status", text: "", folder: "a/b/" },
        { type: "status", text: "", folder: "ab/" },
      ]),
    ).toEqual(["a/b/", "ab/"]);
    // Nothing shows until the top folder has been read.
    expect(treeChoices(new Map(), unfolded, text)).toBeNull();
  });

  it("lets the person close a changed folder and open an unchanged one", () => {
    let folding = toggleFolder(unfolded, "src/", 2);
    folding = toggleFolder(folding, "docs/", 0);
    expect(shown(treeChoices(workspace, folding, text))).toEqual([
      "0:docs/ open",
      "1:loading(docs/)",
      "0:src/",
      "0:AGENTS.md",
    ]);
    // A folder whose read failed says so rather than loading for ever.
    expect(
      shown(
        treeChoices(workspace, folding, {
          ...text,
          failedFolders: new Set(["docs/"]),
        }),
      ),
    ).toContain("1:failed");
    const twice = toggleFolder(toggleFolder(unfolded, "src/", 2), "src/", 2);
    expect(shown(treeChoices(workspace, twice, text))).toEqual(
      shown(treeChoices(workspace, unfolded, text)),
    );
  });

  it("starts on the first changed file, a search's first file, or the revealed one", () => {
    const rows = treeChoices(workspace, unfolded, text) ?? [];
    expect(rows[autoSelect(rows, { searching: false })]).toMatchObject({
      path: "src/shadow.py",
    });
    expect(
      rows[autoSelect(rows, { searching: false, reveal: "AGENTS.md" })],
    ).toMatchObject({ path: "AGENTS.md" });
    const hits = searchChoices([
      { path: "src/AGENTS.md", git: "modified" },
      { path: "AGENTS.md" },
    ]);
    expect(hits.map((r) => r.type === "file" && r.where)).toEqual([
      "src/",
      "/",
    ]);
    expect(autoSelect(hits, { searching: true })).toBe(0);
  });

  it("moves sideways: a folder opens, closes and steps in, ← steps out, a search row → shows its folder", () => {
    const rows = treeChoices(workspace, unfolded, text) ?? [];
    const at = (path: string) =>
      rows.findIndex(
        (r) => r.type !== "status" && "path" in r && r.path === path,
      );
    expect(sideways(rows, at("docs/"), true)).toEqual({
      do: "toggle",
      path: "docs/",
      changed: 0,
    });
    expect(sideways(rows, at("docs/"), false)).toBeNull();
    expect(sideways(rows, at("src/"), true)).toEqual({
      do: "select",
      index: at("src/astro/"),
    });
    expect(sideways(rows, at("src/"), false)).toMatchObject({ do: "toggle" });
    // An open folder whose contents are still loading has nothing to step into.
    expect(sideways(rows, at("src/astro/"), true)).toBeNull();
    expect(sideways(rows, at("src/shadow.py"), false)).toEqual({
      do: "select",
      index: at("src/"),
    });
    expect(sideways(rows, at("src/shadow.py"), true)).toBeNull();
    const hits = searchChoices([{ path: "src/astro/AGENTS.md" }]);
    expect(sideways(hits, 0, true)).toEqual({
      do: "reveal",
      path: "src/astro/AGENTS.md",
    });
    expect(revealFolding("src/astro/AGENTS.md")).toEqual({
      opened: ["src/", "src/astro/"],
      closed: [],
    });
    expect(foldersAbove("AGENTS.md")).toEqual([]);
    expect(foldersAbove("a/b/")).toEqual(["a/"]);
  });
});
