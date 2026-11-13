import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The boundary rule stated in design-system/tokens/colors.css: a line that
// tells a control or a state-carrying box from its surroundings reaches 3:1
// (WCAG 1.4.11) against every opaque background it can sit on. The rendered
// per-component measurement is web/lab/measure-boundaries.mjs.
// Vitest runs from web/.
const css = readFileSync("../design-system/tokens/colors.css", "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block`);
  const body = css.slice(start, css.indexOf("\n}", start));
  return Object.fromEntries(
    [...body.matchAll(/(--ah-[a-z0-9-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [
      m[1],
      m[2],
    ]),
  );
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const themes = {
  light: block('[data-theme="light"]'),
  dark: block('[data-theme="dark"]'),
};
const backgrounds = [
  "--ah-bg",
  "--ah-surface",
  "--ah-surface-2",
  "--ah-rail",
  "--ah-sunken",
  "--ah-current",
];
const boundaries = [
  "--ah-control-line",
  "--ah-line-strong",
  "--ah-current-line",
  "--ah-accent-line",
  "--ah-ok-line",
  "--ah-turn-line",
  "--ah-err-line",
];
// A tone line also sits on its own soft fill.
const ownFill: Record<string, string> = {
  "--ah-accent-line": "--ah-accent-soft",
  "--ah-ok-line": "--ah-ok-soft",
  "--ah-err-line": "--ah-err-soft",
};

describe.each(Object.entries(themes))("%s theme boundaries", (_, theme) => {
  it.each(boundaries)("%s reaches 3:1 on every background", (token) => {
    const fills = [...backgrounds, ...(ownFill[token] ? [ownFill[token]] : [])];
    for (const fill of fills) {
      expect(theme[token], token).toBeDefined();
      expect(theme[fill], fill).toBeDefined();
      expect(
        ratio(theme[token], theme[fill]),
        `${token} on ${fill}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("a disabled line is quieter than an enabled control's", () => {
    for (const fill of backgrounds)
      expect(ratio(theme["--ah-disabled-line"], theme[fill])).toBeLessThan(
        ratio(theme["--ah-control-line"], theme[fill]),
      );
  });
});
