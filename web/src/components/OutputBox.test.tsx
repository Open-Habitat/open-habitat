import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { OutputBox } from "./OutputBox";

const text = Array.from(
  { length: 18 },
  (_, i) => `line ${i} content ${"x".repeat(70)}`,
).join("\n");
it("groups view selection separately from jumps and updates disabled state on scroll", () => {
  const { container } = render(<OutputBox text={text} />);
  expect(
    screen
      .getByRole("button", { name: "Alku ja loppu" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Vieritettävä ikkuna" }));
  const pre = container.querySelector(".ah-output-scroll") as HTMLPreElement;
  Object.defineProperties(pre, {
    scrollHeight: { value: 300 },
    clientHeight: { value: 100 },
  });
  fireEvent.scroll(pre);
  expect(
    screen.getByRole("button", { name: "Alkuun" }).hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen.getByRole("button", { name: "Loppuun" }).hasAttribute("disabled"),
  ).toBe(false);
  pre.scrollTop = 200;
  fireEvent.scroll(pre);
  expect(
    screen.getByRole("button", { name: "Loppuun" }).hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen.getByRole("button", { name: "Alkuun" }).hasAttribute("disabled"),
  ).toBe(false);
  expect(
    screen
      .getByRole("button", { name: "Vieritettävä ikkuna" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Rivitä pitkät rivit" }));
  expect(container.querySelector(".ah-output-wrap")).toBeTruthy();
});
it("copies the entire text even in edges view", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  render(<OutputBox text={text} copyLabel="Kopioi koodi" />);
  fireEvent.click(screen.getByRole("button", { name: "Kopioi koodi" }));
  expect(writeText).toHaveBeenCalledWith(text);
});
