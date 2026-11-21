/** The languages the onboarding note offers for the agent's answers. Any
 * other language the person writes on the note themselves. */
export type AnswerLanguage = "fi" | "en" | "sv";
export const answerLanguages: readonly AnswerLanguage[] = ["fi", "en", "sv"];

/** The languages spoken where a time zone is, most common first. Only zones
 * that tell suomi and svenska apart are listed; elsewhere the zone says
 * nothing about these three. */
const zoneLanguages: Readonly<Record<string, readonly AnswerLanguage[]>> = {
  "Europe/Helsinki": ["fi", "sv"],
  "Europe/Mariehamn": ["sv", "fi"],
  "Europe/Stockholm": ["sv", "fi"],
};

const primary = (tag: string) => tag.toLowerCase().split(/[-_]/)[0];
const asAnswer = (tag: string): AnswerLanguage | undefined => {
  const p = primary(tag);
  return p === "fi" || p === "en" || p === "sv" ? p : undefined;
};

/** The answer language the note preselects (issue
 * new-user-agent-instructions-template, Jari 21.11.2026: guess it from the
 * computer's locale settings and time zone). The rule, in order:
 *
 * 1. Where the time zone names local languages (Helsinki: suomi, svenska;
 *    Mariehamn and Stockholm: svenska, suomi), the first of them the
 *    browser's language list names wins: a Finnish speaker in Helsinki gets
 *    suomi, a Swedish-speaking Finn svenska, a Finn in Stockholm suomi.
 * 2. In such a zone with neither in the browser's list, the zone's first
 *    language wins, unless the person chose English as Habitat's language
 *    themselves: many Finns run an English computer, but someone who also
 *    picked English here means it.
 * 3. Elsewhere, the first of the three in the browser's language list.
 * 4. Otherwise Habitat's interface language.
 *
 * Only a default: the person changes it with one tap. */
export function guessAnswerLanguage({
  languages,
  timeZone,
  ui,
  uiChosen,
}: {
  /** navigator.languages, most preferred first. */
  languages: readonly string[];
  /** Intl.DateTimeFormat().resolvedOptions().timeZone. */
  timeZone: string | undefined;
  /** Habitat's interface language now. */
  ui: "fi" | "en";
  /** Whether the person chose Habitat's language rather than "system". */
  uiChosen: boolean;
}): AnswerLanguage {
  const listed = languages
    .map(asAnswer)
    .filter((l): l is AnswerLanguage => l !== undefined);
  const local = (timeZone && zoneLanguages[timeZone]) || [];
  if (local.length) {
    const named = listed.find((l) => local.includes(l));
    if (named) return named;
    return uiChosen && ui === "en" ? "en" : local[0];
  }
  return listed[0] ?? ui;
}

/** The guess from this browser. */
export function browserAnswerLanguage(
  ui: "fi" | "en",
  uiChosen: boolean,
): AnswerLanguage {
  let timeZone: string | undefined;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {}
  const languages =
    typeof navigator === "undefined"
      ? []
      : navigator.languages?.length
        ? navigator.languages
        : [navigator.language];
  return guessAnswerLanguage({ languages, timeZone, ui, uiChosen });
}
