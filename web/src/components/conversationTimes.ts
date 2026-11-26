// Times in a conversation (conversation-times, experimental; Jari
// 24.–26.11.2026): a day separator where the date changes, the saved time
// right after each message's name, and a turn's duration only where no work
// row already says it. Every time is native history's own entry timestamp
// in the browser's time zone; nothing is guessed from neighbours.

import { currentLanguage, formatDate, liveText } from "../i18n";
import { conversationTimesText } from "../text/conversationTimes";

const txt = liveText(conversationTimesText);

/** A turn shorter than this shows no duration, however it ended. */
export const LONG_TURN_SECONDS = 300;

/** "16.40" in Finnish, "16:40" in English, in the browser's zone. */
export function messageClock(ms: number, timeZone?: string): string {
  return formatDate(ms, { hour: "numeric", minute: "2-digit", timeZone });
}

/** The full moment, for a time's title. */
export function messageMoment(ms: number, timeZone?: string): string {
  return formatDate(ms, { dateStyle: "short", timeStyle: "medium", timeZone });
}

/** The calendar day of a moment in the zone, as a day count. Two moments
 * fall on the same day exactly when their counts are equal. */
export function localDay(ms: number, timeZone?: string): number {
  // The browser's own zone needs no formatter: a long history asks once per
  // entry on every render.
  if (timeZone === undefined) {
    const d = new Date(ms);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5;
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ms);
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day")) / 864e5;
}

/** Which word a day separator uses for the day of `ms`, seen on `now`. */
export function dayKind(
  ms: number,
  now: number,
  timeZone?: string,
): "today" | "yesterday" | "earlier" {
  const diff = localDay(now, timeZone) - localDay(ms, timeZone);
  return diff === 0 ? "today" : diff === 1 ? "yesterday" : "earlier";
}

/** "Pe 20.11." / "Fri 20 Nov" for a day before yesterday; the year joins
 * when it is not the current one. */
export function earlierDay(ms: number, now: number, timeZone?: string): string {
  const year = (t: number) =>
    formatDate(t, { year: "numeric", timeZone }, "en");
  const label = formatDate(ms, {
    weekday: "short",
    day: "numeric",
    // "pe 20.11." in Finnish, "Fri 20 Nov" in English.
    month: currentLanguage() === "fi" ? "numeric" : "short",
    ...(year(ms) === year(now) ? {} : { year: "numeric" }),
    timeZone,
  }).replace(",", "");
  return label.charAt(0).toLocaleUpperCase() + label.slice(1);
}

/** The day separator's words for the day of `ms`, seen on `now`. */
export function dayLabel(ms: number, now: number, timeZone?: string): string {
  const kind = dayKind(ms, now, timeZone);
  return kind === "today"
    ? txt.today
    : kind === "yesterday"
      ? txt.yesterday
      : earlierDay(ms, now, timeZone);
}

/** "48 min", "1 t 12 min": a turn's whole minutes. */
export function minutesLabel(minutes: number): string {
  return minutes < 60
    ? txt.minutes(minutes)
    : txt.hours(Math.floor(minutes / 60), minutes % 60);
}

/**
 * The duration a settled turn shows, in whole minutes, or undefined when it
 * shows none (Jari 26.11.2026, B Vain uusi tieto). Only a turn of two or
 * more stages over five minutes shows one: in a single-stage turn its work
 * row already is the turn's duration. A stopped or restart-cut turn follows
 * the same rule, measured to its aborted entry. Rounded down, so it never
 * says more than the work rows.
 */
export function turnMinutes({
  startedAt,
  endedAt,
  stages,
}: {
  /** When native history saved the message that started the turn. */
  startedAt?: number;
  /** The final reply's, or the aborted entry's, saved time. */
  endedAt?: number;
  stages: number;
}): number | undefined {
  if (startedAt === undefined || endedAt === undefined || stages < 2)
    return undefined;
  const seconds = (endedAt - startedAt) / 1000;
  if (!(seconds >= LONG_TURN_SECONDS)) return undefined;
  return Math.floor(seconds / 60);
}
