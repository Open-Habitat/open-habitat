import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, it } from "vitest";
import type { Spinoff } from "../app/spinoffs";
import { workSummary } from "../app/WorkerGitStatus";
import { WorkerView } from "./Spinoffs";
import type { WorkerGitView } from "./WorkerHeader";

// worker-header-status (Jari 13.11.2026, direction 1 "Otsikkorivillä"): the
// worker's Git, pull request, context and model are buttons on the title
// row; unknown is a "?" with a sentence, never an empty chip or zero ring.

const run: Spinoff = {
  run_id: "01m7examplerun000000000000pr",
  title: "Reittihaun korkeuserot",
  created_at: "2026-11-13T09:00:00Z",
  state: "working",
  summary: "",
  preserved: false,
  branch: "",
  worktree: "/home/example/src/retkiopas__worktrees/wt-q8n",
  source_branch: "main",
  harness: "pi",
  profile: "pi-codex",
  git_workspace: "ws_examplePlace01",
};

function view(props: Partial<Parameters<typeof WorkerView>[0]>) {
  return render(
    <MemoryRouter>
      <WorkerView
        run={run}
        items={[]}
        stale={false}
        parentTitle="Kevään julkaisu"
        workspaceLabel="retkiopas"
        workspaceHref="/workspaces/ws_example123"
        onParent={() => {}}
        {...props}
      />
    </MemoryRouter>,
  );
}

it("puts the worker's Git, pull request, context and model on the title row", () => {
  const work = {
    run_id: run.run_id,
    git: "available" as const,
    dirty_count: 2,
    ahead: 3,
    behind: 0,
    pull_request_state: "found" as const,
    pull_request: {
      number: 418,
      state: "open" as const,
      url: "https://github.com/example/retkiopas/pull/418",
      checks: { passed: 4, failed: 0, pending: 2 },
    },
  };
  const facts = workSummary(run, work, "wt/q8n");
  expect(facts?.base).toMatchObject({ name: "main", ahead: 3, behind: 0 });
  const git: WorkerGitView = {
    state: "known",
    facts: facts as NonNullable<typeof facts>,
    merged: false,
    open: false,
    onOpenChange: () => {},
    details: {
      loading: false,
      readError: false,
      fetching: false,
      onFetch: () => {},
    },
  };
  const v = view({
    work,
    git,
    context: { phase: "known", tokens: 352_000, window: 400_000 },
    model: { name: "GPT-5.5", words: "GPT-5.5 · High" },
  });
  const row = v.container.querySelector(".ah-agent-topline");
  const chip = row?.querySelector('[data-testid="git-chip"]');
  expect(chip?.hasAttribute("data-unknown")).toBe(false);
  expect(chip?.getAttribute("data-changes")).toBe("2");
  expect(chip?.getAttribute("data-base-ahead")).toBe("3");
  const pr = row?.querySelector('[data-testid="worker-pr"]');
  expect(pr?.getAttribute("href")).toBe(work.pull_request.url);
  expect(pr?.textContent).toContain("PR #418");
  // Git, then the pull request, then context and model, as in a conversation.
  const order = [...(row?.children ?? [])]
    .map((el) => el.getAttribute("data-testid"))
    .filter((id) =>
      ["git-chip", "worker-pr", "context-ring", "worker-model"].includes(
        id ?? "",
      ),
    );
  expect(order).toEqual([
    "git-chip",
    "worker-pr",
    "context-ring",
    "worker-model",
  ]);
  const ring = row?.querySelector('[data-testid="context-ring"]');
  expect(ring?.getAttribute("data-percent")).toBe("88");
  expect(ring?.getAttribute("data-level")).toBe("near");
  // Read only: the ring opens the worker's details, not a context page.
  expect(ring?.getAttribute("aria-label")).toContain("Avaa workerin tiedot.");
  expect(ring?.hasAttribute("aria-pressed")).toBe(false);
  const model = row?.querySelector('[data-testid="worker-model"]');
  expect(model?.textContent).toBe("GPT-5.5");
  expect(model?.getAttribute("title")).toBe("GPT-5.5 · High");
  // The work-sentence line is gone; the band keeps the rest.
  expect(v.queryByTestId("worker-work")).toBeNull();
  expect(v.getByTestId("worker-band").textContent).toContain("Pi · pi-codex");
  // Model and ring are read only: they open the worker's details.
  if (model) fireEvent.click(model);
  const details = v.container.querySelector(".ah-agent-header")?.textContent;
  expect(details).toContain("GPT-5.5 · High");
  expect(details).toContain("PR #418 · avoin");
});

it("says why a fact is unknown with a '?' in the same control", () => {
  const claude = {
    ...run,
    harness: "claude" as const,
    profile: "prototype-opus",
    git_workspace: undefined,
  };
  const v = view({ run: claude, git: { state: "unknown" } });
  const chip = v.getByTestId("git-chip");
  expect(chip.hasAttribute("data-unknown")).toBe(true);
  expect(chip.textContent).toBe("?");
  expect(chip.getAttribute("aria-label")).toContain(
    "Git-tilaa ei saatu luettua",
  );
  const ring = v.getByTestId("context-ring");
  expect(ring.hasAttribute("data-unknown")).toBe(true);
  expect(ring.textContent).toBe("?");
  expect(ring.getAttribute("aria-label")).toContain("Claude Coden");
  // The phone's facts line says "?" rather than drawing an empty ring.
  expect(ring.getAttribute("data-phone-summary")).toBe("?");
  const model = v.getByTestId("worker-model");
  expect(model.textContent).toBe("Malli ?");
  expect(model.getAttribute("title")).toContain("prototype-opus");
  expect(v.queryByTestId("worker-pr")).toBeNull();
  // The "?" opens the worker's details, where the same sentences stand.
  fireEvent.click(chip);
  expect(v.container.querySelector(".ah-agent-header")?.textContent).toContain(
    "Habitat ei vielä lue Claude Coden käyttötietoja",
  );
});

it("reads a kept branch's counts as the chip, with nothing uncommitted", () => {
  const ended = { ...run, state: "unmerged" as const, branch: "wt/q8n" };
  expect(
    workSummary(
      ended,
      {
        run_id: run.run_id,
        git: "available",
        ahead: 1,
        behind: 4,
        pull_request_state: "none",
      },
      "fallback",
    ),
  ).toEqual({
    branch: "wt/q8n",
    dirty_count: 0,
    base: {
      name: "main",
      ref: "main",
      source: "recorded",
      ahead: 1,
      behind: 4,
      merged: false,
    },
  });
  expect(
    workSummary(
      ended,
      { run_id: run.run_id, git: "unavailable", pull_request_state: "unknown" },
      "x",
    ),
  ).toBeUndefined();
});
