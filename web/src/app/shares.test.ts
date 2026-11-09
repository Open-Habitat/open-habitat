import { expect, it } from "vitest";
import type { ViewSummary } from "../components/ViewOffer";
import { groupShares, shareCategory } from "./shares";
import type { Agent } from "./snapshot";
import type { ViewAddress } from "./viewLinks";

const address = (id: string, created: string): ViewAddress => ({
  address_id: id,
  view_id: id,
  title: id,
  url: "",
  content_url: "",
  created_at: created,
  state: "private",
});
const view = (id: string, conversation: string): ViewSummary => ({
  view_id: id,
  conversation_id: conversation,
  title: id,
  entry: "index.html",
  files: 1,
  bytes: 12,
  created_at: "2026-01-01T00:00:00Z",
});
const agent = (id: string, changed?: string): Agent => ({
  agent_id: id,
  workspace_id: "ws_example00",
  title: { display: id },
  history: "readable",
  process: "unknown",
  control: "read_only",
  live_tail: [],
  changed_at: changed,
});
it("keeps a recently active archived conversation ahead of newer shares and removed items last", () => {
  const rows = [
    address("new", "2026-03-03"),
    address("old", "2026-01-01"),
    address("gone", "2026-05-05"),
    address("older", "2025-12-01"),
    address("fallback", "2026-02-02"),
  ];
  const result = groupShares(
    rows,
    [
      view("new", "quiet"),
      view("old", "active"),
      view("older", "active"),
      view("fallback", "no-session"),
    ],
    {
      agents: [
        agent("quiet", "2026-03-03"),
        { ...agent("active", "2026-04-04"), archive: "archived" },
        agent("no-session"),
      ],
    },
  );
  expect(result.map((g) => g.id)).toEqual([
    "active",
    "quiet",
    "no-session",
    "removed",
  ]);
  expect(result[0].rows.map((s) => s.address.address_id)).toEqual([
    "old",
    "older",
  ]);
  expect(result[2].changed).toBe("2026-02-02");
  expect(shareCategory(result[3].rows[0])).toBe("past");
});
it("does not present an elapsed public address as public before the next host read", () => {
  const a = {
    ...address("old", "2026-01-01"),
    state: "public" as const,
    public_until: "2000-01-01T00:00:00Z",
  };
  expect(shareCategory({ address: a, item: view("old", "active") })).toBe(
    "past",
  );
});
