import { describe, expect, it } from "vitest";
import { compactionNotice } from "./compactionNotice";
import type { ConversationEvent } from "./conversationEvents";

const marker = (marker: string, outcome?: string) =>
  ({
    kind: "pi.marker",
    payload: { marker, text: "manual", outcome },
  }) as unknown as ConversationEvent;
const signal = (signal: string) =>
  ({
    kind: "pi.lifecycle",
    payload: { signal },
  }) as unknown as ConversationEvent;

describe("compactionNotice", () => {
  it("says the agent compacts from the press on, before Pi's first word", () => {
    expect(compactionNotice({ running: true }, [])).toEqual({
      kind: "running",
    });
    expect(
      compactionNotice({ running: false }, [marker("compaction_start")]),
    ).toEqual({ kind: "running" });
  });
  it("leaves a finished compaction to its mark in history", () => {
    expect(
      compactionNotice(
        { running: false, outcome: { kind: "done", after: 9 } },
        [marker("compaction_start"), marker("compaction_end", "done")],
      ),
    ).toBeUndefined();
  });
  it("says why it did not compact, from the press or from Pi alone", () => {
    expect(
      compactionNotice({ running: false, outcome: { kind: "turn_running" } }),
    ).toEqual({ kind: "failed", reason: "turn_running" });
    expect(
      compactionNotice(undefined, [
        marker("compaction_start"),
        marker("compaction_end", "failed"),
      ]),
    ).toEqual({ kind: "failed", reason: "compaction_failed" });
    expect(
      compactionNotice(undefined, [marker("compaction_end", "cancelled")]),
    ).toEqual({ kind: "failed", reason: "cancelled" });
    // A lost sign-in is the login page's to say.
    expect(
      compactionNotice({ running: false, outcome: { kind: "login" } }),
    ).toBeUndefined();
  });
  it("lets a new turn leave Pi's failure behind", () => {
    expect(
      compactionNotice(undefined, [
        marker("compaction_end", "failed"),
        signal("agent_start"),
      ]),
    ).toBeUndefined();
    // Pi retries the turn after an overflow compaction: it is not running.
    expect(
      compactionNotice(undefined, [
        marker("compaction_start"),
        signal("turn_start"),
      ]),
    ).toBeUndefined();
  });
  it("lets Pi's later end supersede the request's own answer", () => {
    // Another tab compacted after this one failed, or the answer was lost.
    expect(
      compactionNotice(
        { running: false, outcome: { kind: "compaction_failed" } },
        [
          marker("compaction_end", "failed"),
          marker("compaction_start"),
          marker("compaction_end", "done"),
        ],
      ),
    ).toBeUndefined();
    expect(
      compactionNotice({ running: false, outcome: { kind: "uncertain" } }, [
        marker("compaction_end", "done"),
      ]),
    ).toBeUndefined();
    // A refusal before Pi was asked is newer than any earlier end.
    expect(
      compactionNotice({ running: false, outcome: { kind: "turn_running" } }, [
        marker("compaction_end", "done"),
      ]),
    ).toEqual({ kind: "failed", reason: "turn_running" });
  });
  it("keeps Pi's failure after the answer before it is saved", () => {
    expect(
      compactionNotice(undefined, [
        marker("compaction_start"),
        marker("compaction_end", "failed"),
      ]),
    ).toEqual({ kind: "failed", reason: "compaction_failed" });
  });
});
