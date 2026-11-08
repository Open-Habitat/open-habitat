import type { Page } from "@playwright/test";
import { parts } from "../src/components/explainParts";

/** One visible control on screen and the card the explain mode would show
 * for it: its own part, or the nearest enclosing part (what the mode's hit
 * test falls back to). */
export type Control = {
  /** The control's own test id, else the nearest ancestor's with a marker. */
  where: string;
  tag: string;
  role: string;
  label: string;
  card: string | null;
  /** The card belongs to the control itself, not to a region around it. */
  own: boolean;
  /** A CSS path short enough to read in a report. */
  path: string;
  /** Why the control has no card on purpose, from the allow-list. */
  allowed?: string;
};

/** Controls that have no card on purpose, each with its reason. */
export const allowed: [selector: string, reason: string][] = [
  [
    '[data-testid="skip-content"]',
    "The skip link appears only under keyboard focus; the mode is pointed or tapped.",
  ],
  [
    '[style*="clip"] > button',
    "A screen reader's dismiss button for an open menu or popover, visually hidden.",
  ],
];

/** Every visible, enabled-or-not control in the page outside the explain
 * mode's own interface, with its card. The selectors are the parts' own, so
 * the check follows explainParts.ts as it changes. */
export async function controls(
  page: Page,
  { marks = false } = {},
): Promise<Control[]> {
  const entries = Object.entries(parts).map(([id, p]) => [id, p.sel]);
  return page.evaluate(
    ([entries, marks, allowed]) => {
      const CONTROL =
        'button, a[href], input:not([type="hidden"]), textarea, select, summary, [role="button"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="slider"], [contenteditable="true"]';
      const OWN = "[data-explain-own], .ah-explain-ui, .ah-explain-bar";
      const cardOf = (el: Element) => {
        for (const [id, sel] of entries) if (el.matches(sel)) return id;
        return null;
      };
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        if (r.width < 3 || r.height < 3) return false;
        return el.checkVisibility({
          opacityProperty: true,
          visibilityProperty: true,
        });
      };
      const describe = (el: Element) => {
        const id = el.getAttribute("data-testid");
        if (id) return id;
        const near = el.closest("[data-testid]");
        const cls = [...el.classList].find((c) => c.startsWith("ah-"));
        return `${near ? `${near.getAttribute("data-testid")} › ` : ""}${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}`;
      };
      const path = (el: Element) => {
        const bits: string[] = [];
        for (
          let n: Element | null = el;
          n && n !== document.body && bits.length < 4;
          n = n.parentElement
        ) {
          const id = n.getAttribute("data-testid");
          bits.unshift(
            id
              ? `[data-testid="${id}"]`
              : `${n.tagName.toLowerCase()}${n.classList[0] ? `.${n.classList[0]}` : ""}`,
          );
        }
        return bits.join(" > ");
      };
      const seen = new Set<Element>();
      const out = [];
      // For the inventory only: the passive parts with a test id or a role
      // (chips, marks, status lines) that hold no control of their own.
      const MARK = '[data-testid], [role="status"], [role="img"], kbd';
      const candidates = marks
        ? [...document.querySelectorAll(MARK)].filter((el) => {
            if (el.matches(CONTROL) || el.closest(CONTROL)) return false;
            if (el.querySelector(CONTROL)) return false;
            const r = el.getBoundingClientRect();
            return r.width * r.height < 40000;
          })
        : document.querySelectorAll(CONTROL);
      for (const el of candidates) {
        if (el.closest(OWN) || !visible(el)) continue;
        // A control inside another (an input in its label) is one control.
        const outer = el.parentElement?.closest(CONTROL);
        if (outer && seen.has(outer)) continue;
        seen.add(el);
        let card: string | null = null;
        let own = false;
        for (
          let n: Element | null = el;
          n && n !== document.body;
          n = n.parentElement
        ) {
          card = cardOf(n);
          if (card) {
            // A part around this control alone (its label, its row) is its
            // own card; a region holding other controls explains it only
            // in general.
            own = [...n.querySelectorAll(CONTROL)].every(
              (c) =>
                c === el || el.contains(c) || c.contains(el) || !visible(c),
            );
            break;
          }
        }
        const allow = allowed.find(([sel]) => el.matches(sel));
        out.push({
          ...(allow ? { allowed: allow[1] } : {}),
          where: describe(el),
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute("role") ?? "",
          label: (
            el.getAttribute("aria-label") ??
            el.getAttribute("title") ??
            el.textContent ??
            ""
          )
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 60),
          card,
          own,
          path: path(el),
        });
      }
      return out;
    },
    [entries, marks, allowed] as const,
  );
}
