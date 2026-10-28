import { useRef } from "react";

export type TurnIdentity = {
  scope?: string;
  /**
   * The key the running turn's live row was last rendered under, and the
   * history items that existed when that row appeared.
   */
  pending?: { key: string; before: Set<string> };
  /** History item id → the live key it took over. */
  aliases: Map<string, string>;
};

export const turnIdentity = (): TurnIdentity => ({
  pending: undefined,
  aliases: new Map(),
});

/**
 * Before native history has the running turn, it renders as a live row under
 * its own key; once saved, history names it `turn:<entry>`. A changed key
 * would remount the whole turn the moment it settles: a selection in its
 * reply is lost and the turn's own state (opened stages, code view, diagrams)
 * resets. The history turn that takes over a live row therefore keeps the
 * live row's key for as long as the conversation stays open.
 */
export function settleTurnIds<T extends { id: string; kind: string }>(
  memory: TurnIdentity,
  scope: string,
  timeline: T[],
  liveRow: string | undefined,
): { timeline: T[]; liveKey?: string } {
  if (memory.scope !== scope) Object.assign(memory, turnIdentity(), { scope });
  let liveKey = liveRow;
  if (liveRow) {
    // A later live row of the same command must not reuse a key an earlier,
    // already saved part of it keeps.
    const taken = new Set(memory.aliases.values());
    for (let n = 2; liveKey && taken.has(liveKey); n++)
      liveKey = `${liveRow}#${n}`;
    if (memory.pending?.key !== liveKey)
      memory.pending = {
        key: liveKey as string,
        before: new Set(timeline.map((item) => item.id)),
      };
  } else if (memory.pending) {
    // The row's turn is the newest one history added while the row showed,
    // even if a history read showed it beside the row before the row went.
    const { key, before } = memory.pending;
    const target = timeline.findLast(
      (item) => item.kind === "assistant" && !before.has(item.id),
    );
    if (target && !memory.aliases.has(target.id)) {
      memory.aliases.set(target.id, key);
      memory.pending = undefined;
    }
  }
  return {
    liveKey,
    timeline: memory.aliases.size
      ? timeline.map((item) => {
          const alias = memory.aliases.get(item.id);
          return alias ? { ...item, id: alias } : item;
        })
      : timeline,
  };
}

export function useTurnIdentity<T extends { id: string; kind: string }>(
  scope: string,
  timeline: T[],
  liveRow: string | undefined,
) {
  const memory = useRef<TurnIdentity>(turnIdentity());
  return settleTurnIds(memory.current, scope, timeline, liveRow);
}
