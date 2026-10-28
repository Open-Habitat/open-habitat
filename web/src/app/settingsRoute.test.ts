import { describe, expect, it } from "vitest";
import paths from "../../../internal/uiroutes/settings.json";
import { settingsHref, settingsSection } from "./settingsRoute";

describe("settings URL contract", () => {
  it("uses only the agreed English slugs, including ASCII-only Finnish regressions", () => {
    expect(Object.values(paths).sort()).toEqual([
      "account",
      "agent-data",
      "ai",
      "ai-key",
      "appearance",
      "code-hosts",
      "devices",
      "disk",
      "editor",
      "onboarding",
      "server",
      "server-integrations",
      "speech",
      "speech-key",
      "storage",
      "users",
    ]);
    for (const [section, slug] of Object.entries(paths)) {
      expect(slug).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
      expect(settingsHref(section)).toBe(`/settings/${slug}`);
      expect(settingsSection(`/settings/${slug}`)).toBe(section);
    }
  });

  it("does not resolve old slugs or noncanonical URLs", () => {
    expect(settingsSection("/settings")).toBeNull();
    for (const path of [
      "/settings/integraatiot",
      "/settings/connections",
      "/settings/storage/",
      "/settings/account?x=1",
      "/settings/unknown",
    ]) {
      expect(settingsSection(path)).toBeUndefined();
    }
  });
});
