import { useEffect, useMemo } from "react";
import type { AgentNavModel } from "../components/Navigation";
import { liveText } from "../i18n";
import { nextWaitingText } from "../text/nextWaiting";

const txt = liveText(nextWaitingText);

/** A conversation in the round as it was when it joined: its name and where
 * it opens. Its live state comes from the rail, which drops a conversation
 * that no longer runs or waits. */
export type RoundStep = Pick<
  AgentNavModel,
  "agentId" | "href" | "title" | "workspaceId" | "workspaceName"
>;

/** What a step is now: still waiting, handled here (opened in this round
 * and no longer waiting), or handled elsewhere (stopped waiting before this
 * round reached it). */
export type StepState = "waits" | "handled" | "elsewhere";

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
 * It starts while the agent of the conversation at hand works, takes the
 * other Sinun vuorosi in the rail's order and is walked one step at a time.
 * It only moves forward through what waits: the conversation it started
 * from is not a step and the round never leads back to it, because this is
 * not a tracker (Jari 31.10.2026); the person returns through the rail, and
 * the start joins the round like any other once it waits for them. Past the
 * last step the round ends where the person is. The steps are frozen at the
 * start so they never move under the person's cursor, and ones that start
 * waiting later join at the end. It is view state of this tab: nothing is
 * stored.
 */
export class WaitingRound {
  steps: RoundStep[] | null = null;
  /** The step the person is on; -1 before the first, when the step the
   * round was on and all before it left the round. */
  pos = 0;
  /** Steps opened in this round; one that stops waiting without being
   * opened here was handled elsewhere. */
  visited = new Set<string>();
  private told = new Set<string>();
  /** Conversations the host has listed during this round, so one that
   * later drops out of the listing is known to be gone, while one too new
   * to be listed yet is not. */
  private listed = new Set<string>();
  /** Steps archived or gone during the round; they count as handled. */
  private dropped = 0;
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

  /** Starts a round from the conversation `from` and returns the first
   * step to open, or nothing when no other conversation waits. */
  start(from: string, yours: readonly AgentNavModel[]) {
    const others = yours.filter((a) => a.agentId !== from);
    if (!others.length) return undefined;
    this.steps = others.map(step);
    this.visited = new Set();
    this.told = new Set();
    this.listed = new Set();
    this.dropped = 0;
    this.pos = 0;
    this.changed();
    return this.steps[0];
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
    if (s && waits(s.agentId)) return "waits";
    return s && this.visited.has(s.agentId) ? "handled" : "elsewhere";
  }

  /** Archived or vanished conversations leave the round, given the host's
   * confirmed listing. With no step left the round ends into its summary. */
  prune(agents: readonly { agent_id: string; archive?: string }[]) {
    const steps = this.steps;
    if (!steps) return;
    const archived = new Set<string>();
    const present = new Set<string>();
    for (const a of agents) {
      if (a.archive === "archived") archived.add(a.agent_id);
      else present.add(a.agent_id);
      this.listed.add(a.agent_id);
    }
    const gone = (id: string) =>
      archived.has(id) || (this.listed.has(id) && !present.has(id));
    if (!steps.some((s) => gone(s.agentId))) return;
    const kept = steps.filter((s) => !gone(s.agentId));
    this.dropped += steps.length - kept.length;
    if (!kept.length) {
      this.finish([]);
      return;
    }
    // The place stays on the step it was on, or the one before a removed
    // one, so Seuraava still leads to the next.
    let pos = -1;
    for (const [i, s] of steps.entries()) {
      if (i > this.pos) break;
      const k = kept.indexOf(s);
      if (k >= 0) pos = k;
    }
    this.pos = pos;
    this.steps = kept;
    this.changed();
  }

  /** Ends the round saying how many were handled: the dropped ones and
   * those of `left` (steps still in it) visited here. */
  private finish(left: readonly RoundStep[]) {
    const n =
      this.dropped + left.filter((s) => this.visited.has(s.agentId)).length;
    this.steps = null;
    this.say(txt.roundDone(n));
  }

  /** Says once of each step handled elsewhere. */
  announce(waits: (agentId: string) => boolean) {
    const steps = this.steps ?? [];
    for (const [i, s] of steps.entries()) {
      if (this.told.has(s.agentId) || this.stateOf(i, waits) !== "elsewhere")
        continue;
      this.told.add(s.agentId);
      this.say(txt.handledElsewhere(s.title));
    }
  }

  /** How many steps no longer wait. */
  handled(waits: (agentId: string) => boolean) {
    return (this.steps ?? []).filter((s) => !waits(s.agentId)).length;
  }

  /** The step `d` away from here, skipping the ones handled elsewhere.
   * Past the last step the round ends where the person is, saying how many
   * were handled; it leads nowhere. Before the first there is nothing. */
  move(d: 1 | -1, waits: (agentId: string) => boolean) {
    const steps = this.steps;
    if (!steps) return undefined;
    let i = this.pos + d;
    while (i >= 0 && i < steps.length && this.stateOf(i, waits) === "elsewhere")
      i += d;
    if (i < 0) return undefined;
    if (i >= steps.length) {
      const n = this.handled(waits) + this.dropped;
      this.steps = null;
      this.say(txt.roundDone(n));
      return undefined;
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
  /** The host's confirmed listing of the person's conversations, or nothing
   * while it is not known. */
  agents?: readonly { agent_id: string; archive?: string }[],
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new person begins without a round.
  const round = useMemo(() => new WaitingRound(), [identity]);
  useEffect(() => {
    if (openId) round.open(openId);
  }, [round, openId]);
  useEffect(() => {
    round.sync(yours);
  }, [round, yours]);
  useEffect(() => {
    if (agents) round.prune(agents);
  }, [round, agents]);
  return round;
}
