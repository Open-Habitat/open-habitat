import { describe, expect, it } from "vitest";
import { questionTextFits } from "./conversations";

describe("Pi dialog request body", () => {
  it("rejects escaped text before a question attempt is recorded", () => {
    expect(questionTextFits("Jatka")).toBe(true);
    // Quotes double in JSON, so 40 KiB of text is larger than the daemon's
    // 66 KiB request cap even though it is shorter than the text-field cap.
    expect(questionTextFits('"'.repeat(40000))).toBe(false);
    expect(questionTextFits("x".repeat(59998))).toBe(true);
    expect(questionTextFits("x".repeat(59999))).toBe(false);
  });
});
