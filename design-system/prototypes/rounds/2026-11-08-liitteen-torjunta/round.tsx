import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import { refusalReason } from "../../../../web/src/app/mutations";
import { Composer } from "../../../../web/src/components/composer/Composer";
import { InlineNotice } from "../../../../web/src/components/Status";
import { setPersonalLanguage } from "../../../../web/src/i18n";
import { Composer as Fork } from "./forkComposer";
import type { Presentation } from "./refusal";
import "./round.css";

// proto-attachment-refusal, round 1. Jari 8.11.2026 on the test server: a
// too-large file shows a bare line above the composer, "Valitse 1 tavun –
// 20 MiB:n tiedosto.", unlike the other warnings and saying nothing about
// which file or what to do. Every direction shows two composers: on the
// left Jari's case (one file over 20 MiB), on the right the chosen case,
// by default several files at once. Nyt is the production Composer
// unchanged; the three directions are the round's copy (forkComposer.tsx),
// whose diff from its first commit is the specification.
setPersonalLanguage("fi");

const directions = ["Nyt", "Varoitus", "Siru", "Rivi"];
const PRESENT: (Presentation | null)[] = [null, "banner", "chips", "line"];
const LINES = [
  "Nyt: paljas virherivi kentän yllä; ensimmäinen hylätty tiedosto lopettaa koko pudotuksen, eikä nimeä kerrota.",
  "Varoitus: punainen yhteinen varoitus kentän yllä: tiedoston nimi otsikkona, raja ja mitä tehdä alla; monesta tiedostosta lista.",
  "Siru: hylätty tiedosto on punainen siru liitteiden rivissä syy sirussa; sirua painamalla näkyy raja ja mitä tehdä.",
  "Rivi: yksirivinen punainen varoitus: nimi, syy ja mitä tehdä; monesta tiedostosta määrä ja Näytä-painike listaan.",
];

type Case = "large" | "many" | "empty" | "count" | "total" | "quota" | "disk" | "failed";
const CASES: [Case, string][] = [
  ["many", "Monta kerralla"],
  ["large", "Liian suuri"],
  ["empty", "Tyhjä tiedosto"],
  ["count", "Yli 30 tiedostoa"],
  ["total", "Yli 100 Mt yhteensä"],
  ["quota", "Liitetila täynnä"],
  ["disk", "Palvelimen levy täynnä"],
  ["failed", "Yhteys katkeaa"],
];

const MB = 1024 * 1024;
type Spec = [name: string, size: number];
/** Files already in the draft before the case, and the files of the case. */
const SCRIPT: Record<Case, { seed: Spec[]; drop: Spec[] }> = {
  large: { seed: [], drop: [["kokous-2026-11-07.mov", 34.2 * MB]] },
  many: {
    seed: [],
    drop: [
      ["kuvakaappaus.png", 0.4 * MB],
      ["kokous-2026-11-07.mov", 34.2 * MB],
      ["muistio.txt", 0],
      ["haastattelu.m4a", 48 * MB],
      ["kaavio.pdf", 1.2 * MB],
    ],
  },
  empty: { seed: [], drop: [["muistio.txt", 0]] },
  count: {
    seed: [["sopimus.pdf", 0.3 * MB], ["liite-b.pdf", 0.2 * MB]],
    drop: Array.from({ length: 31 }, (_, i): Spec => [`kuva-${String(i + 1).padStart(2, "0")}.jpg`, 0.8 * MB]),
  },
  total: {
    seed: [1, 2, 3, 4, 5].map((i): Spec => [`tallenne-${i}.mp4`, 18 * MB]),
    drop: [["esitys.pdf", 15 * MB]],
  },
  quota: { seed: [], drop: [["raportti.pdf", 2.1 * MB]] },
  disk: { seed: [], drop: [["raportti.pdf", 2.1 * MB]] },
  failed: { seed: [], drop: [["raportti.pdf", 2.1 * MB]] },
};
/** How the stub host answers the case's files; seeds always go in. */
const FATE: Partial<Record<Case, "quota" | "disk" | "network">> = {
  quota: "quota",
  disk: "disk",
  failed: "network",
};

// The stub host: POST /api/v1/attachments answers as the daemon does
// (attachments_linux.go). A file chosen by hand through Liitä goes in.
const uploadedSizes = new Map<string, number>();
const fateOf = new WeakMap<File, "quota" | "disk" | "network">();
const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const hostError = (status: number, code: string) =>
  json(status, { schema_version: 1, error: { code, message: "Request could not be completed", retryable: false } });
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input) === "/api/v1/attachments" && init?.method === "POST" && init.body instanceof File) {
    const file = init.body;
    await pause(file.size > 5 * MB ? 120 : 15);
    const fate = fateOf.get(file);
    if (fate === "network") {
      // The connection comes back: a retry of the same file goes in.
      fateOf.delete(file);
      throw new TypeError("Failed to fetch");
    }
    if (fate === "quota") return hostError(413, "attachment_quota_exceeded");
    if (fate === "disk") return hostError(507, "attachment_storage_full");
    if (!file.size || file.size > 20 * MB) return hostError(413, "attachment_too_large");
    const id = uuid();
    uploadedSizes.set(`/api/v1/attachments/${id}`, file.size);
    return json(200, {
      schema_version: 1,
      id,
      path: `/home/maintainer/attachments/${id}`,
      // Not an image type: the chip's thumbnail would ask the stub host for bytes.
      content_type: "application/octet-stream",
      size: file.size,
    });
  }
  return realFetch(input, init);
};

/** A file of the given size without holding its bytes: the composer reads
 * only `size` and `name`, and the stub host never reads the body. */
