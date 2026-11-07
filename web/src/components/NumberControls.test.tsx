import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NumberStepper } from "./NumberStepper";
import { ScaleSlider } from "./ScaleSlider";

describe("ScaleSlider", () => {
  it("moves between the stops and commits once the key is released", () => {
    const onChange = vi.fn();
    render(
      <ScaleSlider
        testId="s"
        label="Viive"
        value={100}
        stops={[60, 90, 120, 240]}
        format={String}
        onChange={onChange}
      />,
    );
    const range = screen.getByRole("slider") as HTMLInputElement;
    // A stored value between stops sits on the nearest one.
    expect(range.value).toBe("1");
    fireEvent.change(range, { target: { value: "3" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(range.getAttribute("aria-valuetext")).toBe("240");
    fireEvent.keyUp(range);
    expect(onChange).toHaveBeenCalledWith(240);
  });
});

describe("NumberStepper", () => {
  it("holds a typed value within its bounds and steps by its step", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <NumberStepper
        testId="n"
        label="Viestit"
        value={8}
        min={4}
        max={128}
        step={4}
        onChange={onChange}
      />,
    );
    const input = screen.getByTestId("n-input");
    fireEvent.change(input, { target: { value: "500" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith(128);
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.blur(input);
    expect((input as HTMLInputElement).value).toBe("8");
    fireEvent.click(screen.getByTestId("n-less"));
    expect(onChange).toHaveBeenLastCalledWith(4);
    rerender(
      <NumberStepper
        testId="n"
        label="Viestit"
        value={4}
        min={4}
        max={128}
        step={4}
        onChange={onChange}
      />,
    );
    expect((screen.getByTestId("n-less") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
  it("reads digit groups as one number and a decimal comma as a decimal", () => {
    const onChange = vi.fn();
    render(
      <NumberStepper
        testId="n"
        label="Raja"
        value={8}
        min={1}
        max={100000}
        onChange={onChange}
      />,
    );
    const input = screen.getByTestId("n-input");
    for (const [typed, read] of [
      ["16 000", 16000],
      ["16,000", 16000],
      ["9,5", 10],
      ["20", 20],
    ] as const) {
      fireEvent.change(input, { target: { value: typed } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onChange).toHaveBeenLastCalledWith(read);
    }
  });
});
