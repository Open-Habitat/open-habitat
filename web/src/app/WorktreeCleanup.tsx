import { useCallback, useEffect, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import {
  type OwnerConversation,
  WorktreeAttention,
  worktreeTotal,
} from "../components/WorktreeAttention";
import {
  WorktreeCleanDialog,
  WorktreeList,
  WorktreeRemoveDialog,
  worktreeKey,
} from "../components/WorktreeList";
import { liveText } from "../i18n";
import { worktreeAttentionText } from "../text/worktreeAttention";
import { worktreeCleanupText } from "../text/worktreeCleanup";
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

const txt = liveText(worktreeCleanupText);
const attentionTxt = liveText(worktreeAttentionText);

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
  conversation,
  onOpenConversation,
}: {
  csrf: string;
  /** Without it, every Git workspace's worktrees are listed. */
  workspaceId?: string;
  /** The workspace page shows the section only when there is something. */
  hideWhenEmpty?: boolean;
  /** Something was removed: storage and the workspace list may differ. */
  onChanged?: () => void;
  /** On a workspace page: the conversation that started a worktree's run.
   * With it the rows that need the person come first (WorktreeAttention). */
  conversation?: (id: string) => OwnerConversation | undefined;
  /** Restores an archived conversation, then opens it. */
  onOpenConversation?: (conversation: OwnerConversation) => void;
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
                  ? txt.keptPartial
                  : txt.keptChanged;
            return `${names.get(worktreeKey(k)) ?? k.entry}: ${why}`;
          });
          const branches = result.branches_kept.map((b) =>
            txt.branchKept(b.branch, b.reason === "moved"),
          );
          setStatus(
            [txt.removed(result.removed), ...kept, ...branches].join(" "),
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
  const attention = !!workspaceId && !!conversation;
  return (
    <section
      data-testid="worktrees"
      className="ah-trash-section"
      aria-labelledby="worktrees-heading"
    >
      <div className="ah-trash-head">
        <h3 id="worktrees-heading" data-testid="worktrees-heading">
          {txt.title}
          {attention && worktrees.length ? (
            <span className="ah-wt-count">
              {attentionTxt.count(worktrees.length, worktreeTotal(worktrees))}
            </span>
          ) : null}
        </h3>
        {/* Huomio hides the button when nothing merged is free to go; its
            rows say which worktrees release themselves instead. */}
        {!attention || merged.length ? (
          <ControlButton
            data-testid="cleanup-worktrees"
            variant="secondary"
            size="row"
            isDisabled={!merged.length || !!busy}
            onPress={() => setCleanOpen(true)}
          >
            {txt.cleanAll(merged.length)}
          </ControlButton>
        ) : null}
      </div>
      <p className="ah-trash-intro">
        {attention ? attentionTxt.intro : txt.intro(!workspaceId)}
      </p>
      {status ? <p role="status">{status}</p> : null}
      {loadProblem ? (
        <p role="alert">
          {txt.readFailed} {loadProblem}{" "}
          <ControlButton variant="quiet" size="row" onPress={reload}>
            {txt.retry}
          </ControlButton>
        </p>
      ) : !listing ? (
        <p>{txt.reading}</p>
      ) : attention && conversation ? (
        <WorktreeAttention
          worktrees={worktrees}
          conversation={conversation}
          now={Date.now()}
          busy={busy}
          onAction={onAction}
          onOpen={onOpenConversation}
        />
      ) : (
        <WorktreeList
          worktrees={worktrees}
          showWorkspace={!workspaceId}
          busy={busy}
          onAction={onAction}
        />
      )}
      {listing?.truncated ? (
        <p className="ah-trash-intro">{txt.first(worktrees.length)}</p>
      ) : null}
      {listing && !listing.complete ? (
        <p className="ah-trash-intro">{txt.incomplete}</p>
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
