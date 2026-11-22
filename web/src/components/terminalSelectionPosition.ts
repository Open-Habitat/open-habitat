type Bounds = { top: number; bottom: number; left: number };

/** Never clamp vertically into selected rows. A viewport-filling selection (or
 * OSC 52 without geometry) uses the panel header, outside terminal content. */
export function terminalSelectionPosition(
  selection: Bounds | undefined,
  panel: { width: number; height: number },
  toolbar: { width: number; height: number },
) {
  const gap = 4;
  const left = Math.max(
    gap,
    Math.min(selection?.left ?? gap, panel.width - toolbar.width - gap),
  );
  if (
    selection &&
    selection.top - toolbar.height - gap >= gap &&
    selection.top <= panel.height
  ) {
    return { left, top: selection.top - toolbar.height - gap };
  }
  if (
    selection &&
    selection.bottom >= 0 &&
    selection.bottom + gap + toolbar.height <= panel.height - gap
  ) {
    return { left, top: selection.bottom + gap };
  }
  return { left, top: -toolbar.height - gap };
}
