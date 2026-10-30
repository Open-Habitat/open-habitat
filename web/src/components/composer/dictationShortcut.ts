type Key = {
  key: string;
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  isComposing: boolean;
};

/** Starts and ends a dictation from anywhere in the conversation view:
 * ⌘§ on a Mac, Ctrl+§ elsewhere, the key left of 1 on a Nordic keyboard.
 *
 * The § is matched by `key`, because Chrome on a Mac ISO keyboard swaps the
 * codes of § (`IntlBackslash`) and < (`Backquote`), and ⌘< and ⌘` are the
 * window cycling macOS keeps for itself. A Mac layout without § keeps
 * ⌘⇧Space for the same reason: its key left of 1 is `. Elsewhere that key
 * (`Backquote`, never swapped) stands in for § on layouts without one, and
 * Ctrl+` is free in the browsers. Alt is refused so AltGr, which is Ctrl+Alt
 * on Windows, never matches. */
export function isDictationShortcut(event: Key, mac: boolean) {
  if (event.altKey || event.isComposing) return false;
  if (mac) {
    if (!event.metaKey || event.ctrlKey) return false;
    if (event.shiftKey) return event.code === "Space";
    return event.key === "§";
  }
  return (
    event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    (event.key === "§" || event.code === "Backquote")
  );
}

export function dictationShortcutFor(mac: boolean) {
  return {
    label: mac ? "⌘§" : "Ctrl+§",
    aria: mac ? "Meta+§ Meta+Shift+Space" : "Control+§",
    matches: (event: Key) => isDictationShortcut(event, mac),
  };
}
