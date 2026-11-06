import { type ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  type CapacityHolder,
  CapacityRefusal,
} from "../components/CapacityRefusal";
import { textNow } from "../i18n";
import { capacityRefusalText } from "../text/capacityRefusal";
import { agentTitle } from "./agentTitle";
import { stop } from "./conversations";
import { type Capacity, capacity } from "./liveLimits";
import { serverInfo } from "./serverAdministration";
import type { Snapshot, Workspace } from "./snapshot";

// The card of a new conversation refused at the limit. It reads the person's
// own daemon for their limit and what holds a place, names those
// conversations from the snapshot, and stops one with the conversation's
// ordinary stop. Whether Change the limit can be used comes from the
// server's administrator flag; the limit itself is written only in the
// administrator's server settings.

const settleReads = 10;
const settleMs = 400;

export function CapacityCard({
  workspace,
  snapshot,
  csrf,
  tries,
  fallback,
  onRetry,
}: {
  workspace: Workspace;
  snapshot?: Snapshot;
  csrf?: string;
  tries: number;
  /** Shown when the capacity cannot be read: the plain refusal. */
  fallback: ReactNode;
  /** Absent while another creation is under way. */
  onRetry?: () => void;
}) {
  const navigate = useNavigate();
  const [read, setRead] = useState<Capacity | null>();
  const [admin, setAdmin] = useState<boolean>();
  const [stopped, setStopped] = useState<Record<string, CapacityHolder>>({});
  const [stopping, setStopping] = useState<Set<string>>(new Set());
  const [freed, setFreed] = useState(false);
  const [stopProblem, setStopProblem] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: each new refusal reads the capacity again.
  useEffect(() => {
    const controller = new AbortController();
    void capacity(controller.signal).then(
      (v) => setRead(v),
      () => {
        if (!controller.signal.aborted) setRead(null);
      },
    );
    void serverInfo(controller.signal).then(
      (v) => setAdmin(v.administrator),
      () => {},
    );
    return () => controller.abort();
  }, [tries]);
  if (read === undefined) return null;
  if (read === null) return <>{fallback}</>;

  const holderOf = (
    id: string,
    activity: CapacityHolder["activity"],
    ws: string,
  ): CapacityHolder => {
    const agent = snapshot?.agents.find((a) => a.agent_id === id);
    const place =
      snapshot?.workspaces.find((w) => w.workspace_id === ws) ??
      snapshot?.workspaces.find((w) => w.workspace_id === agent?.workspace_id);
    const changed = agent?.changed_at ? Date.parse(agent.changed_at) : NaN;
    return {
      agentId: id,
      title: agent ? agentTitle(agent.title) : id,
      workspaceName: place ? (place.display_name ?? place.name) : "",
      activity,
      changedAt: Number.isFinite(changed) ? changed : undefined,
      stopping: stopping.has(id),
    };
  };
  const live = read.holding
    .filter((h) => !stopped[h.agent_id])
    .map((h) => holderOf(h.agent_id, h.activity, h.workspace_id));
  const holders = [...live, ...Object.values(stopped)];
  const room = freed && live.length < read.limit;

  const onStop = (id: string) => {
    const row = live.find((h) => h.agentId === id);
    if (!row || !csrf) return;
    setStopping((old) => new Set(old).add(id));
    setStopProblem("");
    void stop(id, csrf)
      .then(async () => {
        // The daemon answers before the child has ended: the row says it is
        // stopped only once a read no longer counts it.
        for (let i = 0; i < settleReads && mounted.current; i++) {
          const next = await capacity().catch(() => undefined);
          if (next && mounted.current) {
            setRead(next);
            if (!next.holding.some((h) => h.agent_id === id)) {
              setStopped((old) => ({
                ...old,
                [id]: { ...row, stopped: true, stopping: false },
              }));
              setFreed(true);
              return;
            }
          }
          await new Promise((r) => setTimeout(r, settleMs));
        }
        throw new Error("unconfirmed");
      })
      .catch(() => {
        if (mounted.current)
          setStopProblem(textNow(capacityRefusalText).stopFailed);
      })
      .finally(() => {
        if (mounted.current)
          setStopping((old) => {
            const next = new Set(old);
            next.delete(id);
            return next;
          });
      });
  };
  return (
    <CapacityRefusal
      limit={read.limit}
      source={read.source}
      here={workspace.display_name ?? workspace.name}
      holders={holders}
      room={room}
      tries={tries}
      admin={admin}
      stopProblem={stopProblem}
      onRetry={onRetry}
      onStop={onStop}
      onOpen={(id) => {
        const agent = snapshot?.agents.find((a) => a.agent_id === id);
        const ws = agent?.workspace_id ?? workspace.workspace_id;
        navigate(`/workspaces/${ws}?conversation=${encodeURIComponent(id)}`);
      }}
      onAdmin={() => navigate("/settings/conversations")}
    />
  );
}
