import { useCallback, useEffect, useRef, useState } from "react";
import { jsonWrite, writeOutcome } from "./mutations";
import { validIconSuggestions } from "./snapshot";

// Model-suggested workspace icons (workspace-icons, experimental; Sirut,
// Jari 2026-10-30). The exchange is this page's state only: the daemon
// keeps nothing, and leaving the page drops it. Each new wish sends the
// earlier rounds along, so a refinement ("tummempi") has its context.

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

/** Asks the person's model for icon suggestions once the row shows, and
 * again for each wish; `active` false stops and forgets the exchange. */
export function useIconSuggestions(
  workspaceId: string,
  csrf: string | undefined,
  active: boolean,
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
      const trimmed = wish.trim().slice(0, 200);
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
        rounds.current = [...rounds.current, round];
        const seen = reply.seen;
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
    [csrf, workspaceId],
  );
  // One automatic request per visit while the row shows (round 2's
  // decision); leaving the row or the page forgets the exchange.
  useEffect(() => {
    if (!active || !csrf) return;
    void ask("");
    return () => {
      current.current?.abort();
      current.current = null;
      rounds.current = [];
      setState(undefined);
    };
  }, [active, csrf, ask]);
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
