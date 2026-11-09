import { describe, expect, it } from "vitest";
import { attachmentRefusalText } from "../../text/attachmentRefusal";

describe("attachment size explanations", () => {
  it("never rounds an oversized file down to the permitted limit", () => {
    for (const language of ["fi", "en-US", "en-GB"] as const) {
      for (const bytes of [20 * 1048576 + 1, Math.floor(20.3 * 1048576)]) {
        const shown = attachmentRefusalText[language].size(bytes);
        expect(Number.parseFloat(shown.replace(",", "."))).toBeGreaterThan(20);
      }
    }
  });
});
