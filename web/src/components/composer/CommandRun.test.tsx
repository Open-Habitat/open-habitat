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
  expect(view.container.textContent).not.toContain("Agentti näkee");
  details.open = false;
  fireEvent(details, new Event("toggle"));
  view.rerender(
    <CommandRun {...props} state="running" stopping output="more output" />,
  );
  expect(details.open).toBe(false);
  expect(view.container.textContent).toContain("Keskeytetään…");
  view.rerender(<CommandRun {...props} state="cancelled" />);
  expect(details.open).toBe(false);
  expect(view.container.textContent).toContain("pysäytetty");
  expect(view.container.textContent).not.toContain("Keskeytetään…");
});

it("distinguishes an unknown result from a confirmed failure or a command that never ran", () => {
  const props = { command: "make", excludeFromContext: false, output: "" };
  const view = render(<CommandRun {...props} state="uncertain" />);
  expect(view.container.textContent).toContain("tulos ei tiedossa");
  expect(view.container.textContent).toContain("ei ajeta uudelleen");
  view.rerender(<CommandRun {...props} state="finished" exitCode={2} />);
  expect(view.container.textContent).toContain("paluuarvo 2");
  expect(view.container.textContent).not.toContain("ei ajeta uudelleen");
  view.rerender(<CommandRun {...props} state="not_started" />);
  expect(view.container.textContent).toContain("ei ajettu");
});
