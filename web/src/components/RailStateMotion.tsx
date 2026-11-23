import { Component, createRef, type ReactNode, type RefObject } from "react";
import { liveText } from "../i18n";
import { railStateMotionText } from "../text/railStateMotion";
import type { AgentNavModel } from "./Navigation";
import { RAIL_BEYOND_CUE } from "./railRegions";
import "./RailStateMotion.css";

const txt = liveText(railStateMotionText);

export type MotionRows = Record<"yours" | "running" | "quiet", AgentNavModel[]>;
type Row = { section: keyof MotionRows; agent: AgentNavModel };
export function motionChanges(before: MotionRows, after: MotionRows): Row[] {
  const sections = ["yours", "running", "quiet"] as const;
  const previous = new Map(
    sections.flatMap((section) =>
      before[section].map(
        (agent) => [agent.agentId, { section, agent }] as const,
      ),
    ),
  );
  return sections.flatMap((section) =>
    after[section].flatMap((agent) => {
      const old = previous.get(agent.agentId);
      return old &&
        (old.section !== section ||
          (!!agent.failed && !old.agent.failed) ||
          (!!agent.readyKey && agent.readyKey !== old.agent.readyKey))
        ? [{ section, agent }]
        : [];
    }),
  );
}
export type RailMotionState = {
  rows: MotionRows;
  /** Absent while disconnected; a new identity/server establishes a baseline. */
  baseline?: string;
  enabled: boolean;
};
type Props = {
  root: RefObject<HTMLElement | null>;
  state?: RailMotionState;
  children: ReactNode;
};
type Snapshot = {
  changes: Row[];
  boxes: Map<string, DOMRect>;
  counts: Map<string, string>;
};
const rowSelector = 'li[data-testid^="agent-item-"]';
const headingSelector = ".ah-rail-section-head";
const headingKey = (el: HTMLElement) =>
  `${el.closest<HTMLElement>("section[data-testid]")?.dataset.testid}:head`;
const countSelector =
  '[data-testid="rail-yours-count"], [data-testid="rail-running-count"], [data-testid^="rail-beyond-"] b, [data-testid="navigation-badge"]';
const key = (el: HTMLElement) =>
  el.dataset.testid ??
  el.closest<HTMLElement>("[data-testid]")?.dataset.testid ??
  "";
const ink = (row: Row) => (row.agent.failed ? "err" : "turn");
const strong = (row: Row) => row.section === "yours" || row.agent.failed;
const target = (li: HTMLElement) =>
  li.querySelector<HTMLElement>(".ah-now-row, .ah-now-dot") ?? li;

/** getSnapshotBeforeUpdate is deliberately used here: an effect's previous
 * boxes would be stale after scrolling/resizing, and reading DOM during render
 * would also run for renders React abandons. No host state is delayed. */
