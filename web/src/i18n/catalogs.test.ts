import { expect, it } from "vitest";
import type { Catalog } from ".";

// Every catalog under src/text: English has every message Finnish has (the
// compiler checks the shape; this checks nothing was left in Finnish by
// copying), and no English text carries Finnish letters.
const modules = import.meta.glob<Record<string, unknown>>(
  "../text/*.{ts,tsx}",
  {
    eager: true,
  },
);

function strings(value: unknown, path: string, out: [string, string][]) {
  if (typeof value === "string") out.push([path, value]);
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) strings(v, `${path}.${k}`, out);
  return out;
}

const catalogs = Object.entries(modules).flatMap(([file, exports]) =>
  Object.entries(exports)
    .filter(([, v]) => !!v && typeof v === "object" && "fi" in v && "en" in v)
    .map(([name, v]) => [`${file}#${name}`, v as Catalog<object>] as const),
);

it("finds the catalogs", () => {
  expect(catalogs.length).toBeGreaterThan(20);
});

it.each(catalogs)("%s has an English message for every Finnish one", (_, c) => {
  const keys = (v: unknown, path = ""): string[] =>
    v && typeof v === "object"
      ? Object.entries(v).flatMap(([k, x]) =>
          typeof x === "function" ? [`${path}.${k}`] : keys(x, `${path}.${k}`),
        )
      : [path];
  expect(keys(c.en).sort()).toEqual(keys(c.fi).sort());
  // A pinned exception: a language's own name and the console names that
  // stay in English contain no Finnish letters either.
  const finnish = strings(c.en, "en", []).filter(([, s]) => /[äöÄÖ]/.test(s));
  expect(finnish).toEqual([]);
});
