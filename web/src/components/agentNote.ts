import type { AnswerLanguage } from "../app/answerLanguage";

// The note's pure parts: which questions are asked, how the person's own
// words are tidied, and the Markdown the answers make.

export type NoteQuestion = "lang" | "style" | "ask" | "own" | "tidy";

/** The answers so far. `own` is exactly what will be written. */
export type NoteAnswers = {
  lang?: AnswerLanguage;
  style?: number;
  ask?: number;
  own?: string;
};

/** A4.1 Keskustelu: the language first, the person's own words last. An
 * existing note is not asked the language: its text already names one, and
 * a new sentence could contradict it. */
export function noteQuestions(existing: boolean): NoteQuestion[] {
  return existing ? ["style", "ask", "own"] : ["lang", "style", "ask", "own"];
}

/** Capitals at sentence and line starts, a standalone English "i", and a
 * full stop at the end of a line that has none. Nothing else changes: the
 * words, their order and the line breaks stay the person's. */
export function tidyOwnWords(raw: string): string {
  return raw
    .trim()
    .split("\n")
    .map((line) => {
      let s = line.trim().replace(/[ \t]+/g, " ");
      if (!s) return s;
      s = s.replace(/(^|\s)i(?=\s|'|$)/g, "$1I");
      s = s.replace(
        /(^|[.!?]\s+)(\p{Ll})/gu,
        (_, a: string, b: string) => a + b.toUpperCase(),
      );
      return /[.!?:;)"”»]$/.test(s) || /^[-*#>]/.test(s) ? s : `${s}.`;
    })
    .join("\n");
}

/** The words the note is made of, in the interface language. */
export type NoteWords = {
  title: string;
  titleAdded: string;
  me: (name: string) => string;
  own: string;
  langLine: Record<AnswerLanguage, string>;
  style: { prose: string }[];
  ask: { prose: string }[];
};

/** Exactly what would be written: free-form Markdown, the person's own
 * words under their own heading so a later edit by an agent leaves them be.
 * An existing note is kept as it is and the new part follows it. */
export function noteText(
  w: NoteWords,
  a: NoteAnswers,
  name: string,
  existing?: string,
): string {
  const lines = [
    existing === undefined && name.trim() ? w.me(name.trim()) : "",
    [
      existing === undefined && a.lang ? w.langLine[a.lang] : "",
      a.style === undefined ? "" : (w.style[a.style]?.prose ?? ""),
    ]
      .filter(Boolean)
      .join(" "),
    a.ask === undefined ? "" : (w.ask[a.ask]?.prose ?? ""),
    a.own ? `${w.own}\n\n${a.own}` : "",
  ].filter(Boolean);
  if (existing === undefined) return `${[w.title, ...lines].join("\n\n")}\n`;
  if (!lines.length) return existing;
  // The old text stays byte for byte; only a separating blank line is added.
  const gap =
    existing === "" || existing.endsWith("\n\n")
      ? ""
      : existing.endsWith("\n")
        ? "\n"
        : "\n\n";
  return `${existing}${gap}${[w.titleAdded, ...lines].join("\n\n")}\n`;
}
