import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ChoiceMenu } from "./ChoiceMenu";

it("does not open or write while the value is unavailable", () => {
  const change = vi.fn();
  render(
    <ChoiceMenu
      label="Choice"
      data-testid="choice"
      value="a"
      options={[
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ]}
      isDisabled
      onChange={change}
    />,
  );
  const trigger = screen.getByTestId("choice");
  fireEvent.click(trigger);
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  expect(screen.queryByRole("menu")).toBeNull();
  expect(change).not.toHaveBeenCalled();
});
