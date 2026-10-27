import type { Workspace } from "./snapshot";

/** How a repository of the catalog relates to the workspaces in ~/src.
 * same: a workspace's origin is this repository, as the daemon matched it
 * (GitHub by owner/name, Gitea by base and owner/name, GitLab by base and the
 * whole project path; never an account).
 * taken: no origin is this repository and the directory a clone would
 * make exists with an origin known to be another one, or none.
 * unknown: that directory exists but its origin cannot be compared, for
 * example an SSH address or one Git could not read; it is not called this
 * repository, and nothing is cloned over it either. */
export type WorkspaceMatch = {
  kind: "same" | "taken" | "unknown";
  workspace: Workspace;
};

export function workspaceFor(
  repo: {
    full_name: string;
    base_url?: string;
    source?: { provider: "gitea" | "gitlab" };
  },
  workspaces: readonly Workspace[],
): WorkspaceMatch | undefined {
  const full = repo.full_name.toLocaleLowerCase();
  const name = full.slice(full.lastIndexOf("/") + 1);
  const present = workspaces.filter((w) => w.presence === "present");
  const isThis = (w: Workspace) => {
    const origin =
      repo.source?.provider === "gitlab" ? w.gitlab_origin : w.gitea_origin;
    return repo.base_url
      ? origin?.base_url === repo.base_url &&
          origin.full_name.toLocaleLowerCase() === full
      : w.git_summary?.github_repo?.toLocaleLowerCase() === full;
  };
  const same = present.filter(isThis);
  if (same.length)
    return {
      kind: "same",
      // The directory of the repository's own name is the likelier one.
      workspace:
        same.find((w) => w.name.toLocaleLowerCase() === name) ?? same[0],
    };
  const dir = present.find((w) => w.name.toLocaleLowerCase() === name);
  if (!dir) return undefined;
  if (dir.kind !== "git_main_worktree")
    return { kind: "taken", workspace: dir };
  const known =
    dir.git_remote === "none" ||
    (dir.git_remote === "github" && !!dir.git_summary?.github_repo) ||
    !!dir.gitea_origin ||
    !!dir.gitlab_origin ||
    // Whatever else an origin is, it is not a GitHub repository.
    (!repo.base_url && dir.git_remote === "other");
  return { kind: known ? "taken" : "unknown", workspace: dir };
}
