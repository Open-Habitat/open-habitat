import { expect, it } from "vitest";
import { blockerText, gitChips, onlyHere, shellWord } from "./trashText";
import type { DeletionGit } from "./workspaceTrash";

it("quotes paths in copied commands only when a shell would split them", () => {
  expect(shellWord("/home/a/src/x-1")).toBe("/home/a/src/x-1");
  expect(shellWord("/home/a/it's here")).toBe(`'/home/a/it'\\''s here'`);
  expect(
    blockerText({ kind: "linked_worktree", path: "/tmp/a b" }).command,
  ).toBe("git worktree remove '/tmp/a b'");
});

const clean: DeletionGit = {
  state: "observed",
  has_commits: true,
  remote_refs: true,
  changed: 0,
  untracked: 0,
  ignored: 2,
  ignored_paths: [".env", "node_modules/"],
  stash: 0,
  unpushed: 0,
  nested_repositories: 0,
};

it("lists what only exists here; ignored files are not among them", () => {
  expect(onlyHere(clean)).toEqual([]);
  expect(gitChips(clean).map((chip) => chip.tone)).toEqual(["ok"]);
  const dirty = { ...clean, changed: 2, unpushed: 1, stash: 1 };
  expect(onlyHere(dirty)).toHaveLength(3);
  expect(gitChips(dirty).every((c) => c.tone === "warn")).toBe(true);
  // Without a remote every commit is only here; it is said once.
  expect(onlyHere({ ...clean, remote_refs: false, unpushed: 4 })).toHaveLength(
    1,
  );
});
