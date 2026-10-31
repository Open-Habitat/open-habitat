import { syncedTime } from "../app/integrations";
import { textNow, useText } from "../i18n";
import { restartNoticeText } from "../text/restartNotice";
import { Icon, type IconName } from "./Icon";

/** When and why the conversation's Pi stopped, as the daemon saw it. */
export type RestStop = {
  cause: "idle" | "room" | "person" | "crash" | "restart";
  at: string;
  /** Typing woke Pi and it is ready for the message. */
  awake?: boolean;
};
export type RestRunState =
  | "merged"
  | "not_merged"
  | "failed"
  | "cancelled"
  | "awaiting"
  | "stalled";
export type RestartNotice = {
  stopped?: RestStop;
  /** Habitat woke the agent itself because what it waited for ended. */
  woke?: "settled" | "cut_off";
  /** The turn Pi was working on never finished. */
  interrupted_turn?: boolean;
  processes: { process_id: string; name: string }[];
  runs: {
    run_id: string;
    title: string;
    state: RestRunState;
    summary?: string;
    ended_at?: string;
    branch?: string;
  }[];
  still_running: {
    run_id: string;
    title: string;
    created_at?: string;
    waited?: boolean;
  }[];
};

const runIcon: Record<RestRunState, IconName> = {
  merged: "merge",
  not_merged: "warning",
  failed: "cross",
  cancelled: "cross",
  awaiting: "question",
  stalled: "warning",
};

/** The card's first sentence: Habitat's account of the stop. */
export function stopSentence(
  stop: RestStop,
  cutOff: number,
  turnCut = false,
): string {
  const txt = textNow(restartNoticeText);
  const at = syncedTime(stop.at);
  const cut =
    [turnCut ? txt.turnCut : "", cutOff > 0 ? txt.cutOff(cutOff) : ""].join(
      "",
    ) || txt.nothingCut;
  return txt.stop[stop.cause](at, cut);
}

/** Where a resting conversation's wake stands, as the card's last line. */
export type WakeState = "asleep" | "waking" | "awake" | "refused";

/** Habitat's own report of a rest (Kortti): before the wake at the end of the
 * conversation, and afterwards in history as the catch-up the agent got with
 * the person's message. Written by the host, never by the agent. */
export function RestCard({
  stop,
  notice,
  wake,
  refusal,
  wokeAt,
  unavailable = false,
}: {
  stop: RestStop;
  notice?: RestartNotice;
  /** Before the wake; absent for the history marker. */
  wake?: WakeState;
  /** Why a refused wake would be refused on send too, in words. */
  refusal?: string;
  /** The history marker: when the person's message woke the agent. */
  wokeAt?: string;
  /** Taskfleet could not be fully read: no claim that nothing else settled. */
  unavailable?: boolean;
}) {
  const txt = useText(restartNoticeText);
  const marker = !wake;
  const runs = notice?.runs ?? [];
  const working = notice?.still_running ?? [];
  const cut = notice?.processes ?? [];
  const range = wokeAt
    ? `${syncedTime(stop.at)}–${syncedTime(wokeAt).replace(/^.*\b(klo|at) /, "")}`
    : "";
  return (
    <aside
      className={`ah-rest-card${marker ? " ah-rest-marker" : ""}`}
      data-testid={marker ? "rest-marker" : "rest-card"}
      data-wake={wake}
      aria-label={marker ? txt.markerLabel : txt.cardLabel}
    >
      <header className="ah-rest-head">
        <Icon name="moon" />
        <h2 className="ah-rest-title">
          {marker ? txt.rested(range) : txt.resting}
        </h2>
        <span className="ah-rest-author">Habitat</span>
      </header>
      <p className="ah-rest-text">
        {stopSentence(stop, cut.length, !!notice?.interrupted_turn)}
      </p>
      {cut.length ? (
        <p className="ah-rest-text">
          {txt.cutList}
          {cut.map((p) => p.name || p.process_id).join(", ")}
        </p>
      ) : null}
      {runs.length ? (
        <section>
          <h3 className="ah-rest-heading">{txt.endedMeanwhile}</h3>
          <ul className="ah-rest-list">
            {runs.map((run) => (
              <li
                key={run.run_id}
                className="ah-rest-item"
                data-state={run.state}
              >
                <Icon name={runIcon[run.state]} className="ah-rest-icon" />
                <div>
                  <strong>{run.title || run.run_id}</strong>{" "}
                  <span className="ah-rest-meta">
                    {[
                      txt.runState[run.state],
                      run.branch ? txt.branchKept : "",
                      run.ended_at ? syncedTime(run.ended_at) : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {run.summary ? (
                    <p className="ah-rest-summary">{run.summary}</p>
                  ) : null}
                  {run.branch ? (
                    <code className="ah-rest-branch">{run.branch}</code>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {working.length ? (
        <section>
          <h3 className="ah-rest-heading">{txt.stillRunning}</h3>
          <ul className="ah-rest-list">
            {working.map((run) => (
              <li
                key={run.run_id}
                className="ah-rest-item"
                data-state="working"
              >
                <span className="ah-rest-dot" aria-hidden="true" />
                <div>
                  <strong>{run.title || run.run_id}</strong>{" "}
                  <span className="ah-rest-meta">
                    {[
                      run.created_at
                        ? txt.runningSince(syncedTime(run.created_at))
                        : txt.running,
                      marker || run.waited ? txt.waitCut : txt.nobodyWaits,
                    ].join(" · ")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {unavailable ? (
        <p className="ah-rest-text ah-rest-meta" data-testid="rest-unavailable">
          {txt.unavailable}
        </p>
      ) : null}
      <p className="ah-rest-wake" role={marker ? undefined : "status"}>
        {marker ? (
          <>
            <Icon name="check" />
            {txt.woke(
              !!notice?.woke,
              wokeAt ? ` ${syncedTime(wokeAt)}` : "",
              notice?.woke ? txt.wokeBecause[notice.woke] : "",
            )}
          </>
        ) : (
          <>
            <Icon name="moon" />
            {wake === "refused" && refusal
              ? txt.refusedBecause(refusal)
              : txt.wake[wake]}
          </>
        )}
      </p>
    </aside>
  );
}

/** The person's view of the catch-up Habitat gives the agent after Pi was
 * started again; the agent's own text stays out of the conversation view. */
export function RestartNoticeMarker({
  notice,
  timestamp,
}: {
  notice: RestartNotice;
  timestamp?: string;
}) {
  const txt = useText(restartNoticeText);
  if (notice.stopped)
    return (
      <RestCard stop={notice.stopped} notice={notice} wokeAt={timestamp} />
    );
  // A catch-up written before Habitat named the stop.
  const cut = notice.processes.map((p) => p.name || p.process_id).join(", ");
  const running = notice.still_running
    .map((r) => r.title || r.run_id)
    .join(", ");
  return (
    <aside
      className="ah-pi-marker ah-restart-notice"
      role="note"
      data-testid="restart-notice"
    >
      <span>{txt.restarted}</span>
      {notice.processes.length ||
      notice.runs.length ||
      notice.still_running.length ? (
        <ul>
          {notice.processes.length ? (
            <li>
              {txt.cutList}
              {cut}
            </li>
          ) : null}
          {notice.runs.map((run) => (
            <li key={run.run_id}>
              {run.title || run.run_id}: {txt.runState[run.state]}
            </li>
          ))}
          {notice.still_running.length ? (
            <li>{txt.stillRunningCut(running)}</li>
          ) : null}
        </ul>
      ) : null}
    </aside>
  );
}
