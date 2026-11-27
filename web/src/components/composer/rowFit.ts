import { type RefObject, useCallback, useLayoutEffect } from "react";

/** The parts whose content can overflow the composer's bottom row: the left
 * part with the aids and the model, Sanele's fixed slot, and the model pill,
 * which clips its name rather than overflowing. The `!` label and a running
 * command clip with an ellipsis on purpose and are not asked. */
const PARTS =
  ":scope > .ah-crow-lz, :scope > .ah-crow-mslot, :scope > .ah-crow-mslot > *, .ah-composer-model .md-pill";

function overflows(row: HTMLElement) {
  if (row.scrollWidth > row.clientWidth) return true;
  for (const part of row.querySelectorAll<HTMLElement>(PARTS))
    if (part.scrollWidth > part.clientWidth) return true;
  return false;
}

/** Shows the row's aids as icons (`data-fit="icons"`) when their labels do
 * not fit. The row measures itself rather than the viewport, because a side
 * panel narrows the conversation column without changing the viewport, and
 * the labels' width depends on the language and the model's name. Each check
 * starts from the labelled row, so the decision cannot latch either way; the
 * attribute is not React's, so a render does not reset it. */
export function useRowFit(row: RefObject<HTMLElement | null>) {
  const check = useCallback(() => {
    const node = row.current;
    if (!node) return;
    delete node.dataset.fit;
    if (overflows(node)) node.dataset.fit = "icons";
  }, [row]);
  // Every render may change what the row holds (work controls, a model name,
  // the language); the check runs before paint, so nothing flashes.
  useLayoutEffect(check);
  useLayoutEffect(() => {
    const node = row.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(check);
    observer.observe(node);
    // The bundled fonts change the labels' width once they load.
    let live = true;
    document.fonts?.ready.then(() => live && check());
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [check, row]);
}
