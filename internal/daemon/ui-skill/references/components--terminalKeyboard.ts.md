# components/terminalKeyboard.ts

Generated from web/src/components/terminalKeyboard.ts; do not edit.

```tsx
import { isMac } from "./altKey";
import { isTerminalShortcut } from "./terminalShortcut";

export const terminalCopyKey = isMac ? "⌘C" : "Ctrl+Shift+C";
export const terminalPasteKey = isMac ? "⌘V" : "Ctrl+V";

/** Return false to keep xterm from sending the key to the program. */
export function terminalKeyHandler(
  event: KeyboardEvent,
  selection: {
    hasSelection(): boolean;
    text(): string | undefined;
    clear(): void;
  },
  write: (text: string) => void,
  mac = isMac,
): boolean {
  if (event.type !== "keydown") return true;
  if (isTerminalShortcut(event)) return false;
  // Shift+Cmd+C belongs to DevTools; Cmd+V uses the browser paste event.
  const commandCopy =
    mac &&
    event.metaKey &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey &&
    event.code === "KeyC";
  if (event.metaKey && !commandCopy) return false;
  const controlCopy =
    event.ctrlKey &&
    event.code === "KeyC" &&
    (event.shiftKey || selection.hasSelection());
  if (commandCopy || controlCopy) {
    event.preventDefault();
    const text = selection.text();
    if (text) write(text);
    selection.clear();
    return false;
  }
  if (event.ctrlKey && event.code === "KeyV") return false;
  return true;
}

```
