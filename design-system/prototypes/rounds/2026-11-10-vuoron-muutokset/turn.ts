import { editLines } from "../../../../web/src/components/FileToolCard";

// The simulated turns. Everything here is invented: a hiking-route web app
// `retkiopas`, its files and the agent's work. Each step has its moment on
// the turn's own clock (ms from the person's message), so a running turn can
// be played and stopped on the page clock.

export type Op = " " | "-" | "+";
export type Change = "modified" | "created" | "deleted";

/** One thing that changed a file, in the order the agent did it. */
export type FileEvent = {
  at: number;
  /** Pi's tool, or the command whose effect Git saw afterwards. */
  tool: "edit" | "write" | "bash";
  /** The step that did it, so a timeline can point at its card. */
  step: string;
  /** Pi's edit arguments; the card renders them as production does. */
  edits?: { oldText: string; newText: string }[];
  content?: string;
  command?: string;
};

export type FileChange = {
  path: string;
  change: Change;
  binary?: { bytes: number };
  /** Text before the turn (absent for a created file). */
  before?: string;
  /** Text after the turn (absent for a deleted file). */
  after?: string;
  events: FileEvent[];
};

export type Step =
  | { kind: "thinking"; key: string; at: number; text: string }
  | { kind: "read"; key: string; at: number; path: string; output: string }
  | { kind: "edit"; key: string; at: number; path: string; edits: { oldText: string; newText: string }[] }
  | { kind: "write"; key: string; at: number; path: string; content: string }
  | { kind: "bash"; key: string; at: number; command: string; output: string; failed?: boolean; ms: number }
  | { kind: "text"; key: string; at: number; text: string };

export type Turn = {
  id: string;
  ask: string;
  steps: Step[];
  files: FileChange[];
  /** The page clock stops here in the running case: the turn is still on. */
  holdAt?: number;
};

// ---------- File texts ----------

const HAKU_BEFORE = `import { etaisyys, type Piste } from "../kartta/geo";
import { suodataKausi } from "./kausi";

export type Reitti = {
  nimi: string;
  pisteet: Piste[];
  pituusKm: number;
};

/** Reitin pituus pisteiden välisistä etäisyyksistä. */
export function laskeReitti(nimi: string, pisteet: Piste[]): Reitti {
  let matka = 0;
  for (let i = 1; i < pisteet.length; i++) {
    matka += etaisyys(pisteet[i - 1], pisteet[i]);
  }
  return {
    nimi,
    pisteet,
    pituusKm: Math.round(matka * 10) / 10,
  };
}

export function normalisoi(sana: string): string {
  return sana
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "");
}

export function haeReitit(reitit: Reitti[], hakusana: string, kk: number): Reitti[] {
  const sana = normalisoi(hakusana);
  return suodataKausi(reitit, kk)
    .filter((r) => normalisoi(r.nimi).includes(sana))
    .sort((a, b) => a.pituusKm - b.pituusKm);
}

export function kuvaus(r: Reitti): string {
  return \`\${r.nimi} · \${r.pituusKm} km\`;
}
`;

const HAKU_E1 = {
  oldText: `import { suodataKausi } from "./kausi";`,
  newText: `import { nousu } from "../kartta/korkeus";
import { suodataKausi } from "./kausi";`,
};
const HAKU_E2 = {
  oldText: `  pituusKm: number;
};`,
  newText: `  pituusKm: number;
  /** Nousu yhteensä metreinä. */
  nousuM: number;
};`,
};
const HAKU_E2b = {
  oldText: `    pituusKm: Math.round(matka * 10) / 10,
  };`,
  newText: `    pituusKm: Math.round(matka * 10) / 10,
    nousuM: nousu(pisteet),
  };`,
};
const HAKU_E3 = {
  oldText: `    nousuM: nousu(pisteet),`,
  newText: `    // Korkeusmalli on 5 metrin tarkkuudella.
    nousuM: Math.round(nousu(pisteet) / 5) * 5,`,
};
const HAKU_E3b = {
  oldText: "  return `${r.nimi} · ${r.pituusKm} km`;",
  newText: "  return `${r.nimi} · ${r.pituusKm} km · nousua ${r.nousuM} m`;",
};

