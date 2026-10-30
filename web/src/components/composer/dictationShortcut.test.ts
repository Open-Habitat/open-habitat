import { expect, test } from "vitest";
import { dictationShortcutFor, isDictationShortcut } from "./dictationShortcut";

const none = {
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  isComposing: false,
};

test("⌘§ on a Mac by the key, whichever code Chrome's ISO swap gives it", () => {
  for (const code of ["Backquote", "IntlBackslash"])
    expect(
      isDictationShortcut({ ...none, key: "§", code, metaKey: true }, true),
    ).toBe(true);
  expect(
    isDictationShortcut(
      { ...none, key: " ", code: "Space", metaKey: true, shiftKey: true },
      true,
    ),
  ).toBe(true);
  const section = { ...none, key: "§", code: "IntlBackslash", metaKey: true };
  for (const change of [
    { metaKey: false },
    { metaKey: false, ctrlKey: true },
    { ctrlKey: true },
    { shiftKey: true, key: "½" },
    { altKey: true },
    { isComposing: true },
    // macOS window cycling: ⌘< on a Nordic ISO keyboard, ⌘` on ANSI.
    { key: "<", code: "Backquote" },
    { key: "<", code: "IntlBackslash" },
    { key: "`", code: "Backquote" },
  ])
    expect(isDictationShortcut({ ...section, ...change }, true)).toBe(false);
});

test("Ctrl+§ elsewhere, or Ctrl and the key left of 1 on a layout without §", () => {
  const section = { ...none, key: "§", code: "Backquote", ctrlKey: true };
  expect(isDictationShortcut(section, false)).toBe(true);
  expect(isDictationShortcut({ ...section, key: "`" }, false)).toBe(true);
  expect(isDictationShortcut({ ...section, key: "^" }, false)).toBe(true);
  for (const change of [
    { ctrlKey: false },
    { metaKey: true },
    { shiftKey: true, key: "½" },
    // AltGr is Ctrl+Alt on Windows.
    { altKey: true },
    { isComposing: true },
    { key: "<", code: "IntlBackslash" },
    { key: " ", code: "Space", shiftKey: true },
  ])
    expect(isDictationShortcut({ ...section, ...change }, false)).toBe(false);
});

test("the hint and aria-keyshortcuts name the shortcut", () => {
  expect(dictationShortcutFor(true)).toMatchObject({
    label: "⌘§",
    aria: "Meta+§ Meta+Shift+Space",
  });
  expect(dictationShortcutFor(false)).toMatchObject({
    label: "Ctrl+§",
    aria: "Control+§",
  });
});
