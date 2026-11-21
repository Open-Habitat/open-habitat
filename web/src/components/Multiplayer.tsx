import "./Multiplayer.css";
import { createContext, type ReactNode, useContext, useState } from "react";
import { initials, personHue } from "../app/multiplayer";
import { useText } from "../i18n";
import { multiplayerText } from "../text/multiplayer";

// The pieces of a shared conversation (ADR 0038) that every view draws the
// same way: a person's avatar with their colour, a participant's attributed
// message and Habitat's lines. What they say comes from the daemon's typed
// history facts; nothing here decides who wrote what.

/** The subject of the person viewing, when it is not the conversation's
 * owner: their own messages then say "Sinä". */
export const SharedViewer = createContext<string | undefined>(undefined);

export type ParticipantMessageFact = {
  message_id: string;
  subject: string;
  display_name: string;
  role: "participant" | "full_rights";
  text: string;
};
export type ConversationLineFact = {
  line_id: string;
  kind: "membership" | "continue" | "declined";
  event?: "joined" | "full_rights_given" | "full_rights_taken" | "removed";
  mode?: "tools" | "approve_each";
  request?: string;
  subject: string;
  display_name: string;
};

const githubAvatar = /^https:\/\/avatars\.githubusercontent\.com\//;

export function PersonAvatar({
  subject,
  name,
  avatarUrl,
  presence,
}: {
  subject: string;
  name: string;
  avatarUrl?: string;
  /** here: present now; invited: not joined yet (a dashed ring). */
  presence?: "here" | "away" | "invited";
}) {
  const [failed, setFailed] = useState("");
  const picture =
    !!avatarUrl && avatarUrl !== failed && githubAvatar.test(avatarUrl);
  return (
    <span
      className="ah-mp-avatar"
      data-presence={presence}
      style={{ "--ah-mp-hue": personHue(subject) } as React.CSSProperties}
      aria-hidden="true"
    >
      {picture ? (
        /* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Image load failure swaps to the initials. */
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(avatarUrl ?? "")}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function ParticipantMessage({
  fact,
  at,
}: {
  fact: ParticipantMessageFact;
  at?: string;
}) {
  const t = useText(multiplayerText);
  const viewer = useContext(SharedViewer);
  const own = viewer === fact.subject;
  return (
    <article
      className="ah-mp-message"
      data-testid="participant-message"
      data-subject={fact.subject}
      style={{ "--ah-mp-hue": personHue(fact.subject) } as React.CSSProperties}
    >
      <header>
        <PersonAvatar subject={fact.subject} name={fact.display_name} />
        <strong>
          {own ? `${fact.display_name} (${t.you})` : fact.display_name}
        </strong>
        <span className="ah-mp-role" data-role={fact.role}>
          {t.roles[fact.role]}
        </span>
        {at ? <time>{at}</time> : null}
      </header>
      <p className="ah-mp-text">{fact.text}</p>
    </article>
  );
}

export function ConversationLine({ fact }: { fact: ConversationLineFact }) {
  const t = useText(multiplayerText);
  const name = fact.display_name;
  const text =
    fact.kind === "membership"
      ? fact.event
        ? t.lines[fact.event](name)
        : ""
      : fact.kind === "declined"
        ? t.lines.declined(name)
        : fact.mode === "approve_each"
          ? t.lines.continueEach(name)
          : t.lines.continueTools(name);
  return (
    <p
      className="ah-mp-line"
      role="note"
      data-testid="habitat-line"
      data-kind={fact.kind}
      data-event={fact.event}
    >
      <span className="ah-mp-line-mark" aria-hidden="true" />
      {text}
    </p>
  );
}

/** A card in the conversation that only its owner acts on. */
export function SharedCard({
  testId,
  title,
  subtitle,
  children,
  actions,
  tone = "neutral",
}: {
  testId: string;
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  tone?: "neutral" | "attention";
}) {
  return (
    <section
      className="ah-mp-card"
      data-testid={testId}
      data-tone={tone}
      aria-label={title}
    >
      <h3>{title}</h3>
      {subtitle ? <p className="ah-mp-card-sub">{subtitle}</p> : null}
      {children}
      {actions ? <div className="ah-mp-card-actions">{actions}</div> : null}
    </section>
  );
}
