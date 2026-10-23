import { useState } from "react";
import { useNavigate } from "react-router";
import { ArchiveNotice } from "../components/ArchiveNotice";
import { trashHref, trashPlace } from "../components/WorkspaceTrash";
import { refusalText } from "./trashText";
import type { DeletionOutcome } from "./WorkspaceDeletion";
import { restoreTrashEntry, WorkspaceTrashError } from "./workspaceTrash";

const kept = {
  changed_after_check:
    "se muuttui tarkistuksen jälkeen, joten se jäi roskakoriin",
  process_inside: "prosessi käytti sitä, joten se jäi roskakoriin",
  fetch_failed: "etärepoa ei voitu hakea, joten se jäi roskakoriin",
} as const;

/** After a deletion: undo from the Trash, or say where it went. */
export function TrashNotice({
  outcome,
  note,
  csrf,
  refresh,
  onClose,
}: {
  outcome: DeletionOutcome;
  /** What else changed, such as the frame becoming single-workspace mode. */
  note?: string;
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
    label: trashPlace,
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
        message="Poistettu pysyvästi"
        title={name}
        detail={
          [
            outcome.remote
              ? `Sen saa takaisin kloonaamalla ${outcome.remote}.`
              : undefined,
            note,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        wrap={!!note}
        busy={false}
        onClose={onClose}
      />
    );
  const inside = result.processes_inside?.[0];
  const detail =
    result.state === "partial"
      ? "osa jäi roskakoriin; poista se sieltä uudelleen"
      : result.state === "replaced"
        ? `roskakoriin siirtyi eri hakemisto (${entry}); palauta se sieltä`
        : result.kept_reason
          ? kept[result.kept_reason]
          : inside
            ? `${inside.comm ?? `PID ${inside.pid}`} on yhä sen hakemistossa`
            : undefined;
  // Something did not go as asked: the notice stays until closed.
  const sticky = result.state !== "trashed" || !!result.kept_reason;
  return (
    <ArchiveNotice
      message={
        result.state === "trashed"
          ? "Siirretty roskakoriin"
          : "Ei poistettu kokonaan:"
      }
      title={name}
      busy={busy}
      problem={problem || (sticky ? detail : undefined)}
      detail={
        [sticky ? undefined : detail, note].filter(Boolean).join(" · ") ||
        undefined
      }
      onRestore={restore}
      link={place}
      wrap={!!note}
      onClose={onClose}
    />
  );
}
