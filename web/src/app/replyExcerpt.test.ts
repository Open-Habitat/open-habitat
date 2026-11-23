import { describe, expect, it } from "vitest";
import cases from "../../../internal/replyblock/testdata/excerpts.json";
import type { HistoryEntry } from "./history";
import { replyExcerpt, replyText } from "./replyExcerpt";

// The daemon's rule (internal/replyblock) and this copy read the same cases:
// the field must show the excerpt the agent will receive.
describe("replyExcerpt", () => {
  it.each(cases)("$name", ({ in: input, want }) => {
    expect(replyExcerpt(input)).toBe(want);
  });
});

describe("replyText", () => {
  it("reads the text blocks only", () => {
    const entry: HistoryEntry = {
      entry_key: "a1",
      kind: "assistant",
      content: { media_type: "text/plain", text: "flat", complete: true },
      blocks: [
        { type: "thinking", text: "Salainen pohdinta." },
        { type: "text", text: "Ensimmäinen. Toinen." },
        { type: "toolCall", tool_name: "bash" },
      ],
    } as HistoryEntry;
    expect(replyExcerpt(replyText(entry))).toBe("Ensimmäinen. …");
  });
});
