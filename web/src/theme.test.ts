import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Järjestelmä follows the device: a request for more contrast wins over the
// light/dark preference.
function media(matches: Record<string, boolean>) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches[query] ?? false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

describe("theme choice", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("resolves Järjestelmä from the device", async () => {
    media({ "(prefers-color-scheme: dark)": true });
    const { resolveTheme } = await import("./theme");
    expect(resolveTheme("system")).toBe("dark");
    media({
      "(prefers-color-scheme: dark)": false,
      "(prefers-contrast: more)": true,
    });
    vi.resetModules();
    const again = await import("./theme");
    expect(again.resolveTheme("system")).toBe("contrast");
    expect(document.documentElement.dataset.theme).toBe("contrast");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("keeps a chosen theme, the contrast theme included", async () => {
    media({});
    localStorage.setItem("nah:theme", "contrast");
    const theme = await import("./theme");
    expect(theme.getThemeChoice()).toBe("contrast");
    expect(document.documentElement.dataset.theme).toBe("contrast");
    theme.setThemeChoice("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("nah:theme")).toBe("light");
    expect(theme.isDarkTheme("contrast")).toBe(true);
  });
});
