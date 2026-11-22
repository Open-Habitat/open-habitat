import { describe, expect, it } from "vitest";
import {
  feedbackIssue,
  feedbackText,
  generalFeedbackIssue,
  NOTE_MAX,
} from "./explainFeedback";

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

it("general feedback carries only the person's note, version and language, never a card", () => {
  const issue = generalFeedbackIssue("  A & B?  ", "0.4.2", "en-GB");
  const url = new URL(issue.url);
  expect([...url.searchParams.keys()].sort()).toEqual([
    "fix",
    "language",
    "template",
    "title",
    "version",
  ]);
  expect(url.searchParams.get("template")).toBe("general-feedback.yml");
  expect(url.searchParams.get("fix")).toBe("A & B?");
  expect(url.searchParams.get("language")).toBe("en-GB");
  expect(feedbackText(issue)).not.toContain("Card:");
  expect(
    generalFeedbackIssue("x".repeat(1300), undefined).fields.fix,
  ).toHaveLength(1200);
});
