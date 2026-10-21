import { fireEvent, render } from "@testing-library/react";
import { expect, it } from "vitest";
import { CommandRun } from "./CommandRun";

it("keeps output open by default and preserves a person's disclosure across streaming and completion", () => {
  const props = {
    command: "echo '<script>text</script>'",
    excludeFromContext: true,
    output: "<img src=x onerror=alert(1)>",
  };
  const view = render(<CommandRun {...props} state="running" />);
  const details = view.container.querySelector("details");
  if (!details) throw new Error("missing command disclosure");
  expect(details.open).toBe(true);
  expect(view.container.querySelector("script, img")).toBeNull();

  details.open = false;
  fireEvent(details, new Event("toggle"));
  view.rerender(
    <CommandRun {...props} state="running" stopping output="more output" />,
  );
  expect(details.open).toBe(false);

  view.rerender(<CommandRun {...props} state="cancelled" />);
  expect(details.open).toBe(false);
});
