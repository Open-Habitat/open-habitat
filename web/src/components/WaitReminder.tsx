/** The runs Habitat's turn-end reminder named: the conversation's own
 * Taskfleet runs still working with nothing waiting for them. */
export type WaitReminder = {
  runs: { run_id: string; title: string }[];
  more?: number;
};

/** The person's view of the reminder Habitat gives the agent when a turn ends
 * with its workers unwaited; the agent's own text stays out of the view. */
export function WaitReminderMarker({ reminder }: { reminder: WaitReminder }) {
  const count = reminder.runs.length + (reminder.more ?? 0);
  return (
    <aside
      className="ah-pi-marker ah-restart-notice"
      role="note"
      data-testid="wait-reminder"
    >
      <span>
        {count === 1
          ? "Habitat muistutti agenttia: kukaan ei odota workeria"
          : `Habitat muistutti agenttia: kukaan ei odota ${count} workeria`}
      </span>
      <ul>
        {reminder.runs.map((run) => (
          <li key={run.run_id}>{run.title || run.run_id}</li>
        ))}
        {reminder.more ? <li>ja {reminder.more} muuta</li> : null}
      </ul>
    </aside>
  );
}
