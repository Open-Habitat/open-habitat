/** Derive UI channels only from observed host facts, never from translated labels. */
export interface WaitingOn {
  spinoff?: import("../app/processes").ProcessSpinoff[];
  process_id: string;
  name: string;
  kind: "process" | "taskfleet_wait";
  run_ids: string[];
}
export interface AgentFacts {
  runActive?: boolean;
  waitingOn?: WaitingOn[];
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
  activity: "working" | "waiting" | "waiting_background" | "closed" | "unknown";
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
  // Pi-started runs (including wake-ups) are authoritative; old hosts use command state.
  const working =
    running &&
    (facts.runActive ?? facts.command === "accepted") &&
    !facts.pendingQuestion &&
    !facts.connectionLost;
  const waiting =
    running &&
    (facts.pendingQuestion ||
      facts.runActive === false ||
      facts.command === "idle");
  // A background process and a Taskfleet worker are one state for the
  // person: the agent continues by itself, nothing is asked of them.
  const background =
    running &&
    !working &&
    !facts.pendingQuestion &&
    !facts.connectionLost &&
    facts.runActive !== true &&
    !!facts.waitingOn?.length;
  const backgroundLabel = "Odottaa taustatyötä";
  const activity = facts.intentionallyClosed
    ? "closed"
    : working
      ? "working"
      : background
        ? "waiting_background"
        : waiting
          ? "waiting"
          : "unknown";
  const activityLabel = facts.intentionallyClosed
    ? "Valmis"
    : working
      ? "Työskentelee"
      : background
        ? backgroundLabel
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
        : background
          ? backgroundLabel
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

export function waitingName(item: WaitingOn): string {
  return item.kind === "taskfleet_wait" && item.spinoff?.length
    ? item.spinoff.map((run) => run.title || run.run_id).join(", ")
    : item.name;
}

/** Whether a background wait includes a Taskfleet worker (`run wait`). */
export function waitsOnWorker(waitingOn: WaitingOn[] | undefined): boolean {
  return !!waitingOn?.some((item) => item.kind === "taskfleet_wait");
}
