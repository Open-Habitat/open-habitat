import { formatDate, liveText } from "../i18n";
import { scheduledWakeText } from "../text/scheduledWake";

const txt = liveText(scheduledWakeText);

const clock = (d: Date) =>
  formatDate(d, { hour: "numeric", minute: "2-digit" });
const day = (d: Date, year: boolean) =>
  formatDate(d, {
    day: "numeric",
    month: "numeric",
    ...(year ? { year: "numeric" } : {}),
  });
const dayIndex = (d: Date) =>
  Math.floor(
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 864e5,
  );

/** The rail row's short wake time in the browser's zone: the time today,
 * the weekday and time within the coming week, the date and time beyond
 * (round 1, direction 1 Aika rivillä). */
export function wakeShort(at: number, now: number): string {
  const d = new Date(at);
  const days = dayIndex(d) - dayIndex(new Date(now));
  if (days === 0) return clock(d);
  if (days > 0 && days < 7) return `${txt.weekdays[d.getDay()]} ${clock(d)}`;
  return `${day(d, d.getFullYear() !== new Date(now).getFullYear())} ${clock(d)}`;
}

/** The full wake time: weekday, date and time, the year when it is not this
 * year's. */
export function wakeFull(at: number, now = Date.now()): string {
  const d = new Date(at);
  return txt.full(
    txt.weekdays[d.getDay()],
    day(d, d.getFullYear() !== new Date(now).getFullYear()),
    clock(d),
  );
}

/** A datetime-local input's value for the time, in the browser's zone. */
export function localInput(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
