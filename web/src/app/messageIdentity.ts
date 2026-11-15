import { useLayoutEffect, useRef } from "react";
import type { HistoryEntry } from "./history";

export type PendingMessageIdentity = {
  key: string;
  text: string;
  before?: readonly string[];
  direct?: boolean;
};
export type MessageIdentity = {
  scope?: string;
  pending: Map<string, PendingMessageIdentity & { after?: string }>;
  aliases: Map<string, string>;
};
export const messageIdentity = (): MessageIdentity => ({
  pending: new Map(),
  aliases: new Map(),
});

/** Presentation identity only: delivery, receipts and recovery remain with the
 * send controllers. Native history takes over the already mounted bubble in
 * the same render, not one effect after a duplicate has been painted. */
export function settleMessageIds(
  memory: MessageIdentity,
  scope: string,
  entries: readonly HistoryEntry[],
  pending: PendingMessageIdentity[],
  historyReady = true,
) {
  if (memory.scope !== scope)
    Object.assign(memory, messageIdentity(), { scope });
  const users = entries.filter((e) => e.kind === "user");
  for (const p of pending) {
    if (
      historyReady &&
      !memory.pending.has(p.key) &&
      ![...memory.aliases.values()].includes(p.key)
    )
      memory.pending.set(p.key, {
        ...p,
        before: p.before ?? users.map((e) => e.entry_key),
        after: entries.at(-1)?.entry_key,
      });
  }
  for (const [key, p] of memory.pending) {
    // Loading an older page or jumping to a different history window is
    // not delivery. The native record must follow the latest entry (even
    // a tool-only tail) present when the bubble appeared; if it is absent,
    // this window cannot establish its successor.
    const anchor = p.after
      ? entries.findIndex((e) => e.entry_key === p.after)
      : -1;
    const candidates =
      p.after && anchor < 0
        ? []
        : entries
            .slice(anchor + 1)
            .filter(
              (e) =>
                e.kind === "user" &&
                !p.before?.includes(e.entry_key) &&
                !memory.aliases.has(e.entry_key),
            );
    const entry = p.direct
      ? candidates.at(-1)
      : candidates.find((e) => e.content.text.includes(p.text));
    if (entry) memory.aliases.set(entry.entry_key, key);
    if (entry || !pending.some((p) => p.key === key))
      memory.pending.delete(key);
  }
  return memory.aliases;
}

export function useMessageIdentity(
  scope: string,
  entries: readonly HistoryEntry[],
  pending: PendingMessageIdentity[],
  historyReady: boolean,
) {
  const memory = useRef(messageIdentity());
  const next = {
    ...memory.current,
    pending: new Map(memory.current.pending),
    aliases: new Map(memory.current.aliases),
  };
  const aliases = settleMessageIds(next, scope, entries, pending, historyReady);
  // A speculative render cannot claim a history entry for an unseen bubble.
  useLayoutEffect(() => {
    memory.current = next;
  });
  return aliases;
}
