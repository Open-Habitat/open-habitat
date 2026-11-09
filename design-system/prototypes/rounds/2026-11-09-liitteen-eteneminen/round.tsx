import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import { Composer } from "../../../../web/src/components/composer/Composer";
import { InlineNotice } from "../../../../web/src/components/Status";
import { setPersonalLanguage } from "../../../../web/src/i18n";
import { Composer as Fork } from "./forkComposer";
import type { Presentation } from "./upload";
import "./round.css";

// proto-attachment-upload-progress, round 1. Jari 9.11.2026 on pilot.23: a
// large attachment shows only "Tallennetaan liitettä…", which stands still
// until the upload ends. Every direction shows two composers: on the left
// Jari's case (one 18.6 MB video), on the right the chosen case, by default
// five files at once. Nyt is the production Composer unchanged; the three
// directions are the round's copy (forkComposer.tsx), whose diff from its
// first commit is the specification. The upload is simulated in time: a
// stub XMLHttpRequest (and for Nyt a stub fetch) sends at the chosen
// connection speed, so the progress can be watched.
setPersonalLanguage("fi");
const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
// The page is opened from a file or a plain-http check host, which is not a
// secure context; production's composer names its pending files with this.
if (!crypto.randomUUID)
  Object.defineProperty(crypto, "randomUUID", {
    value: () => uuid() as `${string}-${string}-${string}-${string}-${string}`,
  });

const directions = ["Nyt", "Rengas", "Palkki", "Erä"];
const PRESENT: (Presentation | null)[] = [null, "ring", "bar", "batch"];
const LINES = [
  "Nyt: jokainen tiedosto on sirurivissä heti tekstillä Odottaa tallennusta, myös matkalla oleva; kentän yllä seisoo Tallennetaan liitettä…, ja Lähetä ja Liitä odottavat.",
  "Rengas: tiedosto on sirurivissä heti, ja sen kuvakkeen paikalla on rengas ja prosentti; ✕ peruu juuri sen tiedoston.",
  "Palkki: tiedosto on sirurivissä heti, ja sirun alareunassa kulkee ohut palkki; rivin alla megatavut ja jäljellä oleva aika.",
  "Erä: kentän yllä yksi rivi koko erälle: monesko tiedosto, megatavut yhteensä, aika, yksi palkki ja Peru; siru vasta tallennetusta.",
];

type Case = "many" | "one" | "slow" | "failed" | "cancel" | "send";
const CASES: [Case, string][] = [
  ["many", "Viisi tiedostoa kerralla"],
  ["one", "Yksi suuri tiedosto"],
  ["slow", "Hidas yhteys (1,5 Mbit/s)"],
  ["failed", "Yhteys katkeaa"],
  ["cancel", "Peruttu kesken"],
  ["send", "Lähetä kesken"],
];

const MB = 1024 * 1024;
type Spec = [name: string, size: number, fate?: "network"];
const JARI: Spec[] = [["kokous-2026-11-07.mp4", 18.6 * MB]];
const SCRIPT: Record<Case, Spec[]> = {
  one: JARI,
  many: [
    ["kuvakaappaus.png", 0.4 * MB],
    ["kaavio.pdf", 1.2 * MB],
    ["haastattelu.m4a", 9.6 * MB],
    ["kokous-2026-11-07.mp4", 16.8 * MB],
    ["muistio.txt", 0.02 * MB],
  ],
  slow: [["esitys.pptx", 16.2 * MB]],
  failed: [
    ["muistio.pdf", 2.1 * MB],
    ["raportti.pdf", 8.4 * MB, "network"],
    ["laskelma.xlsx", 0.6 * MB],
  ],
  cancel: [
    ["kaavio.pdf", 1.2 * MB],
    ["kokous-2026-11-07.mp4", 16.8 * MB],
    ["muistio.txt", 0.02 * MB],
  ],
  send: [
    ["kaavio.pdf", 1.2 * MB],
    ["haastattelu.m4a", 9.6 * MB],
  ],
};
/** Where the script acts, as the share of the case's bytes sent. */
const ACT_AT = { cancel: 0.25, send: 0.15 };

// The simulated network. Time is the page's own clock, so Tauko freezes
// every upload as it stands, and `?pause=<ms>` stops it at a given moment
// for the screenshots. `?warp=<n>` runs it n times faster for the checks.
const SPEEDS: [string, string, number][] = [
  ["fast", "Nopea (40 Mbit/s)", 40],
  ["normal", "Tavallinen (8 Mbit/s)", 8],
  ["slow", "Mobiili (3 Mbit/s)", 3],
];
const params = new URLSearchParams(location.search);
const sim = {
  now: 0,
  mbit: 8,
  paused: false,
  pauseAt: Number(params.get("pause")) || Infinity,
  warp: Number(params.get("warp")) || 1,
  listeners: new Set<() => void>(),
};
type Transfer = { panel: Element | null; step: (dt: number) => void };
const transfers = new Set<Transfer>();
const TICK = 100;
setInterval(() => {
  if (sim.paused) return;
  for (let i = 0; i < sim.warp; i++) {
    if (sim.now >= sim.pauseAt) {
      sim.paused = true;
      sim.listeners.forEach((l) => l());
      return;
    }
    sim.now += TICK;
    for (const t of [...transfers]) t.step(TICK);
  }
}, TICK);
/** Bytes a step: the connection's speed with a steady, repeatable wobble. */
const bytesIn = (dt: number, mbit: number) =>
  ((mbit * 1e6) / 8) * (dt / 1000) * (1 + 0.22 * Math.sin(sim.now / 900) + 0.08 * Math.sin(sim.now / 230));
