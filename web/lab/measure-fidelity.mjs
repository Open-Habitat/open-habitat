#!/usr/bin/env node
// Synthetic lab only. Runs against the current inventory; records gaps, never treats them as matches.
// Start scripts/lab.sh first. Output is an issue directory (or .cache/lab/fidelity).
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { origin } from "./session.mjs";

const root = resolve(".");
const output = resolve(process.argv[2] || ".cache/lab/fidelity");
if (
  !output.startsWith(`${root}/issues/`) &&
  !output.startsWith(`${root}/.cache/lab/`)
)
  throw new Error("Output must be an issue directory or .cache/lab directory");
const inventory = JSON.parse(
  await readFile(new URL("./inventory.json", import.meta.url)),
);
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const report = {
  commit,
  inventory: "web/lab/inventory.json",
  origin: "synthetic lab",
  pairs: [],
  gaps: [],
};
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const drafts = await browser.newContext({
  serviceWorkers: "block",
  viewport: { width: 1500, height: 960 },
});
const labContext = await browser.newContext({ ignoreHTTPSErrors: true });
const draft = await drafts.newPage();
const lab = await labContext.newPage();
lab.setDefaultTimeout(10000);
draft.setDefaultTimeout(10000);
const fontCss = (
  await Promise.all(
    [
      ["Instrument Sans", "instrument-sans-latin.woff2"],
      ["JetBrains Mono", "jetbrains-mono-latin.woff2"],
    ].map(
      async ([family, file]) =>
        `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${(await readFile(resolve("design-system/fonts", file))).toString("base64")}) format('woff2');font-weight:400 600}`,
    ),
  )
).join("\n");
await drafts.route("https://fonts.googleapis.com/**", (route) =>
  route.fulfill({ contentType: "text/css", body: fontCss }),
);
await drafts.route("https://fonts.gstatic.com/**", (route) => route.abort());

