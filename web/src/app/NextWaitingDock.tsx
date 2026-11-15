import { useNavigate } from "react-router";
import type { AgentNavModel } from "../components/Navigation";
import { NextWaitingRow } from "../components/NextWaitingRow";

export type NextWaiting = { yours: AgentNavModel[] };

/** The live rail list, offered during this visit's send or arrival window. */
export function NextWaitingDock({
  next,
  agentId,
  open,
}: {
  next?: NextWaiting;
  agentId: string;
  open: boolean;
}) {
  const navigate = useNavigate();
  const yours = next?.yours ?? [];
  const at = yours.findIndex((a) => a.agentId === agentId);
  const others = [...yours.slice(at + 1), ...yours.slice(0, at < 0 ? 0 : at)];
  const first = open ? others[0] : undefined;
  if (!first) return null;
  return (
    <NextWaitingRow waiting={others} onStart={() => navigate(first.href)} />
  );
}
