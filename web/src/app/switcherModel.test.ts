import { describe, expect, it } from "vitest";
import type { SearchReply } from "./search";
import {
  daysAgo,
  rankGroups,
  recentConversations,
  type SwitcherConversation,
  stemsOf,
  switcherRows,
} from "./switcherModel";

const conv = (
  agentId: string,
  title: string,
  extra: Partial<SwitcherConversation> = {},
): SwitcherConversation => ({
  agentId,
  href: `/workspaces/ws?conversation=${agentId}`,
  title,
  workspaceName: "retkiopas",
  archived: false,
  ...extra,
});

const tiles = conv("pi:tiles", "Karttatiilten välimuisti", { changedAt: 5 });
const glossary = conv("pi:glossary", "Tilikartan sanasto", { changedAt: 4 });
const old = conv("pi:old", "Karttapalvelun vaihto", {
  archived: true,
  changedAt: 1,
});
const notice = conv("pi:notice", "Aukioloajat", { changedAt: 9 });
const all = [tiles, glossary, old, notice];

const hit = (entry_key: string, at: string, role: "user" | "assistant") => ({
  entry_key,
  at,
  role,
  snippet: `${entry_key} kartta`,
});
const reply = (
  conversations: SearchReply["conversations"],
  terms = ["kart"],
): SearchReply => ({
  schema_version: 1,
  terms,
  index: { state: "ready", indexed: 4, total: 4 },
  conversations,
});

describe("stemsOf", () => {
  it("follows the index's Finnish stem rule", () => {
    expect(stemsOf("kartta")).toEqual(["kart"]);
    expect(stemsOf("Kartan")).toEqual(["kart"]);
    expect(stemsOf("kartalle")).toEqual(["kart"]);
    expect(stemsOf("välimuistin")).toEqual(["välimuist"]);
    expect(stemsOf("map")).toEqual(["map"]);
    expect(stemsOf("a kartta, kartan!")).toEqual(["kart"]);
    expect(stemsOf("x")).toEqual([]);
    expect(stemsOf("")).toEqual([]);
  });
});

describe("rankGroups", () => {
  it("finds names at once, before the index answers", () => {
    const groups = rankGroups(all, "kartta", undefined);
    // Name matches only; archived last.
    expect(groups.map((g) => g.conversation.agentId)).toEqual([
      "pi:tiles",
      "pi:glossary",
      "pi:old",
    ]);
    expect(groups.every((g) => g.title)).toBe(true);
  });

  it("ranks name matches first, archived last, then the newest hit and the most hits", () => {
    const groups = rankGroups(
      all,
      "aukiolo",
      reply([
        {
          agent_id: "pi:tiles",
          hit_count: 2,
          hits: [hit("t2", "2026-11-14T10:00:00Z", "assistant")],
        },
        {
          agent_id: "pi:old",
          hit_count: 1,
          hits: [hit("o1", "2026-11-15T10:00:00Z", "user")],
        },
        {
          agent_id: "pi:glossary",
          hit_count: 5,
          hits: [hit("g1", "2026-11-15T09:00:00Z", "user")],
        },
        {
          agent_id: "pi:unknown",
          hit_count: 1,
          hits: [hit("u1", "2026-11-15T11:00:00Z", "user")],
        },
      ]),
    );
    expect(groups.map((g) => g.conversation.agentId)).toEqual([
      "pi:notice",
      "pi:glossary",
      "pi:tiles",
      "pi:old",
    ]);
    expect(groups[1].hitCount).toBe(5);
  });

  it("joins a name match and its message hits in one row", () => {
    const groups = rankGroups(
      all,
      "kartta",
      reply([
        {
          agent_id: "pi:tiles",
          hit_count: 1,
          hits: [hit("t1", "2026-11-14T10:00:00Z", "user")],
        },
      ]),
    );
    expect(groups[0]).toMatchObject({ title: true, hitCount: 1 });
    expect(groups.filter((g) => g.conversation === tiles)).toHaveLength(1);
  });
});

describe("switcherRows", () => {
  it("lists recent conversations with the previous one first, not the open one", () => {
    const rows = switcherRows({
      q: "",
      groups: [],
      recent: [notice, tiles, glossary],
      previous: "pi:glossary",
      current: "pi:notice",
      lastQuery: "kartta",
      expanded: new Set(),
    });
    expect(rows.map((r) => r.key)).toEqual([
      "c-pi:glossary",
      "c-pi:tiles",
      "continue",
    ]);
    expect(rows[0]).toMatchObject({ previous: true });
  });

  it("opens a conversation's other hits under it", () => {
    const groups = rankGroups(
      all,
      "kartta",
      reply([
        {
          agent_id: "pi:tiles",
          hit_count: 3,
          hits: [
            hit("best", "2026-11-14T10:00:00Z", "user"),
            hit("b", "2026-11-15T10:00:00Z", "assistant"),
            hit("c", "2026-11-13T10:00:00Z", "user"),
          ],
        },
      ]),
    );
    const shut = switcherRows({
      q: "kartta",
      groups,
      recent: [],
      expanded: new Set(),
    });
    expect(shut.map((r) => r.kind)).toEqual([
      "conversation",
      "conversation",
      "conversation",
    ]);
    const open = switcherRows({
      q: "kartta",
      groups,
      recent: [],
      expanded: new Set(["pi:tiles"]),
    });
    expect(open.map((r) => r.key)).toEqual([
      "c-pi:tiles",
      "h-pi:tiles-b",
      "h-pi:tiles-c",
      "c-pi:glossary",
      "c-pi:old",
    ]);
  });
});

it("recentConversations puts this tab's openings first, then the latest changes", () => {
  expect(
    recentConversations(all, ["pi:glossary"], 3).map((c) => c.agentId),
  ).toEqual(["pi:glossary", "pi:notice", "pi:tiles"]);
});

it("daysAgo counts calendar days", () => {
  const now = new Date(2026, 10, 15, 9).getTime();
  expect(daysAgo(new Date(2026, 10, 15, 1).getTime(), now)).toBe(0);
  expect(daysAgo(new Date(2026, 10, 14, 23).getTime(), now)).toBe(1);
  expect(daysAgo(new Date(2026, 10, 10, 12).getTime(), now)).toBe(5);
});
