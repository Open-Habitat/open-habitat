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
    event.code === "Enter" &&
    event.ctrlKey &&
    event.shiftKey &&
    !event.altKey &&
    !event.metaKey &&
    !event.isComposing
  );
}
