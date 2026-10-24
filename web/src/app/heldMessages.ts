import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelHeld,
  continueConversation,
  type HeldMessage,
  NotAdmitted,
  type Status,
  send,
  sendReceipt,
} from "./conversations";
import type { HistoryEntry } from "./history";

/** A message this tab sent while Pi was not running. The daemon owns it once
 * posted; the browser keeps the text only to draw it and to recover it. */
export type LocalHeld = {
  command_id: string;
  text: string;
  /** The POST was attempted. Its command ID is spent and never posted again. */
  posted: boolean;
  /** No daemon evidence remains (for example after a daemon restart). */
  uncertain?: boolean;
  /** Pi accepted it; drawn until native history shows the message. */
  delivered?: number;
  /** Native user entries that already contained this text when it was sent;
   * they cannot show that this message arrived. */
  preexisting?: string[];
  /** The first message's model intent for a still-empty new conversation. */
  choice?: { provider?: string; model: string; thinking?: string };
};

export type WaitingView = {
  command_id: string;
  text: string;
  state: "waiting" | "failed" | "uncertain";
};

/** States in which Pi is not running and a send is held by the daemon. */
export function piNotRunning(state?: string) {
  return (
    state === "starting" || state === "stopped" || state === "start_failed"
  );
}

const DELIVERY_GRACE_MS = 10000;

export function readHeld(key: string): LocalHeld[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "[]");
    return Array.isArray(value)
      ? value.filter(
          (v): v is LocalHeld =>
            !!v &&
            typeof v.command_id === "string" &&
            typeof v.text === "string" &&
            typeof v.posted === "boolean",
        )
      : [];
  } catch {
    return [];
  }
}
export function writeHeld(key: string, value: LocalHeld[]) {
  if (value.length) sessionStorage.setItem(key, JSON.stringify(value));
  else sessionStorage.removeItem(key);
}

/** Joins texts given back to the person ahead of what is already in the field. */
export function restoreToDraft(returned: string[], draft: string) {
  return [...returned, draft].filter((t) => t.trim()).join("\n\n");
}

/** The waiting bubbles: the daemon's held list first (it is authoritative and
 * includes other tabs), then this tab's messages it has not reported yet. A
 * message Pi accepted stays until native history shows it (or the delivery
 * grace ends): the native message replaces the bubble, with no gap between. */
export function waitingMessages(
  local: LocalHeld[],
  held: HeldMessage[] | undefined,
  state?: string,
): WaitingView[] {
  const failed = state === "start_failed";
  const daemon = held ?? [];
  const known = new Set(daemon.map((h) => h.command_id));
  return [
    ...daemon.map((h) => ({
      command_id: h.command_id,
      text: h.text,
      state: failed ? ("failed" as const) : ("waiting" as const),
    })),
    ...local
      .filter((l) => !known.has(l.command_id))
      .map((l) => ({
        command_id: l.command_id,
        text: l.text,
        state: l.uncertain
          ? ("uncertain" as const)
          : failed && l.posted
            ? ("failed" as const)
            : ("waiting" as const),
      })),
  ];
}