const SAVE_MS = 1200;

const fateOf = new WeakMap<File, "network">();
const panelOf = new WeakMap<File, Element>();
const slowPanels = new WeakSet<Element>();
const reply = (size: number) =>
  JSON.stringify({
    schema_version: 1,
    id: uuid(),
    path: "/home/maintainer/attachments/x",
    // Not an image type: the chip's thumbnail would ask the stub host for bytes.
    content_type: "application/octet-stream",
    size,
  });

/** One file's way: bytes at the panel's speed, a broken connection at 60 %
 * for a file marked so, then the host's write before it answers. */
function transfer(file: File, on: { progress: (sent: number) => void; sent: () => void; done: () => void; fail: (sent: number) => void }) {
  const panel = panelOf.get(file) ?? null;
  let sent = 0;
  let saving = -1;
  const t: Transfer = {
    panel,
    step(dt) {
      if (saving >= 0) {
        saving += dt;
        if (saving >= SAVE_MS) {
          transfers.delete(t);
          on.done();
        }
        return;
      }
      sent = Math.min(file.size, sent + bytesIn(dt, panel && slowPanels.has(panel) ? 1.5 : sim.mbit));
      if (fateOf.get(file) === "network" && sent >= file.size * 0.6) {
        transfers.delete(t);
        // The connection comes back: a retry of the same file goes in.
        fateOf.delete(file);
        on.fail(Math.floor(file.size * 0.6));
        return;
      }
      on.progress(Math.floor(sent));
      if (sent >= file.size) {
        saving = 0;
        on.sent();
      }
    },
  };
  transfers.add(t);
  return () => transfers.delete(t);
}

