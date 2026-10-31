import { useState } from "react";
import { Heading, Input, Label, TextField } from "react-aria-components";
import { bytes, conversationsKept } from "../app/trashText";
import type {
  Worktree,
  WorktreeBlocker,
  WorktreeDisposal,
} from "../app/workspaceWorktrees";
import {
  plainBlocker,
  stateLabel,
  worktreeBlockerText,
  worktreeFacts,
} from "../app/worktreeText";
import { liveText } from "../i18n";
import { worktreesText } from "../text/worktrees";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import { BlockerList, Facts, TrashModal } from "./WorkspaceTrash";
import "./WorkspaceTrash.css";

// Worktree cleanup (ADR 0025): every linked worktree of the person's Git
// workspaces with what Git says about it, and the removals the host would
// accept for exactly that observation. The browser offers no merge or
// settlement; agents do that in conversation.

const txt = liveText(worktreesText);

export function WorktreeList({
  worktrees,
  showWorkspace = false,
  busy,
  onAction,
}: {
  worktrees: Worktree[];
  /** Asetukset › Tallennustila lists every workspace's worktrees. */
  showWorkspace?: boolean;
  /** Key (workspace_id/entry) of the worktree being removed; "*" for all. */
  busy?: string;
  onAction: (worktree: Worktree, disposal: WorktreeDisposal) => void;
}) {
  if (!worktrees.length)
    return (
      <p className="ah-trash-empty">
        <Icon name="branch" />
        <span>{txt.none}</span>
      </p>
    );
  return (
    <ul className="ah-trash-list" aria-label={txt.list}>
      {worktrees.map((w) => {
        const key = worktreeKey(w);
        const state = stateLabel(w.state);
        const meta = [
          showWorkspace ? w.workspace_name : "",
          w.branch
            ? `${w.branch}${w.base ? ` → ${w.base}` : ""}`
            : w.state === "missing" || w.state === "locked"
              ? ""
              : txt.detached,
          w.size_bytes !== undefined
            ? `${w.size_complete ? "" : txt.over}${bytes(w.size_bytes)}`
            : "",
          w.conversations ? txt.conversations(w.conversations) : "",
        ].filter(Boolean);
        const facts = worktreeFacts(w);
        return (
          <li
            key={key}
            className="ah-trash-row"
            data-testid={`worktree-row-${w.name}`}
            data-state={w.state}
            data-blocked={w.blockers.length > 0}
          >
            <span className="ah-trash-icon" aria-hidden="true">
              <Icon name="branch" />
            </span>
            <div className="ah-trash-main">
              <code className="ah-trash-name">{w.name}</code>
              {w.path ? (
                <span className="ah-trash-meta">
                  <code title={w.path}>{w.path}</code>
                </span>
              ) : null}
              {meta.length ? (
                <span className="ah-trash-meta">{meta.join(" · ")}</span>
              ) : null}
              <span className="ah-trash-chips">
                <span className={`ah-trash-chip ${state.tone}`}>
                  {state.text}
                </span>
                {facts.map((f) => (
                  <span key={f} className="ah-trash-chip plain">
                    {f}
                  </span>
                ))}
              </span>
              {w.state === "locked" ? (
                <span className="ah-trash-why">
                  {txt.locked}
                  {w.locked_reason ? (
                    <>
                      : <q>{w.locked_reason}</q>
                    </>
                  ) : null}
                  {txt.lockedEnd}
                </span>
              ) : null}
              {w.blockers.length ? (
                <span className="ah-trash-why">
                  {w.blockers.map(plainBlocker).join(" ")}
                </span>
              ) : null}
            </div>
            <span className="ah-trash-actions">
              {w.actions.map((a) => (
                <ControlButton
                  data-testid={`worktree-${a}`}
                  key={a}
                  variant={a === "force" ? "danger-subtle" : "secondary"}
                  size="row"
                  isDisabled={!!busy}
                  isPending={busy === key}
                  aria-label={`${txt.action[a].replace("…", "")} ${w.name}${a === "prune" ? "" : "…"}`}
                  onPress={() => onAction(w, a)}
                >
                  {txt.action[a]}
                </ControlButton>
              ))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export const worktreeKey = (w: Pick<Worktree, "workspace_id" | "entry">) =>
  `${w.workspace_id}/${w.entry}`;

function IgnoredNote({ worktree }: { worktree: Worktree }) {
  if (!worktree.ignored) return null;
  const shown = worktree.ignored_paths.slice(0, 4);
  const more = worktree.ignored - shown.length;
  return (
    <p className="ah-trash-note warn">
      <Icon name="warning" />
      <span>
        {txt.ignoredLost}{" "}
        {shown.map((p, i) => (
          <span key={p}>
            {i ? ", " : ""}
            <code>{p}</code>
          </span>
        ))}
        {more > 0 ? txt.ignoredMore(more) : ""}.
      </span>
    </p>
  );
}

/** The confirmation of one removal. A forced removal asks for the name. */
export function WorktreeRemoveDialog({
  worktree,
  disposal,
  busy,
  problem,
  blockers,
  onConfirm,
  onClose,
}: {
  worktree?: Worktree;
  disposal?: WorktreeDisposal;
  busy: boolean;
  problem?: string;
  /** What the host found in use when it was asked to remove; nothing changed. */
  blockers?: WorktreeBlocker[];
  onConfirm: (typed?: string) => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const w = worktree;
  const name = w?.name ?? "";
  const close = () => {
    setTyped("");
    onClose();
  };
  const branch = w?.branch ? <code>{w.branch}</code> : null;
  const title =
    disposal === "commit"
      ? txt.titleCommit(name)
      : disposal === "force"
        ? txt.titleForce(name)
        : txt.titleRemove(name);
  const lead =
    !w || !disposal ? null : disposal === "commit" ? (
      <>
        <p>{txt.leadCommit(branch)}</p>
        <Facts tone="warn" items={worktreeFacts(w)} />
      </>
    ) : disposal === "force" ? (
      <>
        <p>{txt.leadForce}</p>
        <Facts tone="warn" items={worktreeFacts(w)} />
        {w.branch ? (
          <p className="ah-trash-sub">{txt.forceBranchKept(branch)}</p>
        ) : null}
      </>
    ) : w.state === "merged" ? (
      <p>{txt.leadMerged(branch, <code>{w.base}</code>)}</p>
    ) : (
      <p>
        {txt.leadRemove} {w.branch ? txt.branchKept(branch) : null}
      </p>
    );
  return (
    <TrashModal
      label={title}
      isOpen={!!w && !!disposal && disposal !== "prune"}
      onClose={close}
      dismissable={!busy}
    >
      <Heading slot="title">
        {disposal === "commit" ? txt.headingCommit : txt.headingRemove}
        <code>{name}</code>
        {disposal === "force" ? txt.headingForce : ""}?
      </Heading>
      {lead}
      {w ? <IgnoredNote worktree={w} /> : null}
      {w?.conversations ? (
        <p className="ah-trash-note">
          <Icon name="agent" />
          <span>{conversationsKept(w.conversations)}</span>
        </p>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          if (disposal !== "force") onConfirm();
          else if (typed === name) onConfirm(typed);
        }}
      >
        {disposal === "force" ? (
          <TextField
            className="ah-trash-type"
            value={typed}
            onChange={setTyped}
            autoFocus
          >
            <Label>{txt.typeName(<code>{name}</code>)}</Label>
            <Input autoComplete="off" spellCheck={false} />
          </TextField>
        ) : null}
        {blockers?.length ? (
          <>
            <p role="alert">{txt.inUse}</p>
            <BlockerList blockers={blockers} describe={worktreeBlockerText} />
          </>
        ) : null}
        {problem ? <p role="alert">{problem}</p> : null}
        <div className="ah-dialog-actions">
          <ControlButton
            size="page"
            variant="secondary"
            isDisabled={busy}
            onPress={close}
            autoFocus={disposal !== "force"}
          >
            {txt.cancel}
          </ControlButton>
          <ControlButton
            data-testid="confirm-worktree"
            size="page"
            type="submit"
            variant={disposal === "commit" ? "primary" : "danger"}
            isPending={busy}
            isDisabled={busy || (disposal === "force" && typed !== name)}
          >
            {disposal === "commit"
              ? txt.confirmCommit
              : disposal === "force"
                ? txt.confirmForce
                : txt.confirmRemove}
          </ControlButton>
        </div>
      </form>
    </TrashModal>
  );
}

/** Siivoa kaikki yhdistetyt: exactly the merged worktrees shown. */
export function WorktreeCleanDialog({
  isOpen,
  merged,
  busy,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  merged: Worktree[];
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ignored = merged.filter((w) => w.ignored).map((w) => w.name);
  return (
    <TrashModal
      label={txt.cleanTitle}
      isOpen={isOpen}
      onClose={onClose}
      dismissable={!busy}
    >
      <Heading slot="title">{txt.cleanTitle}</Heading>
      <p>
        {txt.cleanLead(merged.length)} {txt.cleanSafe}
      </p>
      <ul className="ah-trash-facts">
        {merged.map((w) => (
          <li key={worktreeKey(w)} className="ok">
            <Icon name="check" />
            <span>
              <code>{w.name}</code>
              {w.branch && w.base ? ` · ${w.branch} → ${w.base}` : ""}
            </span>
          </li>
        ))}
      </ul>
      {ignored.length ? (
        <p className="ah-trash-note warn">
          <Icon name="warning" />
          <span>
            {txt.ignoredLostFrom}{" "}
            {ignored.map((n, i) => (
              <span key={n}>
                {i ? ", " : ""}
                <code>{n}</code>
              </span>
            ))}
            .
          </span>
        </p>
      ) : null}
      <div className="ah-dialog-actions">
        <ControlButton
          size="page"
          variant="secondary"
          isDisabled={busy}
          onPress={onClose}
          autoFocus
        >
          {txt.cancel}
        </ControlButton>
        <ControlButton
          data-testid="confirm-cleanup"
          size="page"
          variant="danger"
          isPending={busy}
          isDisabled={busy}
          onPress={onConfirm}
        >
          {txt.cleanConfirm(merged.length)}
        </ControlButton>
      </div>
    </TrashModal>
  );
}
