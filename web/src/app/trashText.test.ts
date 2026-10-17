import { expect, it } from "vitest";
import schema from "../../../contracts/v1/workspace-deletion.schema.json";
import {
  blockerText,
  gitChips,
  onlyHere,
  refusalText,
  shellWord,
} from "./trashText";
import { type DeletionGit, refusalCodes } from "./workspaceTrash";

// The contract's lists, not a copy of them: a kind or check added there
// without Finnish text fails here.
const kinds = schema.$defs.blocker.properties.kind.enum;
const checks = schema.$defs.blocker.properties.check.enum;

it("gives every refusal code its own Finnish text", () => {
  const fallback = refusalText("unavailable");
  const texts = refusalCodes.map(refusalText);
  for (const [i, t] of texts.entries())
    expect(t, refusalCodes[i]).not.toBe(fallback);
  expect(new Set(texts).size).toBe(texts.length);
  expect(refusalText("something_new")).toBe(fallback);
});

it("says what each blocker is and how it goes away", () => {
  const seen = new Set<string>();
  for (const kind of kinds) {
    const variants =
      kind === "unknown"
        ? [
            ...checks.map((check) => ({ check })),
            { check: "processes", pid: 7 },
          ]
        : [{ pid: 7, comm: "zsh", run_id: "0".repeat(26), path: "/w/x" }];
    for (const extra of variants) {
      const t = blockerText({ kind, ...extra } as never);
      const what = t.what.map((p) => (typeof p === "string" ? p : p.code));
      expect(what.join("").length, kind).toBeGreaterThan(10);
      expect(t.how.length, kind).toBeGreaterThan(5);
      seen.add(what.join(""));
    }
  }
  expect(seen.size).toBe(kinds.length - 1 + checks.length + 1);
});

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
  expect(gitChips(clean)).toEqual([{ text: "kaikki etärepossa", tone: "ok" }]);
  const dirty = { ...clean, changed: 2, unpushed: 1, stash: 1 };
  expect(onlyHere(dirty)).toHaveLength(3);
  expect(gitChips(dirty).every((c) => c.tone === "warn")).toBe(true);
  // Without a remote every commit is only here; it is said once.
  expect(onlyHere({ ...clean, remote_refs: false, unpushed: 4 })).toEqual([
    "Ei haettua etärepoa: koko Git-historia on vain täällä.",
  ]);
});
