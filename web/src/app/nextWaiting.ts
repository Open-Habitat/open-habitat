import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Status } from "./conversations";

export type SendWindowEvent = "pending" | "accepted" | "failed";

/** View state only: a send or arrival at a working conversation opens it. */
export function useNextWaitingWindow(
  id: string | undefined,
  status: Status | undefined,
  stale: boolean,
  archived: boolean,
) {
  // A callback from a send on an earlier visit must not open the current one,
  // even if the person has already returned to the same conversation.
  // biome-ignore lint/correctness/useExhaustiveDependencies: one token per visit.
  const visit = useMemo(() => ({}), [id]);
  const latestVisit = useRef(visit);
  latestVisit.current = visit;
  const latestStatus = useRef(status);
  latestStatus.current = status;
  const [window, setWindow] = useState<{
    visit: object;
    worked: boolean;
    accepted: boolean;
    settled?: string;
    baseline?: Status;
  }>();
  const outcome = useCallback(
    (event: SendWindowEvent) => {
      if (latestVisit.current !== visit) return;
      const now = latestStatus.current;
      setWindow((previous) => {
        if (event === "failed") return undefined;
        if (event === "accepted")
          return previous?.visit === visit
            ? { ...previous, accepted: true }
            : undefined;
        return {
          visit,
          baseline: now,
          accepted: previous?.visit === visit && previous.accepted,
          worked: !!now?.run_active,
          settled: now?.turn_settled?.native_key,
        };
      });
    },
    [visit],
  );
  const observedVisit = useRef<object | undefined>(undefined);
  useEffect(() => {
    // Wait for this visit's first fresh observation, not a restored receipt.
    // Later external sends must not reopen a window that has already ended.
    if (!status || stale || observedVisit.current === visit) return;
    observedVisit.current = visit;
    if (
      status.run_active &&
      !archived &&
      !status.pending_question &&
      !status.start_problem &&
      !status.interrupted
    ) {
      setWindow((previous) =>
        previous?.visit === visit
          ? previous
          : {
              visit,
              baseline: status,
              accepted: true,
              worked: true,
              settled: status.turn_settled?.native_key,
            },
      );
    }
  }, [visit, status, stale, archived]);
  const working = !!status?.run_active;
  const ended =
    !!window &&
    !stale &&
    (archived ||
      !!status?.pending_question ||
      !!status?.start_problem ||
      !!status?.interrupted ||
      (status !== window.baseline &&
        (status?.state === "rejected" ||
          status?.send_receipt === "rejected" ||
          status?.send_receipt === "undelivered")) ||
      (window.worked && !working) ||
      (!!status?.turn_settled?.native_key &&
        status.turn_settled.native_key !== window.settled));
  useEffect(() => {
    if (!window || window.visit !== visit) return;
    if (ended) setWindow(undefined);
    else if (working && !window.worked) setWindow({ ...window, worked: true });
  }, [window, visit, ended, working]);
  useEffect(() => {
    latestVisit.current = visit;
    return () => {
      latestVisit.current = {};
    };
  }, [visit]);
  return {
    open: !!window?.accepted && window.visit === visit && !ended && !stale,
    outcome,
  };
}
