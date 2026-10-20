import { expect, test } from "vitest";
import { isTerminalShortcut } from "./terminalShortcut";

const enter = {
  code: "Enter",
  ctrlKey: true,
  shiftKey: true,
  altKey: false,
  metaKey: false,
  isComposing: false,
};
test("Ctrl+Shift+Enter alias, not dead keys, AltGr or IME composition", () => {
  expect(isTerminalShortcut(enter)).toBe(true);
  for (const change of [
    { ctrlKey: false },
    { shiftKey: false },
    { altKey: true },
    { metaKey: true },
    { isComposing: true },
    { code: "Backquote" },
    { code: "Equal" },
  ])
    expect(isTerminalShortcut({ ...enter, ...change })).toBe(false);
});

test("Ctrl+Alt+T works on Nordic keyboards without taking browser new-tab shortcuts", () => {
  const key = { ...enter, code: "KeyT", altKey: true, shiftKey: false };
  expect(isTerminalShortcut(key)).toBe(true);
  for (const change of [
    { altKey: false },
    { ctrlKey: false, metaKey: true },
    { shiftKey: true },
    { metaKey: true },
    { isComposing: true },
    { code: "KeyK" },
  ])
    expect(isTerminalShortcut({ ...key, ...change })).toBe(false);
});
