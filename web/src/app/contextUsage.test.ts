import { describe, expect, it } from "vitest";
import { contextUsage } from "./contextUsage";
import type { ConversationEvent } from "./conversationEvents";
import type { HistoryEntry } from "./history";
import type { Models } from "./PiModels";

const text = { media_type: "text/plain" as const, text: "", complete: true };
const user = (key: string): HistoryEntry => ({
  entry_key: key,
  kind: "user",
  content: text,
});
const reply = (key: string, tokens?: number): HistoryEntry => ({
  entry_key: key,
  kind: "assistant",
  content: text,
  model: "gpt-5.5",
  context_tokens: tokens,
});
const compaction = (key: string): HistoryEntry => ({
  entry_key: key,
  kind: "unknown",
  entry_type: "compaction",
  content: text,
});
const modelChange = (key: string, model: string): HistoryEntry => ({
  entry_key: key,
  kind: "model_change",
  content: { ...text, text: model },
});
const marker = (marker: string) =>
  ({ kind: "pi.marker", payload: { marker } }) as unknown as ConversationEvent;
const catalog: Models = {
  schema_version: 1,
  default_provider: null,
  default_model: null,
  auto_compaction: true,
  models: [
    {
      provider: "openai-codex",
      id: "gpt-5.5",
      name: "GPT-5.5",
      context_window: 272000,
      compaction_reserve_tokens: 16384,
    },
    {
      provider: "openai",
      id: "gpt-5.5",
      name: "GPT-5.5",
      context_window: 400000,
      compaction_reserve_tokens: 20000,
    },
  ],
};

describe("contextUsage", () => {
  it("shows nothing before Pi records a reply's usage", () => {
    expect(
      contextUsage({ entries: [user("u1"), reply("a1")], catalog }),
    ).toBeUndefined();
  });

  it("follows Pi: the newest usage, unknown after a later compaction", () => {
    const entries = [user("u1"), reply("a1", 205300), compaction("c1")];
    expect(contextUsage({ entries, catalog })).toMatchObject({
      phase: "after",
      tokens: undefined,
    });
    entries.push(user("u2"), reply("a2"), reply("a3", 31600));
    expect(contextUsage({ entries, catalog })).toMatchObject({
      phase: "known",
      tokens: 31600,
    });
    // Pi does not trust usage from before a context edit either.
    entries.push({ ...compaction("e1"), entry_type: "context_edit" });
    expect(contextUsage({ entries, catalog })?.phase).toBe("edited");
    entries.push(reply("a4", 31600));
    expect(contextUsage({ entries, catalog })).toMatchObject({
      phase: "known",
      tokens: 31600,
    });
  });

  it("is compacting only between Pi's compaction start and end", () => {
    const entries = [user("u1"), reply("a1", 249600)];
    expect(
      contextUsage({
        entries,
        catalog,
        fragments: [marker("compaction_start")],
      })?.phase,
    ).toBe("compacting");
    expect(
      contextUsage({
        entries,
        catalog,
        fragments: [marker("compaction_start"), marker("compaction_end")],
      })?.phase,
    ).toBe("known");
  });

  it("takes the window of the conversation's provider, not a namesake", () => {
    const entries = [
      modelChange("m1", "openai/gpt-5.5"),
      user("u1"),
      reply("a1", 1000),
    ];
    expect(contextUsage({ entries, catalog, model: "gpt-5.5" })).toMatchObject({
      window: 400000,
      reserve: 20000,
      autoCompaction: true,
    });
    expect(
      contextUsage({ entries, catalog, model: "deepseek/gpt-5.5" })?.window,
    ).toBeUndefined();
    // A history tail without the model change cannot tell the providers apart.
    expect(
      contextUsage({ entries: entries.slice(1), catalog, model: "gpt-5.5" })
        ?.window,
    ).toBeUndefined();
  });
});
