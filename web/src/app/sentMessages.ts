import { useCallback, useEffect, useRef, useState } from "react";
import { restoreToDraft } from "./heldMessages";
import type { HistoryEntry } from "./history";

// A message the person sends is drawn at once, before Pi's own record of it
// can reach this page: that record arrives only after Pi has taken the
// message, written it, and the page has read native history again, which on
// a remote host is up to a second. The text is always in exactly one place:
// the conversation (or Pi's queue card) while it is on its way, the field
// again if it was refused or its outcome is unknown, and Pi's native message
// once history shows it.

// This document's sends and queued messages whose request has not been
// answered yet. A status or receipt read meanwhile may have been taken before
// the host had them, so it cannot make their outcome unknown. Kept outside
// the view: a send outlives switching away from its conversation.
const unanswered = new Set<string>();
export const ownWrites = {
  begin: (command: string) => {
    unanswered.add(command);
  },
  end: (command: string) => {
    unanswered.delete(command);
  },
  /** The commands still on their way now. */
  snapshot: (): ReadonlySet<string> => new Set(unanswered),
};

/** What is known of this tab's latest send. `kind` comes from the send
 * itself and is absent after a reload. */
export type SendObservationValue = {
  text: string;
  state: "pending" | "accepted" | "rejected" | "uncertain";
  command?: string;
  kind?: "send" | "queue";
};

/** A direct send this tab made, drawn until Pi's own message replaces it. */
export type OwnSend = {
  command: string;
  text: string;
  /** The native user messages present when it was sent (`userKeys`). */
  before: string[];
};

/** The person's native messages present when a message was sent. */
export function userKeys(entries: readonly HistoryEntry[]) {
  return entries.filter((e) => e.kind === "user").map((e) => e.entry_key);
}

/** A direct send starts the next turn, so the newest native user message
 * that was not there when it was sent is that message, whatever Pi made of
 * its text (a skill's expansion, attachment paths). An older history page
 * only adds earlier messages, never a newer one. */
export function sendArrived(
  entries: readonly HistoryEntry[],
  before: readonly string[],
) {
  const last = entries.findLast((e) => e.kind === "user");
  return !!last && !before.includes(last.entry_key);
}

/** A steering or follow-up message this tab sent while Pi works. */
export type QueuedSend = {
  command: string;
  kind: "steer" | "follow_up";
  text: string;
  /** Native user entries that already contained this text when it was sent;
   * they cannot show that this message arrived. */
  preexisting: string[];
  /** Pi acknowledged it. */
  accepted?: boolean;
  /** Since when an acknowledged message has been missing from Pi's queue:
   * Pi has delivered it and native history does not show it yet. */
  left?: number;
};

/** How long a delivered message is drawn at most if native history never
 * shows it under its own text (a skill's expansion, for example). */
export const DELIVERY_GRACE_MS = 10000;

type Queue = { steering: string[]; follow_up: string[] };

/** Pi's queue decides; equal texts may repeat in it, so this tab's messages
 * are matched to its entries one by one, oldest first. */
function inQueue(local: readonly QueuedSend[], queue: Queue) {
  const left = new Map<string, number>();
  for (const [kind, texts] of [
    ["steer", queue.steering],
    ["follow_up", queue.follow_up],
  ] as const)
    for (const text of texts)
      left.set(`${kind}\n${text}`, (left.get(`${kind}\n${text}`) ?? 0) + 1);
  return local.map((m) => {
    const key = `${m.kind}\n${m.text}`;
    const n = left.get(key) ?? 0;
    if (n) left.set(key, n - 1);
    return n > 0;
  });
}

/** Pi's queue as the card shows it: Pi's own (it includes other tabs'
 * messages), then this tab's messages Pi does not show: not yet, because
 * its acknowledgement is still on its way, or no longer, because Pi has
 * delivered them and native history does not show them yet. */
export function shownQueue(
  queue: Queue | undefined,
  local: readonly QueuedSend[],
): Queue | undefined {
  if (!local.length) return queue;
  const base = queue ?? { steering: [], follow_up: [] };
  const shown = inQueue(local, base);
  const extra = local.filter((_, i) => !shown[i]);
  return {
    ...base,
    steering: [
      ...base.steering,
      ...extra.filter((m) => m.kind === "steer").map((m) => m.text),
    ],
    follow_up: [
      ...base.follow_up,
      ...extra.filter((m) => m.kind === "follow_up").map((m) => m.text),
    ],
  };
}

/** Advances this tab's queued messages over a new observation of Pi's
 * queue and native history. Only a message Pi has acknowledged and no
 * longer queues can have arrived, and each native message shows one. */