function fake([name, size]: Spec, fate?: "quota" | "disk" | "network") {
  const file = new File([], name, { type: "application/octet-stream" });
  Object.defineProperty(file, "size", { value: Math.round(size) });
  if (fate) fateOf.set(file, fate);
  return file;
}
/** Choosing files through the panel's own Liitä input, as the picker does. */
function choose(panel: Element, files: File[]) {
  const input = panel.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) return;
  Object.defineProperty(input, "files", { value: files, configurable: true });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
const settled = async (panel: Element) => {
  for (let i = 0; i < 200; i++) {
    await pause(40);
    if (!panel.querySelector('.ah-composer [role="status"]')) return;
  }
};

const noop = () => {};
const DRAFT = "Katso liitteet ja kerro, mitä niistä puuttuu.";

async function play(panel: Element, c: Case, alive: () => boolean) {
  const { seed, drop } = SCRIPT[c];
  if (seed.length) {
    choose(panel, seed.map((s) => fake(s)));
    await settled(panel);
    if (!alive()) return;
  }
  choose(panel, drop.map((s) => fake(s, FATE[c])));
  await settled(panel);
  // Over 100 MiB in total: today only the send finds out.
  if (c === "total" && alive()) panel.querySelector<HTMLButtonElement>('[data-testid="send"]')?.click();
}

function Panel({ c, direction, label }: { c: Case; direction: number; label: string }) {
  const [draft, setDraft] = useState(DRAFT);
  const [receipt, setReceipt] = useState("");
  const ref = useRef<HTMLElement>(null);
  const present = PRESENT[direction];
  useEffect(() => {
    let live = true;
    const panel = ref.current;
    if (!panel) return;
    panel.dataset.played = "no";
    const id = setTimeout(
      () =>
        play(panel, c, () => live).then(() => {
          if (live) panel.dataset.played = "yes";
        }),
      80,
    );
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [c]);
  // Nyt: the browser does not count the 100 MiB; the host refuses the send
  // and the conversation shows its refusal above the composer.
  const send = () => {
    const total = [...draft.matchAll(/\/api\/v1\/attachments\/[0-9a-f-]{36}/g)].reduce(
      (sum, m) => sum + (uploadedSizes.get(m[0]) ?? 0),
      0,
    );
    if (total > 100 * MB) setReceipt(refusalReason("invalid_attachments", 400));
    else setReceipt("");
  };
  const common = {
    value: draft,
    onChange: setDraft,
    activity: "idle" as const,
    selectedWorkingMode: "steer" as const,
    onModeChange: noop,
    onSendNow: send,
    onSteer: send,
    onFollowUp: send,
    csrf: "prototype",
    modelPicker: (
      <button type="button" className="md-pill">
        Agentin oletus · medium
      </button>
    ),
  };
  return (
    <section ref={ref} className="lt-panel" data-case={c} aria-label={label}>
      <h2 className="lt-panel-head">{label}</h2>
      <div className="lt-panel-room">
        {receipt ? <InlineNotice data-testid="send-receipt" title={receipt} tone="warning" /> : null}
        {present ? <Fork {...common} refusal={present} /> : <Composer {...common} />}
      </div>
    </section>
  );
}

let reviewTheme = "light";
let reviewCase: Case = "many";
let reviewLanguage: "fi" | "en" = "fi";

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [c, setCase] = useState<Case>(reviewCase);
  const [language, setLanguage] = useState(reviewLanguage);
  const [generation, setGeneration] = useState(0);
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--review-h", `${el.getBoundingClientRect().height}px`);
    set();
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const caseName = CASES.find(([k]) => k === c)?.[1] ?? c;
  return (
    <div className={`lt-review variant-${direction}`} data-direction={direction}>
      <header className="cl-bar" ref={bar}>
        <strong>Liitteen torjunta</strong>
        <label>
          Teema{" "}
          <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
            <option value="light">Vaalea</option>
            <option value="dark">Tumma</option>
          </select>
        </label>
        <label>
          Oikealla{" "}
          <select id="case" value={c} onChange={(e) => { reviewCase = e.target.value as Case; setCase(reviewCase); }}>
            {CASES.map(([k, n]) => (
              <option key={k} value={k}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Kieli{" "}
          <select
            id="language"
            value={language}
            onChange={(e) => {
              reviewLanguage = e.target.value as "fi" | "en";
              setPersonalLanguage(reviewLanguage);
              setLanguage(reviewLanguage);
              setGeneration((g) => g + 1);
            }}
          >
            <option value="fi">suomi</option>
            <option value="en">English</option>
          </select>
        </label>
        <button type="button" data-testid="lt-reset" onClick={() => setGeneration((g) => g + 1)}>
          Alusta
        </button>
        <ol className="cl-lines" data-testid="direction-lines">
          {LINES.map((l, i) => (
            <li key={i} value={i} aria-current={i === direction ? "true" : undefined}>{l}</li>
          ))}
        </ol>
      </header>
      <div className="lt-stage" key={`${generation}-${c}-${language}`}>
        <Panel c="large" direction={direction} label="Liian suuri tiedosto (Jarin tapaus)" />
        <Panel c={c} direction={direction} label={caseName} />
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {
  set innerHTML(view: React.ReactNode) {
    flushSync(() => root.render(view === "" ? null : view));
  },
};
const variants = directions.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement("nav");
picker.className = "proto-picker";
picker.setAttribute("aria-label", "Prototype variants");
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
  const button = document.createElement("button");
  button.className = "proto-picker-item";
  button.textContent = n;
  if (i === 0) {
    button.setAttribute("data-active", "");
    button.setAttribute("aria-current", "true");
  }
  picker.append(button);
});
document.body.append(picker);
new Function("stage", "variants", pickerSource)(stageSink, variants);
