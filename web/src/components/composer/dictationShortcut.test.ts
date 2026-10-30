import { expect, test } from "vitest";
import {
  dictationShortcutFor,
  isDictationShortcut,
  type Keyboard,
} from "./dictationShortcut";

const none = {
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  isComposing: false,
};

const layout = (keys: Record<string, string>) => ({
  get: (code: string) => keys[code],
});
// What Chromium's layout map says on a Mac, with the ISO swap: the key left
// of 1 is IntlBackslash.
const finnishMac = layout({ IntlBackslash: "§", Backquote: "<", Digit6: "6" });
const germanMac = layout({ IntlBackslash: "^", Backquote: "<" });
// A US layout reads the same on an ANSI board and on an ISO one.
const usMac = layout({ IntlBackslash: "§", Backquote: "`" });
const usPc = layout({ Backquote: "`", IntlBackslash: "\\" });

const mac: Keyboard = { mac: true, layout: null };
const pc: Keyboard = { mac: false, layout: null };

test("on a Mac the key left of 1, whichever code the ISO swap gives it, never ⌘< or ⌘`", () => {
  const press = (key: string, code: string, kb: Keyboard) =>
    isDictationShortcut({ ...none, key, code, metaKey: true }, kb);
  // Without a layout map: either code, told apart from window cycling by
  // the character. Chromium on a Finnish ISO board, then Firefox.
  expect(press("§", "IntlBackslash", mac)).toBe(true);
  expect(press("<", "Backquote", mac)).toBe(false);
  expect(press("§", "Backquote", mac)).toBe(true);
  expect(press("<", "IntlBackslash", mac)).toBe(false);
  // A German board's ^, a UK board's ` beside Shift, ANSI's ` left of 1.
  expect(press("^", "IntlBackslash", mac)).toBe(true);
  expect(press("Dead", "Backquote", mac)).toBe(true);
  expect(press("`", "Backquote", mac)).toBe(false);
  expect(press(">", "Backquote", mac)).toBe(false);
  // § elsewhere, as on the 6 of a Belgian board, is not the place.
  expect(press("§", "Digit6", mac)).toBe(false);

  // With Chromium's layout map the code is IntlBackslash.
  const fi = { mac: true, layout: finnishMac };
  expect(press("§", "IntlBackslash", fi)).toBe(true);
  expect(press("§", "Backquote", fi)).toBe(false);
  expect(press("<", "Backquote", fi)).toBe(false);
  expect(press("^", "IntlBackslash", { mac: true, layout: germanMac })).toBe(
    true,
  );
  // Should Chromium stop swapping, the map shows it and Backquote is the key.
  const fixed = {
    mac: true,
    layout: layout({ IntlBackslash: "<", Backquote: "§" }),
  };
  expect(press("§", "Backquote", fixed)).toBe(true);
  expect(press("<", "IntlBackslash", fixed)).toBe(false);
});

test("on a Mac ⌘⇧Space too, and no other modifier", () => {
  expect(
    isDictationShortcut(
      { ...none, key: " ", code: "Space", metaKey: true, shiftKey: true },
      mac,
    ),
  ).toBe(true);
  const section = { ...none, key: "§", code: "IntlBackslash", metaKey: true };
  for (const change of [
    { metaKey: false },
    { metaKey: false, ctrlKey: true },
    { ctrlKey: true },
    { shiftKey: true, key: "°" },
    { altKey: true },
    { isComposing: true },
  ])
    expect(isDictationShortcut({ ...section, ...change }, mac)).toBe(false);
});

test("elsewhere Ctrl and the key left of 1 by its place, whatever it types", () => {
  const press = { ...none, key: "§", code: "Backquote", ctrlKey: true };
  for (const key of ["§", "`", "^", "Dead", "ё"])
    expect(isDictationShortcut({ ...press, key }, pc)).toBe(true);
  for (const change of [
    { ctrlKey: false },
    { metaKey: true },
    { shiftKey: true, key: "½" },
    // AltGr is Ctrl+Alt on Windows.
    { altKey: true },
    { isComposing: true },
    { key: "<", code: "IntlBackslash" },
    // § where a Belgian board has it.
    { key: "§", code: "Digit6" },
    { key: " ", code: "Space", shiftKey: true },
  ])
    expect(isDictationShortcut({ ...press, ...change }, pc)).toBe(false);
});

test("the hint names the key the layout has left of 1, and ⌘⇧Space where the board may be ANSI", () => {
  expect(dictationShortcutFor(mac)).toMatchObject({
    labels: ["⌘§"],
    aria: "Meta+§ Meta+Shift+Space",
  });
  expect(dictationShortcutFor({ mac: true, layout: finnishMac })).toMatchObject(
    { labels: ["⌘§"], aria: "Meta+§ Meta+Shift+Space" },
  );
  expect(dictationShortcutFor({ mac: true, layout: germanMac })).toMatchObject({
    labels: ["⌘^"],
    aria: "Meta+^ Meta+Shift+Space",
  });
  expect(dictationShortcutFor({ mac: true, layout: usMac })).toMatchObject({
    labels: ["⌘§", "⌘⇧välilyönti"],
  });
  // A map that names no key left of 1 but window cycling: only ⌘⇧Space.
  expect(
    dictationShortcutFor({ mac: true, layout: layout({ Backquote: "`" }) }),
  ).toMatchObject({ labels: ["⌘⇧välilyönti"], aria: "Meta+Shift+Space" });
  expect(dictationShortcutFor(pc)).toMatchObject({
    labels: ["Ctrl+§"],
    aria: "Control+§",
  });
  expect(dictationShortcutFor({ mac: false, layout: usPc })).toMatchObject({
    labels: ["Ctrl+`"],
    aria: "Control+`",
  });
});
