import { useSyncExternalStore } from "react";

/** The languages the interface is written in. */
export type Language = "fi" | "en";
/** What a person or the server chooses: a language, or the browser's. */
export type LanguageChoice = "system" | Language;

export const languageChoices: readonly LanguageChoice[] = [
  "system",
  "fi",
  "en",
];

export function isLanguageChoice(value: unknown): value is LanguageChoice {
  return value === "system" || value === "fi" || value === "en";
}

/** The browser's language: Finnish for any `fi*` first preference, English
 * for everything else, since English is the language a non-Finnish
 * speaker is likelier to read. Only the first preference counts, so a
 * Swede with Finnish as a fallback gets English. */
export function browserLanguage(
  languages: readonly string[] = typeof navigator === "undefined"
    ? []
    : navigator.languages?.length
      ? navigator.languages
      : [navigator.language],
): Language {
  return /^fi(-|$)/i.test(languages[0] ?? "") ? "fi" : "en";
}

/** The person's choice, then the server default, then the browser. */
export function resolveLanguage(
  personal: LanguageChoice | undefined,
  serverDefault: LanguageChoice | undefined,
  browser: Language = browserLanguage(),
): Language {
  if (personal && personal !== "system") return personal;
  if (serverDefault && serverDefault !== "system") return serverDefault;
  return browser;
}

/** The locale dates and numbers are formatted in. English uses British
 * conventions (day before month, 24-hour clock), closest to Finnish ones. */
export function localeOf(language: Language) {
  return language === "fi" ? "fi-FI" : "en-GB";
}

// The resolved language is a browser observation. Only the language itself
// is remembered, under `nah:language`, so the static landing of the next
// load (public/landing-bootstrap.js) paints in it before the bundle runs.
const storageKey = "nah:language";
const events = new EventTarget();
// "pending" while it is not yet known whether, or as whom, the browser is
// signed in: the language of the last load stays rather than flickering
// through the server default.
let personal: LanguageChoice | "pending" | undefined = "pending";
let serverDefault: LanguageChoice | undefined;
let current: Language = initialLanguage();

function initialLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "fi" || saved === "en") return saved;
  } catch {
    // Storage may be disabled; the browser's language still applies.
  }
  return browserLanguage();
}

function apply() {
  const next =
    personal === "pending" ? current : resolveLanguage(personal, serverDefault);
  if (typeof document !== "undefined") document.documentElement.lang = next;
  try {
    window.localStorage.setItem(storageKey, next);
  } catch {
    // The language still applies to this page.
  }
  if (next === current) return;
  current = next;
  events.dispatchEvent(new Event("change"));
}

/** The server's default, as the gateway told it. */
export function setServerLanguage(choice: LanguageChoice | undefined) {
  serverDefault = choice;
  apply();
}

/** The signed-in person's choice: "pending" until their preferences answer,
 * undefined when nobody is signed in. */
export function setPersonalLanguage(
  choice: LanguageChoice | "pending" | undefined,
) {
  personal = choice;
  apply();
}

export function currentLanguage(): Language {
  return current;
}

function subscribe(callback: () => void) {
  events.addEventListener("change", callback);
  return () => events.removeEventListener("change", callback);
}

/** The language the interface is in now; rerenders when it changes. */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, currentLanguage, currentLanguage);
}

/** English must supply what Finnish does, with the same shape: a missing,
 * extra or differently typed message is a compile error. */
export type Messages<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends (...args: infer A) => infer R
      ? (...args: A) => R
      : T[K] extends object
        ? Messages<T[K]>
        : never;
};

/** One module's messages in both languages. Finnish defines the keys. */
export type Catalog<T> = Readonly<Record<Language, T>>;

export function catalog<T extends object>(fi: T, en: Messages<T>): Catalog<T> {
  return { fi, en: en as unknown as T };
}

/** The catalog in the current language, rerendering on a change. */
export function useText<T>(messages: Catalog<T>): T {
  return messages[useLanguage()];
}

/** The catalog in the current language, for code outside a render. A
 * component that renders what it returns calls `useLanguage` (or
 * `useText`) itself, so it rerenders when the language changes. */
export function textNow<T>(messages: Catalog<T>): T {
  return messages[current];
}

/** The catalog read in whatever language is current when a message is
 * read, for a module that names its messages once at the top. The frame
 * rerenders the whole tree when the language changes (App, and each page
 * that stands alone, call `useLanguage`), so a render reads the new one. */
export function liveText<T extends object>(messages: Catalog<T>): T {
  return new Proxy({} as T, {
    get: (_target, key) => messages[current][key as keyof T],
  });
}

/** Picks a form by the language's plural rule. */
export function plural(
  language: Language,
  n: number,
  forms: { one: string; other: string },
): string {
  return new Intl.PluralRules(language).select(n) === "one"
    ? forms.one
    : forms.other;
}

/** A number in the current language's notation. */
export function formatNumber(
  n: number,
  options?: Intl.NumberFormatOptions,
  language: Language = current,
): string {
  return new Intl.NumberFormat(localeOf(language), options).format(n);
}

/** A date or time in the current language's notation. */
export function formatDate(
  date: Date | number,
  options: Intl.DateTimeFormatOptions,
  language: Language = current,
): string {
  return new Intl.DateTimeFormat(localeOf(language), options).format(date);
}

/** Resets the module's state between tests. */
export function resetLanguageForTests(language: Language = "fi") {
  personal = "pending";
  serverDefault = undefined;
  current = language;
  events.dispatchEvent(new Event("change"));
}
