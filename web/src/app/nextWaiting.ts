import { useEffect, useMemo } from "react";
import type { AgentNavModel } from "../components/Navigation";

/** A conversation in the round as it was when it joined: its name and where
 * it opens. Its live state comes from the rail, which drops a conversation
 * that no longer runs or waits. */
export type RoundStep = Pick<
  AgentNavModel,
  "agentId" | "href" | "title" | "workspaceId" | "workspaceName"
>;

/** What a step is now: the origin, still waiting, handled here (opened in
 * this round and no longer waiting), or handled elsewhere (stopped waiting
 * before this round reached it). */
export type StepState = "origin" | "waits" | "handled" | "elsewhere";

const step = (a: RoundStep): RoundStep => ({
  agentId: a.agentId,
  href: a.href,
  title: a.title,
  workspaceId: a.workspaceId,
  workspaceName: a.workspaceName,
});

/**
 * The round through the conversations waiting for the person (Seuraava
 * odottava, direction Jono: Jari 30.10.2026, proto-next-waiting-navigation).
 * It starts from the conversation whose agent works, takes Sinun vuorosi in
 * the rail's order and is walked one step at a time; past the last step it
 * leads back to the origin. The steps are frozen at the start so they never
 * move under the person's cursor, and ones that start waiting later join at
 * the end. It is view state of this tab: nothing is stored.
 */
export class WaitingRound {
  steps: RoundStep[] | null = null;
  pos = 0;
  /** Steps opened in this round; one that stops waiting without being
   * opened here was handled elsewhere. */
  visited = new Set<string>();
  private told = new Set<string>();
  /** A one-off line under the bar: the round ended, or a step was handled
   * elsewhere. */
  note = "";
  version = 0;
  private listeners = new Set<() => void>();
  private noteTimer: ReturnType<typeof setTimeout> | undefined;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = () => this.version;
  private changed() {
    this.version++;
    for (const l of this.listeners) l();
  }

  say(note: string) {
    clearTimeout(this.noteTimer);
    this.note = note;
    this.noteTimer = setTimeout(() => {
      this.note = "";
      this.changed();
    }, 5000);
    this.changed();
  }

  /** Starts a round from `origin` and returns the first step to open, or
   * nothing when no other conversation waits. */
  start(origin: RoundStep, yours: readonly AgentNavModel[]) {
    const others = yours.filter((a) => a.agentId !== origin.agentId);
    if (!others.length) return undefined;
    this.steps = [step(origin), ...others.map(step)];
    this.visited = new Set([origin.agentId]);
    this.told = new Set();
    this.pos = 0;
    this.changed();
    return this.steps[1];
  }

  end() {
    if (!this.steps) return;
    this.steps = null;
    this.changed();
  }

  /** Ones that start waiting during the round join at its end. */
  sync(yours: readonly AgentNavModel[]) {
    if (!this.steps) return;
    const added = yours.filter(
      (a) => !this.steps?.some((s) => s.agentId === a.agentId),
    );
    if (!added.length) return;
    this.steps = [...this.steps, ...added.map(step)];
    this.changed();
  }

  /** Any route into a conversation of the round, rail included, moves the
   * round's place there. */
  open(agentId: string) {
    const i = this.steps?.findIndex((s) => s.agentId === agentId) ?? -1;
    if (i < 0 || (i === this.pos && this.visited.has(agentId))) return;
    this.pos = i;
    this.visited.add(agentId);
    this.changed();
  }

  stateOf(i: number, waits: (agentId: string) => boolean): StepState {
    const s = this.steps?.[i];
    if (!s || i === 0) return "origin";
    if (waits(s.agentId)) return "waits";
    return this.visited.has(s.agentId) ? "handled" : "elsewhere";
  }

  /** Says once of each step handled elsewhere. */
  announce(waits: (agentId: string) => boolean) {
    const steps = this.steps ?? [];
    for (const [i, s] of steps.entries()) {
      if (this.told.has(s.agentId) || this.stateOf(i, waits) !== "elsewhere")
        continue;
      this.told.add(s.agentId);
      this.say(`${s.title} hoidettiin toisaalla.`);
    }
  }

  /** How many steps after the origin no longer wait. */
  handled(waits: (agentId: string) => boolean) {
    return (this.steps ?? []).slice(1).filter((s) => !waits(s.agentId)).length;
  }

  /** The step `d` away from here, skipping the ones handled elsewhere.
   * Past the last step the round ends and leads back to the origin, saying
   * how many were handled. Before the origin there is nothing. */
  move(d: 1 | -1, waits: (agentId: string) => boolean) {
    const steps = this.steps;
    if (!steps) return undefined;
    let i = this.pos + d;
    while (i > 0 && i < steps.length && this.stateOf(i, waits) === "elsewhere")
      i += d;
    if (i < 0) return undefined;
    if (i >= steps.length) {
      const n = this.handled(waits);
      this.steps = null;
      this.say(`Kierros käyty: ${n} hoidettu.`);
      return steps[0];
    }
    return steps[i];
  }
}

/** One round per signed-in person, told of every conversation opened and
 * of the rail's Sinun vuorosi. */
export function useWaitingRound(
  identity: string | undefined,
  openId: string | undefined,
  yours: readonly AgentNavModel[],
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new person begins without a round.
  const round = useMemo(() => new WaitingRound(), [identity]);
  useEffect(() => {
    if (openId) round.open(openId);
  }, [round, openId]);
  useEffect(() => {
    round.sync(yours);
  }, [round, yours]);
  return round;
}