// Messages sent while Pi is not running are posted one at a time, in order, so
// the daemon joins them in the order the person wrote them. A spent command ID
// is never posted again; after a lost reply only its receipt can resolve it.
export function useHeldMessages({
  id,
  identity,
  workspaceId,
  csrf,
  current,
  entries,
  draft,
  changeDraft,
  refresh,
  onLogin,
}: {
  id?: string;
  identity: string;
  workspaceId: string;
  csrf?: string;
  current?: Status;
  entries: HistoryEntry[];
  draft: string;
  changeDraft: (value: string) => void;
  refresh: () => Promise<void>;
  onLogin: () => void;
}) {
  const key = `nah:${identity}:held:${id ?? ""}`;
  const [local, setLocalState] = useState<LocalHeld[]>(() => readHeld(key));
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const chain = useRef<Promise<void>>(Promise.resolve());
  // Command IDs whose POST has not answered; only their reply resolves them.
  const inFlight = useRef(new Set<string>());
  const latest = useRef({
    key,
    draft,
    changeDraft,
    csrf,
    id,
    refresh,
    entries,
  });
  latest.current = { key, draft, changeDraft, csrf, id, refresh, entries };
  useEffect(() => {
    setLocalState(readHeld(key));
    setNotice("");
    chain.current = Promise.resolve();
  }, [key]);
  const update = useCallback(
    (forKey: string, change: (old: LocalHeld[]) => LocalHeld[]) => {
      const next = change(readHeld(forKey));
      writeHeld(forKey, next);
      if (forKey === latest.current.key) setLocalState(next);
    },
    [],
  );
  const giveBack = useCallback((texts: string[]) => {
    if (!texts.length) return;
    const { draft: field, changeDraft: set } = latest.current;
    set(restoreToDraft(texts, field));
  }, []);
  // Post every not-yet-posted message for this conversation, in order.
  const flush = useCallback(() => {
    const forKey = latest.current.key;
    const agent = latest.current.id;
    const token = latest.current.csrf;
    if (!agent || !token) return chain.current;
    chain.current = chain.current.then(async () => {
      for (;;) {
        const next = readHeld(forKey).find((l) => !l.posted);
        if (!next) return;
        update(forKey, (old) =>
          old.map((l) =>
            l.command_id === next.command_id ? { ...l, posted: true } : l,
          ),
        );
        inFlight.current.add(next.command_id);
        try {
          await send(agent, next.text, next.command_id, token, next.choice);
        } catch (error) {
          if ((error as Error).message === "identity_lost") {
            onLogin();
            return;
          }
          if (error instanceof NotAdmitted) {
            // A definite refusal: nothing was held. The text goes back.
            update(forKey, (old) =>
              old.filter((l) => l.command_id !== next.command_id),
            );
            if (forKey === latest.current.key) {
              giveBack([next.text]);
              setNotice("Viestiä ei lähetetty. Teksti palautettiin kenttään.");
            }
          }
          // Otherwise the outcome is unknown; the receipt decides it.
        } finally {
          inFlight.current.delete(next.command_id);
        }
      }
    });
    void chain.current.then(() => latest.current.refresh());
    return chain.current;
  }, [update, giveBack, onLogin]);
  const submit = useCallback(
    // A message not typed in the field (the editor's note) keeps the draft.
    (text: string, choice?: LocalHeld["choice"], keepDraft = false) => {
      if (!text.trim() || !id) return;
      const entry: LocalHeld = {
        command_id: crypto.randomUUID(),
        text,
        posted: false,
        preexisting: latest.current.entries
          .filter((e) => e.kind === "user" && e.content?.text?.includes(text))
          .map((e) => e.entry_key),
        ...(choice && !readHeld(key).length ? { choice } : {}),
      };
      update(key, (old) => [...old, entry]);
      if (!keepDraft) changeDraft("");
      setNotice("");
      void flush();
    },
    [id, key, update, changeDraft, flush],
  );
  // Adopt messages written before this conversation existed (or before a
  // reload) that were never posted.
  // biome-ignore lint/correctness/useExhaustiveDependencies: post once per conversation key and session token.
  useEffect(() => {
    if (id && csrf && readHeld(key).some((l) => !l.posted)) void flush();
  }, [key, csrf]);
  // Resolve posted messages the daemon no longer reports as held.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new status observation drives reconciliation.
  useEffect(() => {
    if (!id || !current) return;
    const held = new Set((current.held ?? []).map((h) => h.command_id));
    const open = readHeld(key).filter(
      (l) =>
        l.posted &&
        !l.uncertain &&
        !l.delivered &&
        !held.has(l.command_id) &&
        !inFlight.current.has(l.command_id),
    );
    if (!open.length) return;
    let live = true;
    void (async () => {
      for (const entry of open) {
        let outcome: string | undefined;
        try {
          outcome = await sendReceipt(id, entry.command_id);
        } catch (error) {
          if ((error as Error).message === "identity_lost") onLogin();
          return; // Transport failure is not evidence; try on the next status.
        }
        if (!live) return;
        if (outcome === "held" || outcome === "pending") continue;
        if (outcome === "accepted")
          update(key, (old) =>
            old.map((l) =>
              l.command_id === entry.command_id
                ? { ...l, delivered: Date.now() }
                : l,
            ),
          );
        else if (outcome === "rejected" || outcome === "cancelled") {
          // Never delivered: the text goes back to the field. A cancel whose
          // reply was lost is only learnt here, so this is its one restore.
          update(key, (old) =>
            old.filter((l) => l.command_id !== entry.command_id),
          );
          giveBack([entry.text]);
          setNotice(
            outcome === "rejected"
              ? "Agentti hylkäsi viestin. Teksti palautettiin kenttään."
              : "Viesti ei lähtenyt. Se on taas kentässä.",
          );
        } else
          update(key, (old) =>
            old.map((l) =>
              l.command_id === entry.command_id ? { ...l, uncertain: true } : l,
            ),
          );
      }
    })();
    return () => {
      live = false;
    };
  }, [id, key, current]);
  // A delivered message is drawn until native history shows it. An uncertain
  // one stays (its text is the only copy) until native history shows it.
  useEffect(() => {
    const settled = local.filter((l) => l.delivered || l.uncertain);
    if (!settled.length) return;
    const users = entries.filter((e) => e.kind === "user");
    const now = Date.now();
    // Only a native user entry that appeared after the send shows it arrived.
    const shown = (l: LocalHeld) =>
      users.some(
        (u) =>
          !l.preexisting?.includes(u.entry_key) &&
          (u.content?.text ?? "").includes(l.text),
      );
    const gone = settled.filter(
      (l) =>
        shown(l) || (!!l.delivered && now - l.delivered >= DELIVERY_GRACE_MS),
    );
    if (gone.length)
      update(key, (old) =>
        old.filter((l) => !gone.some((g) => g.command_id === l.command_id)),
      );
    // The grace ends at an absolute deadline: re-renders do not extend it.
    const due = Math.min(
      ...settled
        .filter((l) => !!l.delivered && !gone.includes(l))
        .map((l) => (l.delivered as number) + DELIVERY_GRACE_MS),
    );
    if (!Number.isFinite(due)) return;
    const timer = window.setTimeout(
      () =>
        update(key, (old) =>
          old.filter(
            (l) => !l.delivered || Date.now() - l.delivered < DELIVERY_GRACE_MS,
          ),
        ),
      Math.max(0, due - now),
    );
    return () => window.clearTimeout(timer);
  }, [local, entries, key, update]);
  /** Stop before Pi runs: the daemon gives back exactly what it held. */
  const cancel = useCallback(async () => {
    if (!id || !csrf || busy) return;
    setBusy(true);
    const forKey = key;
    try {
      // A message still being posted must reach the daemon before the cancel,
      // or it would be held after the cancel and start Pi.
      await chain.current;
      const returned = await cancelHeld(id, crypto.randomUUID(), csrf);
      const ids = new Set(returned.map((r) => r.command_id));
      update(forKey, (old) => old.filter((l) => !ids.has(l.command_id)));
      if (forKey === latest.current.key) {
        giveBack(returned.map((r) => r.text));
        setNotice(
          returned.length > 1
            ? "Viestit eivät lähteneet. Ne ovat taas kentässä."
            : returned.length
              ? "Viesti ei lähtenyt. Se on taas kentässä."
              : "Agentti ehti jo ottaa viestin.",
        );
      }
    } catch (error) {
      if ((error as Error).message === "identity_lost") onLogin();
      else
        setNotice(
          "Pysäytyksen tulos on epävarma. Viestejä ei palautettu ilman daemonin kuittausta.",
        );
    } finally {
      setBusy(false);
      void refresh();
    }
  }, [id, csrf, busy, key, update, giveBack, onLogin, refresh]);
  /** Start Pi again after a failed start; the held messages go with it. */
  const retry = useCallback(async () => {
    if (!id || !csrf || busy) return;
    setBusy(true);
    try {
      await continueConversation(id, workspaceId, csrf);
      setNotice("");
    } catch (error) {
      if ((error as Error).message === "identity_lost") onLogin();
      else
        setNotice(
          "Agenttia ei voitu käynnistää uudelleen. Viestit ovat tallessa.",
        );
    } finally {
      setBusy(false);
      void refresh();
    }
  }, [id, csrf, busy, workspaceId, onLogin, refresh]);
  return {
    waiting: waitingMessages(local, current?.held, current?.state),
    local,
    notice,
    setNotice,
    busy,
    submit,
    cancel,
    retry,
  };
}

/** Storage for messages written while a new conversation has no ID yet. */
export function creationKeys(identity: string, workspaceId: string) {
  return {
    held: `nah:${identity}:held:new:${workspaceId}`,
    draft: `nah:${identity}:draft:new:${workspaceId}`,
  };
}
/** The created conversation takes over what was written while it was being
 * created; it posts the messages to the daemon in order. */
export function adoptCreation(
  identity: string,
  workspaceId: string,
  agentId: string,
) {
  const from = creationKeys(identity, workspaceId);
  const heldKey = `nah:${identity}:held:${agentId}`;
  writeHeld(heldKey, [...readHeld(heldKey), ...readHeld(from.held)]);
  sessionStorage.removeItem(from.held);
  const draft = sessionStorage.getItem(from.draft);
  if (draft) sessionStorage.setItem(`nah:${identity}:draft:${agentId}`, draft);
  sessionStorage.removeItem(from.draft);
}
