type Key = {
  key: string;
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  isComposing: boolean;
};

/** What `navigator.keyboard.getLayoutMap()` gives: the character each
 * physical key types on the current layout. Only Chromium has it. */
export type KeyboardLayout = { get(code: string): string | undefined };

export type Keyboard = { mac: boolean; layout: KeyboardLayout | null };

// What macOS's window cycling key (⌘ and the key it numbers 0x32) types on
// the common layouts: < beside the left Shift on a Nordic, German or French
// ISO board, ` on ANSI and on a UK or US ISO board.
const cycling = new Set(["<", ">", "`", "~"]);

/** The codes the key left of 1, below Esc, may report. Off the Mac it is
 * Backquote. On a Mac ISO board, Chromium (and the other engines that read
 * macOS's key numbers as they are) swaps it with the key beside the left
 * Shift: the key left of 1 reports IntlBackslash and the window cycling key
 * Backquote. Firefox corrects the swap. Only Chromium has the layout map, so
 * with one the code is IntlBackslash, unless the map shows the swap gone;
 * without one it is either code, and the typed character tells the window
 * cycling key apart. An ANSI Mac's key left of 1 is the window cycling key
 * itself, which macOS keeps; it has ⌘⇧Space instead. */
export function leftOfOneCodes({ mac, layout }: Keyboard) {
  if (!mac) return ["Backquote"];
  if (!layout) return ["IntlBackslash", "Backquote"];
  return cycling.has(layout.get("IntlBackslash") ?? "")
    ? ["Backquote"]
    : ["IntlBackslash"];
}

/** Starts and ends a dictation from anywhere in the conversation view: ⌘
 * on a Mac, Ctrl elsewhere, and the key left of 1 below Esc on any layout
 * (§ on a Nordic board, ` on ANSI, ^ on a German one). The key is matched
 * by its place, never by what it types, so ⌘6 on a Belgian board, where §
 * is, does nothing. ⌘< and ⌘`, macOS's window cycling, never match. Alt is
 * refused so AltGr, which is Ctrl+Alt on Windows, never matches. */
export function isDictationShortcut(event: Key, keyboard: Keyboard) {
  if (event.altKey || event.isComposing) return false;
  if (keyboard.mac) {
    if (!event.metaKey || event.ctrlKey) return false;
    if (event.shiftKey) return event.code === "Space";
    return (
      leftOfOneCodes(keyboard).includes(event.code) && !cycling.has(event.key)
    );
  }
  return (
    event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    event.code === "Backquote"
  );
}

/** The character on the key left of 1, as the hint names it: from the
 * layout map where there is one, § otherwise. Null on a Mac whose key left
 * of 1 is the window cycling key. */
function leftOfOneLabel(keyboard: Keyboard) {
  if (!keyboard.layout) return "§";
  const typed = keyboard.layout.get(leftOfOneCodes(keyboard)[0] ?? "");
  if (!typed) return keyboard.mac ? null : "§";
  if (keyboard.mac && cycling.has(typed)) return null;
  return typed;
}

export function dictationShortcutFor(keyboard: Keyboard) {
  const typed = leftOfOneLabel(keyboard);
  const alternative = "⌘⇧välilyönti";
  // A Mac with a US or UK layout may be an ANSI board, whose key left of 1
  // macOS keeps for window cycling; ⌘⇧Space works on every board.
  const ansi =
    keyboard.mac &&
    !!keyboard.layout &&
    (!typed || keyboard.layout.get("Backquote") === "`");
  const labels = keyboard.mac
    ? [...(typed ? [`⌘${typed}`] : []), ...(ansi ? [alternative] : [])]
    : [`Ctrl+${typed}`];
  return {
    /** The ways to press it, the first being the key left of 1. */
    labels,
    aria: keyboard.mac
      ? [...(typed ? [`Meta+${typed}`] : []), "Meta+Shift+Space"].join(" ")
      : `Control+${typed}`,
    matches: (event: Key) => isDictationShortcut(event, keyboard),
  };
}

export type DictationShortcut = ReturnType<typeof dictationShortcutFor>;

let layoutRead: Promise<KeyboardLayout | null> | null = null;

/** The current layout, read once per page. Null where the browser has no
 * layout map or refuses it, as in a frame. */
export function readKeyboardLayout(): Promise<KeyboardLayout | null> {
  if (!layoutRead) {
    const keyboard = (
      globalThis.navigator as
        | { keyboard?: { getLayoutMap?: () => Promise<KeyboardLayout> } }
        | undefined
    )?.keyboard;
    layoutRead = keyboard?.getLayoutMap
      ? keyboard.getLayoutMap().catch(() => null)
      : Promise.resolve(null);
  }
  return layoutRead;
}
