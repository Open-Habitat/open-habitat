import { afterEach, expect, it } from "vitest";
import {
  browserLanguage,
  catalog,
  currentLanguage,
  formatDate,
  formatNumber,
  localeOf,
  plural,
  resetLanguageForTests,
  resolveLanguage,
  setPersonalLanguage,
  setServerLanguage,
  textNow,
} from ".";

afterEach(() => resetLanguageForTests("fi"));

it("uses the selected regional locale for dates, time and numbers", () => {
  const date = new Date("2026-10-31T15:04:00Z");
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  };
  setPersonalLanguage("en-US");
  expect(formatDate(date, options)).toBe("10/31/2026");
  expect(formatDate(date, { hour: "numeric", timeZone: "UTC" })).toBe("3 PM");
  expect(formatNumber(1234.5)).toBe("1,234.5");
  setPersonalLanguage("en-GB");
  expect(formatDate(date, options)).toBe("31/10/2026");
  expect(formatDate(date, { hour: "numeric", timeZone: "UTC" })).toBe("15");
  expect(formatNumber(1234.5)).toBe("1,234.5");
  expect(localeOf("en")).toBe("en-GB");
});

it("merges only the UK message overrides without changing parameters or the US base", () => {
  const messages = catalog(
    {
      nested: { unchanged: "same", changed: "väri" },
      sentence: (name: string) => name,
    },
    {
      nested: { unchanged: "same", changed: "color" },
      sentence: (name) => `Color: ${name}`,
    },
    { nested: { changed: "colour" }, sentence: (name) => `Colour: ${name}` },
  );
  expect(messages["en-US"].nested).toEqual({
    unchanged: "same",
    changed: "color",
  });
  expect(messages["en-GB"].nested).toEqual({
    unchanged: "same",
    changed: "colour",
  });
  expect(messages["en-GB"].sentence("color.txt")).toBe("Colour: color.txt");
  expect(messages.en).toBe(messages["en-GB"]);
});

it("reads the browser's first language: Finnish for fi*, English otherwise", () => {
  expect(browserLanguage(["fi-FI", "en"])).toBe("fi");
  expect(browserLanguage(["fi"])).toBe("fi");
  expect(browserLanguage(["en-US"])).toBe("en-US");
  expect(browserLanguage(["en-GB", "fi"])).toBe("en-GB");
  expect(browserLanguage(["EN-gb"])).toBe("en-GB");
  expect(browserLanguage(["en-AU"])).toBe("en-US");
  expect(browserLanguage(["en"])).toBe("en-US");
  expect(browserLanguage(["sv-SE", "fi"])).toBe("en-US");
  expect(browserLanguage(["de-DE"])).toBe("en-US");
  expect(browserLanguage(["fil-PH"])).toBe("en-US");
  expect(browserLanguage([])).toBe("en-US");
});

it("resolves the person's choice, then the server default, then the browser", () => {
  expect(resolveLanguage("en", "fi", "fi")).toBe("en");
  expect(resolveLanguage("system", "fi", "en")).toBe("fi");
  expect(resolveLanguage(undefined, "en", "fi")).toBe("en");
  expect(resolveLanguage("system", "system", "en")).toBe("en");
  expect(resolveLanguage(undefined, undefined, "fi")).toBe("fi");
  expect(resolveLanguage("en-US", "en-GB", "fi")).toBe("en-US");
  expect(resolveLanguage("system", "en-GB", "en-US")).toBe("en-GB");
  expect(resolveLanguage("system", "system", "en-GB")).toBe("en-GB");
});

it("keeps the last load's language while the person's choice is pending", () => {
  resetLanguageForTests("en");
  setServerLanguage("fi");
  expect(currentLanguage()).toBe("en");
  setPersonalLanguage(undefined);
  expect(currentLanguage()).toBe("fi");
  expect(document.documentElement.lang).toBe("fi");
  expect(localStorage.getItem("nah:language")).toBe("fi");
  setPersonalLanguage("en");
  expect(currentLanguage()).toBe("en");
});

it("gives each language its own messages and plural forms", () => {
  const text = catalog(
    {
      files: (n: number) =>
        `${n} ${plural("fi", n, { one: "tiedosto", other: "tiedostoa" })}`,
    },
    {
      files: (n) => `${n} ${plural("en", n, { one: "file", other: "files" })}`,
    },
  );
  setPersonalLanguage("en");
  expect(textNow(text).files(1)).toBe("1 file");
  expect(textNow(text).files(2)).toBe("2 files");
  setPersonalLanguage("fi");
  expect(textNow(text).files(1)).toBe("1 tiedosto");
  expect(textNow(text).files(3)).toBe("3 tiedostoa");
});
