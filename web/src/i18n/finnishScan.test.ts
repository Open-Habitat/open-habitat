import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { settingsSections } from "../app/settingsIndex";
import { finnishWords, scan } from "./finnishScan";

// No Finnish in the interface's source outside the catalogs: an English
// reader meets every word the views show through src/text. Finnish that
// stays on purpose is listed here with its reason, by file and exact text.
const allowed: Record<string, { texts: readonly string[] | "*"; why: string }> =
  {
    "app/settingsIndex.ts": {
      texts: "*",
      why: "the Finnish half of the settings index (English in text/settingsIndex.ts) and its bilingual search words",
    },
    "components/repoCatalog.ts": {
      texts: ["Omat", "Organisaatio", "Ryhmä", "Aliryhmä", "Yhteistyö"],
      why: "section kinds are identifiers; the clone page names them from its catalog",
    },
    "app/GitIdentity.tsx": {
      texts: ["Gitin globaali asetus"],
      why: "a source value the daemon sends; the page words it from its catalog",
    },
    "app/conversations.ts": {
      texts: ["agentti"],
      why: "a worktree branch name, an identifier",
    },
    "app/OnboardingAdministration.tsx": {
      texts: ["lisaa", "pois"],
      why: "route query parameters",
    },
    "app/App.tsx": {
      texts: [
        "Synteettisessä demossa ei voi luoda työtiloja.",
        "SYNTEETTINEN DEMO · Simuloitu identiteetti ja workspace-data · Ei oikeaa kirjautumista, agentteja eikä host-yhteyttä",
      ],
      why: "demo-only text beside its English twin, kept out of the catalogs so the production bundle carries no demo marker",
    },
    "components/LoginCard.tsx": {
      texts: [
        "Simuloidussa demossa ei voi kirjautua.",
        "Tämä näkymä on simulaatio.",
      ],
      why: "demo-only text beside its English twin, as in App.tsx",
    },
  };

// Route slugs of the settings sections are identifiers (/settings/tili).
const slugs = new Set<string>(settingsSections.map((s) => s.id));

function unexplained(srcDir: string) {
  const words = finnishWords(join(srcDir, "text"));
  return scan(srcDir, words).filter(({ file, text }) => {
    if (slugs.has(text)) return false;
    const entry = allowed[file];
    return !entry || (entry.texts !== "*" && !entry.texts.includes(text));
  });
}

it("finds no Finnish outside the catalogs", () => {
  expect(unexplained("src")).toEqual([]);
});

it("finds Finnish in a string, a template and JSX text, not in a comment", () => {
  const src = mkdtempSync(join(tmpdir(), "finnish-scan-"));
  try {
    mkdirSync(join(src, "text"));
    writeFileSync(
      join(src, "text", "sample.ts"),
      'const fi = { close: "Sulje" };\nexport const t = catalog(fi, { close: "Close" });\n',
    );
    writeFileSync(
      join(src, "View.tsx"),
      [
        "// Sulje tämä kommentti",
        'export const a = "Sulje";',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: source text of a template literal.
        "export const b = (n: number) => `${n} päivää`;",
        "export const c = <p>Avaa näkymä</p>;",
        'export const d = "Close";',
      ].join("\n"),
    );
    expect(unexplained(src).map(({ line }) => line)).toEqual([2, 3, 4]);
  } finally {
    rmSync(src, { recursive: true, force: true });
  }
});
