import { describe, expect, it } from "vitest";
import { guessAnswerLanguage } from "./answerLanguage";

const guess = (
  languages: string[],
  timeZone: string | undefined,
  ui: "fi" | "en" = "fi",
  uiChosen = false,
) => guessAnswerLanguage({ languages, timeZone, ui, uiChosen });

describe("guessAnswerLanguage", () => {
  it("lets the browser pick among the zone's own languages", () => {
    expect(guess(["fi-FI", "en-US"], "Europe/Helsinki")).toBe("fi");
    expect(guess(["en-US", "sv-FI", "fi"], "Europe/Helsinki")).toBe("sv");
    expect(guess(["fi"], "Europe/Stockholm")).toBe("fi");
    expect(guess(["en-GB"], "Europe/Stockholm", "en")).toBe("sv");
  });

  it("takes an English computer in Finland as suomi unless English was chosen here too", () => {
    expect(guess(["en-US"], "Europe/Helsinki", "en", false)).toBe("fi");
    expect(guess(["en-US"], "Europe/Helsinki", "en", true)).toBe("en");
    expect(guess(["en-US"], "Europe/Mariehamn", "en", false)).toBe("sv");
  });

  it("uses the browser elsewhere and Habitat's language last", () => {
    expect(guess(["de-DE", "sv-SE"], "Europe/Berlin")).toBe("sv");
    expect(guess(["en-US", "fi"], "America/New_York")).toBe("en");
    expect(guess(["de-DE"], "Europe/Berlin", "en")).toBe("en");
    expect(guess([], undefined, "fi")).toBe("fi");
  });
});
