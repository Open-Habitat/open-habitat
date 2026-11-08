import type { CompactionNotice as Notice } from "../app/compactionNotice";
import { useText } from "../i18n";
import { contextViewText } from "../text/contextView";

/** At the end of the conversation: the agent compacts now, or why the last
 * compaction did not happen, in the same words as the context page. */
export function CompactionNotice({ notice }: { notice: Notice }) {
  const t = useText(contextViewText);
  return (
    <p
      className="ah-session-settings ah-compaction-notice"
      data-testid="compaction-notice"
      data-state={notice.kind}
      role="status"
    >
      {notice.kind === "running" ? (
        <>
          <span className="ah-compaction-spin" aria-hidden="true" />
          <span>{t.compacting}</span>
        </>
      ) : (
        <span>{t.outcome[notice.reason]}</span>
      )}
    </p>
  );
}