// The stub XMLHttpRequest the directions send with. Only what
// uploadWithProgress uses; events carry the page clock as their time.
type Handler = ((e: { loaded: number; total: number; timeStamp: number }) => void) | null;
class StubXHR {
  upload: { onprogress: Handler; onload: (() => void) | null } = { onprogress: null, onload: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  responseText = "";
  withCredentials = false;
  private stop = () => {};
  open() {}
  setRequestHeader() {}
  send(file: File) {
    this.stop = transfer(file, {
      progress: (loaded) => this.upload.onprogress?.({ loaded, total: file.size, timeStamp: sim.now }),
      sent: () => this.upload.onload?.(),
      done: () => {
        this.status = 200;
        this.responseText = reply(file.size);
        this.onload?.();
      },
      fail: () => this.onerror?.(),
    });
  }
  abort() {
    this.stop();
    this.onabort?.();
  }
}
(window as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = StubXHR;

// Nyt sends with fetch, which hears nothing until the host answers.
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input) === "/api/v1/attachments" && init?.method === "POST" && init.body instanceof File) {
    const file = init.body;
    await new Promise<void>((resolve, reject) => {
      const stop = transfer(file, {
        progress: () => {},
        sent: () => {},
        done: resolve,
        fail: () => reject(new TypeError("Failed to fetch")),
      });
      init.signal?.addEventListener("abort", () => {
        stop();
        reject(new DOMException("aborted", "AbortError"));
      });
    });
    return new Response(reply(file.size), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return realFetch(input, init);
};

/** A file of the given size without holding its bytes: the composer reads
 * only `size` and `name`, and the stub host never reads the body. */
function fake([name, size, fate]: Spec, panel: Element) {
  const file = new File([], name, { type: "application/octet-stream" });
  Object.defineProperty(file, "size", { value: Math.round(size) });
  if (fate) fateOf.set(file, fate);
  panelOf.set(file, panel);
  return file;
}
/** Choosing files through the panel's own Liitä input, as the picker does. */
function choose(panel: Element, files: File[]) {
  const input = panel.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) return;
  Object.defineProperty(input, "files", { value: files, configurable: true });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Waits on the page clock until `ms` has passed on it. */
const simReach = async (ms: number, alive: () => boolean) => {
  while (alive() && sim.now < ms) await pause(40);
};

const noop = () => {};
const DRAFT = "Katso liitteet ja kerro, mitä niistä puuttuu.";

async function play(panel: Element, c: Case, alive: () => boolean) {
  const files = SCRIPT[c].map((s) => fake(s, panel));
  if (c === "slow") slowPanels.add(panel);
  choose(panel, files);
  if (c === "cancel" || c === "send") {
    // The moment the script acts, on the page clock at the chosen speed.
    const total = files.reduce((s, f) => s + f.size, 0);
    await simReach(((total * ACT_AT[c]) / ((sim.mbit * 1e6) / 8)) * 1000, alive);
    if (!alive()) return;
    if (c === "send") panel.querySelector<HTMLButtonElement>('[data-testid="send"]')?.click();
    else {
      // Rengas and Palkki cancel the file on the way; Erä cancels the rest.
      const on = panel.querySelector('[data-testid="upload-chip"]:not([data-phase="queued"]) [data-testid="upload-cancel"]');
      const all = panel.querySelector('[data-testid="upload-cancel-all"]');
      ((on ?? all) as HTMLElement | null)?.click();
    }
  }
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
    const id = setTimeout(() => play(panel, c, () => live), 80);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [c]);
  // The conversation takes the message; here a line says what went.
  const send = () => {
    const n = (draft.match(/\/api\/v1\/attachments\//g) ?? []).length;
    setReceipt(n === 1 ? "Viesti lähti, mukana 1 liite." : `Viesti lähti, mukana ${n} liitettä.`);
    setDraft("");
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
        {receipt ? <InlineNotice data-testid="send-receipt" title={receipt} /> : null}
        {present ? <Fork {...common} progress={present} /> : <Composer {...common} />}
      </div>
    </section>
  );
}

let reviewTheme = "light";
let reviewCase: Case = (params.get("case") as Case) || "many";
let reviewLanguage: "fi" | "en" = "fi";
let reviewMotion = "system";

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [c, setCase] = useState<Case>(reviewCase);
  const [language, setLanguage] = useState(reviewLanguage);
  const [motion, setMotion] = useState(reviewMotion);
  const [speed, setSpeed] = useState(String(sim.mbit));
  const [paused, setPaused] = useState(sim.paused);
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
  useEffect(() => {
    if (motion === "reduce") document.documentElement.dataset.motion = "reduce";
    else delete document.documentElement.dataset.motion;
  }, [motion]);
  useEffect(() => {
    const l = () => setPaused(sim.paused);
    sim.listeners.add(l);
    return () => void sim.listeners.delete(l);
  }, []);
  // Every new stage starts the page clock from zero.
  useLayoutEffect(() => {
    sim.now = 0;
    // A stop asked for in the address holds for every stage.
    if (sim.pauseAt !== Infinity) {
      sim.paused = false;
      setPaused(false);
    }
  }, [generation, c, language, direction]);
  const caseName = CASES.find(([k]) => k === c)?.[1] ?? c;
  return (
    <div className={`lt-review variant-${direction}`} data-direction={direction}>
      <header className="cl-bar" ref={bar}>
        <strong>Liitteen eteneminen</strong>
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
          Yhteys{" "}
          <select
            id="speed"
            value={speed}
            onChange={(e) => {
              sim.mbit = Number(e.target.value);
              setSpeed(e.target.value);
              setGeneration((g) => g + 1);
            }}
          >
            {SPEEDS.map(([k, n, v]) => (
              <option key={k} value={v}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Liike{" "}
          <select id="motion" value={motion} onChange={(e) => { reviewMotion = e.target.value; setMotion(reviewMotion); }}>
            <option value="system">Laitteen mukaan</option>
            <option value="reduce">Vähennetty</option>
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
            }}
          >
            <option value="fi">suomi</option>
            <option value="en">English</option>
          </select>
        </label>
        <button
          type="button"
          data-testid="ue-pause"
          aria-pressed={paused}
          onClick={() => {
            sim.paused = !sim.paused;
            sim.pauseAt = Infinity;
            setPaused(sim.paused);
          }}
        >
          {paused ? "Jatka" : "Tauko"}
        </button>
        <button type="button" data-testid="ue-reset" onClick={() => setGeneration((g) => g + 1)}>
          Alusta
        </button>
        <ol className="cl-lines" data-testid="direction-lines">
          {LINES.map((l, i) => (
            <li key={i} value={i} aria-current={i === direction ? "true" : undefined}>{l}</li>
          ))}
        </ol>
      </header>
      <div className="lt-stage" key={`${generation}-${c}-${language}`}>
        <Panel c="one" direction={direction} label="Yksi suuri tiedosto (Jarin tapaus)" />
        <Panel c={c} direction={direction} label={caseName} />
      </div>
    </div>
  );
}

// For the check script: the page clock and its controls.
(window as unknown as { __sim: unknown }).__sim = {
  get now() {
    return sim.now;
  },
  pause: () => {
    sim.paused = true;
    sim.listeners.forEach((l) => l());
  },
  resume: () => {
    sim.paused = false;
    sim.pauseAt = Infinity;
    sim.listeners.forEach((l) => l());
  },
  pauseAt: (ms: number) => {
    sim.pauseAt = ms;
    sim.paused = false;
  },
};

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
