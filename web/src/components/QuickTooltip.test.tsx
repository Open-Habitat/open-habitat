import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ControlButton, Segmented } from "./ControlElements";

const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));
afterEach(() => {
  cleanup();
  tick(2000);
  vi.useRealTimers();
});
it("warms up briefly, transfers immediately, and dismisses with Escape", () => {
  vi.useFakeTimers();
  render(
    <>
      <ControlButton size="row" aria-label="First" data-testid="first">
        ×
      </ControlButton>
      <ControlButton size="row" aria-label="Second" data-testid="second">
        +
      </ControlButton>
    </>,
  );
  const first = screen.getByTestId("first");
  expect(first.hasAttribute("title")).toBe(false);
  fireEvent.pointerMove(document.body, { pointerType: "mouse" });
  fireEvent.pointerEnter(first, { pointerType: "mouse" });
  tick(200);
  expect(screen.queryByRole("tooltip")).toBeNull();
  tick(50);
  expect(screen.getByRole("tooltip")).toBeTruthy();
  fireEvent.pointerLeave(first, { pointerType: "mouse" });
  fireEvent.pointerEnter(screen.getByTestId("second"), {
    pointerType: "mouse",
  });
  tick(0);
  expect(screen.getByRole("tooltip")).toBeTruthy();
  fireEvent.keyDown(document, { key: "Escape" });
  tick(0);
  expect(screen.queryByRole("tooltip")).toBeNull();
});
it("explains a disabled action without enabling it and ignores touch", () => {
  vi.useFakeTimers();
  const action = vi.fn();
  render(
    <ControlButton
      size="row"
      aria-label="Unavailable"
      title="Blocked"
      isDisabled
      onPress={action}
    >
      ×
    </ControlButton>,
  );
  const button = screen.getByRole("button");
  fireEvent.pointerEnter(button, { pointerType: "touch" });
  tick(500);
  expect(screen.queryByRole("tooltip")).toBeNull();
  fireEvent.pointerLeave(button, { pointerType: "touch" });
  fireEvent.pointerEnter(button, { pointerType: "mouse" });
  tick(250);
  expect(screen.getByRole("tooltip")).toBeTruthy();
  fireEvent.click(button);
  expect(action).not.toHaveBeenCalled();
  expect((button as HTMLButtonElement).disabled).toBe(true);
});

it("shows icon-only segment help on keyboard focus without waiting", () => {
  vi.useFakeTimers();
  render(
    <Segmented
      label="Choice"
      options={[{ id: "one", label: "One", iconOnly: true, icon: "+" }]}
      value="one"
      onChange={() => {}}
    />,
  );
  fireEvent.keyDown(document, { key: "Tab" });
  act(() => screen.getByRole("button").focus());
  expect(screen.getByRole("tooltip")).toBeTruthy();
  act(() => screen.getByRole("button").blur());
  expect(screen.queryByRole("tooltip")).toBeNull();
});
