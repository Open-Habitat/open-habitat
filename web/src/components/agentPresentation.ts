/** Derive UI channels only from observed host facts, never from translated labels. */
export interface AgentFacts {
  process: string;
  control?: string;
  history?: string;
  command?: string;
  connectionLost?: boolean;
  /** Explicit local close, not a process exit or interrupted turn. */
  intentionallyClosed?: boolean;
  pendingQuestion?: boolean;
  /** Only a confirmed native event and its visited marker can set attention. */
  attention?: "new" | "seen";
}

export interface AgentPresentation {
  activity: "working" | "waiting" | "closed" | "unknown";
  activityLabel: string;
  activityShortLabel: string;
  controlLabel: string;
  attentionLabel?: string;
  operationLabel?: string;
  running: boolean;
}

export function agentPresentation(facts: AgentFacts): AgentPresentation {
  const running =
    facts.process === "daemon_managed_live" ||
    facts.process === "terminal_observed_live";
  // A live process is not proof of an active turn. An accepted command is.
  const working =
    running &&
    facts.command === "accepted" &&
    !facts.pendingQuestion &&
    !facts.connectionLost;
  const waiting =
    running && (facts.pendingQuestion || facts.command === "idle");
  const activity = facts.intentionallyClosed
    ? "closed"
    : working
      ? "working"
      : waiting
        ? "waiting"
        : "unknown";
  const activityLabel = facts.intentionallyClosed
    ? "Valmis"
    : working
      ? "Työskentelee"
      : waiting
        ? "Odottaa sinua"
        : "Tila ei tiedossa";
  const operationLabel = facts.connectionLost
    ? "Yhteys poikki"
    : facts.command === "uncertain"
      ? "Lähetys epävarma"
      : facts.command === "rejected"
        ? "Viesti hylättiin"
        : facts.command === "pending"
          ? "Odottaa kuittausta"
          : facts.command === "stopping"
            ? "Pysäytetään"
            : undefined;
  return {
    activity,
    activityLabel,
    activityShortLabel: facts.intentionallyClosed
      ? "valmis"
      : working
        ? "työssä"
        : waiting
          ? "odottaa"
          : "Tila ei tiedossa",
    controlLabel:
      facts.control === "read_only"
        ? "Vain luku"
        : facts.control === "unavailable"
          ? "Ohjaus ei saatavilla"
          : facts.control === "unknown"
            ? "Ohjaus ei tiedossa"
            : "",
    attentionLabel: facts.attention === "new" ? "Uusi" : undefined,
    operationLabel,
    running,
  };
}
