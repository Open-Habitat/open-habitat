import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import type { StartGoal } from "./composerReads";
import { GuideHeaderControl, ViewHost } from "./ViewHost";

it("offers a recovered guided goal but no toggle for a recovered guide-free goal", () => {
  const goal: StartGoal = {
    title: "Continue",
    prompt: "Continue the work.",
    when: "After a pause",
    what: "Progress",
    steps: ["Continue"],
  };
  // No in-tab selection: these props are what native history recovery supplies.
  const recovered = (value: StartGoal) => (
    <ViewHost>
      <GuideHeaderControl owner="recovered-goal" goal={value} page="Example" />
    </ViewHost>
  );
  const view = render(recovered(goal));
  expect(view.getByTestId("guide-toggle")).toBeTruthy();
  view.rerender(
    recovered({ title: goal.title, prompt: goal.prompt, guide: "none" }),
  );
  expect(view.queryByTestId("guide-toggle")).toBeNull();
  expect(view.queryByTestId("guide-panel")).toBeNull();
});