async function fixture(path) {
  const response = await lab.request.get(`${origin}/fixture/${path}`);
  if (response.status() !== 204)
    throw new Error(`fixture ${path}: ${response.status()}`);
}
// Returns no fallback element: a missing or ambiguous selector is a gap.
async function readLandmark(page, selector, properties, dimensions) {
  return page.evaluate(
    ({ selector, properties, dimensions }) => {
      const matches = [...document.querySelectorAll(selector)].filter(
        (node) => {
          const box = node.getBoundingClientRect();
          return box.width > 0 && box.height > 0;
        },
      );
      if (matches.length !== 1)
        throw new Error(
          `${selector}: ${matches.length} visible matches (expected one)`,
        );
      const node = matches[0];
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return Object.fromEntries([
        ...properties.map((key) => [key, style[key]]),
        ...dimensions.map((key) => [key, Math.round(box[key] * 100) / 100]),
      ]);
    },
    { selector, properties, dimensions },
  );
}
async function controls(page, selector) {
  return page.locator(selector).ariaSnapshot(); // role + accessible name, not raw DOM text
}
async function image(locator, file) {
  const png = `${file}.png`;
  await locator.screenshot({ path: png, animations: "disabled" });
  execFileSync(
    "avifenc",
    ["--min", "22", "--max", "32", "--speed", "7", png, `${file}.avif`],
    { stdio: "ignore" },
  );
  await rm(png);
}
try {
  const marker = await lab.request.get(`${origin}/fixture/lab-marker`);
  if (marker.status() !== 204) throw new Error("Refusing non-synthetic lab");
  // Each mapped state is a candidate, not an implicit match. Unmapped inventory entries
  // are explicitly gaps in every presentation, including draft-only entries.
  for (const state of inventory.states) {
    const mapping = inventory.landmarks[state.id];
    if (!mapping || state.status !== "capture" || !state.draft) {
      report.gaps.push({
        state: state.id,
        reason:
          state.reason ||
          (state.draft
            ? "No reproducible lab or landmark mapping"
            : "No draft counterpart"),
      });
      continue;
    }
    const entry = inventory.draft_states.find(
      (s) => s.id === mapping.draft_state && s.state === state.id,
    );
    if (!entry) {
      report.gaps.push({
        state: state.id,
        reason: `Draft state mapping ${mapping.draft_state} missing from inventory`,
      });
      continue;
    }
    for (const presentation of inventory.presentations) {
      const key = `${state.id}-${presentation.id}`;
      console.log(`Comparing ${key}`);
      const pair = {
        key,
        draft: entry.draft,
        state: mapping.draft_state,
        presentation: presentation.id,
        differences: [],
        deviations: [],
        incidental: [],
        gaps: [],
        images: {},
      };
      report.pairs.push(pair);
      try {
        await fixture(`scenario?value=${state.scenario}`);
        if (mapping.draft.prototype) await fixture("conversations-reset");
        await fixture("pi-state?value=missing");
        await lab.setViewportSize({
          width: presentation.width,
          height: presentation.height,
        });
        if (state.id === "sign-in") await labContext.clearCookies();
        await lab.goto(`${origin}/workspaces`);
        await lab.evaluate(
          (theme) => localStorage.setItem("nah:theme", theme),
          presentation.theme,
        );
        await lab.reload();
        for (const step of state.steps) {
          if (step === "login") {
            if (
              await lab
                .getByRole("button", { name: "Kirjaudu GitHubilla" })
                .count()
            ) {
              await lab
                .getByRole("button", { name: "Kirjaudu GitHubilla" })
                .click();
              await lab
                .getByRole("link", { name: "Alice", exact: true })
                .click();
            }
          } else if (step === "repo-chooser") {
            await lab
              .getByRole("button", { name: "Jatka ilman repoja" })
              .click();
          } else if (step === "start-sign-in") {
            await lab
              .getByRole("button", { name: "Aloita kirjautuminen" })
              .click();
          } else if (
            step === "synthetic-turn-long" ||
            step === "synthetic-turn-short"
          ) {
            if (presentation.width === 390)
              await lab
                .getByRole("button", { name: "Avaa navigaatio" })
                .click();
            await lab
              .getByRole("navigation")
              .getByRole("link", { name: /aurinkokello/ })
              .first()
              .click();
            await lab
              .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
              .click();
            await lab
              .getByRole("textbox", { name: "Viesti Pi:lle" })
              .fill(
                step.endsWith("long")
                  ? "monirivinen komento ja pitkä tuloste"
                  : "Tarkista lyhyt tuloste",
              );
            await lab
              .getByRole("button", { name: "Lähetä", exact: true })
              .click();
            await lab
              .getByRole("button", { name: /Työ ·/ })
              .first()
              .waitFor({ timeout: 30000 });
          } else throw new Error(`Unsupported lab step: ${step}`);
        }
        await lab.locator(state.region).first().waitFor();
        if (state.id === "pi-code") await lab.getByText("ABCD-1234").waitFor();
        if (state.id === "pi-start" || state.id === "pi-code")
          await lab
            .getByRole("heading", { name: "Kirjaudu OpenAI-tiliisi" })
            .waitFor();
        if (
          (await lab.evaluate(() => document.documentElement.dataset.theme)) !==
          presentation.theme
        )
          throw new Error("Lab theme did not settle");
        await draft.goto(pathToFileURL(resolve(entry.draft)).href);
        const prototype = !!mapping.draft.prototype;
        let frameSelector;
        if (prototype) {
          await draft.locator("#theme").selectOption(presentation.theme);
          if (presentation.width === 390) await draft.locator("#phone").check();
          frameSelector = "#stage .vwrap > .turn.live";
          await draft.locator(frameSelector).waitFor();
          await draft
            .locator(`${frameSelector} .strip-btn`)
            .waitFor({ timeout: 45000 });
        } else {
          await draft.waitForFunction(
            () => typeof window.__dcSetProps === "function",
          );
          const name = await draft.evaluate(() => window.__dcRootName());
          await draft.evaluate(
            ({ name, theme }) => window.__dcSetProps(name, { theme }),
            { name, theme: presentation.theme },
          );
          if (mapping.draft.step === 2)
            await draft.getByRole("tab", { name: "2 · Repot" }).click();
          if (mapping.draft.step === 3)
            await draft.getByRole("tab", { name: "3 · OpenAI" }).click();
          if (mapping.draft.step === 3 && mapping.draft.state === "pending")
            await draft
              .getByRole("button", { name: /Koodi näkyvissä/ })
              .first()
              .click();
          if (mapping.draft.mode === "luku")
            await draft
              .getByRole("button", { name: "Vain luku", exact: true })
              .first()
              .click();
          await draft.waitForFunction(
            (theme) =>
              document
                .querySelector("#dc-root [data-theme]")
                ?.getAttribute("data-theme") === theme,
            presentation.theme,
          );
          frameSelector = `#dc-root [style*="width: ${presentation.width}px"][style*="height: ${presentation.height}px"]`;
        }
        const draftFrame = draft.locator(frameSelector).first();
        await draftFrame.waitFor();
        await Promise.all([
          draft.evaluate(() => document.fonts.ready),
          lab.evaluate(() => document.fonts.ready),
        ]);
        const draftRegion = draftFrame;
        const labRegion = lab.locator(state.region).first();
        const draftText = (await draftRegion.innerText()).replace(/\s+/g, " ");
        const labText = (await labRegion.innerText()).replace(/\s+/g, " ");
        // Drafts contain mocked identities and repo names. Never silently call these like-for-like.
        if (!draftText || !labText || !draftText.includes(labText.slice(0, 30)))
          pair.gaps.push(
            "Content/fixture mismatch: compare layout and controls only; not a like-for-like copy comparison",
          );
        await image(draftRegion, `${output}/${key}-draft`);
        await image(labRegion, `${output}/${key}-lab`);
        pair.images.draft = `${key}-draft.avif`;
        pair.images.lab = `${key}-lab.avif`;
        const draftTree = await controls(
          draft,
          mapping.draftControls
            ? `${frameSelector} ${mapping.draftControls}`
            : frameSelector,
        );
        const labTree = await controls(
          lab,
          mapping.labControls ?? state.region,
        );
        const controlLines = (tree) =>
          tree
            .split("\n")
            .map((s) => s.trim())
            .filter((s) =>
              /^- (button|link|textbox|checkbox|radio|switch|menuitem|combobox)\b/.test(
                s,
              ),
            );
        const dControls = controlLines(draftTree),
          lControls = controlLines(labTree);
        // Multiset comparison: two identically named controls on one side
        // must not disappear behind one matching control on the other.
        for (const [side, list, opposite] of [
          ["draft", dControls, lControls],
          ["lab", lControls, dControls],
        ]) {
          const remaining = [...opposite];
          for (const line of list) {
            const index = remaining.indexOf(line);
            if (index >= 0) remaining.splice(index, 1);
            else
              pair.differences.push({
                landmark: "controls",
                property: "role + accessible name",
                side,
                value: line,
              });
          }
        }
        for (const landmark of mapping.landmarks) {
          try {
            const expected = await readLandmark(
              draft,
              landmark.draft === ":scope"
                ? frameSelector
                : `${frameSelector} ${landmark.draft}`,
              landmark.properties,
              landmark.dimensions,
            );
            const actual = await readLandmark(
              lab,
              landmark.labMetric
                ? inventory.foundation_metrics[landmark.labMetric]
                : landmark.lab,
              landmark.properties,
              landmark.dimensions,
            );
            for (const property of [
              ...landmark.properties,
              ...landmark.dimensions,
            ]) {
              const canonical = landmark.canonical?.[property];
              // A curated repeated-draft variant may resolve to a common
              // token; never infer a blanket tolerance from pixel distance.
              let target = expected[property];
              if (
                canonical?.draftVariants.includes(target) &&
                canonical.reason
              ) {
                pair.incidental.push({
                  landmark: landmark.id,
                  property,
                  draft: target,
                  canonical: canonical.value,
                  reason: canonical.reason,
                });
                target = canonical.value;
              }
              if (target === actual[property]) continue;
              if (
                property === "height" &&
                pair.gaps.some((g) => g.startsWith("Content/fixture mismatch"))
              ) {
                pair.gaps.push(
                  `${landmark.id} height: draft ${expected[property]} / lab ${actual[property]} (text differs; not a design verdict)`,
                );
                continue;
              }
              const difference = {
                landmark: landmark.id,
                property,
                draft: target,
                lab: actual[property],
              };
              // Only named differences with a precise design reference can be waived.
              const deviation = (landmark.deviations || []).find(
                (d) =>
                  d.property === property &&
                  d.draft === target &&
                  d.lab === actual[property],
              );
              if (deviation)
                pair.deviations.push({
                  ...difference,
                  reference: deviation.reference,
                });
              else pair.differences.push(difference);
            }
          } catch (error) {
            pair.gaps.push(`${landmark.id}: ${String(error)}`);
          }
        }
        if (!mapping.landmarks.length)
          pair.gaps.push("No mapped style/dimension landmarks yet");
      } catch (error) {
        console.error(`${key}: ${String(error).slice(0, 350)}`);
        pair.gaps.push(`Comparison failed: ${String(error).slice(0, 350)}`);
      }
    }
  }
  for (const entry of inventory.draft_states)
    if (
      !entry.state ||
      !inventory.landmarks[entry.state] ||
      inventory.landmarks[entry.state].draft_state !== entry.id
    )
      report.gaps.push({
        draftState: entry.id,
        reason: "No reproducible mapped lab counterpart",
      });
} finally {
  await browser.close();
  await writeFile(
    `${output}/report.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  const lines = [
    `# Draft / lab fidelity`,
    "",
    `Lab and drafts: ${commit}; inventory: ${report.inventory}; synthetic lab only.`,
    "",
    `Pairs: ${report.pairs.length}; unresolved differences: ${report.pairs.reduce((n, p) => n + p.differences.length, 0)}; pair gaps: ${report.pairs.reduce((n, p) => n + p.gaps.length, 0)}; inventory gaps: ${report.gaps.length}.`,
    "",
    "Computed values are exact, without a blanket pixel tolerance. Only a property/value-specific deviation with a design.md reference is approved; incidental repeated-draft variations are not automatically treated as production requirements. Screenshots show overall appearance, not proof of semantic equivalence. See report.json for every control and measurement.",
    "",
    "## Pairs",
  ];
  for (const pair of report.pairs) {
    lines.push(`\n### ${pair.key} (${pair.draft} · ${pair.state})`, "");
    if (pair.images.draft)
      lines.push(
        `![Draft](${pair.images.draft}) ![Lab](${pair.images.lab})`,
        "",
      );
    for (const gap of pair.gaps) lines.push(`- GAP: ${gap}`);
    for (const difference of pair.differences)
      lines.push(
        `- UNRESOLVED ${difference.landmark} ${difference.property}: draft ${difference.draft ?? difference.value} / lab ${difference.lab ?? "—"}`,
      );
    for (const incidental of pair.incidental)
      lines.push(
        `- INCIDENTAL ${incidental.landmark} ${incidental.property}: draft ${incidental.draft}; canonical ${incidental.canonical} (${incidental.reason})`,
      );
    for (const deviation of pair.deviations)
      lines.push(
        `- AGREED ${deviation.landmark} ${deviation.property}: ${deviation.reference}`,
      );
  }
  lines.push(
    "",
    "## Unmapped and unreproducible states",
    "",
    ...report.gaps.map((g) => `- GAP ${g.state || g.draftState}: ${g.reason}`),
    "",
  );
  await writeFile(`${output}/report.md`, lines.join("\n"));
}
console.log(
  `${relative(root, output)}/report.md: ${report.pairs.length} pairs, ${report.gaps.length} inventory gaps`,
);
