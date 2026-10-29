import { describe, expect, it, vi } from "vitest";
import {
  ContinuationRefused,
  canRecheckCreation,
  continueConversation,
  createTracked,
  questionTextFits,
  readRecap,
  regenerateTitle,
  retitleHistory,
  TitleGenerationFailed,
} from "./conversations";

describe("native recap read", () => {
  it("accepts bounded native data and rejects unknown fields", async () => {
    const recap = {
      recap: "Work complete",
      next: "Check tests",
      through: "two",
      generated_at: 1750000000000,
    };
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          schema_version: 1,
          recap,
          latest_message: "two",
          latest_message_at: "2026-10-27T08:00:00.000Z",
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    await expect(
      readRecap("pi:11111111-1111-4111-8111-111111111111"),
    ).resolves.toEqual({
      recap,
      latest_message: "two",
      latest_message_at: "2026-10-27T08:00:00.000Z",
    });
    fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          schema_version: 1,
          recap: { ...recap, secret: "no" },
          latest_message: "two",
          latest_message_at: null,
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
    ["history_damaged", 409],
    ["quota_full", 507],
    ["storage_full", 507],
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

describe("creation uncertainty", () => {
  it("allows read-only recheck only after the write settles, never for an outstanding send", async () => {
    const key = "nah:synthetic:uncertain:ws_abcdefgh";
    let reply!: (value: Response) => void;
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise((resolve) => {
          reply = resolve;
        }),
    );
    try {
      const creation = createTracked("ws_abcdefgh", "csrf", key, () => true);
      const failed = expect(creation).rejects.toThrow();
      expect(canRecheckCreation(key)).toBe(false);
      reply(new Response("{}", { status: 503 }));
      await failed;
      expect(canRecheckCreation(key)).toBe(true);
      sessionStorage.setItem(key, "outstanding-send-id");
      expect(canRecheckCreation(key)).toBe(false);
    } finally {
      sessionStorage.removeItem(key);
      fetch.mockRestore();
    }
  });
});

describe("native title outcomes", () => {
  it.each(["live", "history"])(
    "preserves allowlisted model failures for %s without retry or native text",
    async (operation) => {
      const fetch = vi.spyOn(globalThis, "fetch");
      const title = () =>
        operation === "live"
          ? regenerateTitle("pi:11111111-1111-4111-8111-111111111111", "csrf")
          : retitleHistory(
              "pi:11111111-1111-4111-8111-111111111111",
              "ws_fixture123",
              "csrf",
            );
      try {
        for (const reason of [
          "model_unavailable",
          "model_timeout",
          "model_invalid_response",
          "native_name_changed",
        ]) {
          fetch.mockResolvedValueOnce(
            new Response(
              JSON.stringify({ schema_version: 1, state: "failed", reason }),
              { headers: { "Content-Type": "application/json" } },
            ),
          );
          await expect(title()).rejects.toMatchObject({ reason });
        }
        fetch.mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              schema_version: 1,
              state: "failed",
              reason: "provider-secret",
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
        );
        await expect(title()).rejects.not.toBeInstanceOf(TitleGenerationFailed);
        expect(fetch).toHaveBeenCalledTimes(5);
      } finally {
        fetch.mockRestore();
      }
    },
  );
});
