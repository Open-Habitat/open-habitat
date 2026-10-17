#!/usr/bin/env node
// Turn a capture-controls.mjs run into one self-contained catalogue page:
// controls grouped by kind and family, a crop in each presentation, the
// measured geometry, and automatic flags for plain defects.
//   node web/lab/build-control-catalogue.mjs [capture-dir] [out.html] [summary.json]
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(process.argv[2] || ".cache/lab/controls");
const outFile = resolve(process.argv[3] || `${dir}/catalogue.html`);
const summaryFile = process.argv[4] ? resolve(process.argv[4]) : null;
const data = JSON.parse(readFileSync(`${dir}/controls.json`, "utf8"));
const PRES = ["light-desktop", "dark-desktop", "light-phone", "dark-phone"];

const KINDS = [
  [
    "primary",
    "Ensisijainen (primary)",
    "ControlButton variant=primary, teksti tai teksti+ikoni",
  ],
  ["secondary", "Toissijainen (secondary)", "ControlButton variant=secondary"],
  [
    "quiet",
    "Hiljainen tekstipainike (quiet)",
    "ControlButton variant=quiet tekstillä: saa --ah-control-pinnan (buttons-no-surface)",
  ],
  [
    "danger",
    "Vaarallinen (danger, danger-subtle)",
    "ControlButton variant=danger / danger-subtle",
  ],
  ["icon", "Pelkkä ikoni", "IconButton / ControlButton ilman tekstiä"],
  ["back", "Takaisin", "ControlButton presentation=back"],
  ["account", "Tilivalikon painike", "ControlButton presentation=account"],
  [
    "pill",
    "Pillerit ja sirut",
    "omat <button>/<summary>-elementit: taustatyön merkit, asetussirut, mallipilleri",
  ],
  [
    "segmented",
    "Segmentoidut valinnat",
    "omat <button aria-pressed>: asetusten s-seg, ajattelutaso, tila",
  ],
  ["tab", "Välilehdet", "ControlTab / role=tab"],
  ["menu", "Valikon rivit", "ControlMenuItem"],
  ["disclosure", "Avattavat rivit", "DisclosureButton / <summary>"],
  [
    "nav",
    "Navigaatiorivit (linkit)",
    "LinkRow kind=nav/agent/home/workspace, asetusten s-nav-i",
  ],
  ["link", "Tekstilinkit", "LinkRow kind=inline/header, ExternalLink, <a>"],
  ["bespoke", "Muut omat painikkeet", "<button> omalla CSS:llä"],
  ["form", "Lomakekontrollit", "checkbox, switch, select"],
];

const norm = (cls) =>
  cls
    .split(" ")
    .map((c) => {
      const m = /^_([A-Za-z]+)_[a-z0-9]+_\d+$/.exec(c);
      return m ? m[1] : c;
    })
    .filter(
      (c) =>
        c &&
        ![
          "surface",
          "ah-button",
          "ah-button-text",
          "button",
          "link",
          "menuItem",
        ].includes(c),
    )
    .join(" ");

function kind(c) {
  const cl = norm(c.cls);
  if (c.tag === "input" || c.tag === "select" || c.role === "switch")
    return "form";
  if (c.primitive === "menu-item" || c.role.startsWith("menuitem"))
    return "menu";
  if (c.primitive === "tab" || c.role === "tab") return "tab";
  if (/ah-bg-badge|ah-bg-main|ah-set-chip|md-pill/.test(cl)) return "pill";
  if (c.primitive === "disclosure" || c.tag === "summary") return "disclosure";
  if (c.primitive === "button") {
    if (/\bback\b/.test(cl)) return "back";
    if (/\baccount\b/.test(cl)) return "account";
    if (/\bicon\b|messageIcon/.test(cl) || !c.hasText) return "icon";
    if (/\bprimary\b/.test(cl)) return "primary";
    if (/danger/.test(cl)) return "danger";
    if (/secondary/.test(cl)) return "secondary";
    return "quiet";
  }
  if (c.primitive === "link")
    return /\binline\b|\bheader\b/.test(cl) ? "link" : "nav";
  if (c.primitive === "external-link" || c.tag === "a") return "link";
  if (/s-nav-i/.test(cl)) return "nav";
  if (/s-seg|ah-pi-model-selector/.test(c.ancestry) && c.tag === "button")
    return "segmented";
  if (/md-btn|s-back/.test(cl)) return "bespoke";
  return "bespoke";
}

