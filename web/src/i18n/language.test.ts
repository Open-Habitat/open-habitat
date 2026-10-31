import { afterEach, expect, it } from "vitest";
import {
  browserLanguage,
  catalog,
  currentLanguage,
  plural,
  resetLanguageForTests,
  resolveLanguage,
  setPersonalLanguage,
  setServerLanguage,
  textNow,
} from ".";

afterEach(() => resetLanguageForTests("fi"));

it("reads the browser's first language: Finnish for fi*, English otherwise", () => {
  expect(browserLanguage(["fi-FI", "en"])).toBe("fi");
  expect(browserLanguage(["fi"])).toBe("fi");
  expect(browserLanguage(["en-US"])).toBe("en");
  expect(browserLanguage(["sv-SE", "fi"])).toBe("en");
  expect(browserLanguage(["de-DE"])).toBe("en");
  expect(browserLanguage(["fil-PH"])).toBe("en");
  expect(browserLanguage([])).toBe("en");
});

it("resolves the person's choice, then the server default, then the browser", () => {
  expect(resolveLanguage("en", "fi", "fi")).toBe("en");
  expect(resolveLanguage("system", "fi", "en")).toBe("fi");
  expect(resolveLanguage(undefined, "en", "fi")).toBe("en");
  expect(resolveLanguage("system", "system", "en")).toBe("en");
  expect(resolveLanguage(undefined, undefined, "fi")).toBe("fi");
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
