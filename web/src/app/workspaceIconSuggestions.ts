import { useCallback, useEffect, useRef, useState } from "react";
import { jsonWrite, writeOutcome } from "./mutations";
import { validIconSuggestions } from "./snapshot";

// Model-suggested workspace icons (workspace-icons, experimental; Sirut,
// Jari 2026-10-30). The daemon keeps nothing; this browser keeps the rounds
// per person and workspace, so a return to the page shows the suggestions
// already made and the model is asked again only on request (Jari
// 2026-10-31). Each new wish sends the earlier rounds along, so a
// refinement ("tummempi") has its context.

export type IconSuggestionFailure =
  | "model_unavailable"
  | "model_timeout"
  | "model_invalid_response"
  /** No answer from the host at all. */
  | "request_failed";
export type IconSeen = {
  readme: boolean;
  start_page: boolean;
  languages?: { name: string; percent: number }[];
  logo?: string;
};
export type IconRound = {
  wish: string;
  reply?: string;
  model: string;
  suggestions: { icon: string; why: string }[];
};
export type IconSuggestionState = {
  status: "loading" | "done" | "failed";
  reason?: IconSuggestionFailure;
  rounds: IconRound[];
  /** The round on show; the arrows move it. */
  at: number;
  /** The wish being asked, while loading or after a failure. */
  wish: string;
  seen?: IconSeen;
  startedAt: number;
};

type Reply = {
  schema_version: 1;
  state: "done" | "failed";
  reason?: IconSuggestionFailure;
  model?: string;
  reply?: string;
  suggestions?: { icon: string; why: string }[];
  seen: IconSeen;
};
const maxRounds = 3;

/** Kept rounds, per web identity and workspace, newest last. */
const storePrefix = "oh.icon-suggestions.";
const maxStoredRounds = 8;
type Stored = { rounds: IconRound[]; seen?: IconSeen };

function storageOf(storage?: Storage) {
  try {
    return storage ?? window.localStorage;
  } catch {
    return undefined;
  }
}

const text = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length <= max;

function validRound(v: unknown): v is IconRound {
  const r = v as IconRound;
  return (
    !!r &&
    typeof r === "object" &&
    text(r.wish, 200) &&
    (r.reply === undefined || text(r.reply, 400)) &&
    text(r.model, 160) &&
    Array.isArray(r.suggestions) &&
    r.suggestions.length > 0 &&
    r.suggestions.length <= 8 &&
    r.suggestions.every(
      (s) => !!s && text(s.icon, 300) && !!s.icon && text(s.why, 120),
    )
  );
}

function validSeen(v: unknown): v is IconSeen {
  const s = v as IconSeen;
  return (
    !!s &&
    typeof s === "object" &&
    typeof s.readme === "boolean" &&
    typeof s.start_page === "boolean" &&
    (s.logo === undefined || text(s.logo, 300)) &&
    (s.languages === undefined ||
      (Array.isArray(s.languages) &&
        s.languages.every(
          (l) => !!l && text(l.name, 40) && typeof l.percent === "number",
        )))
  );
}

/** The rounds this browser kept for the workspace; anything it cannot read
 * counts as none. */
export function readStoredRounds(
  identity: string,
  workspaceId: string,
  storage?: Storage,
): Stored | undefined {
  try {
    const raw = storageOf(storage)?.getItem(
      `${storePrefix}${identity}.${workspaceId}`,
    );
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Stored;
    if (!Array.isArray(value?.rounds)) return undefined;
    const rounds = value.rounds.filter(validRound).slice(-maxStoredRounds);
    if (!rounds.length) return undefined;
    return validSeen(value.seen) ? { rounds, seen: value.seen } : { rounds };
  } catch {
    return undefined;
  }
}

export function storeRounds(
  identity: string,
  workspaceId: string,
  value: Stored,
  storage?: Storage,
) {
  try {
    storageOf(storage)?.setItem(
      `${storePrefix}${identity}.${workspaceId}`,
      JSON.stringify({
        rounds: value.rounds.slice(-maxStoredRounds),
        seen: value.seen,
      }),
    );
  } catch {
    // Storage may be full or refused; the next visit asks the model again.
  }
}

