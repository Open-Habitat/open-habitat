# app/NextWaitingDock.tsx

Generated from web/src/app/NextWaitingDock.tsx; do not edit.

```tsx
import { useEffect } from "react";
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
  const others = next?.yours.filter((a) => a.agentId !== agentId) ?? [];
  const first = open ? others[0] : undefined;
  useEffect(() => {
    if (!first) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        !e.defaultPrevented &&
        !e.isComposing &&
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        e.code === "ArrowDown"
      ) {
        e.preventDefault();
        navigate(first.href);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [first, navigate]);
  if (!first) return null;
  return (
    <NextWaitingRow waiting={others} onStart={() => navigate(first.href)} />
  );
}

```
