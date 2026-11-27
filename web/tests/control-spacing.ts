import type { Locator } from "@playwright/test";
import { expect } from "./worker-host";

/** No two visible controls in scope are closer than --ah-control-gap (so
 * none touch or overlap; a segmented control counts as one), and a removal stands at least --ah-s4 from the
 * control before it. The distance is between bounding boxes. */
export async function spacing(scope: Locator, what: string) {
  const bad = await scope.evaluate((root) => {
    const px = (v: string) => {
      const e = document.createElement("div");
      e.style.width = `var(${v})`;
      document.body.append(e);
      const w = e.getBoundingClientRect().width;
      e.remove();
      return w;
    };
    const min = px("--ah-control-gap");
    const far = px("--ah-s4");
    const els = [
      ...root.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [role="button"], summary',
      ),
    ].filter((e) => {
      const b = e.getBoundingClientRect();
      return (
        b.width >= 3 &&
        b.height >= 3 &&
        e.checkVisibility({ visibilityProperty: true, opacityProperty: true })
      );
    });
    const name = (e: HTMLElement) =>
      (e.dataset.testid || e.getAttribute("aria-label") || e.tagName).slice(
        0,
        48,
      );
    const gap = (a: Element, b: Element) => {
      const p = a.getBoundingClientRect();
      const q = b.getBoundingClientRect();
      const gx = Math.max(q.left - p.right, p.left - q.right);
      const gy = Math.max(q.top - p.bottom, p.top - q.bottom);
      return gx < 0 && gy < 0
        ? Math.max(gx, gy)
        : gx < 0
          ? gy
          : gy < 0
            ? gx
            : Math.max(gx, gy);
    };
    const out: string[] = [];
    for (let i = 0; i < els.length; i++)
      for (let j = i + 1; j < els.length; j++) {
        const a = els[i];
        const b = els[j];
        if (a.contains(b) || b.contains(a)) continue;
        // A segmented control's options are one control (the primitive's
        // own design), not neighbours.
        const group = a.closest('[data-ah-primitive="segmented"]');
        if (group && group === b.closest('[data-ah-primitive="segmented"]'))
          continue;
        const g = gap(a, b);
        if (g < min - 0.5)
          out.push(`${name(a)} | ${name(b)}: ${g.toFixed(1)}px`);
      }
    for (const d of root.querySelectorAll<HTMLElement>(
      ".mo-destructive, .si-destructive",
    )) {
      const i = els.indexOf(d);
      if (i < 1) continue;
      const g = gap(els[i - 1], d);
      if (g < far - 0.5)
        out.push(`removal ${name(d)} after ${name(els[i - 1])}: ${g}px`);
    }
    return out;
  });
  expect(bad, `${what}: controls too close`).toEqual([]);
}
