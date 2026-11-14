import { type ReactNode, useState } from "react";
import type { RewindPreview } from "../app/rewind";
import { useText } from "../i18n";
import { rewindText } from "../text/rewind";
import { ConversationFloatingAction } from "./ConversationFrame";
import { Icon } from "./Icon";
import { Menu } from "./Overlays";
import { Button, Checkbox } from "./Primitives";
import "./Rewind.css";

// Palaa tähän (experimental; prototype round 2026-11-06-palaa-tahan-vahvistus,
// C Pieni arkki with C Valitse mitä). The same conversation continues from
// before one of the person's messages, as Pi's own /tree does; the replaced
// continuation stays as one row at the branch point and can be continued
// again. Files the agent's edit and write tools changed can be restored with
// it or alone.

export type RewindWhat = "both" | "conversation" | "files";

/** The own message's ⋯ menu: its one item opens the sheet. */
export function RewindMenu({
  onChoose,
  testId,
}: {
  onChoose: () => void;
  testId?: string;
}) {
  const t = useText(rewindText);
  return (
    <Menu
      label={t.menuLabel}
      trigger={<Icon name="more" />}
      triggerPresentation="icon"
      triggerClassName="ah-rewind-more"
      triggerTestId={testId ?? "message-menu"}
      placement="bottom end"
      items={[{ id: "rewind", label: t.menuItem, description: t.menuItemDesc }]}
      onAction={onChoose}
    />
  );
}

function FileList({
  preview,
  restoring,
}: {
  preview: RewindPreview;
  restoring: boolean;
}) {
  const t = useText(rewindText);
  return (
    <ul className="ah-rewind-files" data-testid="rewind-file-list">
      {preview.files.map((f) => (
        <li key={f.path}>
          <code>{f.path}</code>
          <span className="ah-rewind-stat">
            {f.change === "created" ? `${t.created} ` : null}
            {f.change === "deleted" ? `${t.deleted} ` : null}
            {f.committed && restoring ? `${t.committedTag} ` : null}
            {f.additions !== undefined && f.deletions !== undefined
              ? `+${f.additions} −${f.deletions}`
              : null}
          </span>
        </li>
      ))}
      {preview.files_more ? (
        <li className="ah-rewind-quiet">{t.more(preview.files_more)}</li>
      ) : null}
      {restoring
        ? preview.commands.map((c) => (
            <li key={c} className="ah-rewind-quiet">
              <code>{c}</code>
              <span className="ah-rewind-stat">{t.stays}</span>
            </li>
          ))
        : null}
      {restoring && preview.commands_more ? (
        <li className="ah-rewind-quiet">{t.more(preview.commands_more)}</li>
      ) : null}
    </ul>
  );
}

/** C Pieni arkki: a low panel above the composer. Two choices express the
 * three outcomes: both, the conversation alone or the files alone. */
