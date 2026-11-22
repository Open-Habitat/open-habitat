import { describe, expect, it } from "vitest";
import { inPath } from "./ExplainMode";
import { feedbackIssue, feedbackText, NOTE_MAX } from "./explainFeedback";

describe("feedbackIssue", () => {
  it("opens the issue form with the text, card, version and language only", () => {
    const issue = feedbackIssue(
      "Y05",
      "  Ei kerro & tiivistyykö?  ",
      "0.4.2",
      "fi",
    );
    const url = new URL(issue.url);
    expect(url.origin + url.pathname).toBe(
      "https://github.com/Open-Habitat/open-habitat/issues/new",
    );
    expect([...url.searchParams.keys()].sort()).toEqual(
      ["card", "fix", "language", "template", "title", "version"].sort(),
    );
    expect(url.searchParams.get("template")).toBe("explain-feedback.yml");
    expect(url.searchParams.get("fix")).toBe("Ei kerro & tiivistyykö?");
    expect(url.searchParams.get("card")).toMatch(/^Y05 · \S/);
    expect(url.searchParams.get("title")).toContain("(Y05)");
    expect(url.searchParams.get("version")).toBe("0.4.2");
    expect(url.searchParams.get("language")).toBe("fi");
  });

  it("says unknown without a version and never exceeds the limit", () => {
    const issue = feedbackIssue(
      "Y05",
      "x".repeat(NOTE_MAX + 50),
      undefined,
      "en-GB",
    );
    expect(issue.fields.version).toBe("unknown");
    expect(issue.fields.fix).toHaveLength(NOTE_MAX);
    expect(feedbackText(issue)).toContain("Card: Y05");
  });
});

describe("inPath", () => {
  const part = { x: 100, y: 100, w: 40, h: 20 };
  it("holds between the part and a card below it, and nowhere else", () => {
    const card = { left: 60, right: 380, top: 130, bottom: 300 };
    expect(inPath(120, 125, part, card)).toBe(true);
    expect(inPath(300, 129, part, card)).toBe(true);
    expect(inPath(300, 121, part, card)).toBe(false);
    expect(inPath(120, 90, part, card)).toBe(false);
  });
  it("has no path when the card overlaps its part", () => {
    const card = { left: 60, right: 380, top: 110, bottom: 300 };
    expect(inPath(120, 115, part, card)).toBe(false);
    expect(inPath(120, 105, part, card)).toBe(false);
  });
  it("holds between the part and a card above it", () => {
    const card = { left: 60, right: 380, top: 0, bottom: 90 };
    expect(inPath(120, 95, part, card)).toBe(true);
    expect(inPath(350, 91, part, card)).toBe(true);
    expect(inPath(370, 99, part, card)).toBe(false);
  });
});
