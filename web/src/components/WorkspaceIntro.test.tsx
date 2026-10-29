import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { firstParagraph, WorkspaceIntro } from "./WorkspaceIntro";

const goal = {
  title: "Korjaa havaittu virhe",
  what: "x",
  steps: ["s"],
  when: "Laskettu aika on väärä.",
  prompt: "Selvitä syy.\n\n[kuvaile havainto]",
};
const page = {
  title: "Aurinkokello",
  body: "Ensimmäinen **kappale**.\n\nToinen kappale.",
  goals: [goal],
};
const base = {
  state: "ready" as const,
  onRetry: () => {},
  onGoal: () => {},
  onCreatePage: () => {},
};

describe("workspace page Esittely", () => {
  beforeAll(async () => {
    await import("./MarkdownRenderer");
  }, 30_000);

  it("splits the description at its first blank line outside code", () => {
    expect(firstParagraph("Yksi\nrivi\n\nKaksi")).toEqual({
      first: "Yksi\nrivi",
      more: true,
    });
    expect(firstParagraph("Vain yksi\n\n\n")).toEqual({
      first: "Vain yksi",
      more: false,
    });
    expect(firstParagraph("```\na\n\nb\n```\n\nLoput").first).toBe(
      "```\na\n\nb\n```",
    );
  });

  it("shows the first paragraph, the rest on request, and the goals", async () => {
    const onGoal = vi.fn();
    render(<WorkspaceIntro {...base} page={page} onGoal={onGoal} />);
    expect(screen.getByTestId("landing-title").textContent).toBe(
      "Aurinkokello",
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("landing-body").querySelector("strong")?.textContent,
      ).toBe("kappale"),
    );
    expect(screen.getByTestId("landing-body").textContent).not.toContain(
      "Toinen",
    );
    fireEvent.click(screen.getByTestId("landing-more"));
    await waitFor(() =>
      expect(screen.getByTestId("landing-body").textContent).toContain(
        "Toinen",
      ),
    );
    expect(
      screen.getByTestId("landing-more").getAttribute("aria-expanded"),
    ).toBe("true");
    fireEvent.click(screen.getByTestId("starting-goal"));
    expect(onGoal).toHaveBeenCalledWith(goal);
  });

  it("offers to write a missing or outdated start page", () => {
    const onCreatePage = vi.fn();
    const view = render(
      <WorkspaceIntro {...base} page={null} onCreatePage={onCreatePage} />,
    );
    expect(screen.queryByTestId("landing")).toBeNull();
    fireEvent.click(screen.getByText("Luo aloitussivu"));
    expect(onCreatePage).toHaveBeenCalled();
    view.rerender(
      <WorkspaceIntro
        {...base}
        page={{ state: "needs_update" }}
        onCreatePage={onCreatePage}
      />,
    );
    expect(screen.getByTestId("landing-needs-update")).not.toBeNull();
    expect(screen.getByTestId("landing-create").textContent).toBe(
      "Päivitä aloitussivu",
    );
  });

  it("keeps goals inert while no conversation can start", () => {
    const onGoal = vi.fn();
    render(
      <WorkspaceIntro
        {...base}
        page={page}
        onGoal={onGoal}
        disabled="Luonti on käynnissä."
      />,
    );
    const card = screen.getByTestId("starting-goal");
    expect(card.getAttribute("aria-disabled")).toBe("true");
    expect(card.getAttribute("title")).toBe("Luonti on käynnissä.");
    fireEvent.click(card);
    expect(onGoal).not.toHaveBeenCalled();
  });

  it("draws nothing while loading", () => {
    const view = render(<WorkspaceIntro {...base} state="loading" />);
    expect(view.container.textContent).toBe("");
  });
});
