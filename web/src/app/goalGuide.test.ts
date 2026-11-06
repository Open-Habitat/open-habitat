import { afterEach, describe, expect, it, vi } from "vitest";
import type { StartGoal, StartPage } from "./composerReads";
import {
  adoptGuide,
  composerGoals,
  conversationGoal,
  creationGuideOwner,
  guideOwner,
  readFirstSkill,
  readGuide,
  setGuide,
} from "./goalGuide";
import type { HistoryEntry } from "./history";

const goal = (title: string, skill?: string): StartGoal => ({
  title,
  when: "w",
  what: "x",
  steps: ["s"],
  prompt: "Pyyntö.\n\n[paikka]",
  skill,
});
const korjaa = goal("Korjaa", "korjaa");
const julkaise = goal("Julkaise", "julkaise");
const page: StartPage = {
  title: "Sivu",
  body: "",
  goals: [korjaa, julkaise, goal("Tutustu")],
};
const user = (skill?: string) =>
  ({
    kind: "user",
    skill: skill ? { name: skill } : undefined,
  }) as HistoryEntry;

describe("the goal a conversation is about", () => {
  it("prefers the goal started in this tab, then Pi's newest goal skill call, then the draft", () => {
    const started = goal("Tutustu");
    expect(conversationGoal(page, started, [user("korjaa")], "")).toBe(started);
    expect(
      conversationGoal(
        page,
        undefined,
        [user("korjaa"), user("julkaise"), user("muu"), user()],
        "/skill:korjaa x",
      ),
    ).toBe(julkaise);
    expect(conversationGoal(page, undefined, [], "/skill:korjaa x")).toBe(
      korjaa,
    );
    // A first message older than the loaded tail still names the goal.
    expect(
      conversationGoal(
        page,
        undefined,
        [user()],
        "/skill:julkaise x",
        "korjaa",
      ),
    ).toBe(korjaa);
    // A goal's name still being typed, or an unknown skill, names no goal.
    expect(conversationGoal(page, undefined, [], "/skill:korjaa")).toBe(
      undefined,
    );
    expect(
      conversationGoal(page, undefined, [user("muu")], "/skill:muu x"),
    ).toBe(undefined);
    expect(
      conversationGoal(
        { state: "needs_update" },
        undefined,
        [user("korjaa")],
        "",
      ),
    ).toBe(undefined);
  });
  it("offers chips only for goals with a skill, with the request's placeholder removed", () => {
    expect(composerGoals(page).slice(1)).toEqual([
      {
        skill: "korjaa",
        title: "Korjaa",
        request: "Pyyntö.",
        placeholder: "[paikka]",
      },
      {
        skill: "julkaise",
        title: "Julkaise",
        request: "Pyyntö.",
        placeholder: "[paikka]",
      },
    ]);
    expect(composerGoals(null).map((g) => g.skill)).toEqual([
      "open-habitat-start-page",
    ]);
  });
  it("hands the guide started during creation to the created conversation", () => {
    const from = creationGuideOwner("person", "ws");
    setGuide(from, { goal: korjaa, page: "Sivu", open: true });
    adoptGuide("person", "ws", "pi:new");
    expect(readGuide(from)).toBeUndefined();
    expect(readGuide(guideOwner("person", "pi:new"))).toEqual({
      goal: korjaa,
      page: "Sivu",
      open: true,
    });
    // Another person's creation is not taken over.
    setGuide(creationGuideOwner("other", "ws"), {
      goal: korjaa,
      page: "Sivu",
      open: true,
    });
    adoptGuide("person", "ws", "pi:second");
    expect(readGuide(guideOwner("person", "pi:second"))).toBeUndefined();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("reads the first message's skill from the start of the native history", async () => {
  const fetch = vi.fn(
    async (_url: string) =>
      new Response(
        JSON.stringify({
          schema_version: 1,
          agent_id: "pi:a1a1a1a1-0000-4000-8000-000000000001",
          native_revision: "r1",
          entries: [
            {
              entry_key: "model",
              kind: "model_change",
              content: { media_type: "text/plain", text: "", complete: true },
            },
            {
              entry_key: "first",
              kind: "user",
              skill: { name: "korjaa", description: "Korjaa" },
              content: { media_type: "text/plain", text: "x", complete: true },
            },
            {
              entry_key: "second",
              kind: "user",
              skill: { name: "julkaise" },
              content: { media_type: "text/plain", text: "y", complete: true },
            },
          ],
          complete: false,
          next_after: "second",
          cut_off: false,
        }),
        { headers: { "content-type": "application/json" } },
      ),
  );
  vi.stubGlobal("fetch", fetch);
  await expect(
    readFirstSkill(
      "pi:a1a1a1a1-0000-4000-8000-000000000001",
      new AbortController().signal,
    ),
  ).resolves.toBe("korjaa");
  expect(String(fetch.mock.calls[0]?.[0])).toBe(
    "/api/v1/agents/pi:a1a1a1a1-0000-4000-8000-000000000001/history?after=&limit=10",
  );
});