export class RailStateMotion extends Component<Props> {
  private announcement = createRef<HTMLSpanElement>();
  private animations = new Set<Animation>();
  private cleanups = new Set<() => void>();
  private media?: MediaQueryList;
  private clear = () => {
    for (const animation of this.animations) animation.cancel();
    this.animations.clear();
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups.clear();
    if (this.announcement.current) this.announcement.current.textContent = "";
  };
  componentDidMount() {
    this.media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    this.media?.addEventListener("change", this.clear);
    document.addEventListener("visibilitychange", this.clear);
  }
  componentWillUnmount() {
    this.clear();
    this.media?.removeEventListener("change", this.clear);
    document.removeEventListener("visibilitychange", this.clear);
  }
  private shell() {
    return (
      this.props.root.current?.closest<HTMLElement>(".ah-shell-body") ??
      this.props.root.current
    );
  }
  getSnapshotBeforeUpdate(previous: Props): Snapshot | null {
    const a = previous.state;
    const b = this.props.state;
    const root = this.props.root.current;
    if (
      !a?.enabled ||
      !b?.enabled ||
      !a.baseline ||
      a.baseline !== b.baseline ||
      !root ||
      document.hidden
    )
      return null;
    const changes = motionChanges(a.rows, b.rows);
    if (!changes.length) return null;
    const boxes = new Map<string, DOMRect>();
    for (const li of root.querySelectorAll<HTMLElement>(rowSelector))
      boxes.set(key(li), target(li).getBoundingClientRect());
    for (const heading of root.querySelectorAll<HTMLElement>(headingSelector))
      boxes.set(headingKey(heading), heading.getBoundingClientRect());
    const counts = new Map<string, string>();
    for (const el of this.shell()?.querySelectorAll<HTMLElement>(
      countSelector,
    ) ?? [])
      counts.set(key(el), el.textContent ?? "");
    return { changes, boxes, counts };
  }
  private later(fn: () => void, ms: number) {
    const cleanup = () => {
      clearTimeout(timer);
      fn();
      this.cleanups.delete(cleanup);
    };
    const timer = window.setTimeout(cleanup, ms);
    this.cleanups.add(cleanup);
  }
  private animate(el: HTMLElement, frames: Keyframe[], token: string) {
    if (!el.animate) return;
    const style = getComputedStyle(el);
    const animation = el.animate(frames, {
      duration: Number.parseFloat(
        style.getPropertyValue(`--ah-rail-${token}-ms`),
      ),
      easing: style.getPropertyValue("--ah-rail-move-ease").trim(),
    });
    this.animations.add(animation);
    animation.onfinish = () => {
      this.animations.delete(animation);
    };
    return animation;
  }
  private flag(el: HTMLElement, name: string, ms: number) {
    el.setAttribute(name, "");
    this.later(() => el.removeAttribute(name), ms);
  }
  private roll(el: HTMLElement, old: string, reduced: boolean) {
    if (old === el.textContent) return;
    if (reduced) {
      this.flag(el, "data-rail-hold", 4000);
      return;
    }
    el.style.setProperty("--rail-ink", getComputedStyle(el).color);
    el.dataset.railOld = old;
    el.dataset.railNew = el.textContent ?? "";
    this.flag(el, "data-rail-roll", 520);
    this.later(() => {
      delete el.dataset.railOld;
      delete el.dataset.railNew;
      el.style.removeProperty("--rail-ink");
    }, 520);
  }
  componentDidUpdate(previous: Props, _state: unknown, snap: Snapshot | null) {
    if (
      !this.props.state?.enabled ||
      !this.props.state.baseline ||
      previous.state?.baseline !== this.props.state.baseline
    ) {
      this.clear();
      return;
    }
    if (!snap) return;
    this.clear();
    const root = this.props.root.current;
    const shell = this.shell();
    if (!root || !shell) return;
    const reduced = this.media?.matches ?? false;
    const burst = snap.changes.length >= 3;
    const message = burst
      ? txt.changed(snap.changes.length)
      : snap.changes
          .map(({ agent }) => txt.arrival(agent.title, agent.activityLabel))
          .join(". ");
    if (this.announcement.current)
      this.announcement.current.textContent = message;
    let flight: Animation | undefined;
    const region = root.querySelector<HTMLElement>(
      '[data-testid="rail-conversations"]',
    );
    const box = region?.getBoundingClientRect();
    const phone = shell.querySelector<HTMLElement>(".ah-mobile-toolbar");
    const closedPhone =
      phone &&
      phone.getBoundingClientRect().height > 0 &&
      !shell.classList.contains("ah-mobile-open");
    if (closedPhone) {
      const attention = snap.changes.filter(strong);
      const button = phone.querySelector<HTMLElement>(
        '[data-testid="navigation-open"]',
      );
      if (attention.length && button) {
        const fly = document.createElement("div");
        fly.className = "ah-rail-flight";
        fly.setAttribute("aria-hidden", "true");
        // Native titles are text, never markup. A burst has one shared cue.
        fly.textContent = message;
        fly.style.top = `${phone.getBoundingClientRect().bottom + 10}px`;
        shell.append(fly);
        const f = fly.getBoundingClientRect();
        const b = button.getBoundingClientRect();
        if (!reduced)
          flight = this.animate(
            fly,
            [
              { opacity: 0, transform: "translateY(-8px)" },
              { offset: 0.14, opacity: 1, transform: "none" },
              { offset: 0.58, opacity: 1, transform: "none" },
              {
                opacity: 0,
                transform: `translate(${b.x + b.width / 2 - f.x - f.width / 2}px, ${b.y + b.height / 2 - f.y - f.height / 2}px) scale(.12)`,
              },
            ],
            "flight",
          );
        this.later(() => fly.remove(), reduced ? 4000 : 1700);
      }
    } else {
      const rows = [...root.querySelectorAll<HTMLElement>(rowSelector)];
      // Animate the row's contents, not the measured li. Edge chips and the
      // adaptive allocator must continue measuring final layout during travel.
      for (const li of rows) {
        const el = target(li);
        const old = snap.boxes.get(key(li));
        const rect = el.getBoundingClientRect();
        if (!reduced && old && Math.abs(old.top - rect.top) >= 2) {
          if (
            snap.changes.some(
              (change) => key(li) === `agent-item-${change.agent.agentId}`,
            )
          )
            this.flag(el, "data-rail-travel", 700);
          this.animate(
            el,
            [
              { transform: `translateY(${old.top - rect.top}px)` },
              { transform: "none" },
            ],
            "move",
          );
        }
      }
      if (!reduced)
        for (const heading of root.querySelectorAll<HTMLElement>(
          headingSelector,
        )) {
          const old = snap.boxes.get(headingKey(heading));
          const rect = heading.getBoundingClientRect();
          if (old && Math.abs(old.top - rect.top) >= 2)
            this.animate(
              heading,
              [
                { transform: `translateY(${old.top - rect.top}px)` },
                { transform: "none" },
              ],
              "move",
            );
        }
      for (const change of snap.changes) {
        const li = rows.find(
          (el) => key(el) === `agent-item-${change.agent.agentId}`,
        );
        const rect = li?.getBoundingClientRect();
        const edge =
          box && rect
            ? rect.bottom - 8 <= box.top + RAIL_BEYOND_CUE
              ? "above"
              : rect.top + 8 >= box.bottom - RAIL_BEYOND_CUE
                ? "below"
                : null
            : null;
        if (li && !edge && !burst && strong(change)) {
          const el = target(li);
          el.style.setProperty("--rail-colour", `var(--ah-${ink(change)})`);
          el.style.setProperty("--rail-line", `var(--ah-${ink(change)}-line)`);
          this.flag(
            el,
            reduced ? "data-rail-still" : "data-rail-glow",
            reduced ? 4000 : 1900,
          );
          this.later(
            () => {
              el.style.removeProperty("--rail-colour");
              el.style.removeProperty("--rail-line");
            },
            reduced ? 4000 : 1900,
          );
        }
      }
    }
    // The existing edge observer updates chips after commit. Observe only
    // their text/arrival for this transition, not later scrolling or events.
    const seen = new Map(snap.counts);
    const marked = new Set<HTMLElement>();
    const counts = () => {
      // An allocator resize can leave the count unchanged even though a
      // different conversation now lies beyond it. Still mark that arrival.
      const bounds = region?.getBoundingClientRect();
      if (bounds && !closedPhone)
        for (const change of snap.changes.filter(strong)) {
          const li = [...root.querySelectorAll<HTMLElement>(rowSelector)].find(
            (el) => key(el) === `agent-item-${change.agent.agentId}`,
          );
          const rect = li?.getBoundingClientRect();
          const edge =
            rect &&
            (rect.bottom - 8 <= bounds.top + RAIL_BEYOND_CUE
              ? "above"
              : rect.top + 8 >= bounds.bottom - RAIL_BEYOND_CUE
                ? "below"
                : null);
          const chip =
            edge &&
            root.querySelector<HTMLElement>(
              `[data-testid="rail-beyond-${edge}-${change.section}"]`,
            );
          if (chip && !marked.has(chip)) {
            marked.add(chip);
            this.flag(chip, "data-rail-hold", reduced ? 4000 : 1600);
          }
        }
      for (const el of shell.querySelectorAll<HTMLElement>(countSelector)) {
        const id = key(el);
        const old = seen.get(id);
        const text = el.textContent ?? "";
        if (old === text) continue;
        seen.set(id, text);
        if (flight && id === "navigation-badge") {
          const previous = old ?? "";
          el.dataset.railPending = previous;
          this.later(() => {
            delete el.dataset.railPending;
          }, 1700);
          flight.addEventListener(
            "finish",
            () => {
              delete el.dataset.railPending;
              this.roll(el, previous, false);
            },
            { once: true },
          );
          continue;
        }
        const chip = el.closest<HTMLElement>(".ah-rail-beyond-chip");
        if (chip && old === undefined && !reduced)
          this.animate(
            chip,
            [
              {
                transform: `translateY(${id.includes("above") ? -130 : 130}%)`,
                opacity: 0,
              },
              { transform: "none", opacity: 1 },
            ],
            "edge",
          );
        else this.roll(el, old ?? "0", reduced);
      }
    };
    counts();
    const observer = new MutationObserver(counts);
    observer.observe(shell, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    const resize =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(counts);
    if (region) resize?.observe(region);
    this.later(() => {
      observer.disconnect();
      resize?.disconnect();
    }, 800);
  }
  render() {
    return (
      <>
        {this.props.children}
        <span
          ref={this.announcement}
          className="ah-visually-hidden"
          role="status"
          aria-atomic="true"
        />
      </>
    );
  }
}
