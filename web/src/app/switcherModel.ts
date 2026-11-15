import type { SearchHit, SearchReply } from "./search";

/** One conversation the switcher can open, from the snapshot. */
export interface SwitcherConversation {
  agentId: string;
  href: string;
  title: string;
  workspaceName: string;
  archived: boolean;
  /** Epoch ms of the last change, when known. */
  changedAt?: number;
}

/** Query words cut to the stems search matches, the rule of the daemon's
 * index (internal/searchindex Terms): words of two letters or more, lower
 * case; words of five or more lose one common Finnish case ending, their
 * final vowels and a doubled final consonant (kartta, kartan → kart). The
 * browser needs it itself so that names are found before the index answers. */
export function stemsOf(q: string): string[] {
  const out: string[] = [];
  for (let w of q.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if ([...w].length < 2) continue;
    if ([...w].length >= 5)
      w = w
        .replace(/(ssa|ssä|sta|stä|lla|llä|lta|ltä|lle|ksi|na|nä|n|t)$/u, "")
        .replace(/[aeiouyäö]+$/u, "")
        .replace(/(\p{L})\1$/u, "$1");
    if ([...w].length < 2 || out.includes(w)) continue;
    out.push(w);
    if (out.length === 8) break;
  }
  return out;
}

const has = (s: string, stems: string[]) => {
  const lower = s.toLocaleLowerCase();
  return stems.length > 0 && stems.every((x) => lower.includes(x));
};

/** One conversation's share of a result. */
export interface SwitcherGroup {
  conversation: SwitcherConversation;
  /** The query matched its name or workspace. */
  title: boolean;
  hitCount: number;
  /** The hit that stands for it first, then the rest newest first. */
  hits: SearchHit[];
}

/** Name matches first, archived last within each, then the newest hit, then
 * the most hits (round 3's order). Name matches come from the snapshot at
 * once; message hits join when the person's daemon answers. */
export function rankGroups(
  conversations: SwitcherConversation[],
  q: string,
  reply: SearchReply | undefined,
): SwitcherGroup[] {
  const stems = stemsOf(q);
  if (!stems.length) return [];
  const byId = new Map(conversations.map((c) => [c.agentId, c]));
  const groups = new Map<string, SwitcherGroup>();
  for (const c of conversations)
    if (has(c.title, stems) || has(c.workspaceName, stems))
      groups.set(c.agentId, {
        conversation: c,
        title: true,
        hitCount: 0,
        hits: [],
      });
  for (const r of reply?.conversations ?? []) {
    const c = byId.get(r.agent_id);
    // A conversation the snapshot does not list cannot be opened from here.
    if (!c) continue;
    const g = groups.get(c.agentId) ?? {
      conversation: c,
      title: false,
      hitCount: 0,
      hits: [],
    };
    g.hitCount = r.hit_count;
    g.hits = r.hits;
    groups.set(c.agentId, g);
  }
  const newest = (g: SwitcherGroup) =>
    g.hits.reduce((m, h) => Math.max(m, Date.parse(h.at) || 0), 0);
  return [...groups.values()].sort(
    (a, b) =>
      Number(b.title) - Number(a.title) ||
      Number(a.conversation.archived) - Number(b.conversation.archived) ||
      newest(b) - newest(a) ||
      b.hitCount - a.hitCount ||
      (b.conversation.changedAt ?? 0) - (a.conversation.changedAt ?? 0),
  );
}

/** The list's selectable rows. */
export type SwitcherRow =
  | {
      kind: "conversation";
      key: string;
      group?: SwitcherGroup;
      conversation: SwitcherConversation;
      previous?: boolean;
      open?: boolean;
    }
  | {
      kind: "hit";
      key: string;
      conversation: SwitcherConversation;
      hit: SearchHit;
    }
  | { kind: "continue"; key: string; query: string };

/** The rows for a query: with none, the recently opened conversations with
 * the previous one first (so ⌘K Enter swaps two) and "Continue search";
 * with one, a row per conversation and its other hits under it when open. */
export function switcherRows({
  q,
  groups,
  recent,
  previous,
  current,
  lastQuery,
  expanded,
}: {
  q: string;
  groups: SwitcherGroup[];
  recent: SwitcherConversation[];
  previous?: string;
  current?: string;
  lastQuery?: string;
  expanded: ReadonlySet<string>;
}): SwitcherRow[] {
  const rows: SwitcherRow[] = [];
  if (!q.trim()) {
    const prev = recent.find((c) => c.agentId === previous);
    const order = prev
      ? [prev, ...recent.filter((c) => c !== prev)]
      : [...recent];
    for (const c of order)
      if (c.agentId !== current)
        rows.push({
          kind: "conversation",
          key: `c-${c.agentId}`,
          conversation: c,
          previous: c.agentId === previous,
        });
    if (lastQuery)
      rows.push({ kind: "continue", key: "continue", query: lastQuery });
    return rows;
  }
  for (const g of groups) {
    const open = expanded.has(g.conversation.agentId) && g.hits.length > 1;
    rows.push({
      kind: "conversation",
      key: `c-${g.conversation.agentId}`,
      group: g,
      conversation: g.conversation,
      open,
    });
    if (open)
      for (const hit of g.hits.slice(1))
        rows.push({
          kind: "hit",
          key: `h-${g.conversation.agentId}-${hit.entry_key}`,
          conversation: g.conversation,
          hit,
        });
  }
  return rows;
}

/** The recently opened conversations: this tab's own openings newest first,
 * then the rest by their last change. */
export function recentConversations(
  conversations: SwitcherConversation[],
  opened: readonly string[],
  limit = 8,
): SwitcherConversation[] {
  const byId = new Map(conversations.map((c) => [c.agentId, c]));
  const out: SwitcherConversation[] = [];
  for (const id of opened) {
    const c = byId.get(id);
    if (c && !out.includes(c)) out.push(c);
  }
  for (const c of [...conversations]
    .filter((c) => !c.archived)
    .sort((a, b) => (b.changedAt ?? 0) - (a.changedAt ?? 0))) {
    if (out.length >= limit) break;
    if (!out.includes(c)) out.push(c);
  }
  return out.slice(0, Math.max(limit, opened.length));
}

/** Whole days between two instants, by the reader's calendar. */
export function daysAgo(at: number, now: number): number {
  const day = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  return Math.max(0, Math.round((day(now) - day(at)) / 86_400_000));
}
