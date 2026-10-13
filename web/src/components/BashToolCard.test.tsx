import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BashToolCard } from "./BashToolCard";

const output = Array.from({ length: 53 }, (_, i) => `rivi ${i + 1}`).join("\n");
it("shows command first line and output edges, expands each independently", () => {
  const view = render(
    <BashToolCard command={"cat <<EOF\nsecond\nEOF"} output={output} />,
  );
  expect(view.getByText(/^3 riviä/)).toBeTruthy();
  expect(view.queryByText(/second/)).toBeNull();
  expect(view.getByText(/43 riviä välistä/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Näytä koko komento" }));
  expect(view.getByText(/second/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /43 riviä välistä/ }));
  expect(view.getByText(/rivi 26/)).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Avaa omassa ikkunassa" }),
  );
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Alku ja loppu" }));
});
it("follows the end while running, then shows edges", () => {
  const view = render(<BashToolCard command="pwd" output={output} running />);
  expect(view.queryByText(/43 riviä välistä/)).toBeNull();
  const pre = view.container.querySelector(
    ".ah-bash-window > pre",
  ) as HTMLPreElement;
  Object.defineProperty(pre, "scrollHeight", { value: 400 });
  view.rerender(
    <BashToolCard command="pwd" output={`${output}\nmore`} running />,
  );
  expect(pre.scrollTop).toBe(400);
  view.rerender(<BashToolCard command="pwd" output={`${output}\nmore`} />);
  expect(view.getByText(/44 riviä välistä/)).toBeTruthy();
});
it("copies all output even when only edges are shown, and shows copy on short output", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  const view = render(<BashToolCard command="ls" output={output} />);
  fireEvent.click(
    within(view.container).getByRole("button", { name: "Kopioi tuloste" }),
  );
  expect(writeText).toHaveBeenCalledWith(output);
  view.rerender(<BashToolCard command="ls" output="a\nb" />);
  await waitFor(() =>
    expect(
      within(view.container).getByRole("button", { name: "Tuloste kopioitu" }),
    ).toBeTruthy(),
  );
});
it("copies the entire command beside it, including folded lines", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  render(<BashToolCard command={"cat <<EOF\nsecond\nEOF"} output="done" />);
  fireEvent.click(screen.getByRole("button", { name: "Kopioi komento" }));
  expect(writeText).toHaveBeenCalledWith("cat <<EOF\nsecond\nEOF");
});
it("offers the own window for any long output, not only very long ones", () => {
  const sixteen = Array.from({ length: 16 }, (_, i) => `rivi ${i + 1}`).join(
    "\n",
  );
  render(<BashToolCard command="ls" output={sixteen} />);
  expect(screen.getByText(/6 riviä välistä/)).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Avaa omassa ikkunassa" }),
  ).toBeTruthy();
  const short = render(<BashToolCard command="ls" output={"a\nb"} />);
  expect(
    within(short.container).queryByRole("button", {
      name: "Avaa omassa ikkunassa",
    }),
  ).toBeNull();
  expect(
    within(short.container).getByRole("button", { name: "Kopioi tuloste" }),
  ).toBeTruthy();
});
