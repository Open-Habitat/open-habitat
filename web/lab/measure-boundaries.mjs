#!/usr/bin/env node
// Boundary contrast (WCAG 1.4.11) of production controls and state boxes, per
// component, state and theme, measured from the rendered DOM of a static
// Storybook build. Synthetic stories only; no host, home or network.
//   npm run build-storybook --prefix web -- -o ../.cache/lab/storybook
//   node web/lab/measure-boundaries.mjs [storybook-dir] [out-dir]
// For each target the ratio is the better of its fill and its drawn edge
// (border or box-shadow ring) against the opaque background behind it, which
// is what tells the box from its surroundings. Writes boundaries.json and
// boundaries.md and exits 1 when a target is below 3:1 (4.5:1 in Korkea
// kontrasti).
import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const repo = fileURLToPath(new URL("../..", import.meta.url));
const cache = resolve(repo, ".cache/lab");
const root = resolve(process.argv[2] || join(cache, "storybook"));
const out = resolve(process.argv[3] || join(cache, "boundaries"));
if (!existsSync(join(root, "iframe.html")))
  throw new Error(`No Storybook build at ${root}`);
if (!out.startsWith(`${cache}/`) && !out.startsWith(resolve(repo, "issues")))
  throw new Error("Output must be under .cache/lab/ or issues/");

// Päivä, Yö and Korkea kontrasti; the last holds boundaries to 4.5:1.
const themes = ["light", "dark", "contrast"];
const floor = (theme) => (theme === "contrast" ? 4.5 : 3);
// [story id, theme global, [[label, selector, minimum = floor(theme)]]]
const targets = [
  ...themes.map((theme) => [
    `production-interaction-states--${theme}`,
    theme,
    [
      ["button secondary", '[class*="_secondary_"][data-ah-state="rest"]'],
      [
        "button secondary hover",
        '[class*="_secondary_"][data-ah-state="hover"]',
      ],
      [
        "button danger-subtle",
        '[class*="_dangerSubtle_"][data-ah-state="rest"]',
      ],
      [
        "button danger-subtle hover",
        '[class*="_dangerSubtle_"][data-ah-state="hover"]',
      ],
      ["button primary", '[class*="_primary_"][data-ah-state="rest"]'],
      ["button danger", '[class*="_danger_"][data-ah-state="rest"]'],
      [
        "segmented frame",
        '[data-ah-primitive="segmented"] [class*="_segmented_"], [class*="_segmented_"]',
      ],
      ["segment selected", '[class*="_segment_"][aria-pressed="true"]'],
      ["field", 'input[class*="_fieldInput_"]:not(:disabled, [data-disabled])'],
      [
        "field invalid",
        'input[class*="_fieldInput_"][data-invalid], [data-invalid] input[class*="_fieldInput_"]',
      ],
      ["textarea", 'textarea[class*="_fieldInput_"]'],
      ["checkbox", ".ah-checkbox:not([data-disabled]) .ah-checkbox-box"],
      ["radio", ".ah-radio-group label:not([data-disabled]) .ah-radio-dot"],
      ["current home link", '[class*="_home_"][aria-current="page"]'],
      // Disabled is outside 1.4.11; reported to check it is not the most
      // prominent control.
      ["button disabled", '[class*="_button_"][data-disabled]', 0],
      ["checkbox disabled", ".ah-checkbox[data-disabled] .ah-checkbox-box", 0],
    ],
  ]),
  ...themes.flatMap((theme) =>
    ["danger", "neutral", "progress", "success", "page"].map((story) => [
      `production-warning-banner--${story}`,
      theme,
      [[`banner ${story}`, ".ah-warning"]],
    ]),
  ),
  ...themes.map((theme) => [
    "production-capacity-refusal--installation-limit",
    theme,
    [["capacity chip", ".ah-capacity-chip"]],
  ]),
  ...themes.map((theme) => [
    "production-catalog--unhappy-states",
    theme,
    [["toast", ".ah-toast"]],
  ]),
  ...themes.map((theme) => [
    "production-catalog--primitives",
    theme,
    [
      ["notice info", ".ah-notice.ah-tone-info"],
      ["notice warning", ".ah-notice.ah-tone-warning"],
      ["notice danger", ".ah-notice.ah-tone-danger"],
    ],
  ]),
  ...themes.map((theme) => [
    "production-catalog--navigation",
    theme,
    [
      ["rail search", ".ah-rail-search input"],
      [
        "current nav link",
        '[class*="_link_"][aria-current="page"]:not(.ah-nav-link):not([class*="_workspace_"])',
      ],
    ],
  ]),
  ...themes.map((theme) => [
    "production-catalog--account",
    theme,
    [["settings page selected", ".s-nav-i[aria-current]"]],
  ]),
];

