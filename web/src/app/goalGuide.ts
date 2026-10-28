import { useSyncExternalStore } from "react";
import type { ComposerGoal } from "../components/composer/GoalChip";
import { goalRequest } from "../components/StartHere";
import type { StartGoal, StartPage } from "./composerReads";
import { type HistoryEntry, readHistory } from "./history";

/**
 * The guide a conversation shows beside it after Aloita. It lives in this
 * tab's memory only: a reload forgets it, and the conversation then finds its
 * goal again from Pi's own skill invocation in the native history. No other
 * record of the goal exists.
 */
export type Guide = { goal: StartGoal; page: string; open: boolean };

const guides = new Map<string, Guide>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const notify = () => {
  for (const listener of listeners) listener();
};

/** A conversation's guide owner; a conversation being created is `new:<workspace>`. */
export const guideOwner = (identity: string, conversation: string) =>
  `${identity}:${conversation}`;
export const creationGuideOwner = (identity: string, workspaceId: string) =>
  guideOwner(identity, `new:${workspaceId}`);

export function setGuide(owner: string, guide: Guide | undefined) {
  if (guide) guides.set(owner, guide);
  else guides.delete(owner);
  notify();
}

export function readGuide(owner: string) {
  return guides.get(owner);
}

/** The created conversation takes over the guide started while it was being
 * created, as it takes over the draft (adoptCreation). */
export function adoptGuide(
  identity: string,
  workspaceId: string,
  agentId: string,
) {
  const from = creationGuideOwner(identity, workspaceId);
  const guide = guides.get(from);
  if (!guide) return;
  guides.delete(from);
  guides.set(guideOwner(identity, agentId), guide);
  notify();
}

export function useGuide(owner: string | undefined) {
  return useSyncExternalStore(subscribe, () =>
    owner ? guides.get(owner) : undefined,
  );
}

/** A phone opens nothing by itself: the panel would cover the field just filled. */
export const guideOpensItself = () =>
  !(window.matchMedia?.("(max-width: 800px)").matches ?? false);

export function authoredGoals(page: StartPage | null | undefined) {
  return page && !("state" in page) ? page.goals : [];
}

/** The goals whose skill invocation the composer shows as a chip. */
export function composerGoals(page: StartPage | null | undefined) {
  return authoredGoals(page).flatMap<ComposerGoal>((goal) =>
    goal.skill
      ? [
          {
            skill: goal.skill,
            title: goal.title,
            request: goalRequest(goal).request,
          },
        ]
      : [],
  );
}

/**
 * The start-page goal a conversation is about: the one started in this tab,
 * else the newest of Pi's recorded skill invocations that names a goal's
 * skill, else the skill of the conversation's first message when that lies
 * before the loaded history, else a draft that begins with one. Only the
 * browser compares the native sources it read; nothing is stored for it.
 */
export function conversationGoal(
  page: StartPage | null | undefined,
  started: StartGoal | undefined,
  entries: readonly HistoryEntry[],
  draft: string,
  firstSkill?: string,
): StartGoal | undefined {
  if (started) return started;
  const goals = authoredGoals(page);
  const named = (name?: string) =>
    name ? goals.find((g) => g.skill === name) : undefined;
  for (let i = entries.length - 1; i >= 0; i--) {
    const goal = named(entries[i].skill?.name);
    if (goal) return goal;
  }
  return named(firstSkill) ?? named(/^\/skill:(\S+) /.exec(draft)?.[1]);
}

/** Aloita is only offered before the first message, so a started goal is the
 * first message's skill call. A long conversation's tail no longer holds it;
 * the start of the native history does. */
export async function readFirstSkill(
  agentId: string,
  signal: AbortSignal,
): Promise<string | undefined> {
  const response = await fetch(
    `/api/v1/agents/${encodeURIComponent(agentId).replace("%3A", ":")}/history?after=&limit=10`,
    { credentials: "same-origin", cache: "no-store", signal },
  );
  const page = await readHistory(response);
  if (!("entries" in page)) return undefined;
  return page.entries.find((entry) => entry.kind === "user")?.skill?.name;
}
