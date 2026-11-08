import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { Worktree, WorktreeOwner } from "../app/workspaceWorktrees";
import { type OwnerConversation, WorktreeAttention } from "./WorktreeAttention";

// Jari's worktrees on 8.11.2026 (proto-worktree-list-meaning): a working
// worker, an interactive worker of an archived conversation waiting for its
// decision, an ended worker's leftover and two helpers whose rounds are all
// merged.
const now = new Date(2030, 0, 1, 12, 0).getTime();
const live: OwnerConversation = {
  id: "pi:11111111-1111-4111-8111-111111111111",
  title: "Worktree-lista selväksi",
  href: "/workspaces/ws_example123?conversation=pi:11111111-1111-4111-8111-111111111111",
  archived: false,
};
const trials: OwnerConversation = {
  id: "pi:22222222-2222-4222-8222-222222222222",
  title: "Avustajien kokeilu",
  href: "/workspaces/ws_example123?conversation=pi:22222222-2222-4222-8222-222222222222",
  archived: true,
};
const conversations = new Map([live, trials].map((c) => [c.id, c]));

let n = 0;
const wt = (
  name: string,
  state: Worktree["state"],
  owner?: Omit<WorktreeOwner, "run_id">,
  over: Partial<Worktree> = {},
): Worktree => ({
  workspace_id: "ws_example123",
  workspace_name: "example",
  entry: name,
  name,
  path: `~/src/example__worktrees/${name}`,
  state,
  branch: name,
  base: "main",
  changed: 0,
  untracked: 0,
  ignored: 0,
  ignored_paths: [],
  unreachable_head: false,
  size_bytes: 445 * 1024 * 1024,
  size_complete: true,
  blockers: owner && owner.state !== "ended" ? [{ kind: "taskfleet_run" }] : [],
  actions: owner && owner.state !== "ended" ? [] : ["remove"],
  observation_token: `wt_${String(++n).padStart(24, "A")}`,
  ...(owner
    ? { owner: { run_id: "01m53433zdhmcc9q1spepb30gz", ...owner } }
    : {}),
  ...over,
});
const rows = [
  wt("wt-list", "dirty", {
    role: "worker",
    title: "Worktree-listan prototyyppi",
    state: "working",
    conversation_id: live.id,
  }),
  wt(
    "wt-decide",
    "unmerged",
    {
      role: "worker",
      title: "Testi: interaktiivinen odottaa",
      state: "waiting",
      conversation_id: trials.id,
    },
    { ahead: 1 },
  ),
  wt(
    "wt-leftover",
    "unmerged",
    {
      role: "ended",
      title: "Testi: headless päättyy",
      state: "ended",
      conversation_id: trials.id,
    },
    { ahead: 1 },
  ),
  wt("wt-testaaja", "merged", {
    role: "helper",
    name: "testaaja",
    state: "waiting",
    conversation_id: trials.id,
    releases_at: new Date(2030, 0, 1, 19, 25).toISOString(),
  }),
  wt("wt-avustaja", "merged", {
    role: "helper",
    name: "testi-avustaja",
    state: "waiting",
    conversation_id: trials.id,
    releases_at: new Date(2030, 0, 2, 7, 5).toISOString(),
  }),
];

function show(
  worktrees: Worktree[],
  handlers: { onAction?: () => void; onOpen?: () => void } = {},
) {
  return render(
    <MemoryRouter>
      <WorktreeAttention
        worktrees={worktrees}
        conversation={(id) => conversations.get(id)}
        now={now}
        onAction={handlers.onAction ?? (() => {})}
        onOpen={handlers.onOpen ?? (() => {})}
      />
    </MemoryRouter>,
  );
}
const row = (name: string) => screen.getByTestId(`worktree-row-${name}`);

