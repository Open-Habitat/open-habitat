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

  expect(view.queryByText(/second/)).toBeNull();

  fireEvent.click(screen.getByTestId("command-disclosure"));
  expect(view.getByText(/second/)).toBeTruthy();
  fireEvent.click(screen.getByTestId("output-expand-gap"));
  expect(view.getByText(/rivi 26/)).toBeTruthy();
  fireEvent.click(screen.getByTestId("output-external"));
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByTestId("output-edges"));
});
it("follows the end while running, then shows edges", () => {
  const view = render(<BashToolCard command="pwd" output={output} running />);
  expect(view.queryByTestId("output-expand-gap")).toBeNull();
  const pre = view.container.querySelector(
    ".ah-bash-window > pre",
  ) as HTMLPreElement;
  Object.defineProperty(pre, "scrollHeight", { value: 400 });
  view.rerender(
    <BashToolCard command="pwd" output={`${output}\nmore`} running />,
  );
  expect(pre.scrollTop).toBe(400);
  view.rerender(<BashToolCard command="pwd" output={`${output}\nmore`} />);
  expect(view.getByTestId("output-expand-gap")).toBeTruthy();
});
it("copies all output even when only edges are shown, and shows copy on short output", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  const view = render(<BashToolCard command="ls" output={output} />);
  fireEvent.click(within(view.container).getByTestId("output-copy"));
  expect(writeText).toHaveBeenCalledWith(output);
  view.rerender(<BashToolCard command="ls" output="a\nb" />);
  await waitFor(() =>
    expect(within(view.container).getByTestId("output-copy")).toBeTruthy(),
  );
});
it("copies the entire command beside it, including folded lines", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  render(<BashToolCard command={"cat <<EOF\nsecond\nEOF"} output="done" />);
  fireEvent.click(screen.getByTestId("command-copy"));
  expect(writeText).toHaveBeenCalledWith("cat <<EOF\nsecond\nEOF");
});
it("offers the own window for any long output, not only very long ones", () => {
  const sixteen = Array.from({ length: 16 }, (_, i) => `rivi ${i + 1}`).join(
    "\n",
  );
  render(<BashToolCard command="ls" output={sixteen} />);

  expect(screen.getByTestId("output-external")).toBeTruthy();
  const short = render(<BashToolCard command="ls" output={"a\nb"} />);
  expect(within(short.container).queryByTestId("output-external")).toBeNull();
  expect(within(short.container).getByTestId("output-copy")).toBeTruthy();
});
