import { useCallback, useEffect, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import {
  WorktreeCleanDialog,
  WorktreeList,
  WorktreeRemoveDialog,
  worktreeKey,
} from "../components/WorktreeList";
import { WorkspaceTrashError } from "./workspaceTrash";
import {
  cleanMergedWorktrees,
  type WorktreeList as Listing,
  listWorktrees,
  removeWorktree,
  type Worktree,
  type WorktreeBlocker,
  type WorktreeDisposal,
} from "./workspaceWorktrees";
import { plainBlocker, removedText, worktreeRefusalText } from "./worktreeText";

const problemOf = (e: unknown) =>
  worktreeRefusalText(
    e instanceof WorkspaceTrashError ? e.code : "unavailable",
  );

/** The worktree list of one workspace (its page) or of all of them
 * (Asetukset › Tallennustila), with removal. Every listing reads Git again. */
export function WorktreeCleanup({
  csrf,
  workspaceId,
  hideWhenEmpty = false,
  onChanged,
}: {
  csrf: string;
  /** Without it, every Git workspace's worktrees are listed. */
  workspaceId?: string;
  /** The workspace page shows the section only when there is something. */
  hideWhenEmpty?: boolean;
  /** Something was removed: storage and the workspace list may differ. */
  onChanged?: () => void;
}) {
  const [listing, setListing] = useState<Listing>();
  const [loadProblem, setLoadProblem] = useState("");
  const [read, setRead] = useState(0);
  const [busy, setBusy] = useState<string>();
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<{
    worktree: Worktree;
    disposal: WorktreeDisposal;
  }>();
  const [problem, setProblem] = useState("");
  const [blockers, setBlockers] = useState<WorktreeBlocker[]>();
  const [cleanOpen, setCleanOpen] = useState(false);
  const reload = useCallback(() => setRead((n) => n + 1), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: read explicitly asks for a fresh listing.
  useEffect(() => {
    const controller = new AbortController();
    void listWorktrees(csrf, workspaceId, controller.signal).then(
      (value) => {
        if (controller.signal.aborted) return;
        setListing(value);
        setLoadProblem("");
      },
      (e) => {
        if (!controller.signal.aborted) setLoadProblem(problemOf(e));
      },
    );
    return () => controller.abort();
  }, [csrf, workspaceId, read]);
  const worktrees = listing?.worktrees ?? [];
  const merged = worktrees.filter(
    (w) => w.state === "merged" && w.actions.includes("remove"),
  );
  const run = (
    worktree: Worktree,
    disposal: WorktreeDisposal,
    typed?: string,
  ) => {
    setBusy(worktreeKey(worktree));
    setProblem("");
    setBlockers(undefined);
    void removeWorktree(worktree, disposal, csrf, typed)
      .then(
        (result) => {
          if (result.state === "blocked") {
            if (open) setBlockers(result.blockers ?? []);
            else setStatus(removedText(worktree, result));
            return;
          }
          setOpen(undefined);
          setStatus(removedText(worktree, result));
          onChanged?.();
        },
        (e) => {
          // The row the dialog describes is no longer what the host sees:
          // close it and show the fresh listing instead of retrying.
          setOpen(undefined);
          setStatus(`${worktree.name}: ${problemOf(e)}`);
        },
      )
      .finally(() => {
        setBusy(undefined);
        reload();
      });
  };
  const onAction = (worktree: Worktree, disposal: WorktreeDisposal) => {
    setStatus("");
    // A missing directory loses nothing; only Git's entry goes.
    if (disposal === "prune") run(worktree, disposal);
    else {
      setProblem("");
      setBlockers(undefined);
      setOpen({ worktree, disposal });
    }
  };
  const confirmClean = () => {
    if (!listing) return;
    setBusy("*");
    void cleanMergedWorktrees(listing, csrf)
      .then(
        (result) => {
          const names = new Map(worktrees.map((w) => [worktreeKey(w), w.name]));
          const kept = result.kept.map((k) => {
            const why =
              k.state === "blocked"
                ? (k.blockers ?? []).map(plainBlocker).join(" ")
                : k.state === "partial"
                  ? "osa jäi poistamatta."
                  : "se oli muuttunut.";
            return `${names.get(worktreeKey(k)) ?? k.entry}: ${why}`;
          });
          const branches = result.branches_kept.map(
            (b) =>
              `haara ${b.branch} säilyi, koska ${b.reason === "moved" ? "se oli muuttunut" : "se on käytössä"}.`,
          );
          setStatus(
            [
              `${result.removed} ${result.removed === 1 ? "worktree siivottiin" : "worktreetä siivottiin"}.`,
              ...kept,
              ...branches,
            ].join(" "),
          );
          if (result.removed) onChanged?.();
        },
        (e) => setStatus(problemOf(e)),
      )
      .finally(() => {
        setCleanOpen(false);
        setBusy(undefined);
        reload();
      });
  };
  if (hideWhenEmpty && !status && (!listing || !worktrees.length)) return null;
  return (
    <section
      data-testid="worktrees"
      className="ah-trash-section"
      aria-labelledby="worktrees-heading"
    >
      <div className="ah-trash-head">
        <h3 id="worktrees-heading">Worktreet</h3>
        <ControlButton
          data-testid="cleanup-worktrees"
          variant="secondary"
          size="row"
          isDisabled={!merged.length || !!busy}
          onPress={() => setCleanOpen(true)}
        >
          Siivoa kaikki yhdistetyt{merged.length ? ` (${merged.length})` : ""}…
        </ControlButton>
      </div>
      <p className="ah-trash-intro">
        Gitin linkitetyt worktreet{workspaceId ? "" : " kaikista työtiloista"}{" "}
        sellaisina kuin Git ne nyt näkee. Yhdistämisen ja muut Git-työt tekee
        agentti keskustelussa; täällä worktreen voi poistaa. Taskfleetin
        käynnissä olevan ajon worktreetä ei poisteta.
      </p>
      {status ? <p role="status">{status}</p> : null}
      {loadProblem ? (
        <p role="alert">
          Worktreitä ei voitu lukea. {loadProblem}{" "}
          <ControlButton variant="quiet" size="row" onPress={reload}>
            Yritä uudelleen
          </ControlButton>
        </p>
      ) : !listing ? (
        <p>Luetaan worktreitä…</p>
      ) : (
        <WorktreeList
          worktrees={worktrees}
          showWorkspace={!workspaceId}
          busy={busy}
          onAction={onAction}
        />
      )}
      {listing?.truncated ? (
        <p className="ah-trash-intro">
          Näytetään {worktrees.length} ensimmäistä.
        </p>
      ) : null}
      {listing && !listing.complete ? (
        <p className="ah-trash-intro">
          Joidenkin työtilojen worktreitä ei voitu lukea, joten lista voi olla
          vajaa.
        </p>
      ) : null}
      <WorktreeRemoveDialog
        key={open ? `${worktreeKey(open.worktree)}:${open.disposal}` : ""}
        worktree={open?.worktree}
        disposal={open?.disposal}
        busy={!!busy && !!open && busy === worktreeKey(open.worktree)}
        problem={problem}
        blockers={blockers}
        onConfirm={(typed) => open && run(open.worktree, open.disposal, typed)}
        onClose={() => {
          setOpen(undefined);
          setBlockers(undefined);
        }}
      />
      <WorktreeCleanDialog
        isOpen={cleanOpen}
        merged={merged}
        busy={busy === "*"}
        onConfirm={confirmClean}
        onClose={() => setCleanOpen(false)}
      />
    </section>
  );
}
