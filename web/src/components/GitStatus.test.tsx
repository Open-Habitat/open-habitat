import { fireEvent, render } from "@testing-library/react";
import { Dialog } from "react-aria-components";
import { describe, expect, it, vi } from "vitest";
import { type GitDetailFacts, GitStatusDetails, gitArrows } from "./GitStatus";

const commit = (n: number, subject: string) => ({
  hash: String(n).repeat(40),
  subject,
  timestamp: 1790000000 + n * 60,
});
const main = {
  name: "main",
  ref: "origin/main",
  source: "origin_head" as const,
  ahead: 25,
  behind: 3,
  merged: false,
};
const detail: GitDetailFacts = {
  branch: "status-rivit",
  dirty_count: 2,
  upstream: "origin/status-rivit",
  ahead: 2,
  behind: 1,
  base: main,
  files: [
    { status: " M", path: "scripts/status_rows.py", added: 18, deleted: 4 },
    { status: "??", path: "tests/test_status_rows.py", added: 52, deleted: 0 },
    { status: "AA", path: "AA-konflikti.txt" },
  ],
  files_truncated: false,
  commits: [],
  commits_available: true,
  fetched_at: 1790000000,
  unpushed_commits: [commit(1, "Statusrivit: --since"), commit(2, "Jäsennys")],
  incoming_commits: [commit(3, "README: esimerkki")],
  // The host names at most 20; the count stays the total.
  base_ahead_commits: Array.from({ length: 20 }, (_, i) =>
    commit(i + 4, `c${i}`),
  ),
  base_behind_commits: [
    commit(5, "CI"),
    commit(6, "Aikavyöhyke"),
    commit(7, "Päivitä"),
  ],
};
const props = {
  summary: detail,
  loading: false,
  readError: false,
  fetching: false,
  onFetch: vi.fn(),
  now: 1790000000 * 1000 + 25 * 60000,
};

describe("Git status", () => {
  it("compares a branch without an upstream against its base", () => {
    expect(gitArrows(detail)).toMatchObject({ up: 2, down: 1, base: false });
    const worktree = {
      branch: "wt/x",
      dirty_count: 0,
      base: { ...main, ahead: 0, behind: 4, merged: true },
    };
    expect(gitArrows(worktree)).toMatchObject({ up: 0, down: 4, base: true });

    expect(gitArrows({ branch: "main", dirty_count: 0 })).toBeUndefined();
  });

  it("folds named commits under totals and says when a list is cut", () => {
    const view = render(
      <Dialog aria-label="Git-tila">
        <GitStatusDetails {...props} detail={detail} />
      </Dialog>,
    );
    const ahead = view.getAllByTestId(/^git-commits-/)[2] as HTMLDetailsElement;
    expect(ahead?.querySelector(".ah-gs-count")?.textContent).toBe("25");
    expect(ahead.querySelectorAll("li")).toHaveLength(20);

    const incoming = view.getAllByTestId(
      /^git-commits-/,
    )[1] as HTMLDetailsElement;
    expect(incoming?.open).toBe(false);
    expect(incoming?.textContent).toContain("README: esimerkki");
  });

  it("shows a merged base and a failed fetch as plain text", () => {
    const merged = {
      ...detail,
      base: { ...main, ahead: 0, merged: true },
    };
    const onFetch = vi.fn();
    const view = render(
      <Dialog aria-label="Git-tila">
        <GitStatusDetails
          {...props}
          detail={merged}
          onFetch={onFetch}
          fetchFailed
          fetchMessage="Haku epäonnistui: etärepo käyttää SSH:ta."
        />
      </Dialog>,
    );

    expect(view.getByRole("alert").textContent).toContain("SSH");
    fireEvent.click(view.getByTestId("fetch-git"));
    expect(onFetch).toHaveBeenCalledOnce();
  });
});
