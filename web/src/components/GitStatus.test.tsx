import { fireEvent, render } from "@testing-library/react";
import { Dialog } from "react-aria-components";
import { describe, expect, it, vi } from "vitest";
import {
  type GitDetailFacts,
  GitStatusChip,
  GitStatusDetails,
  gitArrows,
  gitSentence,
} from "./GitStatus";

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
  onReread: vi.fn(),
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
    expect(gitSentence(worktree)).toBe(
      "Haara wt/x, yhdistetty main-haaraan, 4 jäljessä, 0 muuttunutta tiedostoa.",
    );
    expect(gitArrows({ branch: "main", dirty_count: 0 })).toBeUndefined();
  });

  it("says a worktree agent's work is merged instead of counting", () => {
    const facts = {
      branch: "wt/x",
      dirty_count: 0,
      base: { ...main, ref: "main", ahead: 0, behind: 0, merged: true },
    };
    const chip = (merged: boolean) =>
      render(
        <GitStatusChip
          facts={facts}
          open={false}
          onOpenChange={() => {}}
          worktree={{ merged }}
        >
          <Dialog />
        </GitStatusChip>,
      );
    let view = chip(true);
    const button = view.getByRole("button");
    expect(button.getAttribute("aria-label")).toBe(
      "Worktree-agentin haara wt/x, yhdistetty main-haaraan. Avaa Git-tiedot.",
    );
    expect(button.textContent).toBe("wt/xyhdistetty");
    view.unmount();
    // Not merged yet (a fresh branch is also "in the base"): the counts.
    view = chip(false);
    expect(view.getByRole("button").getAttribute("aria-label")).toMatch(
      /^Worktree-agentin haara wt\/x, 0 edellä ja 0 jäljessä main-haaraa, 0 muuttunutta tiedostoa\./,
    );
    expect(view.getByRole("button").textContent).toContain("0");
    view.unmount();
  });

  it("folds named commits under totals and says when a list is cut", () => {
    const view = render(
      <Dialog aria-label="Git-tila">
        <GitStatusDetails {...props} detail={detail} />
      </Dialog>,
    );
    const ahead = view.getByText("Edellä main-haaraa").closest("details");
    expect(ahead?.querySelector(".ah-gs-count")?.textContent).toBe("25");
    expect(ahead?.textContent).toContain("Näytetään 20 uusinta 25:stä.");
    const incoming = view.getByText("Tulossa").closest("details");
    expect(incoming?.open).toBe(false);
    expect(incoming?.textContent).toContain("README: esimerkki");
    expect(
      view.getByText("AA-konflikti.txt").closest("li")?.textContent,
    ).toContain("Ristiriita");
    expect(view.getByText("+52").closest("li")?.textContent).toContain(
      "Uusi, ei seurannassa",
    );
    expect(view.container.textContent).toContain(
      "Etärepo haettu 25 min sitten",
    );
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
    expect(view.getByText("Kaikki commitit ovat main-haarassa.")).toBeTruthy();
    expect(view.queryByText("Edellä main-haaraa")).toBeNull();
    expect(view.getByRole("alert").textContent).toContain("SSH");
    fireEvent.click(view.getByRole("button", { name: "Hae etätiedot" }));
    expect(onFetch).toHaveBeenCalledOnce();
  });
});