export function RewindSheet({
  time,
  preview,
  previewState,
  busy,
  filesByDefault = true,
  pending = false,
  error,
  onCancel,
  onGo,
}: {
  /** When the chosen message was sent, as the timeline shows it. */
  time?: string;
  preview?: RewindPreview;
  previewState: "loading" | "ready" | "failed";
  /** The agent is working and is stopped first. */
  busy: boolean;
  filesByDefault?: boolean;
  pending?: boolean;
  error?: string;
  onCancel: () => void;
  onGo: (what: RewindWhat) => void;
}) {
  const t = useText(rewindText);
  const n = preview?.files.length ?? 0;
  const restorable =
    !!preview?.checkpoint && n + (preview?.files_more ?? 0) > 0;
  const [conversation, setConversation] = useState(true);
  const [files, setFiles] = useState(filesByDefault);
  const [listOpen, setListOpen] = useState(false);
  const withFiles = files && restorable;
  const what: RewindWhat =
    conversation && withFiles ? "both" : withFiles ? "files" : "conversation";
  const none = !conversation && !withFiles;
  const total = n + (preview?.files_more ?? 0);
  // Named before the person confirms: the restore brings these files back
  // in the working tree and leaves their commits as they are.
  const committed = preview?.files.filter((f) => f.committed) ?? [];
  const filesHint =
    previewState === "loading"
      ? t.reading
      : !preview
        ? t.readFailed
        : !preview.checkpoint
          ? t.noCopies
          : !total
            ? t.noChanges
            : withFiles
              ? t.restoring(total)
              : t.staying(total);
  const go =
    what === "files"
      ? busy
        ? t.stopAndRestore
        : t.goFiles
      : busy
        ? t.stopAndReturn
        : what === "both"
          ? t.goBoth
          : t.goConversation;
  return (
    <ConversationFloatingAction>
      <section
        className="ah-rewind-sheet"
        role="dialog"
        aria-label={t.sheetLabel}
        data-testid="rewind-sheet"
        data-what={none ? "none" : what}
      >
        <header className="ah-rewind-head">
          <h2>{t.title(time)}</h2>
          <Button
            data-testid="rewind-close"
            label={t.close}
            ariaLabel={t.close}
            icon="cross"
            variant="quiet"
            size="row"
            onPress={onCancel}
          />
        </header>
        <div className="ah-rewind-toggles">
          <Checkbox
            data-testid="rewind-conversation"
            label={t.conversation}
            hint={
              conversation
                ? preview
                  ? t.aside(preview.own, preview.replies)
                  : undefined
                : t.continues
            }
            checked={conversation}
            onChange={setConversation}
          />
          <Checkbox
            data-testid="rewind-files"
            label={t.files}
            hint={restorable ? filesHint : undefined}
            checked={withFiles}
            onChange={setFiles}
            availability={
              restorable ? undefined : { state: "disabled", reason: filesHint }
            }
          />
        </div>
        <div className="ah-rewind-foot">
          <div className="ah-rewind-notes">
            {withFiles ? (
              <p className="ah-rewind-meta">{t.restoreWarning}</p>
            ) : null}
            {preview && total ? (
              <p className="ah-rewind-meta">
                {withFiles && preview.commands.length ? (
                  <span>{t.commandsStay}</span>
                ) : null}
                <button
                  type="button"
                  className="ah-rewind-link"
                  data-testid="rewind-files-toggle"
                  aria-expanded={listOpen}
                  onClick={() => setListOpen(!listOpen)}
                >
                  {listOpen ? t.hideFiles : t.showFiles}
                </button>
              </p>
            ) : null}
            {withFiles && committed.length ? (
              <p
                className="ah-rewind-meta ah-rewind-committed"
                data-testid="rewind-committed"
              >
                {t.committed(
                  committed.slice(0, 3).map((f) => f.path),
                  Math.max(0, committed.length - 3),
                )}
              </p>
            ) : null}
            {preview?.file_errors ? (
              <p className="ah-rewind-meta">
                {t.unreadable(preview.file_errors)}
              </p>
            ) : null}
            {listOpen && preview ? (
              <FileList preview={preview} restoring={withFiles} />
            ) : null}
            {busy ? (
              <p className="ah-rewind-meta ah-rewind-busy">{t.busy}</p>
            ) : null}
            {error ? (
              <p
                className="ah-rewind-error"
                role="alert"
                data-testid="rewind-error"
              >
                {error}
              </p>
            ) : null}
          </div>
          <div className="ah-rewind-actions">
            <Button
              data-testid="rewind-cancel"
              label={t.cancel}
              variant="quiet"
              size="row"
              onPress={onCancel}
            />
            <Button
              data-testid="rewind-go"
              label={go}
              variant="primary"
              size="row"
              pending={pending}
              onPress={() => {
                if (!none && !pending) onGo(what);
              }}
              availability={
                none ? { state: "disabled", reason: t.chooseOne } : undefined
              }
            />
          </div>
        </div>
      </section>
    </ConversationFloatingAction>
  );
}

export type RewindRowMarker = {
  action: "rewind" | "switch" | "files" | "undo";
  own: number;
  replies: number;
  files_restored?: number;
  file_errors?: number;
  switchable: boolean;
  files_return: boolean;
};

