import { type RefObject, useLayoutEffect, useSyncExternalStore } from "react";
import { splitAttachments } from "../components/AttachmentChips";
import type { ComposerGoal } from "../components/composer/GoalChip";
import {
  goalDraft,
  goalRequest,
  goalStartsImmediately,
} from "../components/StartHere";
import { readCommands, type StartGoal, type StartPage } from "./composerReads";
import { conversationName } from "./conversationName";
import { creationKeys, readHeld, writeHeld } from "./heldMessages";
import { type HistoryEntry, readHistory } from "./history";
import { startPageGoal } from "./startPageRequest";

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

/**
 * What choosing a goal outside a conversation leaves for the new one: the
 * prepared draft, its selection (the placeholder) and focus in the field.
 * The new conversation is drawn first while it is created and again once it
 * exists, and the goal chip appears only after its start page is read; the
 * selection is put back each time the field shows the prepared text, until
 * the person changes it. Like the guide, it lives in this tab's memory only.
 */
type PreparedField = { text: string; start: number; end: number };
const preparedFields = new Map<
  string,
  PreparedField & { shownIn?: HTMLTextAreaElement; shown?: string }
>();

export function prepareField(owner: string, field: PreparedField) {
  preparedFields.set(owner, field);
}

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
 * created, and the prepared field's selection, as it takes over the draft
 * (adoptCreation). */
export function adoptGuide(
  identity: string,
  workspaceId: string,
  agentId: string,
) {
  const from = creationGuideOwner(identity, workspaceId);
  const field = preparedFields.get(from);
  if (field) {
    preparedFields.delete(from);
    preparedFields.set(guideOwner(identity, agentId), field);
  }
  const guide = guides.get(from);
  if (!guide) return;
  guides.delete(from);
  guides.set(guideOwner(identity, agentId), guide);
  notify();
}

/**
 * A goal's skill counts only if Pi lists it for this workspace or
 * conversation; otherwise the request goes in as text. The goal's own skill
 * (described by the goal's title) holds the request (`carried`); a general
 * skill the goal borrows does not.
 */
export async function resolveGoal(
  goal: StartGoal,
  scope: { agentId: string } | { workspaceId: string },
  signal: AbortSignal,
): Promise<{ goal: StartGoal; carried: boolean }> {
  if (!goal.skill) return { goal, carried: false };
  const list = await readCommands(scope, signal);
  const skill = list.commands.find(
    (c) => c.source === "skill" && c.name === `skill:${goal.skill}`,
  );
  return {
    goal: { ...goal, skill: skill ? goal.skill : undefined },
    carried: skill?.description.trim() === goal.title.trim(),
  };
}

/** A draft as the composer's field shows it, without its attachment
 * reference lines (they are chips), and draft positions mapped into it. */
function asShown(draft: string, positions: number[]) {
  const lines = draft.split("\n");
  const removed: [number, number][] = [];
  let offset = 0;
  lines.forEach((line, i) => {
    const end = offset + line.length;
    if (splitAttachments(line).attachments.length)
      // A removed line takes its newline with it: the one before it if last.
      removed.push(
        i < lines.length - 1
          ? [offset, end + 1]
          : [Math.max(0, offset - 1), end],
      );
    offset = end + 1;
  });
  const map = (at: number) =>
    removed.reduce(
      (shifted, [from, to]) =>
        shifted - (at >= to ? to - from : at > from ? at - from : 0),
      at,
    );
  return { text: splitAttachments(draft).text, positions: positions.map(map) };
}

