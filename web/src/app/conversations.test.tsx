import { describe, expect, it, vi } from "vitest";
import { questionTextFits, readRecap } from "./conversations";

describe("native recap read", () => {
  it("accepts bounded native data and rejects unknown fields", async () => {
    const recap = {
      recap: "Work complete",
      next: "Check tests",
      through: "two",
      generated_at: 1750000000000,
    };
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ schema_version: 1, recap, latest_message: "two" }),
          { headers: { "Content-Type": "application/json" } },
        ),
      );
    await expect(
      readRecap("pi:11111111-1111-4111-8111-111111111111"),
    ).resolves.toEqual({ recap, latest_message: "two" });
    fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          schema_version: 1,
          recap: { ...recap, secret: "no" },
          latest_message: "two",
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    await expect(
      readRecap("pi:11111111-1111-4111-8111-111111111111"),
    ).rejects.toThrow("invalid recap");
    fetch.mockRestore();
  });
});

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