/** The row a return leaves in the history. For a return of the
 * conversation it is the replaced continuation at the branch point: shown
 * on request and continued again from its own button. */
export function RewindRow({
  marker,
  time,
  undone = false,
  open = false,
  onToggle,
  continuation,
  pending = false,
  error,
  onSwitch,
  onUndo,
}: {
  marker: RewindRowMarker;
  /** When the message a files-only restore went back to was sent. */
  time?: string;
  /** A later row undid this files-only restore. */
  undone?: boolean;
  open?: boolean;
  onToggle?: () => void;
  /** The replaced continuation, rendered by the caller, or its status. */
  continuation?: ReactNode;
  pending?: boolean;
  error?: string;
  onSwitch?: (files: boolean) => void;
  onUndo?: () => void;
}) {
  const t = useText(rewindText);
  const [confirming, setConfirming] = useState(false);
  const [withFiles, setWithFiles] = useState(true);
  const errors = marker.file_errors ? (
    <span className="ah-rewind-quiet"> {t.fileErrors(marker.file_errors)}</span>
  ) : null;
  if (marker.action === "files" || marker.action === "undo")
    return (
      <section className="ah-rewind-origin" data-testid="rewind-files-row">
        <Icon name="restore" />
        <span>
          {marker.action === "undo" ? (
            t.undone
          ) : (
            <>
              <strong>
                {t.filesRestored(marker.files_restored ?? 0, time)}
              </strong>{" "}
              {t.conversationContinues}
            </>
          )}
          {errors}
          {error ? (
            <span className="ah-rewind-error" role="alert">
              {" "}
              {error}
            </span>
          ) : null}
        </span>
        {marker.action === "files" &&
        marker.files_return &&
        !undone &&
        onUndo ? (
          <Button
            data-testid="rewind-undo"
            label={t.undo}
            variant="quiet"
            size="row"
            pending={pending}
            onPress={onUndo}
          />
        ) : null}
      </section>
    );
  return (
    <section
      className="ah-rewind-branch"
      data-testid="rewind-branch"
      aria-label={t.earlier}
    >
      <div className="ah-rewind-branch-row">
        <Icon name="branch" />
        <span>
          <strong>{t.earlier}</strong> · {t.counted(marker.own, marker.replies)}
          {marker.files_restored ? t.restoredNote(marker.files_restored) : null}
          {errors}
        </span>
        {onToggle ? (
          <Button
            data-testid="rewind-branch-toggle"
            label={open ? t.hide : t.show}
            variant="quiet"
            size="row"
            onPress={onToggle}
          />
        ) : null}
      </div>
      {open ? (
        <div className="ah-rewind-branch-body" data-testid="rewind-branch-body">
          <p className="ah-rewind-meta">
            {t.agentDoesNotSee}{" "}
            {marker.files_return ? t.filesReturn : t.canContinue}
          </p>
          <div className="ah-rewind-continuation">{continuation}</div>
          {error ? (
            <p
              className="ah-rewind-error"
              role="alert"
              data-testid="rewind-error"
            >
              {error}
            </p>
          ) : null}
          {marker.switchable && onSwitch ? (
            confirming && marker.files_return ? (
              <div className="ah-rewind-swap" data-testid="rewind-swap">
                <Checkbox
                  data-testid="rewind-swap-files"
                  label={t.alsoFiles}
                  hint={t.alsoFilesHint}
                  checked={withFiles}
                  onChange={setWithFiles}
                />
                <div className="ah-rewind-actions">
                  <Button
                    label={t.cancel}
                    variant="quiet"
                    size="row"
                    onPress={() => setConfirming(false)}
                  />
                  <Button
                    data-testid="rewind-swap-go"
                    label={t.continueThis}
                    variant="primary"
                    size="row"
                    pending={pending}
                    onPress={() => onSwitch(withFiles)}
                  />
                </div>
              </div>
            ) : (
              <Button
                data-testid="rewind-switch"
                label={t.continueThis}
                variant="secondary"
                size="row"
                pending={pending}
                onPress={() =>
                  marker.files_return ? setConfirming(true) : onSwitch(false)
                }
              />
            )
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
