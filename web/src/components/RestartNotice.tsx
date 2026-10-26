export type RestartNotice = {
  processes: { process_id: string; name: string }[];
  runs: {
    run_id: string;
    title: string;
    state:
      | "merged"
      | "not_merged"
      | "failed"
      | "cancelled"
      | "awaiting"
      | "stalled";
  }[];
  still_running: { run_id: string; title: string }[];
};

// Each is Taskfleet's own report. A stall is Taskfleet's verdict about a
// supervisor, which a live worker can contradict, so it is attributed.
const runState: Record<RestartNotice["runs"][number]["state"], string> = {
  merged: "valmis ja yhdistetty",
  not_merged: "valmis, ei yhdistetty",
  failed: "epäonnistui",
  cancelled: "peruttu",
  awaiting: "odottaa sinua",
  stalled: "Taskfleetin mukaan pysähtynyt",
};

/** The person's view of the catch-up Habitat gives the agent after Pi was
 * started again; the agent's own text stays out of the conversation view. */
export function RestartNoticeMarker({ notice }: { notice: RestartNotice }) {
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
      <span>Agentti käynnistettiin uudelleen</span>
      {notice.processes.length ||
      notice.runs.length ||
      notice.still_running.length ? (
        <ul>
          {notice.processes.length ? (
            <li>Katkenneet taustatyöt: {cut}</li>
          ) : null}
          {notice.runs.map((run) => (
            <li key={run.run_id}>
              {run.title || run.run_id}: {runState[run.state]}
            </li>
          ))}
          {notice.still_running.length ? (
            <li>Yhä käynnissä, odotus katkesi: {running}</li>
          ) : null}
        </ul>
      ) : null}
    </aside>
  );
}