const TEST_BEFORE = `import { describe, expect, it } from "vitest";
import { haeReitit, laskeReitti } from "./haku";
import { NUUKSIO } from "./testireitit";

describe("laskeReitti", () => {
  it("laskee pituuden kymmenesosan tarkkuudella", () => {
    const r = laskeReitti("Haukankierros", NUUKSIO);
    expect(r.pituusKm).toBe(4.2);
  });
});

describe("haeReitit", () => {
  it("löytää reitin ilman ääkkösiä", () => {
    const r = laskeReitti("Haukankierros", NUUKSIO);
    expect(haeReitit([r], "haukan", 6)).toEqual([r]);
  });
});
`;
const TEST_E1 = {
  oldText: `    expect(r.pituusKm).toBe(4.2);
  });`,
  newText: `    expect(r.pituusKm).toBe(4.2);
  });

  it("laskee nousun viiden metrin tarkkuudella", () => {
    const r = laskeReitti("Haukankierros", NUUKSIO);
    expect(r.nousuM).toBe(115);
  });`,
};

const KORKEUS = `import type { Piste } from "./geo";

/**
 * Reitin nousu metreinä: vain ylämäet lasketaan, ja alle kahden
 * metrin vaihtelu jätetään pois mittausvirheenä.
 */
export function nousu(pisteet: Piste[]): number {
  let yhteensa = 0;
  for (let i = 1; i < pisteet.length; i++) {
    const ero = pisteet[i].korkeus - pisteet[i - 1].korkeus;
    if (ero > 2) yhteensa += ero;
  }
  return Math.round(yhteensa);
}

/** Korkein kohta, jos reitillä on korkeustiedot. */
export function huippu(pisteet: Piste[]): number | undefined {
  if (!pisteet.length) return undefined;
  return Math.max(...pisteet.map((p) => p.korkeus));
}
`;

const TASOT_BEFORE = `import { Taso } from "./Taso";
import { vanhaTaso } from "../vanha/kartta-legacy";
import type { Kartta } from "./tyypit";

export function Tasot({ kartta }: { kartta: Kartta }) {
  return (
    <>
      <Taso nimi="maasto" lahde={kartta.maasto} />
      <Taso nimi="reitit" lahde={kartta.reitit} />
      {kartta.vanha ? vanhaTaso(kartta) : null}
    </>
  );
}
`;
const TASOT_E1 = {
  oldText: `import { vanhaTaso } from "../vanha/kartta-legacy";
`,
  newText: "",
};
const TASOT_E2 = {
  oldText: `      {kartta.vanha ? vanhaTaso(kartta) : null}
`,
  newText: "",
};

const LEGACY = `// Vanha karttapohja ennen vektoritasoja (2024). Ei enää käytössä
// uusissa näkymissä; Tasot.tsx kutsuu tätä vain vanhoille kartoille.
import type { Kartta } from "../kartta/tyypit";

const RUUTU = 256;

export function vanhaTaso(kartta: Kartta) {
  const ruudut = [];
  for (let x = 0; x < kartta.leveys / RUUTU; x++) {
    for (let y = 0; y < kartta.korkeus / RUUTU; y++) {
      ruudut.push(
        <img
          key={\`\${x}-\${y}\`}
          src={\`/vanha/\${kartta.id}/\${x}_\${y}.png\`}
          style={{ left: x * RUUTU, top: y * RUUTU }}
          alt=""
        />,
      );
    }
  }
  return <div className="vanha-kartta">{ruudut}</div>;
}
`;

const PKG_BEFORE = `{
  "name": "retkiopas",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  }
}
`;
const PKG_E1 = {
  oldText: `    "test": "vitest run"`,
  newText: `    "test": "vitest run",
    "kuvakkeet": "node scripts/kuvakkeet.mjs"`,
};

