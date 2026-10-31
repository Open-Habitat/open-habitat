import { useEffect, useRef, useSyncExternalStore } from "react";
import { useNavigate } from "react-router";
import { type AgentNavModel, ballOf } from "../components/Navigation";
import {
  NextWaitingQueue,
  type QueueStep,
} from "../components/NextWaitingQueue";
import { NextWaitingRow } from "../components/NextWaitingRow";
import { textNow } from "../i18n";
import { nextWaitingText } from "../text/nextWaiting";
import { useExperimentalFeature } from "./accountPreferences";
import type { WaitingRound } from "./nextWaiting";

/** What the app gives a conversation for the round: the rail's Sinun vuorosi
 * and Käynnissä, and the round this tab is on. */
export type NextWaiting = {
  yours: AgentNavModel[];
  running: AgentNavModel[];
  round: WaitingRound;
};

/**
 * The conversations waiting for the person above this conversation's
 * composer, when the person has turned the experiment on (direction Jono).
 * Outside a round, a line offers the others as one round only while the
 * host confirms that this conversation's agent works (run active): it is
 * for the time the agent here works, so it goes when the agent's turn ends
 * or it asks something and comes back when it works again (Jari
 * 31.10.2026). Not when the message is merely sent, either: until the host
 * confirms, the message can still fail and the person still has something
 * here. During a round the round's bar shows in every conversation, also
 * one that asks or whose reply was only read, because the steps are the
 * ones waiting for the person and the bar is how the round moves on.
 * Alt+↓ (⌥↓ on a Mac) moves on, Alt+↑ steps back, Esc ends the round.
 */
export function NextWaitingDock({
  next,
  agentId,
  working,
}: {
  next?: NextWaiting;
  agentId: string;
  /** The host confirms this conversation's agent works. */
  working: boolean;
}) {
  const on = useExperimentalFeature("next-waiting-row");
  const navigate = useNavigate();
  const round = next?.round;
  useSyncExternalStore(
    round?.subscribe ?? noSubscribe,
    round?.snapshot ?? noSnapshot,
  );
  const yours = next?.yours ?? [];
  const waits = (id: string) => yours.some((a) => a.agentId === id);
  const inRound = on && !!round?.steps;
  useEffect(() => {
    if (inRound) round?.announce(waits);
  });
  // Never itself, even while the rail counts it as waiting.
  const others = yours.filter((a) => a.agentId !== agentId);
  const offered = on && !!next && working && others.length > 0;
  const actions = useRef({
    start: () => {},
    move: (_d: 1 | -1) => {},
    go: (_i: number) => {},
    end: () => {},
  });
  actions.current = {
    start: () => {
      if (!next) return;
      const first = next.round.start(agentId, next.yours);
      if (first) navigate(first.href);
    },
    move: (d) => {
      const target = round?.move(d, waits);
      if (target && target.agentId !== agentId) navigate(target.href);
    },
    go: (i) => {
      const target = round?.steps?.[i];
      if (target && target.agentId !== agentId) navigate(target.href);
    },
    end: () => round?.end(),
  };
  const canBack =
    inRound &&
    (round?.steps ?? [])
      .slice(0, Math.max(0, round?.pos ?? 0))
      .some((_, i) => round?.stateOf(i, waits) !== "elsewhere");
  useEffect(() => {
    if (!on || !next) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      // Esc ends the round only when nothing else took it: the composer's
      // Esc stops a working agent, and dialogs and menus close first.
      if (
        e.key === "Escape" &&
        inRound &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        !(e.target as Element | null)?.closest?.(
          '[role="dialog"], [role="menu"], [role="listbox"]',
        )
      ) {
        e.preventDefault();
        actions.current.end();
        return;
      }
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === "ArrowDown" && (inRound || offered)) {
        e.preventDefault();
        if (inRound) actions.current.move(1);
        else actions.current.start();
      } else if (e.key === "ArrowUp" && canBack) {
        // Without a step to go back to, Alt+↑ stays the field's own key.
        e.preventDefault();
        actions.current.move(-1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [on, next, inRound, offered, canBack]);
  const t = textNow(nextWaitingText);
  if (!on || !next || !round) return null;
  if (round.steps) {
    const models = [...next.yours, ...next.running];
    const steps: QueueStep[] = round.steps.map((s, i) => {
      const live = models.find((a) => a.agentId === s.agentId);
      const state = round.stateOf(i, waits);
      const ball = live ? ballOf(live) : "done";
      return {
        agentId: s.agentId,
        title: s.title,
        state,
        ball,
        detail:
          state === "waits"
            ? live?.question
              ? t.asks
              : t.newReply
            : state === "elsewhere"
              ? t.elsewhere
              : undefined,
      };
    });
    return (
      <NextWaitingQueue
        steps={steps}
        pos={round.pos}
        note={round.note}
        onGo={(i) => actions.current.go(i)}
        onPrev={() => actions.current.move(-1)}
        onNext={() => actions.current.move(1)}
        onEnd={() => actions.current.end()}
      />
    );
  }
  return (
    <NextWaitingRow
      waiting={offered ? others : []}
      note={round.note}
      onStart={() => actions.current.start()}
    />
  );
}

const noSubscribe = () => () => {};
const noSnapshot = () => 0;
