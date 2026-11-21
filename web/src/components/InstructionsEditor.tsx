import { type ReactNode, useEffect, useRef, useState } from "react";
import { useText } from "../i18n";
import { instructionsEditorText } from "../text/instructionsEditor";
import { ControlButton } from "./ControlElements";
import { type ConflictPick, EditorConflict } from "./EditorConflict";
import { type MergeConflict, threeWay } from "./editorMerge";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";
import { Tabs } from "./Overlays";
import "./BrowserEditor.css";
import "./InstructionsEditor.css";

/** What the page's save came to. `conflict` carries the text now on disk:
 * the editor merges the other change into the draft, as the workspace
 * editor does, and the person saves again. `error` is shown as it is and
 * keeps the draft. */
export type InstructionsSaveResult =
  | { ok: true }
  | { conflict: string }
  | { error: string };

type Tab = "preview" | "edit";

/** The one instructions editor (issue new-user-agent-instructions-template,
 * Jari 21.11.2026): an ordinary Markdown block that opens in Esikatselu, a
 * Muokkaa tab with the raw text, and Tallenna / Peru. Onboarding's note and
 * Settings › Tili › Ohjeet agentille use it. It owns only its draft; the
 * page owns the file, gives `value` and decides what Tallenna does. */
export function InstructionsEditor({
  value,
  label,
  onSave,
  alwaysSavable = false,
  saveLabel,
  keptPrefix,
  empty,
  source,
  secondary,
  "data-testid": testId = "instructions-editor",
}: {
  /** The text the editor starts from and Peru returns to: the file, or in
   * onboarding the note made from the answers. A new value while the person
   * has edits is merged into them, never replaces them. */
  value: string;
  /** Accessible name of the block. */
  label: string;
  onSave: (text: string) => Promise<InstructionsSaveResult>;
  /** Tallenna without edits (onboarding: nothing is on disk yet). */
  alwaysSavable?: boolean;
  saveLabel?: string;
  /** An existing file's text the page did not add: drawn as unchanged, the
   * rest as new. */
  keptPrefix?: string;
  /** The preview of an empty text. */
  empty?: ReactNode;
  /** Where the text lives, under the body. */
  source?: ReactNode;
  /** Actions on the left of the action row. */
  secondary?: ReactNode;
  "data-testid"?: string;
}) {
  const t = useText(instructionsEditorText);
  const [base, setBase] = useState(value);
  const [draft, setDraft] = useState(value);
  const [tab, setTab] = useState<Tab>("preview");
  const [merged, setMerged] = useState(0);
  const [conflicts, setConflicts] = useState<MergeConflict[]>([]);
  const [justSaved, setJustSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  const dirty = draft !== base;

  // The page's text moved: an untouched draft follows it, an edited one
  // gets it merged in.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new value from the page merges; the base it is compared with moves with it.
  useEffect(() => {
    if (value === base) return;
    setDraft((d) => (d === base ? value : threeWay(d, base, value).text));
    setBase(value);
  }, [value]);
  useEffect(() => {
    if (tab === "edit") area.current?.focus({ preventScroll: true });
  }, [tab]);

  const save = async () => {
    if (busy) return;
    const text = draft;
    setBusy(true);
    setError("");
    const result = await onSave(text);
    if (!alive.current) return;
    setBusy(false);
    if ("ok" in result) {
      setBase(text);
      setMerged(0);
      setConflicts([]);
      setTab("preview");
      setJustSaved(true);
      return;
    }
    if ("error" in result) {
      setError(result.error);
      return;
    }
    // The file changed since it was read: fold the other change in and keep
    // the person's text where both touched the same lines.
    const m = threeWay(text, base, result.conflict);
    setBase(result.conflict);
    setDraft(m.text);
    setMerged(m.incoming.length + m.conflicts.length);
    setConflicts(m.conflicts);
    setJustSaved(false);
  };
  const pick = (c: MergeConflict, choice: ConflictPick) => {
    const lines = draft.split("\n");
    const next =
      choice === "mine"
        ? c.mine
        : choice === "theirs"
          ? c.theirs
          : [...c.mine, ...c.theirs];
    lines.splice(c.line, c.mine.length, ...next);
    const shift = next.length - c.mine.length;
    setDraft(lines.join("\n"));
    setConflicts((all) =>
      all
        .filter((x) => x !== c)
        .map((x) => (x.line > c.line ? { ...x, line: x.line + shift } : x)),
    );
  };
  const cancel = () => {
    setDraft(base);
    setMerged(0);
    setConflicts([]);
    setError("");
    setTab("preview");
  };

  const added =
    keptPrefix && draft.startsWith(keptPrefix)
      ? draft.slice(keptPrefix.length).trim()
      : undefined;
  const preview =
    draft.trim() === "" ? (
      <div className="ie-empty" data-testid="editor-empty">
        {empty}
      </div>
    ) : added !== undefined && keptPrefix ? (
      <div className="ie-doc" data-testid="editor-preview">
        <div className="ie-kept" data-testid="editor-kept">
          <p className="ie-mark">{t.kept}</p>
          <Markdown text={keptPrefix} document />
        </div>
        {added ? (
          <div className="ie-added" data-testid="editor-added">
            <p className="ie-mark">{t.added}</p>
            <Markdown text={added} document />
          </div>
        ) : null}
      </div>
    ) : (
      <div className="ie-doc" data-testid="editor-preview">
        <Markdown text={draft} document />
      </div>
    );
  const raw = (
    <div className="ie-raw-wrap">
      <textarea
        ref={area}
        className="ie-raw"
        data-testid="editor-text"
        aria-label={t.rawLabel}
        aria-describedby={`${testId}-hint`}
        spellCheck
        value={draft}
        rows={Math.min(22, Math.max(8, draft.split("\n").length + 1))}
        onChange={(e) => {
          // The file holds no CR; a pasted one becomes an ordinary line end.
          setDraft(e.target.value.replace(/\r\n?/g, "\n"));
          setJustSaved(false);
        }}
      />
      <p className="ie-hint" id={`${testId}-hint`}>
        {t.rawHint}
      </p>
    </div>
  );
  const canSave = (alwaysSavable || dirty) && conflicts.length === 0;
  return (
    <section
      className="ie"
      data-testid={testId}
      data-tab={tab}
      data-dirty={dirty || undefined}
      aria-label={label}
      aria-busy={busy || undefined}
    >
      {merged ? (
        <div className="ie-merged" role="status" data-testid="editor-merged">
          <Icon name="info" aria-hidden="true" />
          <div>
            <strong>{t.mergedTitle}</strong>
            <p>{conflicts.length ? t.conflictLead : t.mergedLead(merged)}</p>
          </div>
        </div>
      ) : null}
      {conflicts.map((c) => (
        <div
          key={`${c.line}-${c.theirs.join("|")}`}
          data-testid="editor-conflict"
        >
          <EditorConflict
            theirs={c.theirs}
            mine={c.mine}
            source="disk"
            onPick={(p) => pick(c, p)}
          />
        </div>
      ))}
      <div className="ie-body ie-tabs">
        <Tabs
          label={t.tabs}
          selected={tab}
          onChange={setTab}
          tabs={[
            { id: "preview", label: t.preview, panel: preview },
            { id: "edit", label: t.edit, panel: raw },
          ]}
        />
        {dirty ? (
          <span className="ie-state" data-testid="editor-unsaved">
            {t.unsaved}
          </span>
        ) : justSaved ? (
          <span
            className="ie-state"
            data-state="saved"
            data-testid="editor-saved"
            role="status"
          >
            {t.saved}
          </span>
        ) : null}
      </div>
      {source ? <div className="ie-source">{source}</div> : null}
      {error ? (
        <p className="ie-error" role="alert" data-testid="editor-error">
          <Icon name="warning" aria-hidden="true" />
          {error}
        </p>
      ) : null}
      <div className="ie-actions">
        <div className="ie-secondary">{secondary}</div>
        <div className="ie-primary">
          {dirty ? (
            <ControlButton
              size="row"
              variant={alwaysSavable ? "quiet" : "secondary"}
              data-testid="editor-cancel"
              isDisabled={busy}
              onPress={cancel}
            >
              {t.cancel}
            </ControlButton>
          ) : null}
          {canSave || (dirty && conflicts.length) ? (
            <ControlButton
              size="row"
              variant="primary"
              data-testid="editor-save"
              isDisabled={conflicts.length > 0 || busy}
              aria-describedby={
                conflicts.length ? `${testId}-blocked` : undefined
              }
              onPress={() => void save()}
            >
              {busy ? t.saving : (saveLabel ?? t.save)}
            </ControlButton>
          ) : null}
          {conflicts.length ? (
            <span className="ie-hint" id={`${testId}-blocked`}>
              {t.conflictBlocks}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
