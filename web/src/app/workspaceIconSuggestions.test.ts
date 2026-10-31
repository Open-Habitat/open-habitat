import { beforeEach, describe, expect, it } from "vitest";
import { readStoredRounds, storeRounds } from "./workspaceIconSuggestions";

const round = (icon: string) => ({
  wish: "",
  model: "synthetic/icon-fixture",
  suggestions: [{ icon, why: "syy" }],
});

describe("kept icon suggestion rounds", () => {
  beforeEach(() => localStorage.clear());

  it("belong to one person and one workspace, newest eight", () => {
    const rounds = Array.from({ length: 10 }, (_, i) => round(String(i)));
    storeRounds("wid_a", "ws_one", {
      rounds,
      seen: { readme: true, start_page: false },
    });
    const kept = readStoredRounds("wid_a", "ws_one");
    expect(kept?.rounds.map((r) => r.suggestions[0].icon)).toEqual([
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
    ]);
    expect(kept?.seen).toEqual({ readme: true, start_page: false });
    expect(readStoredRounds("wid_b", "ws_one")).toBeUndefined();
    expect(readStoredRounds("wid_a", "ws_two")).toBeUndefined();
  });

  it("count as none when the browser holds something else", () => {
    for (const raw of [
      "{",
      "null",
      JSON.stringify({ rounds: "x" }),
      JSON.stringify({ rounds: [{ wish: "", suggestions: [] }] }),
      JSON.stringify({ rounds: [{ ...round("🦉"), wish: 7 }] }),
    ]) {
      localStorage.setItem("oh.icon-suggestions.wid_a.ws_one", raw);
      expect(readStoredRounds("wid_a", "ws_one")).toBeUndefined();
    }
    // A readable round survives beside a broken one; a broken seen is dropped.
    localStorage.setItem(
      "oh.icon-suggestions.wid_a.ws_one",
      JSON.stringify({ rounds: [{}, round("🦉")], seen: { readme: "yes" } }),
    );
    expect(readStoredRounds("wid_a", "ws_one")).toEqual({
      rounds: [round("🦉")],
    });
  });
});
