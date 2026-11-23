import { describe, expect, it } from "vitest";
import { searchCoverage, validSearchKey } from "./webSearch";

describe("web search key", () => {
  const native = ["openai-codex", "openai", "anthropic", "claude-bridge"];

  it("names the person's providers by whether the extension searches for them", () => {
    expect(
      searchCoverage(native, ["openai-codex", "deepseek", "claude-bridge"]),
    ).toEqual({ natives: ["ChatGPT", "Claude"], needers: ["DeepSeek"] });
    expect(searchCoverage(native, ["deepseek"])).toEqual({
      natives: [],
      needers: ["DeepSeek"],
    });
  });

  it("says nothing when the extension's list or the person's providers are unknown", () => {
    expect(searchCoverage(null, ["deepseek"])).toBeUndefined();
    expect(searchCoverage(native, undefined)).toBeUndefined();
  });

  it("takes only a literal key", () => {
    expect(validSearchKey("BSAown00000000000000000000Ab12")).toBe(true);
    expect(validSearchKey("$BRAVE_API_KEY_000000")).toBe(false);
    expect(validSearchKey("short")).toBe(false);
    expect(validSearchKey("BSA own 0000000000000000000")).toBe(false);
  });
});
