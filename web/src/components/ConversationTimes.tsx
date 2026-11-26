import { useLanguage } from "../i18n";
import { dayLabel, messageClock, messageMoment } from "./conversationTimes";
import "./ConversationTimes.css";

/**
 * A message's saved time right after its name ("Sinä 16.40", "✓ Vastaus
 * valmis 17.03 · vuoro kesti 48 min"), with the full moment in its title.
 * Any message header in the conversation uses it, so every card reads as
 * one sentence: who, when, and in a long turn how long.
 */
export function MessageTime({ at, took }: { at: number; took?: string }) {
  useLanguage();
  const time = new Date(at);
  return (
    <span className="ah-message-when" data-testid="message-time">
      <time dateTime={time.toISOString()} title={messageMoment(at)}>
        {messageClock(at)}
      </time>
      {took ? (
        <span className="ah-message-took" data-testid="turn-took">
          {` · ${took}`}
        </span>
      ) : null}
    </span>
  );
}

/** Where the date changes between turns: Tänään, Eilen or the date. The
 * word is read as text in the conversation's list; the hairlines beside it
 * are decoration. */
export function DaySeparator({ at }: { at: number }) {
  useLanguage();
  return (
    <div className="ah-day-separator" data-testid="day-separator">
      <time dateTime={new Date(at).toISOString()}>
        {dayLabel(at, Date.now())}
      </time>
    </div>
  );
}
