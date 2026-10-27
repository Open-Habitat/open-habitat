import { expect, it } from "vitest";
import type { Workspace } from "./snapshot";
import { workspaceFor } from "./workspaceMatch";

const A = "https://one.example.test";
const B = "https://two.example.test/git";
const ws = (name: string, extra: Partial<Workspace> = {}): Workspace => ({
  workspace_id: `ws_${name}`,
  name,
  kind: "git_main_worktree",
  visibility: "visible",
  mutation_state: "allowed",
  presence: "present",
  facts: [],
  ...extra,
});

it("matches a Gitea repository by its server and owner/name, never by its directory", () => {
  const cloned = ws("elsewhere", {
    git_remote: "other",
    gitea_origin: { base_url: A, full_name: "Ada/Notes" },
  });
  const named = ws("notes", {
    git_remote: "other",
    gitea_origin: { base_url: A, full_name: "bob/notes" },
  });
  const all = [named, cloned];
  // Same server, owner/name compared as Gitea does, case-insensitively.
  expect(workspaceFor({ full_name: "ada/notes", base_url: A }, all)).toEqual({
    kind: "same",
    workspace: cloned,
  });
  // The same owner/name on another server is another repository, and the
  // directory it would clone into is taken by a known other origin.
  expect(workspaceFor({ full_name: "ada/notes", base_url: B }, all)).toEqual({
    kind: "taken",
    workspace: named,
  });
  // A GitHub repository of that name is not the Gitea clone either.
  expect(workspaceFor({ full_name: "ada/notes" }, all)?.kind).toBe("taken");
  // Two directories with the repository's origin: its own name wins.
  const own = ws("notes", {
    gitea_origin: { base_url: A, full_name: "ada/notes" },
  });
  expect(
    workspaceFor({ full_name: "ada/notes", base_url: A }, [cloned, own])
      ?.workspace,
  ).toBe(own);
});

it("never calls an origin it cannot compare this repository", () => {
  const ssh = ws("notes", { git_remote: "other" });
  const unread = ws("notes", { git_remote: "unknown" });
  const fresh = ws("notes", { git_remote: "none" });
  const plain = ws("notes", { kind: "directory" });
  const gone = ws("notes", {
    presence: "absent",
    gitea_origin: { base_url: A, full_name: "ada/notes" },
  });
  const gitea = { full_name: "ada/notes", base_url: A };
  expect(workspaceFor(gitea, [ssh])?.kind).toBe("unknown");
  expect(workspaceFor(gitea, [unread])?.kind).toBe("unknown");
  expect(workspaceFor(gitea, [fresh])?.kind).toBe("taken");
  expect(workspaceFor(gitea, [plain])?.kind).toBe("taken");
  expect(workspaceFor(gitea, [gone])).toBeUndefined();
  // For GitHub, any non-GitHub origin is known to be another repository.
  expect(workspaceFor({ full_name: "ada/notes" }, [ssh])?.kind).toBe("taken");
  expect(workspaceFor({ full_name: "ada/notes" }, [unread])?.kind).toBe(
    "unknown",
  );
  // A GitHub origin whose owner/name was not read (a timed-out summary).
  expect(
    workspaceFor({ full_name: "ada/notes" }, [
      ws("notes", { git_remote: "github" }),
    ])?.kind,
  ).toBe("unknown");
});

it("treats a renamed or deleted repository by what its origin says", () => {
  // The clone's origin still names the old name: the renamed repository
  // is not proven to be it, and its new name's directory is free.
  const old = ws("old", {
    gitea_origin: { base_url: A, full_name: "ada/old" },
  });
  expect(
    workspaceFor({ full_name: "ada/new", base_url: A }, [old]),
  ).toBeUndefined();
  // A workspace of a repository the list no longer has changes nothing
  // for the others.
  expect(
    workspaceFor({ full_name: "ada/other", base_url: A }, [old]),
  ).toBeUndefined();
  // GitHub is matched by origin too, wherever the clone is.
  const gh = ws("fork", {
    git_remote: "github",
    git_summary: { branch: "main", dirty_count: 0, github_repo: "Ada/Notes" },
  });
  expect(workspaceFor({ full_name: "ada/notes" }, [gh])).toEqual({
    kind: "same",
    workspace: gh,
  });
});

it("matches a GitLab project by its server and whole path, its directory by the project's own name", () => {
  const gitlab = { provider: "gitlab" as const };
  const cloned = ws("terraform", {
    git_remote: "other",
    gitlab_origin: {
      base_url: A,
      full_name: "konepaja/verkkokauppa/infra/terraform",
    },
  });
  expect(
    workspaceFor(
      {
        full_name: "Konepaja/Verkkokauppa/infra/terraform",
        base_url: A,
        source: gitlab,
      },
      [cloned],
    ),
  ).toEqual({ kind: "same", workspace: cloned });
  // Another group's project of the same name would clone into the same
  // directory, whose origin is known to be another project.
  expect(
    workspaceFor(
      { full_name: "toinen/terraform", base_url: A, source: gitlab },
      [cloned],
    ),
  ).toEqual({ kind: "taken", workspace: cloned });
  // A Gitea repository of that path on the same server is not it.
  expect(
    workspaceFor(
      { full_name: "konepaja/verkkokauppa/infra/terraform", base_url: A },
      [cloned],
    )?.kind,
  ).toBe("taken");
});
