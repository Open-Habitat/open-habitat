import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { WorkerBrief } from "./Spinoffs";

// Jari 28.10.2026: the card led with Taskfleet's English run context and the
// main agent's task was behind "Näytä koko viesti".
it("shows the main agent's task first and Taskfleet's run context on request", () => {
  const view = render(
    <WorkerBrief
      text={
        "# Taskfleet run context (read first)\n\nYou are working inside taskfleet run `x`.\n\n---\n\nThe original task brief follows.\n\n\n# worker-presentation\n\nKorjaa muistutus."
      }
    />,
  );
  const task = view.getByTestId("user-content");
  expect(task.textContent).toContain("Korjaa muistutus.");
  expect(task.textContent).not.toContain("Taskfleet run context");
  const context = view.getByTestId("run-context") as HTMLDetailsElement;
  expect(context.open).toBe(false);
  expect(context.textContent).toContain("Taskfleetin ajo-ohje workerille");
  expect(context.textContent).toContain("You are working inside taskfleet run");
});

it("shows a brief without Taskfleet's run context as it is", () => {
  const view = render(<WorkerBrief text={"# Tehtävä\n\nLisää testit."} />);
  expect(view.getByTestId("user-content").textContent).toContain(
    "Lisää testit.",
  );
  expect(view.queryByTestId("run-context")).toBeNull();
});
