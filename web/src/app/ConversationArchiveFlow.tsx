import { type ReactNode, useEffect, useState } from "react";
import {
  type ArchiveRow,
  archiveTraces,
  ConversationArchiveList,
} from "../components/ConversationArchive";
import { useText } from "../i18n";
import { conversationArchiveText } from "../text/conversationArchive";
import { readSpinoffs, type Spinoff } from "./spinoffs";

export type ArchiveEntry = Omit<ArchiveRow, "traces">;

/** Each archived conversation's own Taskfleet runs, read once per
 * conversation while the archive is open. A failed read leaves the row
 * without marks; it is a view of Taskfleet, not an inventory of its own. */
function useArchivedRuns(ids: readonly string[], binding: string | undefined) {
  const [runs, setRuns] = useState<{
    binding?: string;
    byId: ReadonlyMap<string, Spinoff[]>;
  }>({ byId: new Map() });
  const key = ids.join(" ");
  useEffect(() => {
    const controller = new AbortController();
    const wanted = key ? key.split(" ") : [];
    for (const id of wanted)
      void readSpinoffs(
        id,
        null,
        AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
      )
        .then((reply) => {
          if (controller.signal.aborted) return;
          setRuns((old) => {
            const byId = new Map(old.binding === binding ? old.byId : []);
            byId.set(id, reply.runs);
            return { binding, byId };
          });
        })
        .catch(() => {});
    return () => controller.abort();
  }, [key, binding]);
  return runs.binding === binding ? runs.byId : new Map<string, Spinoff[]>();
}

/** The workspace page's archive: the list, its marks and the restore's
 * quiet outcome. */
export function WorkspaceArchive({
  entries,
  count,
  binding,
  open,
  helpers,
  onRestore,
  children,
}: {
  entries: ArchiveEntry[];
  count: number | string;
  /** The session the reads belong to. */
  binding: string | undefined;
  /** The archive is open: only then are its runs read. */
  open: boolean;
  /** Named helpers are on: their marks show. */
  helpers: boolean;
  /** Restores the conversation; `confirmed` runs once the host confirms. */
  onRestore: (id: string, confirmed: () => void) => void;
  children?: ReactNode;
}) {
  const t = useText(conversationArchiveText);
  const runs = useArchivedRuns(open ? entries.map((e) => e.id) : [], binding);
  const [restored, setRestored] = useState<string>();
  // The list is relative to the day it is shown; a minute is close enough.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const rows = entries.map((e) => ({
    ...e,
    traces: archiveTraces(runs.get(e.id) ?? [], helpers, t),
  }));
  return (
    <ConversationArchiveList
      rows={rows}
      count={count}
      now={now}
      onRestore={(row) => {
        setRestored(undefined);
        const helped = row.traces.some((x) => x.key.startsWith("helper:"));
        onRestore(row.id, () => setRestored(t.restored(row.title, helped)));
      }}
    >
      {children}
      {restored ? (
        <p
          role="status"
          className="ah-archive-status"
          data-testid="archive-restored"
        >
          {restored}
        </p>
      ) : null}
    </ConversationArchiveList>
  );
}
