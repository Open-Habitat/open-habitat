import { describe, expect, it, vi } from "vitest";
import { terminalKeyHandler } from "./terminalKeyboard";

function press(
  mac: boolean,
  init: KeyboardEventInit,
  selected?: string,
  reported?: string,
) {
  const event = new KeyboardEvent("keydown", {
    code: "KeyC",
    cancelable: true,
    ...init,
  });
  const write = vi.fn();
  const clear = vi.fn();
  const handled = terminalKeyHandler(
    event,
    {
      hasSelection: () => selected !== undefined,
      text: () => selected ?? reported,
      clear,
    },
    write,
    mac,
  );
  return { handled, event, write, clear };
}

it.each([
  ["canvas", "canvas", "tmux"],
  ["tmux", undefined, "tmux"],
  [undefined, undefined, undefined],
])(
  "Mac Cmd+C copies %s without sending input",
  (expected, selected, reported) => {
    const result = press(true, { metaKey: true }, selected, reported);
    expect(result.handled).toBe(false);
    expect(result.event.defaultPrevented).toBe(true);
    if (expected) expect(result.write).toHaveBeenCalledWith(expected);
    else expect(result.write).not.toHaveBeenCalled();
  },
);

it("leaves Shift+Cmd+C to the browser even with a selection", () => {
  const result = press(
    true,
    { metaKey: true, shiftKey: true },
    "canvas",
    "tmux",
  );
  expect(result.handled).toBe(false);
  expect(result.event.defaultPrevented).toBe(false);
  expect(result.write).not.toHaveBeenCalled();
  expect(result.clear).not.toHaveBeenCalled();
});

it("does not treat Meta+C as copy on other platforms", () => {
  const result = press(false, { metaKey: true }, "canvas");
  expect(result.event.defaultPrevented).toBe(false);
  expect(result.write).not.toHaveBeenCalled();
});

describe.each([true, false])("platform mac=%s", (mac) => {
  it("Ctrl+C interrupts without an xterm selection, even with reported text", () => {
    const result = press(mac, { ctrlKey: true }, undefined, "tmux");
    expect(result.handled).toBe(true);
    expect(result.event.defaultPrevented).toBe(false);
    expect(result.write).not.toHaveBeenCalled();
  });
  it("Ctrl+C copies an xterm selection", () => {
    const result = press(mac, { ctrlKey: true }, "canvas", "tmux");
    expect(result.handled).toBe(false);
    expect(result.write).toHaveBeenCalledWith("canvas");
    expect(result.clear).toHaveBeenCalledOnce();
  });
  it.each([undefined, "tmux"])(
    "Ctrl+Shift+C never interrupts (%s)",
    (reported) => {
      const result = press(
        mac,
        { ctrlKey: true, shiftKey: true },
        undefined,
        reported,
      );
      expect(result.handled).toBe(false);
      expect(result.event.defaultPrevented).toBe(true);
      if (reported) expect(result.write).toHaveBeenCalledWith(reported);
      else expect(result.write).not.toHaveBeenCalled();
    },
  );
  it.each([
    { metaKey: true },
    { ctrlKey: true },
    { ctrlKey: true, shiftKey: true },
  ])("leaves paste to the browser: %j", (modifiers) => {
    const result = press(mac, { ...modifiers, code: "KeyV" }, "canvas");
    expect(result.handled).toBe(false);
    expect(result.event.defaultPrevented).toBe(false);
    expect(result.write).not.toHaveBeenCalled();
  });
});
