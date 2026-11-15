import { useEffect } from "react";
import { useNavigate } from "react-router";
import type { AgentNavModel } from "../components/Navigation";
import {
  type QuietChoice,
  type QuietWorkspace,
  quietView,
} from "../components/QuietSection";
import type { RailNow } from "./railNow";

/** Share Quiet's ordering/filtering, including its pinned open row. Hidden
 * rows are not keyboard destinations, just as they are not click targets. */
export function railKeyboardOrder(
  now: RailNow,
  choice: QuietChoice,
  workspaces: QuietWorkspace[],
  folded: boolean,
  collapsed: boolean,
) {
  const quiet = quietView(now.quiet, choice, workspaces);
  return [
    ...now.yours,
    ...now.running,
    ...(collapsed
      ? []
      : folded
        ? quiet.open
          ? [quiet.open]
          : []
        : quiet.shown),
  ];
}

export function railKeyboardTarget(
  rows: AgentNavModel[],
  current: string | undefined,
  direction: number,
  waiting: boolean,
  yours: AgentNavModel[],
) {
  if (waiting) {
    const at = yours.findIndex((row) => row.href === current);
    const next =
      yours[
        at < 0
          ? direction > 0
            ? 0
            : yours.length - 1
          : (at + direction + yours.length) % yours.length
      ];
    return next?.href !== current ? next : undefined;
  }
  const index = rows.findIndex((row) => row.href === current);
  return rows[index < 0 ? 0 : index + direction];
}

export function railKeyboardDirection(event: KeyboardEvent): number {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    !event.altKey ||
    event.ctrlKey ||
    event.metaKey
  )
    return 0;
  const target = event.target;
  if (
    target instanceof Element &&
    target.closest(
      '.ah-terminal-surface, iframe, .cm-editor, [role="dialog"], [role="menu"], [role="listbox"]',
    )
  )
    return 0;
  if (document.querySelector('[role="dialog"], .ah-composer [role="listbox"]'))
    return 0;
  return event.code === "ArrowDown" ? 1 : event.code === "ArrowUp" ? -1 : 0;
}

export function useRailKeyboard(rows: AgentNavModel[], yours: AgentNavModel[]) {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        !window.location.pathname.startsWith("/workspaces") &&
        !window.location.pathname.startsWith("/agents")
      )
        return;
      const direction = railKeyboardDirection(event);
      if (!direction) return;
      event.preventDefault();
      event.stopPropagation();
      // The address changes before React commits the selected rail row. Reading
      // that row here can repeat a step (or leave the end) under held keys.
      const route = new URL(window.location.href);
      const current = [...rows, ...yours].find((row) => {
        const href = new URL(row.href, route);
        return (
          href.pathname === route.pathname &&
          href.searchParams.get("conversation") ===
            route.searchParams.get("conversation")
        );
      })?.href;
      const next = railKeyboardTarget(
        rows,
        current,
        direction,
        event.shiftKey,
        yours,
      );
      if (!next) return;
      // Conversation changes keep this field mounted. Enter it before routing
      // when the key came from the rail/feed; never blur a live composer.
      // If the destination mounts a new field, its normal opening focus owns it.
      const field = document.querySelector<HTMLTextAreaElement>(
        ".ah-composer textarea:not(:disabled)",
      );
      if (field) field.focus({ preventScroll: true });
      else if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
      void navigate(next.href);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [rows, yours, navigate]);
}
