// biome-ignore-all lint/suspicious/noTemplateCurlyInString: synthetic source and assertions preserve template placeholders literally.
import { expect, it } from "vitest";
import {
  extractCatalog,
  extractSettings,
  languageFindings,
} from "./catalog-review.mjs";

it("keeps array indices, template placeholders and helper text for review", () => {
  const rows = extractCatalog(
    [
      'const fi = { steps: ["Avaa", "Sulje"], label: (n: number) => `${n} asiaa` };',
      'const helper = () => "Palauta";',
      'export const text = catalog(fi, { steps: ["Open", "Close"], label: (n: number) => `${n} ${helper()}` });',
    ].join("\n"),
    "sample.ts",
  );
  expect(rows.map((row) => row.key)).toEqual([
    "sample.ts#text.steps.0",
    "sample.ts#text.steps.1",
    "sample.ts#text.label",
  ]);
  expect(rows[2]["en-US"].source).toContain("${n}");
  expect(rows[2]["en-US"].helpers).toEqual({ helper: '() => "Palauta"' });
  expect(languageFindings(rows).map((finding) => finding.language)).toEqual([
    "en-US",
    "en-GB",
  ]);
});

it("includes settings labels by stable id but not bilingual search keywords", () => {
  const rows = extractSettings(
    [
      {
        id: "test",
        label: "Asetukset",
        kw: ["settings"],
        rows: [{ id: "row", label: "Rivi", desc: "Kuvaus", kw: ["retry"] }],
      },
    ],
    'const settingsIndexEnglish = { test: { label: "Settings", rows: { row: { label: "Row", desc: "Description" } } } };',
  );
  expect(rows.map((row) => row.key)).toEqual([
    "settingsIndex.ts#settingsIndexText.test.label",
    "settingsIndex.ts#settingsIndexText.test.rows.row.label",
    "settingsIndex.ts#settingsIndexText.test.rows.row.desc",
  ]);
  expect(languageFindings(rows)).toEqual([]);
});

it("finds regional and Finnish-letter leftovers inside JSX and template branches", () => {
  const rows = extractCatalog(
    "const fi = { text: (n: number) => <>Teksti {n}</> }; const text = catalog(fi, { text: (n: number) => n ? <>Organisations</> : `Näytä ${n}` }, { text: (n: number) => <>Organizations {n}</> });",
    "sample.tsx",
  );
  expect(
    languageFindings(rows).map(({ language, matches }) => [language, matches]),
  ).toEqual([
    ["en-US", ["Other English region"]],
    ["en-US", ["Finnish letter"]],
    ["en-GB", ["Other English region"]],
  ]);
});
