# components/terminalShortcut.ts

Generated from web/src/components/terminalShortcut.ts; do not edit.

```tsx
/** A non-printing key shared by Nordic and US keyboards, including macOS.
 * Match the physical key, never a layout's printable/dead-key character. */
export function isTerminalShortcut(event: {
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  isComposing: boolean;
}) {
  return (
    ((event.code === "KeyT" && event.altKey && !event.shiftKey) ||
      (event.code === "Enter" && event.shiftKey && !event.altKey)) &&
    event.ctrlKey &&
    !event.metaKey &&
    !event.isComposing
  );
}

```
