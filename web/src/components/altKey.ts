const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

/** An Alt shortcut as the keyboard names it: ⌥↓ on a Mac, whose key is
 * Option, like the editor's ⌘⌥K, and Alt+↓ elsewhere. */
export function altKey(key: string): string {
  return isMac ? `⌥${key}` : `Alt+${key}`;
}
