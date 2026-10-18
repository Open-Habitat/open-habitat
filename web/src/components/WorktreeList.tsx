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
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import { BlockerList, Facts, TrashModal } from "./WorkspaceTrash";
import "./WorkspaceTrash.css";

// Worktree cleanup (ADR 0025): every linked worktree of the person's Git
// workspaces with what Git says about it, and the removals the host would
// accept for exactly that observation. The browser offers no merge or
// settlement; agents do that in conversation.

const actionLabel: Record<WorktreeDisposal, string> = {
  remove: "Poista…",
  // The dialog says in full that the changes are committed to the branch.
  commit: "Tallenna ja poista…",
  force: "Poista pakolla…",
  prune: "Siivoa merkintä",
};

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
        <span>Ei linkitettyjä worktreitä.</span>
      </p>
    );
  return (
    <ul className="ah-trash-list" aria-label="Worktreet">
      {worktrees.map((w) => {
        const key = worktreeKey(w);
        const state = stateLabel[w.state];
        const meta = [
          showWorkspace ? w.workspace_name : "",
          w.branch
            ? `${w.branch}${w.base ? ` → ${w.base}` : ""}`
            : w.state === "missing" || w.state === "locked"
              ? ""
              : "irrallinen HEAD",
          w.size_bytes !== undefined
            ? `${w.size_complete ? "" : "yli "}${bytes(w.size_bytes)}`
            : "",
          w.conversations
            ? `${w.conversations} ${w.conversations === 1 ? "keskustelu" : "keskustelua"}`
            : "",
        ].filter(Boolean);
        const facts = worktreeFacts(w);
        return (
          <li key={key} className="ah-trash-row">
            <span className="ah-trash-icon" aria-hidden="true">
              <Icon name="branch" />
            </span>
            <div className="ah-trash-main">
              <code className="ah-trash-name">{w.name}</code>
              <span className="ah-trash-meta">
                <code title={w.path}>{w.path}</code>
              </span>
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
                  Git on lukinnut tämän worktreen
                  {w.locked_reason ? (
                    <>
                      : <q>{w.locked_reason}</q>
                    </>
                  ) : null}
                  . Lukittua ei poisteta.
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
                  key={a}
                  variant={a === "force" ? "danger-subtle" : "secondary"}
                  size="row"
                  isDisabled={!!busy}
                  isPending={busy === key}
                  aria-label={`${actionLabel[a].replace("…", "")} ${w.name}${a === "prune" ? "" : "…"}`}
                  onPress={() => onAction(w, a)}
                >
                  {actionLabel[a]}
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
        Gitin ohittamat tiedostot häviävät:{" "}
        {shown.map((p, i) => (
          <span key={p}>
            {i ? ", " : ""}
            <code>{p}</code>
          </span>
        ))}
        {more > 0 ? ` ja ${more} muuta` : ""}.
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
      ? `Tallennetaanko muutokset ja poistetaan ${name}?`
      : disposal === "force"
        ? `Poistetaanko ${name} pakolla?`
        : `Poistetaanko ${name}?`;
  const lead =
    !w || !disposal ? null : disposal === "commit" ? (
      <>
        <p>
          Kaikki muutokset ja uudet tiedostot commitoidaan haaraan {branch}, ja
          worktreen hakemisto poistetaan. Haara säilyy, joten työn saa takaisin
          komennolla <code>git worktree add</code>.
        </p>
        <Facts tone="warn" items={worktreeFacts(w)} />
      </>
    ) : disposal === "force" ? (
      <>
        <p>
          Hakemisto poistetaan, ja nämä häviävät lopullisesti. Tätä ei voi
          perua.
        </p>
        <Facts tone="warn" items={worktreeFacts(w)} />
        {w.branch ? (
          <p className="ah-trash-sub">
            Haara {branch} ja sen commitit säilyvät.
          </p>
        ) : null}
      </>
    ) : w.state === "merged" ? (
      <p>
        Haara {branch} on yhdistetty haaraan <code>{w.base}</code>, joten
        worktreen hakemisto ja haara poistetaan. Mitään commitoitua ei häviä.
      </p>
    ) : (
      <p>
        Worktreen hakemisto poistetaan.{" "}
        {w.branch ? (
          <>Haara {branch} säilyy, joten sen commitit eivät häviä.</>
        ) : null}
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
        {disposal === "commit"
          ? "Tallennetaanko muutokset ja poistetaan "
          : "Poistetaanko "}
        <code>{name}</code>
        {disposal === "force" ? " pakolla" : ""}?
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
            <Label>
              Kirjoita <code>{name}</code> vahvistukseksi
            </Label>
            <Input autoComplete="off" spellCheck={false} />
          </TextField>
        ) : null}
        {blockers?.length ? (
          <>
            <p role="alert">Ei poistettu, koska nämä käyttävät worktreetä:</p>
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
            Peruuta
          </ControlButton>
          <ControlButton
            size="page"
            type="submit"
            variant={disposal === "commit" ? "primary" : "danger"}
            isPending={busy}
            isDisabled={busy || (disposal === "force" && typed !== name)}
          >
            {disposal === "commit"
              ? "Tallenna ja poista"
              : disposal === "force"
                ? "Poista pakolla"
                : "Poista"}
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
      label="Siivotaanko yhdistetyt worktreet?"
      isOpen={isOpen}
      onClose={onClose}
      dismissable={!busy}
    >
      <Heading slot="title">Siivotaanko yhdistetyt worktreet?</Heading>
      <p>
        {merged.length === 1
          ? "Tämän worktreen hakemisto ja haara poistetaan."
          : `Näiden ${merged.length} worktreen hakemistot ja haarat poistetaan.`}{" "}
        Haarat on yhdistetty, joten mitään commitoitua ei häviä.
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
            Gitin ohittamat tiedostot häviävät näistä:{" "}
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
          Peruuta
        </ControlButton>
        <ControlButton
          size="page"
          variant="danger"
          isPending={busy}
          isDisabled={busy}
          onPress={onConfirm}
        >
          Siivoa{" "}
          {merged.length === 1 ? "1 worktree" : `${merged.length} worktreetä`}
        </ControlButton>
      </div>
    </TrashModal>
  );
}