export function reconcileQueued(
  local: readonly QueuedSend[],
  queue: Queue | undefined,
  entries: readonly HistoryEntry[],
  now: number,
): QueuedSend[] {
  if (!queue) return [...local];
  const queued = inQueue(local, queue);
  const users = entries.filter((e) => e.kind === "user");
  const used = new Set<string>();
  return local.flatMap((m, i) => {
    if (!m.accepted) return [m];
    if (queued[i])
      return m.left === undefined ? [m] : [{ ...m, left: undefined }];
    const native = users.find(
      (u) =>
        !used.has(u.entry_key) &&
        !m.preexisting.includes(u.entry_key) &&
        (u.content?.text ?? "").includes(m.text),
    );
    if (native) {
      used.add(native.entry_key);
      return [];
    }
    if (m.left === undefined) return [{ ...m, left: now }];
    return now - m.left >= DELIVERY_GRACE_MS ? [] : [m];
  });
}

/** This tab's messages on their way in one conversation, and the field's
 * part in a send's outcome: a refused or unknown message goes back to the
 * field, and only text given back that way is cleared again once accepted. */
export function useSentMessages({
  scope,
  entries,
  queue,
  sendObservation,
  draft,
  changeDraft,
}: {
  /** The person and conversation; another scope starts empty. */
  scope: string;
  entries: HistoryEntry[];
  queue: Queue | undefined;
  sendObservation: SendObservationValue | undefined;
  draft: string;
  changeDraft: (value: string) => void;
}) {
  const [state, setState] = useState<{
    scope: string;
    own?: OwnSend;
    queued: QueuedSend[];
  }>({ scope, queued: [] });
  const current = state.scope === scope ? state : { scope, queued: [] };
  const queued = current.queued;
  const update = useCallback(
    (change: (old: QueuedSend[]) => QueuedSend[]) =>
      setState((old) => {
        const now = old.scope === scope ? old : { scope, queued: [] };
        const next = change(now.queued);
        return old === now &&
          next.length === now.queued.length &&
          next.every((m, i) => m === now.queued[i])
          ? old
          : { ...now, queued: next };
      }),
    [scope],
  );
  const onQueued = useCallback(
    (message: QueuedSend | "clear") =>
      update((old) => (message === "clear" ? [] : [...old, message])),
    [update],
  );
  const onSent = useCallback(
    (own: OwnSend) =>
      setState((old) => ({
        scope,
        queued: old.scope === scope ? old.queued : [],
        own,
      })),
    [scope],
  );
  const [tick, setTick] = useState(0);
  useEffect(() => {
    void tick; // a delivery grace ended
    update((old) =>
      old.length ? reconcileQueued(old, queue, entries, Date.now()) : old,
    );
  }, [queue, entries, tick, update]);
  // The grace ends at an absolute deadline: re-renders do not extend it.
  useEffect(() => {
    const due = Math.min(
      ...queued.flatMap((m) =>
        m.left === undefined ? [] : [m.left + DELIVERY_GRACE_MS],
      ),
    );
    if (!Number.isFinite(due)) return;
    const timer = window.setTimeout(
      () => setTick((n) => n + 1),
      Math.max(0, due - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [queued]);
  const restored = useRef(new Set<string>());
  // biome-ignore lint/correctness/useExhaustiveDependencies: an outcome, not a draft edit, moves the text.
  useEffect(() => {
    const command = sendObservation?.command;
    if (!sendObservation || !command) return;
    const { state, text } = sendObservation;
    if (state === "accepted") {
      update((old) =>
        old.map((m) =>
          m.command === command && !m.accepted ? { ...m, accepted: true } : m,
        ),
      );
      // A text given back as unknown, then shown accepted after all.
      if (restored.current.has(command) && draft === text) changeDraft("");
      return;
    }
    if (state !== "rejected" && state !== "uncertain") return;
    update((old) => old.filter((m) => m.command !== command));
    setState((old) =>
      old.own?.command === command ? { ...old, own: undefined } : old,
    );
    if (restored.current.has(command)) return;
    restored.current.add(command);
    if (!draft.includes(text)) changeDraft(restoreToDraft([text], draft));
  }, [sendObservation, update]);
  // Once Pi's message has replaced the bubble, the send is done: a later
  // history without it (Palaa tähän went back before it) must not draw it
  // again.
  const arrived = !!current.own && sendArrived(entries, current.own.before);
  useEffect(() => {
    if (!arrived) return;
    setState((old) =>
      old.scope === scope && old.own && sendArrived(entries, old.own.before)
        ? { ...old, own: undefined }
        : old,
    );
  }, [arrived, entries, scope]);
  // The bubble belongs to its own send, not to whichever send is latest.
  const own =
    current.own && !sendArrived(entries, current.own.before)
      ? {
          ...current.own,
          pending:
            sendObservation?.command === current.own.command &&
            sendObservation.state === "pending",
        }
      : undefined;
  return { own, onSent, queued, onQueued };
}