const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const server = createServer((req, res) => {
  const path = join(
    root,
    decodeURIComponent(new URL(req.url, "http://x").pathname),
  );
  if (!path.startsWith(root) || !existsSync(path) || !statSync(path).isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    "content-type": types[extname(path)] ?? "application/octet-stream",
  });
  createReadStream(path).pipe(res);
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}`;

// Runs in the page: WCAG ratio of a box's fill or drawn edge against what is behind it.
function measure(selector) {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1]
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number);
    return [r, g, b, a];
  };
  const over = (top, under) => {
    const a = top[3];
    return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1);
  };
  const lum = (c) => {
    const [r, g, b] = c.slice(0, 3).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const hex = (c) =>
    `#${c
      .slice(0, 3)
      .map((v) => Math.round(v).toString(16).padStart(2, "0"))
      .join("")}`;
  const behind = (node) => {
    const layers = [];
    for (let n = node.parentElement; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0) {
        layers.push(c);
        if (c[3] === 1) break;
      }
    }
    return layers.reduceRight(
      (under, top) => over(top, under),
      [255, 255, 255, 1],
    );
  };
  return [...document.querySelectorAll(selector)]
    .filter((n) => n.getBoundingClientRect().width > 0)
    .map((node) => {
      const s = getComputedStyle(node);
      const back = behind(node);
      const fillColor = parse(s.backgroundColor);
      const fill = fillColor ? over(fillColor, back) : back;
      const edges = [];
      for (const side of ["Top", "Right", "Bottom", "Left"]) {
        const w = Number.parseFloat(s[`border${side}Width`]);
        const c = parse(s[`border${side}Color`]);
        if (w > 0 && s[`border${side}Style`] !== "none" && c && c[3] > 0)
          edges.push(over(c, back));
      }
      for (const m of s.boxShadow.matchAll(
        /(rgba?\([^)]+\))\s+0px\s+0px\s+0px\s+([\d.]+)px/g,
      )) {
        const c = parse(m[1]);
        if (Number(m[2]) > 0 && c[3] > 0) edges.push(over(c, back));
      }
      const fillRatio = ratio(fill, back);
      const edge = edges.sort((a, b) => ratio(b, back) - ratio(a, back))[0];
      const edgeRatio = edge ? ratio(edge, back) : 1;
      return {
        background: hex(back),
        fill: hex(fill),
        edge: edge ? hex(edge) : null,
        fillRatio: Math.round(fillRatio * 100) / 100,
        edgeRatio: Math.round(edgeRatio * 100) / 100,
        ratio: Math.round(Math.max(fillRatio, edgeRatio) * 100) / 100,
      };
    });
}

const browser = await chromium.launch({ headless: true });
const rows = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  for (const [id, theme, items] of targets) {
    await page.goto(
      `${base}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`,
    );
    await page
      .locator("#storybook-root > *")
      .first()
      .waitFor({ timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    for (const [label, selector, minimum = floor(theme)] of items) {
      const found = await page.evaluate(measure, selector);
      // The weakest instance stands for the component.
      const worst = found.sort((a, b) => a.ratio - b.ratio)[0];
      rows.push({
        story: id,
        theme,
        component: label,
        minimum,
        instances: found.length,
        ...(worst ?? { ratio: null }),
        pass: worst ? worst.ratio >= minimum : null,
      });
    }
  }
} finally {
  await browser.close();
  server.close();
}

await mkdir(out, { recursive: true });
await writeFile(
  join(out, "boundaries.json"),
  `${JSON.stringify(rows, null, 2)}\n`,
);
const md = [
  "| Component | Theme | Background | Fill | Edge | Fill ratio | Edge ratio | Result |",
  "|---|---|---|---|---|---|---|---|",
  ...rows.map((r) =>
    r.instances
      ? `| ${r.component} | ${r.theme} | \`${r.background}\` | \`${r.fill}\` | ${r.edge ? `\`${r.edge}\`` : "–"} | ${r.fillRatio} | ${r.edgeRatio} | ${r.pass ? "ok" : `**below ${r.minimum}**`} |`
      : `| ${r.component} | ${r.theme} | | | | | | not found |`,
  ),
];
await writeFile(join(out, "boundaries.md"), `${md.join("\n")}\n`);
console.log(md.join("\n"));
process.exitCode = rows.some((r) => r.pass === false) ? 1 : 0;