function flags(c) {
  const f = [];
  if (c.icon && c.hasText) {
    if (c.icon.gap !== null && c.icon.gap !== undefined && c.icon.gap < 4)
      f.push(`ikonin ja tekstin väli ${c.icon.gap}px`);
    if (Math.abs(c.icon.dy ?? 0) > 1.5)
      f.push(
        `ikoni ${c.icon.dy > 0 ? "alempana" : "ylempänä"} kuin teksti (${c.icon.dy}px)`,
      );
  }
  if (c.icon && !c.hasText) {
    if (Math.abs(c.icon.dyBox) > 1.5 || Math.abs(c.icon.dxBox ?? 0) > 1.5)
      f.push(`ikoni ei keskellä (${c.icon.dxBox}, ${c.icon.dyBox})`);
  }
  // Only a control that actually took focus says anything about its ring.
  if (c.ring?.focused) {
    // React Aria draws some rings only for keyboard modality
    // (data-focus-visible), which programmatic focus does not set.
    if (
      c.ring.outline === "none" &&
      !c.ring.shadow &&
      c.primitive !== "tab" &&
      c.role !== "tab"
    )
      f.push("ei fokusrengasta");
    // A pill's ends are curves, which straight-line sampling misses.
    const pill = c.style.radius >= c.rect.h / 2 - 1;
    const hidden = Object.entries(c.ring.visible || {}).filter(
      ([side, v]) =>
        v !== null &&
        v < 70 &&
        !(pill && (side === "left" || side === "right")),
    );
    if (hidden.length)
      f.push(
        `fokusrengas näkyy vain osin: ${hidden.map(([k, v]) => `${k} ${v} %`).join(", ")}${c.ring.clippedBy?.length ? `; overflow ${c.ring.clippedBy[0]}` : ""}`,
      );
  }
  return f;
}

const families = new Map();
for (const st of data.states)
  for (const c of st.controls) {
    const k = kind(c);
    const famKey = `${k}|${norm(c.cls) || `${c.tag} < ${c.ancestry.split(" < ")[0]}`}`;
    let fam = families.get(famKey);
    if (!fam) {
      fam = {
        key: famKey,
        kind: k,
        cls: c.cls,
        primitive: c.primitive,
        tag: c.tag,
        ancestry: c.ancestry,
        names: new Set(),
        states: new Set(),
        per: {},
        heights: new Set(),
        flags: new Map(),
        count: 0,
      };
      families.set(famKey, fam);
    }
    fam.count++;
    fam.names.add(c.name || "(nimetön)");
    fam.states.add(st.state);
    fam.heights.add(Math.round(c.rect.h));
    for (const f of flags(c)) {
      const g = f.replace(/\(.*\)$/, "").trim();
      if (!fam.flags.has(g)) fam.flags.set(g, { text: f, where: [] });
      fam.flags.get(g).where.push(`${st.state}/${st.presentation}: ${c.name}`);
    }
    // Prefer an instance with a crop; prefer the flagged one for focus crops.
    const cur = fam.per[st.presentation];
    if (
      !cur ||
      (!cur.crop && c.crop) ||
      (flags(c).length && !flags(cur).length && c.crop)
    )
      fam.per[st.presentation] = { ...c, state: st.state };
  }

const img = (file) => {
  if (!file) return "";
  try {
    return `data:image/png;base64,${readFileSync(`${dir}/crops/${file}`).toString("base64")}`;
  } catch {
    return "";
  }
};
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch],
  );

