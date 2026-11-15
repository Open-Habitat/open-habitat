import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { checkStartPage, type StartPageCheck } from "../app/startPageCheck";
import DocumentPreviewFrame from "./DocumentPreviewFrame";

vi.mock("../app/startPageCheck", () => ({ checkStartPage: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(checkStartPage).mockReset();
});
const page = {
  title: "Draft workspace",
  body: "Introduction",
  goals: [
    {
      title: "Plan work",
      when: "Now",
      what: "Read together",
      steps: ["Read", "Discuss"],
      prompt: "Please plan",
      skill: "authored-skill",
    },
  ],
};
const source = "---\ntitle: Draft workspace\n---\nIntroduction";
const preview = (text = source, path = ".agents/start-page.md") => (
  <Suspense fallback={null}>
    <DocumentPreviewFrame
      kind="markdown"
      text={text}
      path={path}
      workspace="ws_example123"
      csrf="test-csrf"
    />
  </Suspense>
);

it("opens the checked page, keeps goal presses inert, and switches to generic and back", async () => {
  vi.mocked(checkStartPage).mockResolvedValue({ valid: true, page });
  render(preview());
  const special = await screen.findByTestId("start-page-preview");
  expect(special.textContent).toContain("authored-skill");
  const guide = screen.getByTestId("preview-goal-guides")
    .firstElementChild as HTMLElement;
  guide.scrollIntoView = vi.fn();
  fireEvent.click(special.querySelector(".ah-start-goal") as HTMLElement);
  expect(guide.scrollIntoView).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(guide);
  expect(checkStartPage).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByTestId("preview-renderer-toggle"));
  expect(screen.queryByTestId("start-page-preview")).toBeNull();
  await screen.findByTestId("markdown-frontmatter");
  fireEvent.click(screen.getByTestId("preview-renderer-toggle"));
  await screen.findByTestId("start-page-preview");
});
it("shows the generic document with a field path on decline and fails closed when unavailable", async () => {
  vi.mocked(checkStartPage).mockResolvedValue({
    valid: false,
    problems: [{ code: "invalid_goal_fields", path: "goals[1].prompt" }],
  });
  const view = render(preview());
  await screen.findByText("goals[1].prompt");
  expect(screen.queryByTestId("start-page-preview")).toBeNull();
  await screen.findByTestId("markdown-frontmatter");
  vi.mocked(checkStartPage).mockRejectedValue(
    new Error("native private detail"),
  );
  view.rerender(preview(`${source}\nchanged`));
  await waitFor(() => expect(checkStartPage).toHaveBeenCalledTimes(2));
  expect(view.container.textContent).not.toContain("native private detail");
  expect(screen.queryByTestId("start-page-preview")).toBeNull();
});
it("aborts and ignores an older check when the buffer changes", async () => {
  let first!: (value: StartPageCheck) => void;
  vi.mocked(checkStartPage)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          first = resolve;
        }),
    )
    .mockResolvedValueOnce({
      valid: false,
      problems: [{ code: "missing_frontmatter", path: "" }],
    });
  const view = render(preview());
  await waitFor(() => expect(checkStartPage).toHaveBeenCalledTimes(1));
  const signal = vi.mocked(checkStartPage).mock.calls[0][3];
  view.rerender(preview("not a start page"));
  await waitFor(() => expect(checkStartPage).toHaveBeenCalledTimes(2));
  expect(signal.aborted).toBe(true);
  first({ valid: true, page });
  await waitFor(() =>
    expect(screen.queryByTestId("start-page-preview")).toBeNull(),
  );
});
it("declines oversized content locally and never checks unrelated paths", async () => {
  const view = render(preview("é".repeat(16385)));
  expect(checkStartPage).not.toHaveBeenCalled();
  expect(screen.queryByTestId("preview-renderer-toggle")).toBeNull();
  view.rerender(preview(source, "docs/.agents/start-page.md"));
  await screen.findByTestId("markdown-frontmatter");
  expect(checkStartPage).not.toHaveBeenCalled();
});
