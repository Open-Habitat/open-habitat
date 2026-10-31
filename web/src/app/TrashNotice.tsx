import { useState } from "react";
import { useNavigate } from "react-router";
import { ArchiveNotice } from "../components/ArchiveNotice";
import { trashHref, trashPlace } from "../components/WorkspaceTrash";
import { liveText } from "../i18n";
import { trashNoticeText } from "../text/trashNotice";
import { refusalText } from "./trashText";
import type { DeletionOutcome } from "./WorkspaceDeletion";
import { restoreTrashEntry, WorkspaceTrashError } from "./workspaceTrash";

const txt = liveText(trashNoticeText);

/** After a deletion: undo from the Trash, or say where it went. */
export function TrashNotice({
  outcome,
  csrf,
  refresh,
  onClose,
}: {
  outcome: DeletionOutcome;
  csrf?: string;
  refresh: () => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const { result, name } = outcome;
  const entry = result.entry;
  const place = {
    label: trashPlace(),
    onPress: () => {
      onClose();
      navigate(trashHref);
    },
  };
  const restore =
    entry && csrf && result.state === "trashed"
      ? () => {
          setBusy(true);
          setProblem("");
          void restoreTrashEntry(entry, csrf).then(
            (restored) => {
              refresh();
              onClose();
              if (restored.workspace_id)
                navigate(`/workspaces/${restored.workspace_id}`);
            },
            (e) => {
              setBusy(false);
              setProblem(
                refusalText(
                  e instanceof WorkspaceTrashError ? e.code : "unavailable",
                ),
              );
            },
          );
        }
      : undefined;
  if (result.state === "deleted")
    return (
      <ArchiveNotice
        kind="trash"
        message={txt.deleted}
        title={name}
        detail={outcome.remote ? txt.cloneBack(outcome.remote) : undefined}
        busy={false}
        onClose={onClose}
      />
    );
  const inside = result.processes_inside?.[0];
  const detail =
    result.state === "partial"
      ? txt.partial
      : result.state === "replaced"
        ? txt.replaced(entry ?? "")
        : result.kept_reason
          ? txt.kept[result.kept_reason]
          : inside
            ? txt.stillInside(inside.comm ?? `PID ${inside.pid}`)
            : undefined;
  // Something did not go as asked: the notice stays until closed.
  const sticky = result.state !== "trashed" || !!result.kept_reason;
  return (
    <ArchiveNotice
      kind="trash"
      message={result.state === "trashed" ? txt.trashed : txt.notDeleted}
      title={name}
      busy={busy}
      problem={problem || (sticky ? detail : undefined)}
      detail={sticky ? undefined : detail}
      onRestore={restore}
      link={place}
      onClose={onClose}
    />
  );
}