const famList = [...families.values()];
const summary = { kinds: {}, flagged: [] };
let body = "";
let toc = "";
for (const [k, title, source] of KINDS) {
  const fams = famList
    .filter((f) => f.kind === k)
    .sort((a, b) => b.count - a.count);
  if (!fams.length) continue;
  const ref = fams.flatMap((f) => PRES.map((p) => f.per[p]).filter(Boolean));
  const range = (fn) => {
    const v = [
      ...new Set(
        ref.map(fn).filter((x) => x !== undefined && x !== null && x !== ""),
      ),
    ];
    return v.length ? v.sort().slice(0, 8).join(" · ") : "–";
  };
  const row = {
    title,
    families: fams.length,
    instances: fams.reduce((n, f) => n + f.count, 0),
    height: range((c) => Math.round(c.rect.h)),
    padding: range((c) => c.style.padding),
    radius: range((c) => c.style.radius),
    font: range((c) => c.style.font),
    icon: range((c) => (c.icon ? `${c.icon.w}` : "")),
    gap: range((c) => c.icon?.gap ?? ""),
    ring: range((c) =>
      c.ring?.outline.replace(/rgb\([^)]*\)/, "").replace(/\s+/g, " "),
    ),
  };
  summary.kinds[k] = row;
  toc += `<tr><td><a href="#k-${k}">${esc(title)}</a></td><td>${row.families}</td><td>${row.instances}</td><td>${esc(row.height)}</td><td>${esc(row.padding)}</td><td>${esc(row.radius)}</td><td>${esc(row.font)}</td><td>${esc(row.icon)}</td><td>${esc(row.gap)}</td><td>${esc(row.ring)}</td></tr>`;
  body += `<section id="k-${k}"><h2>${esc(title)} <small>${fams.length} perhettä · ${row.instances} esiintymää</small></h2><p class="src">${esc(source)}</p>`;
  for (const f of fams) {
    const ex =
      f.per["light-desktop"] || f.per["light-phone"] || Object.values(f.per)[0];
    const fl = [...f.flags.values()];
    if (fl.length)
      summary.flagged.push({
        kind: k,
        family: norm(f.cls) || f.ancestry,
        flags: fl.map((x) => ({ text: x.text, where: x.where.slice(0, 4) })),
      });
    const focus =
      PRES.map((p) => f.per[p]).find(
        (c) => c?.focusCrop && flags(c).some((x) => x.startsWith("fokus")),
      ) || ex;
    body += `<article class="fam${fl.length ? " flagged" : ""}">
<header><b>${esc([...f.names].slice(0, 4).join(" · "))}</b>${f.names.size > 4 ? ` <small>+${f.names.size - 4}</small>` : ""}
<code>${esc(f.primitive ? `data-ah-primitive=${f.primitive}` : `<${f.tag}>`)} .${esc(norm(f.cls).split(" ").join(" ."))}</code>
<small>${esc(f.ancestry)} — näkymät: ${esc([...f.states].join(", "))}</small></header>
<div class="crops">${PRES.map((p) => (f.per[p]?.crop ? `<figure><img src="${img(f.per[p].crop)}" alt=""><figcaption>${p}</figcaption></figure>` : `<figure class="none"><figcaption>${p}: ei</figcaption></figure>`)).join("")}
${focus?.focusCrop ? `<figure><img src="${img(focus.focusCrop)}" alt=""><figcaption>fokus (${esc(focus.state)})</figcaption></figure>` : ""}</div>
<dl><dt>korkeus</dt><dd>${[...f.heights].sort((a, b) => a - b).join(", ")} px</dd>
<dt>padding</dt><dd>${esc(ex.style.padding)}</dd><dt>säde</dt><dd>${ex.style.radius}</dd>
<dt>fontti</dt><dd>${esc(ex.style.font)}</dd><dt>pinta</dt><dd>${esc(ex.style.bg)} / ${esc(ex.style.border)}</dd>
<dt>ikoni</dt><dd>${ex.icon ? `${ex.icon.w}px${ex.icon.gap != null ? `, väli ${ex.icon.gap}` : ""}${ex.icon.dy != null ? `, dy ${ex.icon.dy}` : ""}` : "–"}</dd>
<dt>fokus</dt><dd>${esc(ex.ring?.outline || "–")}</dd></dl>
${fl.length ? `<ul class="flags">${fl.map((x) => `<li>${esc(x.text)} <small>${esc(x.where.slice(0, 3).join(" | "))}${x.where.length > 3 ? ` +${x.where.length - 3}` : ""}</small></li>`).join("")}</ul>` : ""}
</article>`;
  }
  body += "</section>";
}

