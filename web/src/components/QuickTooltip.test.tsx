import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ControlButton, Segmented } from "./ControlElements";
import { TooltipButton } from "./QuickTooltip";

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
it("does not bring back help that closed while the next one replaced it", () => {
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
  fireEvent.pointerMove(document.body, { pointerType: "mouse" });
  fireEvent.pointerEnter(first, { pointerType: "mouse" });
  tick(250);
  expect(screen.getByRole("tooltip").textContent).toBe("First");
  // A slow page renders the press that closes the first help and the
  // warmed-up second help in one batch.
  act(() => {
    fireEvent.pointerDown(first, { pointerType: "mouse" });
    fireEvent.pointerLeave(first, { pointerType: "mouse" });
    fireEvent.pointerEnter(screen.getByTestId("second"), {
      pointerType: "mouse",
    });
  });
  expect(screen.getByRole("tooltip").textContent).toBe("Second");
  first.focus();
  fireEvent.keyDown(first, { key: "Escape" });
  tick(0);
  expect(screen.queryByRole("tooltip")).toBeNull();
});
it("lets Escape in a focused field through while hover help is open", () => {
  vi.useFakeTimers();
  const stop = vi.fn();
  render(
    <>
      <ControlButton size="row" aria-label="Refresh" data-testid="refresh">
        ↻
      </ControlButton>
      <textarea
        data-testid="field"
        onKeyDown={(event) => event.key === "Escape" && stop()}
      />
    </>,
  );
  fireEvent.pointerMove(document.body, { pointerType: "mouse" });
  fireEvent.pointerEnter(screen.getByTestId("refresh"), {
    pointerType: "mouse",
  });
  tick(250);
  expect(screen.getByRole("tooltip")).toBeTruthy();
  const field = screen.getByTestId("field");
  field.focus();
  fireEvent.keyDown(field, { key: "Escape" });
  expect(stop).toHaveBeenCalledTimes(1);
  tick(0);
  expect(screen.queryByRole("tooltip")).toBeNull();
});
it.each(["aria", "native"])(
  "explains a disabled %s action without enabling it and ignores touch",
  (kind) => {
    vi.useFakeTimers();
    const action = vi.fn();
    render(
      kind === "aria" ? (
        <ControlButton
          size="row"
          aria-label="Unavailable"
          title="Blocked"
          isDisabled
          onPress={action}
        >
          ×
        </ControlButton>
      ) : (
        <TooltipButton
          title="Blocked"
          aria-label="Unavailable"
          disabled
          onClick={action}
        >
          ×
        </TooltipButton>
      ),
    );
    const button = screen.getByRole("button");
    fireEvent.pointerEnter(button, { pointerType: "touch" });
    tick(500);
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.pointerLeave(button, { pointerType: "touch" });
    fireEvent.pointerMove(document.body, { pointerType: "mouse" });
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    tick(250);
    const trigger = screen.getByRole("group");
    expect(trigger.getAttribute("aria-describedby")).toBe(
      screen.getByRole("tooltip").id,
    );
    fireEvent.pointerLeave(button, { pointerType: "mouse" });
    tick(100);
    fireEvent.keyDown(document, { key: "Tab" });
    act(() => trigger.focus());
    expect(trigger.getAttribute("aria-describedby")).toBe(
      screen.getByRole("tooltip").id,
    );
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.keyDown(trigger, { key: " " });
    fireEvent.click(button);
    expect(action).not.toHaveBeenCalled();
    expect((button as HTMLButtonElement).disabled).toBe(true);
  },
);

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
