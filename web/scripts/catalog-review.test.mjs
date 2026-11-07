import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";
import {
  extractCatalog,
  foreignWords,
  languageFindings,
  readCatalogs,
} from "./catalog-review.mjs";

it("checks all catalog messages in both directions, including function branches", async () => {
  const rows = await readCatalogs(pathToFileURL(`${resolve("src/text")}/`));
  expect(rows.length).toBeGreaterThan(1000);
  expect(languageFindings(rows)).toEqual([]);
  // Keep the small vocabulary grounded in the opposite language's catalogs.
  for (const [target, words] of Object.entries(foreignWords)) {
    const source = target === "fi" ? "en-US" : "fi";
    const vocabulary = new Set(
      rows.flatMap((row) =>
        row[source].texts.flatMap(
          (text) => text.toLowerCase().match(/\p{L}+/gu) ?? [],
        ),
      ),
    );
    expect(words.filter((word) => !vocabulary.has(word))).toEqual([]);
  }
});

it("extracts nested messages, whole JSX/functions and UK fallback without executing them", () => {
  const rows = extractCatalog(
    `
    const fi = { nested: { title: "Otsikko", count: (n: number) => n === 1 ? "yksi" : "monta" }, rich: (link: ReactNode) => <>Lue {link}</> };
    export const text = catalog(fi,
      { nested: { title: "Title", count: (n: number) => n === 1 ? "one" : "many" }, rich: (link: ReactNode) => <>Read {link}</> },
      { nested: { title: "UK title" } });
  `,
    "sample.tsx",
  );
  expect(rows.map((row) => row.key)).toEqual([
    "sample.tsx#text.nested.title",
    "sample.tsx#text.nested.count",
    "sample.tsx#text.rich",
  ]);
  expect(rows[0]["en-GB"].source).toBe("UK title");
  expect(rows[1]["en-GB"]).toEqual(rows[1]["en-US"]);
  expect(rows[1].fi.texts).toEqual(["yksi", "monta"]);
  expect(rows[2].fi.source).toContain("{link}");
});

it("finds ASCII Finnish and reverse leakage without matching substrings or comments", () => {
  const rows = extractCatalog(
    `
    const fi = { title: "Retry", action: (n: number) => n ? "Cancel" : "Peruuta" };
    export const text = catalog(fi, { title: "Tila", action: (n: number) => n ? "Palauta" : "Open" }, { title: "Sulje" });
  `,
    "sample.ts",
  );
  expect(
    languageFindings(rows).map(({ language, matches }) => [language, matches]),
  ).toEqual([
    ["fi", ["retry"]],
    ["en-US", ["tila"]],
    ["en-GB", ["sulje"]],
    ["fi", ["cancel"]],
    ["en-US", ["palauta"]],
    ["en-GB", ["palauta"]],
  ]);
  expect(
    languageFindings(
      extractCatalog(
        `
    const fi = { title: "GitHub" }; // Retry
    export const text = catalog(fi, { title: "Available" }); // Palauta
  `,
        "sample.ts",
      ),
    ),
  ).toEqual([]);
});

it("refuses missing, extra, differently shaped and unsupported entries", () => {
  for (const english of [
    "{}",
    '{ title: "Title", extra: "Extra" }',
    '{ title: () => "Title" }',
    "{ ...other }",
  ]) {
    expect(() =>
      extractCatalog(
        `const fi = { title: "Otsikko" }; export const text = catalog(fi, ${english});`,
        "sample.ts",
      ),
    ).toThrow();
  }
  expect(() => extractCatalog("const fi = {};", "sample.ts")).toThrow(
    "no catalog",
  );
});
