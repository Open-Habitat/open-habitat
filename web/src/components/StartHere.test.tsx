import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { goalDraft, StartHere } from "./StartHere";

const goal = {
  title: "A native goal",
  what: "A concrete result",
  steps: ["Read the context", "Check the result"],
  when: "A native use case",
  prompt: "An editable prompt",
};
describe("repository start page", () => {
  it("keeps the existing draft and puts a referenced native skill at its beginning", () => {
    expect(goalDraft(goal, "Existing draft.  ").text).toBe(
      "An editable prompt\n\nExisting draft.  \n\n",
    );
    expect(
      goalDraft({ ...goal, skill: "fixture" }, "Existing draft.").text,
    ).toBe("/skill:fixture An editable prompt\n\nExisting draft.\n\n");
    expect(goalDraft(goal, " ").text).toBe("An editable prompt\n\n");
  });
  it("normalizes trailing blank lines so typing starts in one new paragraph", () => {
    expect(
      goalDraft({ ...goal, prompt: "Request\n\n\n" }, "Earlier\n\n\n").text,
    ).toBe("Request\n\nEarlier\n\n");
    expect(goalDraft({ ...goal, skill: "native" }, "").text).toBe(
      "/skill:native An editable prompt\n\n",
    );
  });
  it.each([
    ["Read the sources.\n\n[kysymys]", "Read the sources."],
    ["[kysymys] Read the sources.", "Read the sources."],
    [
      "Read the sources.\n[kysymys]\nCite exact pages.",
      "Read the sources.\n\nCite exact pages.",
    ],
  ])(
    "moves one placeholder last and selects the brackets too: %s",
    (prompt, instructions) => {
      const prepared = goalDraft(
        { ...goal, prompt, skill: "native" },
        "Earlier\n\n",
      );
      expect(prepared.text).toBe(
        `/skill:native ${instructions}\n\nEarlier\n\n[kysymys]`,
      );
      expect(
        prepared.text.slice(prepared.selectionStart, prepared.selectionEnd),
      ).toBe("[kysymys]");
      expect(prepared.selectionEnd).toBe(prepared.text.length);
    },
  );
  it.each([
    "No marker",
    "[]",
    "[ ]",
    "[one] [two]",
    "[unfinished",
    "[outer [inner]]",
    "[two\nlines]",
    "[two\rlines]",
  ])("leaves absent or ambiguous markers literal: %s", (prompt) => {
    const prepared = goalDraft({ ...goal, prompt }, "");
    expect(prepared).toEqual({
      text: `${prompt}\n\n`,
      selectionStart: prompt.length + 2,
      selectionEnd: prompt.length + 2,
    });
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
    expect(onGoal).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("guide-start-top"));
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
