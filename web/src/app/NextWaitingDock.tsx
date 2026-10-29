import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { AgentNavModel } from "../components/Navigation";
import { NextWaitingRow } from "../components/NextWaitingRow";
import { useExperimentalFeature } from "./accountPreferences";
import type { WaitingWalk } from "./nextWaiting";

/** What the app gives a conversation for the walk: the rail's Sinun vuorosi,
 * the walk this tab is on, and the workspace the conversation belongs to. */
export type NextWaiting = {
  yours: AgentNavModel[];
  walk: WaitingWalk;
  workspaceId: string;
};

/**
 * The next waiting conversation above this conversation's composer, when the
 * person has turned the experiment on. It appears once the host confirms the
 * agent works (run active), not when the message is merely sent: until then
 * the message can still fail and the person still has something here. It
 * then stays for the rest of this visit, also after the agent finishes.
 * Nothing is offered while this conversation asks the person something.
 * Alt+↓ opens the offer and Alt+↑ steps back in the walk.
 */
export function NextWaitingDock({
  next,
  agentId,
  working,
  needsYou,
}: {
  next?: NextWaiting;
  agentId: string;
  /** The host confirms this conversation's agent works. */
  working: boolean;
  /** This conversation waits for the person, or its state is not known. */
  needsYou: boolean;
}) {
  const on = useExperimentalFeature("next-waiting-row");
  const navigate = useNavigate();
  const [engaged, setEngaged] = useState(false);
  // Only work seen while the experiment is on counts, so switching it on
  // shows nothing until the next confirmed run.
  useEffect(() => {
    if (working && on) setEngaged(true);
  }, [working, on]);
  const active = on && !!next && engaged && !needsYou;
  const offer = active ? next.walk.offer(next.yours, agentId) : undefined;
  const actions = useRef({ forward: () => {}, back: (): boolean => false });
  actions.current = {
    forward: () => {
      if (!next) return;
      const target = next.walk.forward(next.yours, agentId);
      if (target) navigate(target.href);
    },
    back: () => {
      const step = next?.walk.back(agentId);
      if (step) navigate(step.href);
      return !!step;
    },
  };
  const offered = !!offer?.next;
  // Alt+↓ while the line shows, Alt+↑ whenever the experiment is on; both
  // also while typing or while the reply streams.
  useEffect(() => {
    if (!on || !next) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.defaultPrevented || e.isComposing) return;
      if (e.key === "ArrowDown" && offered) {
        e.preventDefault();
        actions.current.forward();
      } else if (e.key === "ArrowUp" && actions.current.back()) {
        // Without a step to go back to, Alt+↑ stays the field's own key.
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [on, next, offered]);
  if (!active) return null;
  return (
    <NextWaitingRow
      offer={offer?.next}
      more={offer?.more ?? 0}
      workspaceId={next.workspaceId}
      waits={(id) => next.yours.some((a) => a.agentId === id)}
      onOpen={() => actions.current.forward()}
    />
  );
}
