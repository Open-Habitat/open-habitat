import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { CommandRun } from "./CommandRun";

it("keeps output view state across command disclosure and live completion", () => {
  const output = Array.from({ length: 30 }, (_, i) => `native line ${i}`).join(
    "\n",
  );
  const props = { command: "make", output, excludeFromContext: false };
  const view = render(<CommandRun {...props} state="running" />);
  fireEvent.click(screen.getByTestId("output-expand"));
  expect(view.container.textContent).toContain("native line 15");
  const toggle = screen.getByTestId("command-run-toggle");
  const panel = document.getElementById(
    toggle.getAttribute("aria-controls") ?? "",
  );
  fireEvent.click(toggle);
  expect(panel?.hidden).toBe(true);
  fireEvent.click(toggle);
  view.rerender(<CommandRun {...props} state="finished" exitCode={0} />);
  expect(panel?.hidden).toBe(false);
  expect(screen.getByTestId("output-expand").getAttribute("aria-pressed")).toBe(
    "true",
  );
  expect(screen.getByTestId("status-mark").getAttribute("data-kind")).toBe(
    "success",
  );
  view.rerender(<CommandRun {...props} state="finished" exitCode={2} />);
  expect(screen.getByTestId("status-mark").getAttribute("data-kind")).toBe(
    "error",
  );
});

it("preserves a person's collapsed disclosure through stopping and cancellation, rendering native text inertly", () => {
  const props = {
    command: "echo '<script>text</script>'",
    excludeFromContext: true,
    output: "<img src=x onerror=alert(1)>",
  };
  const view = render(<CommandRun {...props} state="running" />);
  const toggle = screen.getByTestId("command-run-toggle");
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(view.container.querySelector("script, img")).toBeNull();
  fireEvent.click(toggle);
  view.rerender(
    <CommandRun {...props} state="running" stopping output="more output" />,
  );
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  view.rerender(<CommandRun {...props} state="cancelled" />);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
});
