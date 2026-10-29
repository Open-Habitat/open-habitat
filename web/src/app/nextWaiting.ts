import { useEffect, useMemo } from "react";
import type { AgentNavModel } from "../components/Navigation";

/** One conversation the person opened during the walk, by any route. */
export type WalkStep = { agentId: string; href: string };

/**
 * The walk through the conversations waiting for the person (Seuraava
 * odottava, research-workmux-sidebar round 3b). It is view state of this
 * tab: which conversations were opened since the walk began, so the offer
 * moves on to one not yet seen and Alt+↑ can step back. Nothing is stored.
 */
export class WaitingWalk {
  steps: WalkStep[] = [];

  /** Any route into a conversation counts as a visit. */
  visit(step: WalkStep) {
    if (this.steps.at(-1)?.agentId !== step.agentId) this.steps.push(step);
    // A long evening of walking needs no more than its recent steps.
    if (this.steps.length > 64) this.steps = this.steps.slice(-64);
  }

  /** What to offer from `currentId`: the first of Sinun vuorosi not yet
   * visited in this walk, in the rail's order. When every other one has been
   * visited the walk begins again from the first. */
  offer(yours: readonly AgentNavModel[], currentId: string) {
    const others = yours.filter((a) => a.agentId !== currentId);
    const fresh = others.find(
      (a) => !this.steps.some((s) => s.agentId === a.agentId),
    );
    return {
      next: fresh ?? others[0],
      restart: !fresh && others.length > 0,
      more: Math.max(0, others.length - 1),
    };
  }

  /** Opening the offer: a restarted walk forgets its earlier visits. */
  forward(yours: readonly AgentNavModel[], currentId: string) {
    const { next, restart } = this.offer(yours, currentId);
    // The new walk starts from here, so Alt+↑ still leads back to it.
    if (restart)
      this.steps =
        this.steps.at(-1)?.agentId === currentId ? this.steps.slice(-1) : [];
    return next;
  }

  /** The conversation before this one in the walk, which the walk then
   * rewinds to. */
  back(currentId: string): WalkStep | undefined {
    for (let i = this.steps.length - 1; i >= 0; i--) {
      const step = this.steps[i];
      if (step.agentId === currentId) continue;
      this.steps = this.steps.slice(0, i);
      return step;
    }
    return undefined;
  }
}

/** One walk per signed-in person, fed with every conversation opened. */
export function useWaitingWalk(identity: string | undefined, open?: WalkStep) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new person begins a new walk.
  const walk = useMemo(() => new WaitingWalk(), [identity]);
  const agentId = open?.agentId;
  const href = open?.href;
  useEffect(() => {
    if (agentId && href) walk.visit({ agentId, href });
  }, [walk, agentId, href]);
  return walk;
}
