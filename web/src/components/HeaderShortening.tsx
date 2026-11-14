import { type RefObject, useEffect, useLayoutEffect, useState } from "react";
import type { MarkState } from "./HabitatMark";
import type { StatusKind } from "./Status";
import { StatusMark } from "./Status";

/** The steps the desktop conversation header takes, in this order, until
 * the title keeps its share of the one row (proto-conversation-header,
 * round 2, direction 1). components.css draws each step from the row's
 * `data-shorten` list:
 * 1 the workspace into the ⋯ menu; 2 the context percentage (the ring
 * stays); 3 new title, archive and details into the ⋯ menu; 4 the file
 * count; 5 tighter gaps and chips; 6 the Git counts (the icon stays; a Git
 * row joins the menu) and an open machine's name (its dot stays); 7 the
 * model chip (a model row joins the menu). */
export const HEADER_STEPS = 7;
const WORKSPACE = 1;
const ACTIONS = 3;
const GIT_COUNTS = 6;
const MODEL = 7;
/** The title keeps this share of the row, or its whole text. */
const TITLE_SHARE = 0.4;

/** What the desktop row moved into the ⋯ menu. Unset where nothing was
 * measured (a phone, whose menu holds every secondary action, or a test DOM
 * without layout): the menu then lists everything. */
export type HiddenState = {
  workspace?: boolean;
  actions?: boolean;
  git?: string;
  model?: string;
};

/** Measures the header's one row and applies the fewest steps that leave the
 * title its share. Content decides as much as width does (a long title,
 * Git counts, a guide toggle), so this measures rather than using fixed
 * container widths. A phone keeps its compact title/facts block and takes no steps.
 * Returns what the steps hid that the ⋯ menu must now say. */
export function useHeaderShortening(
  row: RefObject<HTMLElement | null>,
): HiddenState {
  const [hidden, setHidden] = useState<HiddenState>({});
  useLayoutEffect(() => {
    const element = row.current;
    // A test DOM without layout has nothing to measure.
    if (
      !element ||
      typeof window.matchMedia !== "function" ||
      typeof ResizeObserver === "undefined"
    )
      return;
    const desktop = window.matchMedia("(min-width: 801px)");
    let frame = 0;
    const apply = (steps: number) => {
      const list = Array.from({ length: steps }, (_, i) => i + 1).join(" ");
      if (list) element.dataset.shorten = list;
      else delete element.dataset.shorten;
    };
    const fits = () => {
      const title = element.querySelector("h1");
      const box = element.getBoundingClientRect();
      // Children rather than scrollWidth: the activity's hidden tooltip
      // may reach past the row without taking any of its room.
      const right = Math.max(
        box.left,
        ...[...element.children].map((child) => {
          const rect = child.getBoundingClientRect();
          return rect.width ? rect.right : box.left;
        }),
      );
      if (right > box.right + 1) return false;
      if (!title) return true;
      const need = Math.min(title.scrollWidth, box.width * TITLE_SHARE);
      return title.clientWidth >= need - 1;
    };
    const run = () => {
      frame = 0;
      let steps = 0;
      if (desktop.matches) {
        for (; steps < HEADER_STEPS; steps++) {
          apply(steps);
          if (fits()) break;
        }
      }
      apply(steps);
      const git =
        steps >= GIT_COUNTS
          ? element
              .querySelector<HTMLElement>(".ah-gs-chip")
              ?.getAttribute("data-menu-summary")
          : undefined;
      const model =
        steps >= MODEL
          ? element
              .querySelector<HTMLElement>(".ah-set-chip[data-menu-summary]")
              ?.getAttribute("data-menu-summary")
          : undefined;
      const next: HiddenState = {
        workspace: desktop.matches ? steps >= WORKSPACE : undefined,
        actions: desktop.matches ? steps >= ACTIONS : undefined,
        git: git ?? undefined,
        model: model ?? undefined,
      };
      setHidden((previous) =>
        previous.workspace === next.workspace &&
        previous.actions === next.actions &&
        previous.git === next.git &&
        previous.model === next.model
          ? previous
          : next,
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(run);
    };
    run();
    // The row's width, and anything inside it: a title, a count, a chip
    // that arrives with its first read.
    const resize = new ResizeObserver(schedule);
    resize.observe(element);
    const mutation = new MutationObserver(schedule);
    mutation.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    desktop.addEventListener("change", schedule);
    document.fonts?.ready.then(schedule);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      desktop.removeEventListener("change", schedule);
    };
  }, [row]);
  return hidden;
}

/** The conversation's activity as a dot (no pill, no words in the row). The
 * state shows as text on hover, keyboard focus and a tap, and is always the
 * dot's accessible name. */
export function HeaderActivity({
  label,
  detail,
  mark,
  kind,
}: {
  label: string;
  /** The turn's phase and duration, "Ajattelee · 2 min 14 s". */
  detail?: string;
  mark: MarkState;
  kind: StatusKind;
}) {
  const [open, setOpen] = useState(false);
  const text = detail ? `${label} · ${detail}` : label;
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest(".ah-header-activity")
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [open]);
  return (
    <button
      type="button"
      className="ah-header-activity"
      data-testid="header-activity"
      data-open={open || undefined}
      aria-label={text}
      onClick={() => setOpen(!open)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <StatusMark label={label} tone="info" kind={kind} mark={mark} />
      <span className="ah-header-tip" aria-hidden="true">
        {text}
      </span>
    </button>
  );
}