export function usePreparedField(
  owner: string | undefined,
  root: RefObject<HTMLElement | null>,
) {
  useLayoutEffect(() => {
    const prepared = owner ? preparedFields.get(owner) : undefined;
    if (!owner || !prepared) return;
    const field = root.current?.querySelector<HTMLTextAreaElement>(
      ".ah-composer textarea",
    );
    if (!field) return;
    const same = field === prepared.shownIn;
    if (same && field.value === prepared.shown) return;
    const {
      text,
      positions: [start, end],
    } = asShown(prepared.text, [prepared.start, prepared.end]);
    // The composer shows a goal's skill invocation as a chip and edits the rest.
    const chip = /^\/skill:\S+ /.exec(text)?.[0].length ?? 0;
    const offset =
      field.value === text
        ? 0
        : chip && field.value === text.slice(chip)
          ? chip
          : -1;
    if (offset < 0) {
      // Edited after it was shown: the person's own text and caret win.
      if (same) preparedFields.delete(owner);
      return;
    }
    const active = document.activeElement;
    if (active && active !== document.body && active !== field) return;
    prepared.shownIn = field;
    prepared.shown = field.value;
    field.focus({ preventScroll: true });
    field.setSelectionRange(
      Math.max(0, start - offset),
      Math.max(0, end - offset),
    );
    field.scrollTop = field.scrollHeight;
  });
}

/**
 * Choosing a goal outside a conversation is its Aloita: the new
 * conversation's draft is prepared before it is created, and its guide is
 * set as Aloita sets it. With onStart, returns whether creation began;
 * a declined start retains the draft without queueing an immediate send.
 * An unavailable skill read rejects before anything is prepared.
 */
export async function prepareGoalConversation({
  identity,
  workspaceId,
  goal,
  page,
  signal,
  allowImmediate = true,
  onStart,
}: {
  identity: string;
  workspaceId: string;
  goal: StartGoal;
  page: string;
  signal: AbortSignal;
  allowImmediate?: boolean;
  /** True only once creation has begun; a model chooser is not creation. */
  onStart?: () => boolean;
}) {
  const { goal: effective, carried } = await resolveGoal(
    goal,
    { workspaceId },
    signal,
  );
  if (signal.aborted) return false;
  const keys = creationKeys(identity, workspaceId);
  const key = keys.draft;
  const draft = sessionStorage.getItem(key) ?? "";
  const prepared = goalDraft(effective, draft, carried);
  sessionStorage.setItem(key, prepared.text);
  const owner = creationGuideOwner(identity, workspaceId);
  prepareField(owner, {
    text: prepared.text,
    start: prepared.selectionStart,
    end: prepared.selectionEnd,
  });
  setGuide(owner, { goal: effective, page, open: guideOpensItself() });
  const started = onStart?.() ?? false;
  if (
    started &&
    allowImmediate &&
    goalStartsImmediately(effective, draft) &&
    !readHeld(keys.held).length
  ) {
    // Enqueue only after creation begins, before its view mounts. A refused
    // start or a model chooser leaves a draft, never a send for a later visit.
    writeHeld(keys.held, [
      { command_id: crypto.randomUUID(), text: prepared.text, posted: false },
    ]);
    sessionStorage.removeItem(key);
  }
  return onStart ? started : true;
}

/** A new conversation's draft that is a native invocation, caret after it. */
export function prepareInvocation(
  identity: string,
  workspaceId: string,
  invocation: string,
) {
  const key = creationKeys(identity, workspaceId).draft;
  const draft = sessionStorage.getItem(key) ?? "";
  const text = draft.startsWith(invocation)
    ? draft
    : `${invocation}${draft.trim() ? `\n\n${draft.replace(/\n+$/, "")}` : ""}`;
  sessionStorage.setItem(key, text);
  const at = invocation.length;
  prepareField(creationGuideOwner(identity, workspaceId), {
    text,
    start: draft.startsWith(invocation) ? text.length : at,
    end: draft.startsWith(invocation) ? text.length : at,
  });
}

/** The name a conversation started from a goal gets until it is renamed:
 * the goal's own `name`, else its title. */
export function goalConversationName(goal: StartGoal) {
  return conversationName(goal.name ?? goal.title) || undefined;
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
  return [
    startPageGoal(!!page),
    ...authoredGoals(page).flatMap<ComposerGoal>((goal) =>
      goal.skill
        ? [
            {
              skill: goal.skill,
              title: goal.title,
              ...goalRequest(goal),
            },
          ]
        : [],
    ),
  ];
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