describe("worktree attention", () => {
  it("shows only the rows that need the person, each with its one action", () => {
    const onAction = vi.fn();
    const onOpen = vi.fn();
    show(rows, { onAction, onOpen });
    const shown = within(screen.getByTestId("worktree-attention"))
      .getAllByRole("listitem")
      .map((r) => r.dataset.testid);
    expect(shown).toEqual([
      "worktree-row-wt-decide",
      "worktree-row-wt-leftover",
    ]);

    // The waiting worker of an archived conversation leads to restoring it.
    const decide = row("wt-decide");
    expect(decide.textContent).toContain("Testi: interaktiivinen odottaa");
    expect(decide.textContent).toContain("arkistoitu");
    expect(decide.textContent).toContain("ennen kuin palautat sen");
    expect(within(decide).queryByTestId("worktree-remove")).toBeNull();
    fireEvent.click(
      within(decide).getByTestId("worktree-restore-conversation"),
    );
    expect(onOpen).toHaveBeenCalledWith(trials);

    // The leftover is the only row Habitat removes; its branch keeps a commit.
    const leftover = row("wt-leftover");
    expect(leftover.textContent).toContain("worker, päättynyt");
    expect(leftover.textContent).toContain("Sen commit jää haaraan");
    fireEvent.click(within(leftover).getByTestId("worktree-remove"));
    expect(onAction).toHaveBeenCalledWith(rows[2], "remove");

    // The rest is one line until opened.
    const rest = screen.getByTestId("worktree-rest");
    expect(rest.textContent).toBe(
      "3 muuta hoituu ilman sinua · testaaja ja testi-avustaja vapautuvat itsestään, Worktree-listan prototyyppi on työssä",
    );
    expect(screen.queryByTestId("worktree-rest-list")).toBeNull();
    fireEvent.click(rest);
    const helper = row("wt-testaaja");
    expect(within(helper).getByTestId("worktree-releases").textContent).toBe(
      "Vapautuu itsestään tänään klo 19.25.",
    );
    expect(
      within(row("wt-avustaja")).getByTestId("worktree-releases").textContent,
    ).toBe("Vapautuu itsestään huomenna klo 7.05.");
    expect(within(helper).queryByRole("button", { name: /Poista/ })).toBeNull();
  });

  it("keeps Git's names behind Git details", () => {
    show(rows);
    const leftover = row("wt-leftover");
    expect(leftover.textContent).not.toContain("~/src/example__worktrees");
    fireEvent.click(within(leftover).getByTestId("worktree-git-toggle"));
    const facts = within(leftover).getByTestId("worktree-git").textContent;
    expect(facts).toContain("~/src/example__worktrees/wt-leftover");
    expect(facts).toContain("1 commit, joita ei ole haarassa main");
    expect(facts).toContain("01m53433zdhmcc9q1spepb30gz");
  });

  it("leaves a waiting worker of an active conversation to its agent", () => {
    const active = wt("wt-active", "unmerged", {
      role: "worker",
      title: "Tarkistus",
      state: "waiting",
      conversation_id: live.id,
    });
    show([active]);
    expect(screen.getByTestId("worktree-attention-empty").textContent).toBe(
      " Mikään ei tarvitse sinua.",
    );
    expect(screen.getByTestId("worktree-rest").textContent).toContain(
      "Tarkistus odottaa agenttia",
    );
  });

  it("promises release only for a helper whose worktree is merged", () => {
    show([
      wt("wt-kesken", "unmerged", {
        role: "helper",
        name: "kesken",
        state: "waiting",
        conversation_id: trials.id,
      }),
    ]);
    const rest = screen.getByTestId("worktree-rest").textContent;
    expect(rest).toContain("kesken odottaa agenttia");
    expect(rest).not.toContain("vapautuu");
  });

  it("names a worktree no run owns by its directory", () => {
    show([wt("handmade", "merged")]);
    const r = row("handmade");
    expect(r.textContent).toContain("Mikään agentti ei pidä tätä worktreetä.");
    expect(within(r).getByTestId("worktree-remove")).toBeTruthy();
  });
});
