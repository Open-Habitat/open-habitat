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
test("only Ctrl+Shift+Enter, not dead keys, AltGr or IME composition", () => {
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