/** Shows the kept rounds once the row shows, or asks the person's model
 * when there are none, and asks again for each wish; `active` false stops
 * a request on its way. */
export function useIconSuggestions(
  workspaceId: string,
  csrf: string | undefined,
  active: boolean,
  /** The web identity the kept rounds belong to; none keeps nothing. */
  identity?: string,
) {
  const [state, setState] = useState<IconSuggestionState>();
  const current = useRef<AbortController | null>(null);
  const rounds = useRef<IconRound[]>([]);
  const ask = useCallback(
    async (wish: string) => {
      if (!csrf) return;
      current.current?.abort();
      const controller = new AbortController();
      current.current = controller;
      // One line: a dictation pause makes a paragraph break, which the
      // daemon refuses in a wish.
      const trimmed = wish.replace(/\s+/gu, " ").trim().slice(0, 200);
      setState((old) => ({
        status: "loading",
        rounds: old?.rounds ?? [],
        at: old?.at ?? -1,
        wish: trimmed,
        seen: old?.seen,
        startedAt: Date.now(),
      }));
      let reply: Reply | undefined;
      try {
        const outcome = await writeOutcome(
          await jsonWrite(
            "workspace.icon_suggestions",
            "/api/v1/workspaces/icon/suggestions",
            {
              schema_version: 1,
              workspace_id: workspaceId,
              wish: trimmed,
              history: rounds.current.slice(-maxRounds).map((r) => ({
                wish: r.wish,
                icons: r.suggestions.map((s) => s.icon),
              })),
            },
            csrf,
            { signal: controller.signal },
          ),
        );
        if (outcome.kind === "ok") {
          const value: unknown = await outcome.response.json();
          if (validIconSuggestions?.(value)) reply = value as Reply;
        }
      } catch {
        // An aborted or lost request is a failure like an unanswered one.
      }
      if (controller.signal.aborted) return;
      current.current = null;
      if (reply?.state === "done" && reply.suggestions && reply.model) {
        const round: IconRound = {
          wish: trimmed,
          reply: reply.reply,
          model: reply.model,
          suggestions: reply.suggestions,
        };
        rounds.current = [...rounds.current, round].slice(-maxStoredRounds);
        const seen = reply.seen;
        if (identity)
          storeRounds(identity, workspaceId, { rounds: rounds.current, seen });
        setState((old) => ({
          status: "done",
          rounds: rounds.current,
          at: rounds.current.length - 1,
          wish: "",
          seen,
          startedAt: old?.startedAt ?? Date.now(),
        }));
      } else {
        const reason = reply?.reason ?? "request_failed";
        const seen = reply?.seen;
        setState((old) => ({
          status: "failed",
          reason,
          rounds: rounds.current,
          at: old?.at ?? -1,
          wish: trimmed,
          seen: seen ?? old?.seen,
          startedAt: old?.startedAt ?? Date.now(),
        }));
      }
    },
    [csrf, workspaceId, identity],
  );
  // The kept rounds, else one automatic request while the row shows; the
  // next activation reads the kept rounds again, which another tab may
  // have added to.
  useEffect(() => {
    if (!active || !csrf) return;
    const stored = identity
      ? readStoredRounds(identity, workspaceId)
      : undefined;
    if (stored) {
      rounds.current = stored.rounds;
      setState({
        status: "done",
        rounds: stored.rounds,
        at: stored.rounds.length - 1,
        wish: "",
        seen: stored.seen,
        startedAt: Date.now(),
      });
    } else void ask("");
    return () => {
      current.current?.abort();
      current.current = null;
      rounds.current = [];
      setState(undefined);
    };
  }, [active, csrf, ask, identity, workspaceId]);
  const move = (delta: number) =>
    setState((old) =>
      old
        ? {
            ...old,
            at: Math.max(0, Math.min(old.rounds.length - 1, old.at + delta)),
          }
        : old,
    );
  return { state, ask, move };
}