const README_BEFORE = `# Retkiopas

Retkiopas näyttää lähialueen retkireitit kartalla ja hakee niitä nimellä.

## Asennus

    npm install
    npm run dev

## Reittihaku

Haku vertaa nimiä ilman ääkkösiä ja näyttää lyhimmän reitin ensin.
Reitin pituus lasketaan pisteiden välisistä etäisyyksistä.
`;
const README_E1 = {
  oldText: `Reitin pituus lasketaan pisteiden välisistä etäisyyksistä.`,
  newText: `Reitin pituus lasketaan pisteiden välisistä etäisyyksistä, ja nousu
korkeusmallista viiden metrin tarkkuudella.`,
};

const README_TYPO_BEFORE = README_BEFORE.replace("npm run dev", "npm rnu dev");
const README_TYPO = { oldText: "    npm rnu dev", newText: "    npm run dev" };

// ---------- Helpers ----------

export const apply = (text: string, edits: { oldText: string; newText: string }[]) =>
  edits.reduce((t, e) => t.replace(e.oldText, e.newText), text);

/** The net diff, as production's file card expects a native unified diff:
 * three lines of context, a quiet "⋯" row between hunks. */
export function unified(path: string, before = "", after = ""): string {
  const strip = (s: string) => (s ? s.replace(/\n$/, "").split("\n") : []);
  const ops: [Op, string][] = before
    ? after
      ? editLines(before.replace(/\n$/, ""), after.replace(/\n$/, ""))
      : strip(before).map((l) => ["-", l] as [Op, string])
    : strip(after).map((l) => ["+", l] as [Op, string]);
  const keep = ops.map(() => false);
  ops.forEach(([op], i) => {
    if (op === " ") return;
    for (let j = Math.max(0, i - 3); j <= Math.min(ops.length - 1, i + 3); j++) keep[j] = true;
  });
  const lines: string[] = [];
  let gap = false;
  ops.forEach(([op, text], i) => {
    if (!keep[i]) {
      gap = lines.length > 0;
      return;
    }
    if (gap) lines.push(" ⋯");
    gap = false;
    lines.push(`${op}${text}`);
  });
  return `--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n${lines.join("\n")}`;
}

/** Line counts of the net change; binary files have none. */
export function counts(f: FileChange): { add: number; del: number } | undefined {
  if (f.binary) return undefined;
  const ops = unified(f.path, f.before, f.after)
    .split("\n")
    .slice(3)
    .filter((l) => l !== " ⋯");
  return { add: ops.filter((l) => l[0] === "+").length, del: ops.filter((l) => l[0] === "-").length };
}

/** Where the editor should open: the first changed line after the turn. */
export function firstLine(f: FileChange): number | undefined {
  if (f.binary || f.change === "deleted") return undefined;
  if (!f.before) return 1;
  const ops = editLines(f.before.replace(/\n$/, ""), (f.after ?? "").replace(/\n$/, ""));
  let line = 0;
  for (const [op] of ops) {
    if (op !== "-") line++;
    if (op !== " ") return Math.max(1, op === "-" ? line + 1 : line);
  }
  return 1;
}

/** One event's own line counts, for a timeline marker. */
export function eventCounts(e: FileEvent, f: FileChange): { add: number; del: number } | undefined {
  if (f.binary) return undefined;
  if (e.edits) {
    const ops = e.edits.flatMap((x) => editLines(x.oldText, x.newText));
    return { add: ops.filter((o) => o[0] === "+").length, del: ops.filter((o) => o[0] === "-").length };
  }
  if (e.content !== undefined) return { add: e.content.replace(/\n$/, "").split("\n").length, del: 0 };
  return counts(f);
}

export const lineCount = (s: string) => s.replace(/\n$/, "").split("\n").length;

// ---------- The turns ----------

const S = 1000;

/** Eight files: a new one, one edited three times, one deleted and one
 * binary made by commands, and small edits. Two stages. */
