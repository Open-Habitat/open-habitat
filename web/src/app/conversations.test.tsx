import { describe, expect, it, vi } from "vitest";
import {
  ContinuationRefused,
  continueConversation,
  questionTextFits,
  readRecap,
} from "./conversations";

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

describe("native continuation refusals", () => {
  it.each([
    ["writer_conflict", 409],
    ["read_only_history", 409],
    ["control_uncertain", 409],
    ["capacity_exceeded", 429],
  ] as const)(
    "preserves %s from the host instead of retrying",
    async (code, status) => {
      const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ schema_version: 1, error: { code } }), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      );
      try {
        try {
          await continueConversation(
            "pi:11111111-1111-4111-8111-111111111111",
            "ws_abcdefgh",
            "csrf",
          );
          throw new Error("continuation was accepted");
        } catch (error) {
          expect(error).toBeInstanceOf(ContinuationRefused);
          expect((error as ContinuationRefused).code).toBe(code);
        }
        expect(fetch).toHaveBeenCalledOnce();
      } finally {
        fetch.mockRestore();
      }
    },
  );
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
