import React, { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import { AccountShelf } from "../../../../web/src/components/Account";
import { AssistantMessage, ConversationTimeline, UserMessage } from "../../../../web/src/components/Conversation";
import { ConversationFrame, ConversationStream } from "../../../../web/src/components/ConversationFrame";
import { Markdown } from "../../../../web/src/components/Markdown";
import {
  AgentHeader,
  type AgentNavModel,
  AppShell,
  NowSections,
  WorkspaceNavRow,
  WorkspaceRail,
} from "../../../../web/src/components/Navigation";
import { QuietSection } from "../../../../web/src/components/QuietSection";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { Composer } from "../../../../web/src/components/composer/Composer";
import { setPersonalLanguage } from "../../../../web/src/i18n";
import "../../../../web/src/components/components.css";
import { CONVS, DIRECTIONS, FIVE, type Kind, type Lang, ONE, SCRIPT, type State, TEXT, type Text, WORKSPACES } from "./text";
import "./round.css";

// rail-state-change-visual, round 2 (Jari 23.11.2026: round 1 was
// confusing, the "uusi" tag is probably unnecessary, motion should carry the
// change). One axis: which motion tells that a conversation changed state.
// No direction leaves a persistent mark; after the motion the rail is
// production's (section, mark, count, edge chip).
//   A Moves: the row slides from its old place into its new one (FLIP, its
//     neighbours glide with it), glows on arrival, and the section's count
//     rolls. Out of view the row slides over the edge and production's edge
//     chip slides in or rolls its number. On the phone the conversation's
//     name flies into the menu button, whose count then rolls.
//   B Sweep: the row jumps as in production and one band of light crosses
//     it in the state's colour. Out of view the band crosses the edge chip;
//     a burst gets one band over the section. On the phone the band crosses
//     the top bar.
//   C Counter: nothing moves but numbers: the section's count, the edge
//     chip's count and the row's time roll like a meter and the count stays
//     ringed for two seconds. On the phone the menu button's count rolls.
// A start (Käynnissä) asks nothing of the person, so it gets only what is
// a faithful picture of where the row is (A's slide, C's roll), never a
// glow, band or flight. Three or more changes in one event are a burst: A
// moves them as one motion without a glow, B gives one band, C rolls once.
// With reduced motion nothing moves: glows and bands are a still tint or
// outline for 4 s, numbers change at once and stay ringed for 4 s.
//
// The page must work as a Habitat view (a sandboxed document with an opaque
// origin and connect-src 'none'): no iframe, no navigation, no network. The
// phone is therefore not a frame but a box that is a size container:
// build.mjs rewrites production's width and height media queries into
// container queries on that box, and window.matchMedia is answered for its
// width below, so production's own phone layout renders inside it.

const params = new URLSearchParams(location.search);
const noop = () => {};
type Theme = "light" | "dark" | "contrast";
type Section = "yours" | "running" | "quiet";
type View = "desktop" | "phone";
type Scene = "script" | "one" | "five";
/** This many changes in one event are a burst. */
const BURST = 3;
const HOLD_MS = 4000;
const PANEL = 380;
const PHONE_W = 390;

// ---------- The phone without a frame: production's width queries ----------

/** A real narrow window (a phone) shows the phone layout on the whole stage. */
const narrow = window.innerWidth < 900;
let mediaWidth = () => window.innerWidth;
const realMatch = window.matchMedia.bind(window);
window.matchMedia = (query: string) => {
  if (!/\((min|max)-width/.test(query)) return realMatch(query);
  const w = mediaWidth();
  let matches = true;
  for (const m of query.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)) if (m[1] === "min" ? w < +m[2] : w > +m[2]) matches = false;
  return {
    matches,
    media: query,
    onchange: null,
    addEventListener: noop,
    removeEventListener: noop,
    addListener: noop,
    removeListener: noop,
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
};

const sectionOf = (s: State): Section =>
  s === "reply" || s === "question" ? "yours" : s === "quiet" ? "quiet" : "running";
const kindOf = (s: State): Kind => (s === "reply" || s === "question" ? "turn" : s === "fail" ? "fail" : "start");
const colourOf = (k: Kind) => (k === "turn" ? "var(--ah-turn)" : k === "fail" ? "var(--ah-err)" : "var(--ah-accent)");
const lineOf = (k: Kind) => (k === "turn" ? "var(--ah-turn-line)" : k === "fail" ? "var(--ah-err-line)" : "var(--ah-accent-line)");

type World = { states: Record<string, State>; at: Record<string, number> };
function initial(): World {
  const now = Date.now();
  const states: Record<string, State> = {};
  const at: Record<string, number> = {};
  let q = 0;
  CONVS.forEach((c, i) => {
    states[c.id] = c.state;
    at[c.id] = c.id === "o" ? now - 3 * 60_000 : c.state === "quiet" ? now - (2 + q++ * 5) * 3_600_000 : now - (4 + i * 3) * 60_000;
  });
  return { states, at };
}

const wsName = (i: number, lang: Lang) => WORKSPACES[i][lang];
const hrefOf = (id: string, lang: Lang) => {
  const c = CONVS.find((x) => x.id === id)!;
  return `/workspaces/${encodeURIComponent(wsName(c.ws, lang))}?conversation=${id}`;
};

function model(id: string, w: World, t: Text, lang: Lang, selected: string): AgentNavModel {
  const c = CONVS.find((x) => x.id === id)!;
  const s = w.states[id];
  const ws = wsName(c.ws, lang);
  const label = s === "reply" ? t.newReply : s === "question" ? t.asks : s === "fail" ? t.failed : s === "quiet" ? t.done : t.working;
  return {
    agentId: id,
    title: c[lang],
    href: hrefOf(id, lang),
    activity: s === "work" ? "working" : s === "fail" ? "closed" : "waiting",
    activityLabel: label,
    attentionLabel: s === "reply" ? t.newReply : undefined,
    question: s === "question" || undefined,
    failed: s === "fail" || undefined,
    controlLabel: "",
    workspaceId: `ws_${c.ws}`,
    workspaceName: ws,
    detail: [ws, label].join(" · "),
    changedAt: w.at[id],
    selected: id === selected,
  };
}

// ---------- DOM helpers on production's rail ----------

const rowOf = (root: ParentNode, id: string) => root.querySelector<HTMLElement>(`li[data-testid="agent-item-${id}"]`);
const textOf = (el: Element | null) => el?.textContent?.trim() ?? "";
const CUE = 26; // production's edge-chip strip (railRegions.tsx)
/** Which edge of the conversations' region a row lies wholly past, if any. */
function edgeOf(li: HTMLElement, region: HTMLElement): "above" | "below" | null {
  const box = region.getBoundingClientRect();
  const r = li.getBoundingClientRect();
  if (r.bottom - 8 <= box.top + CUE) return "above";
  if (r.top + 8 >= box.bottom - CUE) return "below";
  return null;
}
/** What the rail looked like just before an event, for the motion from it. */
type Snap = {
  rects: Map<string, DOMRect>;
  counts: Record<string, string>;
  chips: Record<string, string>;
  badge: string;
  times: Record<string, string>;
};
const flipKey = (el: Element) =>
  el.matches("li") ? (el as HTMLElement).dataset.testid! : `${el.closest("[data-testid]")?.getAttribute("data-testid")}:head`;
const FLIP_SEL = 'li[data-testid^="agent-item-"], .ah-rail-section-head';
function snapshot(root: HTMLElement): Snap {
  const rects = new Map<string, DOMRect>();
  for (const el of root.querySelectorAll(`[data-testid="rail-conversations"] :is(${FLIP_SEL})`)) rects.set(flipKey(el), el.getBoundingClientRect());
  const counts: Record<string, string> = {};
  for (const sec of ["yours", "running"]) counts[sec] = textOf(root.querySelector(`[data-testid="rail-${sec}-count"]`)) || "0";
  const chips: Record<string, string> = {};
  for (const b of root.querySelectorAll('[data-testid^="rail-beyond-"] b')) chips[b.closest("button")!.dataset.testid!] = textOf(b);
  const times: Record<string, string> = {};
  for (const li of root.querySelectorAll<HTMLElement>('li[data-testid^="agent-item-"]'))
    times[li.dataset.testid!] = textOf(li.querySelector(".ah-nav-time"));
  return { rects, counts, chips, badge: textOf(root.querySelector('[data-testid="navigation-badge"]')), times };
}

// ---------- The page ----------

type Ctx = { lang: Lang; d: number; reduced: boolean; auto: boolean; phone: boolean; scene: Scene };

function Main({ lang, d, reduced, auto, phone, scene, onStep }: Ctx & { onStep: (i: number) => void }) {
  const t = TEXT[lang];
  const loc = useLocation();
  const selected = new URLSearchParams(loc.search).get("conversation") ?? "o";
  const queue = useMemo(() => (scene === "one" ? [ONE] : scene === "five" ? [FIVE] : SCRIPT.map((_, i) => i)), [scene]);
  const [w, setW] = useState<World>(initial);
  const [step, setStep] = useState(0);
  const [fx, setFx] = useState(0);
  const [said, setSaid] = useState("");
  const shell = useRef<HTMLDivElement>(null);
  const pending = useRef<{ changes: { id: string; to: State }[]; snap: Snap } | null>(null);
  const timers = useRef<number[]>([]);
  const owner = useRef(new WeakMap<Element, Record<string, number>>());
  const seq = useRef(0);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  const region = () => shell.current?.querySelector<HTMLElement>('[data-testid="rail-conversations"]') ?? null;

  /** Set an attribute for a while; a newer setting of the same one wins. */
  const flag = (el: Element, attr: string, value: string, ms: number) => {
    const id = ++seq.current;
    const own = owner.current.get(el) ?? {};
    own[attr] = id;
    owner.current.set(el, own);
    el.removeAttribute(attr);
    void (el as HTMLElement).offsetWidth;
    el.setAttribute(attr, value);
    later(() => {
      if (owner.current.get(el)?.[attr] === id) el.removeAttribute(attr);
    }, ms);
  };
  const note = (s: string) => {
    const root = shell.current;
    if (root) root.dataset.fx = `${root.dataset.fx ?? ""} ${s}`.trim();
  };

  /** A number or time that changed rolls like a meter (reduced: rings). */
  const roll = (el: Element | null, old: string, label: string, ring: boolean) => {
    if (!el) return;
    const now = textOf(el);
    if (now === old) return;
    if (reduced) {
      flag(el, "data-rsc-hold", "", HOLD_MS);
      note(`hold:${label}`);
      return;
    }
    (el as HTMLElement).style.setProperty("--rsc-ink", getComputedStyle(el).color);
    el.setAttribute("data-rsc-old", old);
    el.setAttribute("data-rsc-new", now);
    flag(el, "data-rsc-roll", "", 520);
    if (ring) flag(el, "data-rsc-hold", "", 2000);
    note(`roll:${label}`);
  };
  /** A band of light crosses an element once (reduced: a still outline). */
  const sweep = (el: HTMLElement | null, kind: Kind, label: string) => {
    if (!el) return;
    el.style.setProperty("--rsc-c", colourOf(kind));
    el.style.setProperty("--rsc-line", lineOf(kind));
    if (reduced) {
      flag(el, "data-rsc-outline", kind, HOLD_MS);
      note(`outline:${label}`);
      return;
    }
    const band = document.createElement("span");
    band.className = "rsc-sweep";
    band.setAttribute("aria-hidden", "true");
    flag(el, "data-rsc-sweep", "", 1000);
    el.append(band);
    band.animate([{ transform: "translateX(-100%)" }, { transform: "translateX(200%)" }], { duration: 950, easing: "cubic-bezier(.45,0,.35,1)" }).onfinish = () =>
      band.remove();
    note(`sweep:${label}`);
  };
  /** The row's glow on arrival (reduced: the tint held still). */
  const glow = (li: HTMLElement | null, kind: Kind, id: string) => {
    const row = li?.querySelector<HTMLElement>(".ah-now-row") ?? li;
    if (!row) return;
    row.style.setProperty("--rsc-c", colourOf(kind));
    row.style.setProperty("--rsc-line", lineOf(kind));
    if (reduced) {
      flag(row, "data-rsc-still", kind, HOLD_MS);
      note(`still:${id}`);
      return;
    }
    flag(row, "data-rsc-glow", kind, 1900);
    note(`glow:${id}`);
  };
  const waitFor = (fn: () => boolean, ms = 800) =>
    new Promise<boolean>((res) => {
      const t0 = performance.now();
      const tick = () => (fn() ? res(true) : performance.now() - t0 > ms ? res(false) : requestAnimationFrame(tick));
      tick();
    });

  /** The motion of one event, run after React has committed the new rail. */
  const play = useCallback(
    (changes: { id: string; to: State }[], snap: Snap) => {
      const root = shell.current;
      const reg = region();
      if (!root || !reg) return;
      root.dataset.fx = "";
      const burst = changes.length >= BURST;
      const strong = changes.filter((c) => kindOf(c.to) !== "start");
      const drawerClosed = phone && !root.querySelector(".ah-mobile-open");
      const badge = () => root.querySelector<HTMLElement>('[data-testid="navigation-badge"]');

      if (drawerClosed) {
        if (!strong.length) return;
        const first = strong[0];
        const kind = burst ? "turn" : kindOf(first.to);
        if (d === 0) {
          const nav = root.querySelector<HTMLElement>('[data-testid="navigation-open"]');
          const bar = root.querySelector<HTMLElement>(".ah-mobile-toolbar");
          if (!nav || !bar) return;
          const fly = document.createElement("div");
          fly.className = "rsc-fly";
          fly.dataset.testid = "rsc-fly";
          fly.setAttribute("aria-hidden", "true");
          fly.style.setProperty("--rsc-line", lineOf(kind));
          fly.textContent = burst ? t.flyMany(changes.length) : t.flyTo(CONVS.find((c) => c.id === first.id)![lang], t.where[kind]);
          root.append(fly);
          const box = root.getBoundingClientRect();
          const b = bar.getBoundingClientRect();
          fly.style.top = `${b.bottom - box.top + 10}px`;
          const f = fly.getBoundingClientRect();
          const n = nav.getBoundingClientRect();
          const dx = n.left + n.width / 2 - (f.left + f.width / 2);
          const dy = n.top + n.height / 2 - (f.top + f.height / 2);
          const el = badge();
          const changed = textOf(el) !== snap.badge;
          if (reduced) {
            later(() => fly.remove(), 3000);
            if (changed) roll(el, snap.badge, "badge", true);
            note("fly-still");
            return;
          }
          if (el && changed) el.setAttribute("data-rsc-pending", snap.badge);
          note("fly");
          fly.animate(
            [
              { opacity: 0, transform: "translate(-50%, -8px)" },
              { offset: 0.14, opacity: 1, transform: "translate(-50%, 0)" },
              { offset: 0.58, opacity: 1, transform: "translate(-50%, 0)" },
              { opacity: 0.25, transform: `translate(calc(-50% + ${dx}px), ${dy}px) scale(.12)` },
            ],
            { duration: 1700, easing: "cubic-bezier(.4,0,.2,1)" },
          ).onfinish = () => {
            fly.remove();
            const e = badge();
            if (!e) return;
            e.removeAttribute("data-rsc-pending");
            if (changed && snap.badge) roll(e, snap.badge, "badge", false);
            e.animate([{ transform: "scale(1)" }, { transform: "scale(1.3)" }, { transform: "scale(1)" }], { duration: 320 });
          };
        } else if (d === 1) {
          sweep(root.querySelector<HTMLElement>(".ah-mobile-toolbar"), kind, "toolbar");
        } else {
          roll(badge(), snap.badge, "badge", true);
        }
        return;
      }

      // Where each changed row is now, before any motion moves its box.
      const where = changes.map((c) => {
        const li = rowOf(root, c.id);
        return { ...c, kind: kindOf(c.to), li, edge: li ? edgeOf(li, reg) : null };
      });

      if (d === 0) {
        if (!reduced) {
          const moved = new Set(changes.map((c) => `agent-item-${c.id}`));
          for (const el of reg.querySelectorAll<HTMLElement>(FLIP_SEL)) {
            const key = flipKey(el);
            const old = snap.rects.get(key);
            if (!old) continue;
            const dy = old.top - el.getBoundingClientRect().top;
            if (Math.abs(dy) < 2) continue;
            const lift = moved.has(key);
            if (lift) {
              el.style.position = "relative";
              el.style.zIndex = "3";
              later(() => {
                el.style.removeProperty("position");
                el.style.removeProperty("z-index");
              }, 700);
              note(`travel:${key.slice("agent-item-".length)}`);
            }
            el.animate(
              lift
                ? [
                    { transform: `translateY(${dy}px)`, boxShadow: "0 8px 18px -8px rgb(0 0 0 / .45)" },
                    { offset: 0.8, boxShadow: "0 8px 18px -8px rgb(0 0 0 / .45)" },
                    { transform: "none", boxShadow: "none" },
                  ]
                : [{ transform: `translateY(${dy}px)` }, { transform: "none" }],
              { duration: 620, easing: "cubic-bezier(.25,.75,.25,1)" },
            );
          }
        }
        // Production measures the edge chips from the rows' boxes, which the
        // slide transforms; let it measure again once they have landed.
        if (!reduced) later(() => reg.dispatchEvent(new Event("scroll")), 660);
        if (!burst) for (const c of where) if (c.kind !== "start" && !c.edge) glow(c.li, c.kind, c.id);
        for (const sec of ["yours", "running"]) roll(root.querySelector(`[data-testid="rail-${sec}-count"]`), snap.counts[sec], sec, false);
      } else if (d === 1) {
        if (burst) {
          if (strong.length) sweep(root.querySelector<HTMLElement>('[data-testid="rail-yours"]'), "turn", "yours");
        } else for (const c of where) if (c.kind !== "start" && !c.edge) sweep(c.li?.querySelector<HTMLElement>(".ah-now-row") ?? c.li, c.kind, c.id);
      } else {
        for (const sec of ["yours", "running"]) roll(root.querySelector(`[data-testid="rail-${sec}-count"]`), snap.counts[sec], sec, true);
        for (const c of where) if (!c.edge) roll(c.li?.querySelector(".ah-nav-time") ?? null, snap.times[`agent-item-${c.id}`] ?? "", `time-${c.id}`, false);
      }

      // Out of view: production's edge chip tells it, each direction its way.
      for (const c of where) {
        if (!c.edge) continue;
        const key = `rail-beyond-${c.edge}-${sectionOf(c.to)}`;
        const chip = () => root.querySelector<HTMLElement>(`[data-testid="${key}"]`);
        const had = key in snap.chips;
        if (d === 1 && c.kind === "start") continue;
        void waitFor(() => !!chip() && (!had || textOf(chip()!.querySelector("b")) !== snap.chips[key]), d === 0 ? 1500 : 800).then(() => {
          const el = chip();
          if (!el) return;
          const b = el.querySelector("b");
          if (d === 0) {
            if (!had && !reduced) {
              el.animate([{ transform: `translateY(${c.edge === "above" ? -130 : 130}%)`, opacity: 0 }, { transform: "none", opacity: 1 }], {
                duration: 340,
                easing: "cubic-bezier(.25,.75,.25,1)",
              });
              note(`chip-in:${key}`);
            } else if (had) roll(b, snap.chips[key], key, false);
            el.style.setProperty("--rsc-line", lineOf(c.kind));
            if (c.kind !== "start") flag(el, reduced ? "data-rsc-hold" : "data-rsc-ring", "", reduced ? HOLD_MS : 1600);
          } else if (d === 1) sweep(el, c.kind, key);
          else roll(b, had ? snap.chips[key] : "0", key, true);
        });
      }
    },
    // biome-ignore lint/correctness/useExhaustiveDependencies: helpers read refs only
    [d, reduced, phone, lang, t],
  );

  const advance = useCallback(() => {
    if (step >= queue.length) return;
    const s = SCRIPT[queue[step]];
    const changes = s.changes ?? [];
    if (changes.length && shell.current) {
      pending.current = { changes, snap: snapshot(shell.current) };
      const now = Date.now();
      setW((old) => {
        const states = { ...old.states };
        const at = { ...old.at };
        for (const c of changes) {
          states[c.id] = c.to;
          at[c.id] = now;
        }
        return { states, at };
      });
      setFx((n) => n + 1);
      setSaid(
        changes.length >= BURST
          ? t.announceMany(changes.length)
          : changes.map((c) => t.announce(CONVS.find((x) => x.id === c.id)![lang], t.said[c.to])).join(". "),
      );
    }
    if (s.scroll) {
      const r = region();
      if (r) {
        if (s.scroll === "top") r.scrollTop = 0;
        else {
          const head = r.querySelector('[data-testid="rail-running"]');
          if (head) r.scrollTop += head.getBoundingClientRect().top - r.getBoundingClientRect().top - CUE - 2;
        }
      }
    }
    setStep(step + 1);
  }, [step, queue, t, lang]);

  useLayoutEffect(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    play(p.changes, p.snap);
  }, [fx, play]);

  useEffect(() => onStep(step === 0 ? -1 : queue[step - 1]), [step, onStep, queue]);
  useEffect(() => {
    const go = () => advance();
    window.addEventListener("rsc-next", go);
    return () => window.removeEventListener("rsc-next", go);
  }, [advance]);
  useEffect(() => {
    if (step >= queue.length) return;
    if (scene === "script" && !auto) return;
    const id = window.setTimeout(advance, step === 0 ? 900 : 3600);
    return () => clearTimeout(id);
  }, [auto, step, advance, scene, queue.length]);

  const ids = CONVS.map((c) => c.id);
  const byNewest = (a: string, b: string) => w.at[b] - w.at[a];
  const m = (id: string) => model(id, w, t, lang, selected);
  const yours = ids.filter((id) => sectionOf(w.states[id]) === "yours").sort(byNewest).map(m);
  const running = ids.filter((id) => sectionOf(w.states[id]) === "running").map(m);
  const quiet = ids.filter((id) => sectionOf(w.states[id]) === "quiet").sort(byNewest).map(m);
  const listed = WORKSPACES.map((x, i) => ({ id: `ws_${i}`, name: x[lang] }));
  const open = CONVS.find((c) => c.id === selected) ?? CONVS[7];
  const openWs = wsName(open.ws, lang);

  const rail = (
    <WorkspaceRail
      collapsed={false}
      serverLabel="Habitat"
      connectionLabel=""
      connectionTone="success"
      homeCurrent={false}
      filterValue=""
      resultSummary={`${WORKSPACES.length}`}
      listState="ready"
      onToggle={noop}
      onFilter={noop}
      onRefresh={noop}
      sessionActions={<AccountShelf profile={{ name: "Esimerkki Käyttäjä", email: "", avatar_url: "" }} onSettings={noop} onLogout={noop} />}
      now={
        <NowSections
          yours={yours}
          running={running}
          workspaces={listed}
          quiet={<QuietSection rows={quiet} workspaces={listed} choice={{ sort: "newest", workspace: null }} />}
        />
      }
    >
      {WORKSPACES.map((x, i) => (
        <WorkspaceNavRow key={x.fi} name={x[lang]} href={`/workspaces/${encodeURIComponent(x[lang])}`} selected={i === open.ws} />
      ))}
    </WorkspaceRail>
  );
  const items = [
    {
      id: "u1",
      kind: "user",
      content: (
        <UserMessage sourceText={t.ask} onCopy={noop} time="9.12">
          <Markdown text={t.ask} />
        </UserMessage>
      ),
    },
    {
      id: "a1",
      kind: "assistant",
      content: (
        <AssistantMessage streamState="complete" time="9.13" onCopy={noop}>
          <Markdown text={t.reply} />
        </AssistantMessage>
      ),
    },
  ];
  return (
    <StatusBellProvider items={[]}>
      <div
        className="rsc-shell"
        ref={shell}
        data-direction={d}
        data-step={step}
        data-reduced={reduced ? "" : undefined}
        data-view={phone ? "phone" : "desktop"}
      >
        <AppShell
          mobileTitle={open[lang]}
          navigationBadge={yours.length}
          rail={rail}
          main={
            <div className="rsc-main" data-testid="conversation">
              <ConversationFrame>
                <AgentHeader
                  title={open[lang]}
                  workspaceLabel={openWs}
                  workspaceHref={`/workspaces/${encodeURIComponent(openWs)}`}
                  activityLabel=""
                  controlLabel=""
                  detailsExpanded={false}
                  onToggleDetails={noop}
                />
                <ConversationStream>
                  <ConversationTimeline state="ready" items={items} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
                </ConversationStream>
                <Composer
                  value=""
                  onChange={noop}
                  activity="idle"
                  selectedWorkingMode="steer"
                  onModeChange={noop}
                  onSendNow={noop}
                  onSteer={noop}
                  onFollowUp={noop}
                  idlePlaceholder=""
                />
              </ConversationFrame>
            </div>
          }
        />
        <p className="ah-visually-hidden" role="status" aria-live="polite" data-testid="rsc-live">
          {said}
        </p>
      </div>
    </StatusBellProvider>
  );
}

// ---------- Review page ----------

const firstTheme = (["light", "dark", "contrast"].includes(params.get("theme") ?? "") ? params.get("theme") : "light") as Theme;
let reviewTheme: Theme = firstTheme;
let reviewLanguage: Lang = params.get("lang") === "en" ? "en" : "fi";
const systemReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let reviewReduced = systemReduced || params.get("reduce") === "1";
let reviewAuto = params.get("auto") !== "0";
let reviewView: View = narrow || params.get("view") === "phone" ? "phone" : "desktop";

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [lang, setLang] = useState(reviewLanguage);
  const [reduced, setReduced] = useState(reviewReduced);
  const [auto, setAuto] = useState(reviewAuto);
  const [view, setView] = useState<View>(reviewView);
  const [scene, setScene] = useState<Scene>("script");
  const [run, setRun] = useState(0);
  const [at, setAt] = useState(-1);
  const t = TEXT[lang];
  const bar = useRef<HTMLElement>(null);
  const phone = view === "phone";
  const framed = phone && !narrow;
  // Production's matchMedia width checks answer for the box it renders in.
  mediaWidth = () => (phone ? (narrow ? window.innerWidth : PHONE_W) : narrow ? window.innerWidth : window.innerWidth - PANEL);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--review-h", `${el.getBoundingClientRect().height}px`);
    set();
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  const restart = (next: Scene = "script") => {
    setScene(next);
    setAt(-1);
    setRun((r) => r + 1);
  };
  const total = scene === "script" ? SCRIPT.length : 1;
  const done = scene === "script" ? (at < 0 ? 0 : at + 1) : at < 0 ? 0 : 1;
  const caption =
    at < 0
      ? t.start
      : scene === "one"
        ? t.oneCaption
        : scene === "five"
          ? t.fiveCaption
          : phone && SCRIPT[at].scroll
            ? `${t.steps[at]} ${t.phoneScroll}`
            : t.steps[at];
  const stage = (
    <MemoryRouter key={`${run}-${lang}-${view}`} initialEntries={[hrefOf("o", lang)]}>
      <Main
        key={`${direction}-${run}-${lang}-${reduced}-${view}`}
        lang={lang}
        d={direction}
        reduced={reduced}
        auto={auto}
        phone={phone}
        scene={scene}
        onStep={setAt}
      />
    </MemoryRouter>
  );
  return (
    <div className="rsc-review" data-direction={direction} data-narrow={narrow ? "" : undefined}>
      <header className="rsc-bar" ref={bar}>
        <strong className="rsc-title">{t.title}</strong>
        <ol className="rsc-lines" data-testid="direction-lines">
          {t.lines.map((l, i) => (
            <li key={l} aria-current={i === direction ? "true" : undefined}>
              {l}
            </li>
          ))}
        </ol>
        <p className="rsc-recommend" data-testid="recommendation">
          {t.recommend}
        </p>
        <div className="rsc-controls">
          <button type="button" className="rsc-play" data-testid="play-one" onClick={() => restart("one")}>
            {t.one}
          </button>
          <button type="button" className="rsc-play" data-testid="play-five" onClick={() => restart("five")}>
            {t.five}
          </button>
          <button
            type="button"
            data-testid="event-next"
            disabled={done >= total}
            onClick={() => window.dispatchEvent(new Event("rsc-next"))}
          >
            {t.next} ›
          </button>
          <button type="button" data-testid="event-reset" onClick={() => restart()}>
            {t.reset}
          </button>
        </div>
        <p className="rsc-caption" data-testid="event-caption">
          <b>{t.stepOf(done, total)}</b> {caption}
        </p>
        <div className="rsc-controls rsc-settings">
          {narrow ? null : (
            <label>
              {t.view}{" "}
              <select
                data-testid="view"
                value={view}
                onChange={(e) => {
                  reviewView = e.target.value as View;
                  setView(reviewView);
                  restart();
                }}
              >
                <option value="desktop">{t.views.desktop}</option>
                <option value="phone">{t.views.phone}</option>
              </select>
            </label>
          )}
          <label>
            {t.theme}{" "}
            <select
              id="theme"
              value={theme}
              onChange={(e) => {
                reviewTheme = e.target.value as Theme;
                setTheme(reviewTheme);
              }}
            >
              {(["light", "dark", "contrast"] as const).map((k) => (
                <option key={k} value={k}>
                  {t.themes[k]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.language}{" "}
            <select
              id="language"
              value={lang}
              onChange={(e) => {
                reviewLanguage = e.target.value as Lang;
                setPersonalLanguage(reviewLanguage);
                setLang(reviewLanguage);
                restart();
              }}
            >
              <option value="fi">suomi</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              data-testid="reduce"
              checked={reduced}
              onChange={(e) => {
                reviewReduced = e.target.checked;
                setReduced(reviewReduced);
                restart();
              }}
            />{" "}
            {t.reduce}
          </label>
          <label>
            <input
              type="checkbox"
              data-testid="auto"
              checked={auto}
              onChange={(e) => {
                reviewAuto = e.target.checked;
                setAuto(reviewAuto);
              }}
            />{" "}
            {t.auto}
          </label>
        </div>
        <p className="rsc-reduced-line">{t.reducedLine}</p>
      </header>
      <div className="rsc-stage" data-view={view} data-testid="stage">
        {framed ? (
          <div className="rsc-phone" data-testid="phone-frame">
            {stage}
          </div>
        ) : (
          stage
        )}
      </div>
    </div>
  );
}

// ---------- Host stand-in: only what the production shell asks for ----------

// A Habitat view has connect-src 'none': every request is answered here,
// none goes to the network.
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
window.fetch = async (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, "http://prototype.test/").pathname;
  if (path === "/api/v1/server") return json({ schema_version: 1, name: "Habitat", administrator: false, version: "0.0.0-proto" });
  return new Response("", { status: 404 });
};
// A sandboxed view's opaque origin may refuse URL rewrites; the picker's
// ?v= is a convenience, so a refusal must not stop it.
{
  const replace = history.replaceState.bind(history);
  history.replaceState = (...a: Parameters<History["replaceState"]>) => {
    try {
      replace(...a);
    } catch {
      // The view stays on its address.
    }
  };
}

setPersonalLanguage(reviewLanguage);
const root = createRoot(document.getElementById("root")!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {
  set innerHTML(view: ReactNode) {
    flushSync(() => root.render(view === "" ? null : view));
  },
};
const variants = DIRECTIONS.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement("nav");
picker.className = "proto-picker";
picker.setAttribute("aria-label", "Prototype variants");
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
DIRECTIONS.forEach((n, i) => {
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

export type { React };