export const MANY: Turn = {
  id: "monta",
  ask: "Lisää reittihakuun korkeuserot: tuloksessa pitää näkyä nousu metreinä. Vanha karttakoodi saa samalla lähteä. Tee laavulle myös oma kuvake.",
  steps: [
    { kind: "thinking", key: "t1", at: 4 * S, text: "Katson ensin, miten reittihaku laskee matkan" },
    { kind: "read", key: "r1", at: 7 * S, path: "src/reitit/haku.ts", output: HAKU_BEFORE },
    { kind: "read", key: "r2", at: 9 * S, path: "src/kartta/geo.ts", output: 'export type Piste = { lat: number; lon: number; korkeus: number };\n' },
    { kind: "write", key: "w1", at: 21 * S, path: "src/kartta/korkeus.ts", content: KORKEUS },
    { kind: "edit", key: "e1", at: 27 * S, path: "src/reitit/haku.ts", edits: [HAKU_E1] },
    { kind: "edit", key: "e2", at: 36 * S, path: "src/reitit/haku.ts", edits: [HAKU_E2, HAKU_E2b] },
    { kind: "bash", key: "b1", at: 44 * S, ms: 6 * S, command: "npm test -- haku", output: " ✓ src/reitit/haku.test.ts (2)\n ✗ src/reitit/nayta.test.ts > näyttää pituuden\n   Expected: \"Haukankierros · 4.2 km\"\n   Received: \"Haukankierros · 4.2 km · nousua 117 m\"\n\n Tests  1 failed | 2 passed", failed: true },
    {
      kind: "text",
      key: "s1",
      at: 58 * S,
      text: "Nousu lasketaan nyt, mutta korkeusmalli antaa metrin tarkkuuden, jota sillä ei oikeasti ole (117 m). Pyöristän nousun viiteen metriin, lisään sille testin ja poistan sitten vanhan karttakoodin.",
    },
    { kind: "edit", key: "e3", at: 66 * S, path: "src/reitit/haku.ts", edits: [HAKU_E3, HAKU_E3b] },
    { kind: "edit", key: "e4", at: 74 * S, path: "src/reitit/haku.test.ts", edits: [TEST_E1] },
    { kind: "bash", key: "b2", at: 80 * S, ms: 5 * S, command: "npm test", output: " ✓ src/reitit/haku.test.ts (3)\n ✓ src/reitit/nayta.test.ts (4)\n ✓ src/kartta/korkeus.test.ts (2)\n\n Tests  9 passed" },
    { kind: "edit", key: "e5", at: 92 * S, path: "src/kartta/Tasot.tsx", edits: [TASOT_E1, TASOT_E2] },
    { kind: "bash", key: "b3", at: 98 * S, ms: 1 * S, command: "git rm src/vanha/kartta-legacy.ts", output: "rm 'src/vanha/kartta-legacy.ts'" },
    { kind: "bash", key: "b4", at: 108 * S, ms: 3 * S, command: "node scripts/kuvakkeet.mjs laavu", output: "public/kuvakkeet/laavu.png 48×48 (3,4 kt)" },
    { kind: "edit", key: "e6", at: 117 * S, path: "package.json", edits: [PKG_E1] },
    { kind: "edit", key: "e7", at: 126 * S, path: "README.md", edits: [README_E1] },
    {
      kind: "text",
      key: "f",
      at: 141 * S,
      text: "Reittihaku näyttää nyt nousun metreinä, esimerkiksi `Haukankierros · 4.2 km · nousua 115 m`.\n\n- Uusi `src/kartta/korkeus.ts` laskee nousun ja jättää alle kahden metrin vaihtelun pois.\n- Nousu pyöristetään viiteen metriin, koska korkeusmalli ei ole tarkempi; sille on testi.\n- Vanha karttapohja `src/vanha/kartta-legacy.ts` on poistettu, eikä `Tasot.tsx` enää kutsu sitä.\n- Laavun kuvake on `public/kuvakkeet/laavu.png`, ja sen voi tehdä uudelleen komennolla `npm run kuvakkeet`.\n\nKaikki 9 testiä menevät läpi.",
    },
  ],
  files: [
    {
      path: "src/reitit/haku.ts",
      change: "modified",
      before: HAKU_BEFORE,
      after: apply(HAKU_BEFORE, [HAKU_E1, HAKU_E2, HAKU_E2b, HAKU_E3, HAKU_E3b]),
      events: [
        { at: 27 * S, tool: "edit", step: "e1", edits: [HAKU_E1] },
        { at: 36 * S, tool: "edit", step: "e2", edits: [HAKU_E2, HAKU_E2b] },
        { at: 66 * S, tool: "edit", step: "e3", edits: [HAKU_E3, HAKU_E3b] },
      ],
    },
    { path: "src/kartta/korkeus.ts", change: "created", after: KORKEUS, events: [{ at: 21 * S, tool: "write", step: "w1", content: KORKEUS }] },
    {
      path: "src/reitit/haku.test.ts",
      change: "modified",
      before: TEST_BEFORE,
      after: apply(TEST_BEFORE, [TEST_E1]),
      events: [{ at: 74 * S, tool: "edit", step: "e4", edits: [TEST_E1] }],
    },
    {
      path: "src/kartta/Tasot.tsx",
      change: "modified",
      before: TASOT_BEFORE,
      after: apply(TASOT_BEFORE, [TASOT_E1, TASOT_E2]),
      events: [{ at: 92 * S, tool: "edit", step: "e5", edits: [TASOT_E1, TASOT_E2] }],
    },
    {
      path: "src/vanha/kartta-legacy.ts",
      change: "deleted",
      before: LEGACY,
      events: [{ at: 98 * S, tool: "bash", step: "b3", command: "git rm src/vanha/kartta-legacy.ts" }],
    },
    {
      path: "public/kuvakkeet/laavu.png",
      change: "created",
      binary: { bytes: 3482 },
      events: [{ at: 108 * S, tool: "bash", step: "b4", command: "node scripts/kuvakkeet.mjs laavu" }],
    },
    {
      path: "package.json",
      change: "modified",
      before: PKG_BEFORE,
      after: apply(PKG_BEFORE, [PKG_E1]),
      events: [{ at: 117 * S, tool: "edit", step: "e6", edits: [PKG_E1] }],
    },
    {
      path: "README.md",
      change: "modified",
      before: README_BEFORE,
      after: apply(README_BEFORE, [README_E1]),
      events: [{ at: 126 * S, tool: "edit", step: "e7", edits: [README_E1] }],
    },
  ],
  // Stopped after the deletion, before the icon: four files so far.
  holdAt: 101 * S,
};