const html = `<!doctype html><html lang="fi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Painikekatalogi</title>
<style>
:root{--bg:#f6f7f9;--fg:#1d2430;--muted:#5d6675;--card:#fff;--line:#dde2e8;--flag:#b3261e;--flagbg:#fdf0ef}
@media (prefers-color-scheme:dark){:root{--bg:#14181d;--fg:#e6e9ee;--muted:#9aa3ae;--card:#1c2128;--line:#2e3540;--flag:#ff8a80;--flagbg:#3a1f1f}}
body{margin:0;padding:24px 16px;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif}
main{max-width:1200px;margin:0 auto}
h1{margin:0 0 4px}h2{margin:36px 0 4px;font-size:20px}h2 small{font-weight:400;color:var(--muted);font-size:13px}
.src,.lead{color:var(--muted);margin:0 0 12px}
table{border-collapse:collapse;width:100%;font-size:12.5px;background:var(--card)}
th,td{border:1px solid var(--line);padding:4px 6px;text-align:left;vertical-align:top}
.tablewrap{overflow-x:auto}
.fam{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin:10px 0}
.fam.flagged{border-color:var(--flag)}
.fam header{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}
.fam header small{color:var(--muted);flex-basis:100%}
code{font-size:12px;color:var(--muted);word-break:break-all}
.crops{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0;align-items:flex-end}
figure{margin:0}figure img{display:block;max-width:100%;border:1px dashed var(--line)}
figcaption{font-size:11px;color:var(--muted)}figure.none{opacity:.5}
dl{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:2px 12px;margin:4px 0;font-size:12.5px}
dt{color:var(--muted)}dd{margin:0 0 4px}
.flags{margin:6px 0 0;padding:6px 10px 6px 24px;background:var(--flagbg);color:var(--flag);border-radius:6px}
.flags small{color:var(--muted);display:block}
</style></head><body><main>
<h1>Painikkeet ja kontrollit</h1>
<p class="lead">Synteettinen labi, tuotantobundle. Kaapattu ${esc(data.captured)} (${data.states.length} näkymäkaappausta, ${famList.length} perhettä).
Perhe = sama komponentti ja samat luokat; kuva on ensimmäinen esiintymä kussakin esityksessä, fokuskuva näppäimistöfokuksella.
Liput ovat automaattisia mittauksia (ikonin väli ja keskitys, fokusrenkaan leikkautuminen tai peittyminen), eivät makuasioita. Fokus annetaan ohjelmallisesti; React Arian välilehdet piirtävät renkaan vain näppäimistöllä, joten niiden puuttuva rengas ei ole lippu. Rengas luetaan kuvapisteistä jokaiselta sivulta; näkymän reunaan osuva rengas voi näkyä osittain kaappauksen takia.
Lähde: <code>web/lab/capture-controls.mjs</code> → <code>web/lab/build-control-catalogue.mjs</code>.</p>
<h2>Muunnelmat</h2><div class="tablewrap"><table><thead><tr><th>laji</th><th>perheitä</th><th>esiintymiä</th><th>korkeus px</th><th>padding</th><th>säde</th><th>fontti px/paino</th><th>ikoni px</th><th>ikonin väli</th><th>fokus</th></tr></thead><tbody>${toc}</tbody></table></div>
${body}
${data.errors.length ? `<h2>Kaappaamatta</h2><ul>${data.errors.map((e) => `<li>${esc(e.key)}: ${esc(e.error.slice(0, 120))}</li>`).join("")}</ul>` : ""}
</main></body></html>`;
writeFileSync(outFile, html);
if (summaryFile)
  writeFileSync(summaryFile, `${JSON.stringify(summary, null, 1)}\n`);
console.log(
  `${famList.length} families, ${summary.flagged.length} flagged; ${outFile} ${(html.length / 1e6).toFixed(2)} MB`,
);
