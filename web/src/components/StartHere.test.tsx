import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { goalDraft, StartHere } from "./StartHere";

const goal = {
  title: "A native goal",
  when: "A native use case",
  prompt: "An editable prompt",
};
describe("repository start page", () => {
  it("keeps the existing draft and puts a referenced native skill at its beginning", () => {
    expect(goalDraft(goal, "Existing draft.  ")).toBe(
      "An editable prompt\n\nExisting draft.  ",
    );
    expect(goalDraft({ ...goal, skill: "fixture" }, "Existing draft.")).toBe(
      "/skill:fixture An editable prompt\n\nExisting draft.",
    );
    expect(goalDraft(goal, " ")).toBe("An editable prompt");
  });
  it("renders only authored goals and sanitized free text, and emits only draft intent", async () => {
    const onGoal = vi.fn();
    const props = { state: "ready" as const, onRetry: vi.fn(), onGoal };
    const view = render(
      <StartHere
        {...props}
        page={{
          title: "Repository title",
          body: "**Repository intro**\n\n<script>window.bad = true</script>\n\n[bad](javascript:alert(1))",
          goals: [goal],
        }}
      />,
    );
    expect(screen.getByTestId("start-page-title").textContent).toBe(
      "Repository title",
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("start-page-body").querySelector("strong")
          ?.textContent,
      ).toBe("Repository intro"),
    );
    expect(
      screen.getByTestId("start-page-body").querySelector("script"),
    ).toBeNull();
    expect(
      screen
        .getByTestId("start-page-body")
        .querySelector('[href^="javascript:"]'),
    ).toBeNull();
    fireEvent.click(screen.getByTestId("starting-goal"));
    expect(onGoal).toHaveBeenCalledWith(goal);
    view.rerender(<StartHere {...props} page={null} />);
    expect(screen.queryAllByTestId("starting-goal")).toHaveLength(0);
    expect(screen.queryByTestId("start-page-title")).toBeNull();
    expect(screen.getByTestId("start-page-hint")).not.toBeNull();
    view.rerender(
      <StartHere
        {...props}
        page={{ title: "Text only", body: "Repository text", goals: [] }}
      />,
    );
    expect(screen.queryByTestId("start-page-hint")).toBeNull();
    expect(screen.queryAllByTestId("starting-goal")).toHaveLength(0);
  });
});