/** One small edit in one file. */
export const SMALL: Turn = {
  id: "pieni",
  ask: "Asennusohjeessa on kirjoitusvirhe, korjaa se.",
  steps: [
    { kind: "read", key: "r1", at: 3 * S, path: "README.md", output: README_TYPO_BEFORE },
    { kind: "edit", key: "e1", at: 8 * S, path: "README.md", edits: [README_TYPO] },
    { kind: "text", key: "f", at: 11 * S, text: "Korjasin README:n asennusohjeen: `npm rnu dev` on nyt `npm run dev`." },
  ],
  files: [
    {
      path: "README.md",
      change: "modified",
      before: README_TYPO_BEFORE,
      after: apply(README_TYPO_BEFORE, [README_TYPO]),
      events: [{ at: 8 * S, tool: "edit", step: "e1", edits: [README_TYPO] }],
    },
  ],
};

/** What the turn has done by `now` on its own clock. */
export function turnAt(turn: Turn, now: number): { steps: Step[]; files: FileChange[]; running: boolean } {
  const steps = turn.steps.filter((s) => s.at <= now);
  const running = steps.length < turn.steps.length;
  const files = turn.files
    .map((f) => {
      const events = f.events.filter((e) => {
        const step = turn.steps.find((s) => s.key === e.step);
        // A command's effect is seen when the command has finished.
        return step && (step.kind === "bash" ? step.at + step.ms <= now : step.at <= now);
      });
      if (!events.length) return null;
      if (events.length === f.events.length) return f;
      // Part way: the file as the edits so far left it.
      const edits = events.flatMap((e) => e.edits ?? []);
      return { ...f, events, after: f.before !== undefined ? apply(f.before, edits) : f.after };
    })
    .filter((f): f is FileChange => !!f);
  return { steps, files, running };
}
