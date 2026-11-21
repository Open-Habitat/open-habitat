import { type ReactNode, useEffect, useRef, useState } from "react";
import { ControlButton } from "../../../../web/src/components/ControlElements";
import { EditorConflict, type ConflictPick } from "../../../../web/src/components/EditorConflict";
import { type MergeConflict, threeWay } from "../../../../web/src/components/editorMerge";
import { Icon } from "../../../../web/src/components/Icon";
import { Markdown } from "../../../../web/src/components/Markdown";
import { Tabs } from "../../../../web/src/components/Overlays";
import { catalog, useText } from "../../../../web/src/i18n";
// The conflict card's rules live with the workspace editor that owns it.
import "../../../../web/src/components/BrowserEditor.css";
import "./editor.css";

// The one instructions editor both rounds use (issue
// new-user-agent-instructions-template, Jari 21.11.2026): an ordinary
// Markdown block that opens in Esikatselu, a Muokkaa tab with the raw text,
// and Tallenna / Peru. Onboarding round 4 shows the note the agent wrote in
// it before the route's Save; Settings round 2 shows the file on disk in it.
//
// Everything here is production pieces: Tabs (Overlays), Markdown in its
// document mode, ControlButton, and on a refused save the workspace editor's
// own three-way merge (editorMerge.threeWay) and conflict card
// (EditorConflict). The editor owns only its draft; the page owns the file,
// gives the editor `value` and decides what Tallenna does. A refused
// compare-and-swap comes back as `{ conflict: theirs }`, the text now on
// disk: the editor folds the other change into the draft, as the workspace
// editor does, and asks the person to save again.

const fi = {
  preview: "Esikatselu",
  edit: "Muokkaa",
  tabs: "Näkymä",
  save: "Tallenna",
  cancel: "Peru",
  unsaved: "Tallentamattomia muutoksia",
  saved: "Tallennettu",
  rawLabel: "Ohjeet Markdown-tekstinä",
  rawHint: "Tavallista tekstiä. # aloittaa otsikon ja - listan rivin.",
  kept: "Ennallaan",
  added: "Uutta",
  mergedTitle: "Ohjeet muuttuivat sillä välin, kun muokkasit niitä.",
  mergedLead: (n: number) =>
    n === 1
      ? "Toinen muutos on nyt mukana tekstissäsi. Mitään ei ole vielä tallennettu: tarkista ja tallenna uudelleen."
      : `${n} toista muutosta on nyt mukana tekstissäsi. Mitään ei ole vielä tallennettu: tarkista ja tallenna uudelleen.`,
  conflictLead: "Sama kohta muuttui myös toisaalla. Valitse ensin, mikä jää.",
  conflictBlocks: "Valitse ensin, mikä jää.",
};
export const editorText = catalog(fi, {
  preview: "Preview",
  edit: "Edit",
  tabs: "View",
  save: "Save",
  cancel: "Cancel",
  unsaved: "Unsaved changes",
  saved: "Saved",
  rawLabel: "Instructions as Markdown text",
  rawHint: "Plain text. # starts a heading and - a list line.",
  kept: "Unchanged",
  added: "New",
  mergedTitle: "The instructions changed while you were editing them.",
  mergedLead: (n: number) =>
    n === 1
      ? "The other change is now part of your text. Nothing is saved yet: check it and save again."
      : `${n} other changes are now part of your text. Nothing is saved yet: check it and save again.`,
  conflictLead: "The same part changed elsewhere too. Choose what stays first.",
  conflictBlocks: "Choose what stays first.",
});

export type SaveResult = { ok: true } | { conflict: string };
type Tab = "preview" | "edit";

export function InstructionsEditor({
  value,
  label,
  onSave,
  onDraft,
  alwaysSavable = false,
  saveLabel,
  startTab = "preview",
  keptPrefix,
  editLocked,
  empty,
  source,
  secondary,
  beforeActions,
  "data-testid": testId = "instructions-editor",
}: {
  /** The text the editor starts from and Peru returns to: the file on disk,
   * or in onboarding the note the agent wrote. A new value while the person
   * has edits is merged into them, never replaces them. */
  value: string;
  /** Accessible name of the block. */
  label: string;
  /** What Tallenna does with the draft. */
  onSave: (text: string) => SaveResult;
  /** Every draft change, for a page that shows the text elsewhere too. */
  onDraft?: (text: string) => void;
  /** Tallenna without edits (onboarding: nothing is on disk yet). */
  alwaysSavable?: boolean;
  saveLabel?: string;
  startTab?: Tab;
  /** An existing file's text the page did not add: drawn as unchanged, the
   * rest as new (onboarding with instructions already in place). */
  keptPrefix?: string;
  /** Why the text cannot be edited right now; hides the tabs. */
  editLocked?: string;
  /** The preview of an empty text. */
  empty?: ReactNode;
  /** Where the text lives, under the body (Settings). */
  source?: ReactNode;
  /** Actions on the left of the action row (Tee myöhemmin, Muokkaa agentin kanssa). */
  secondary?: ReactNode;
  /** Anything the page adds between the text and the actions (A4.3's own words). */
  beforeActions?: ReactNode;
  "data-testid"?: string;
}) {
  const t = useText(editorText);
  const [base, setBase] = useState(value);
  const [draft, setDraft] = useState(value);
  const [tab, setTab] = useState<Tab>(startTab);
  const [merged, setMerged] = useState(0);
  const [conflicts, setConflicts] = useState<MergeConflict[]>([]);
  const [justSaved, setJustSaved] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const dirty = draft !== base;

  // The page's text moved (the agent added a line, the person's own words
  // landed): an untouched draft follows it, an edited one gets it merged in.
  useEffect(() => {
    if (value === base) return;
    setDraft((d) => (d === base ? value : threeWay(d, base, value).text));
    setBase(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  useEffect(() => onDraft?.(draft), [draft, onDraft]);
  useEffect(() => {
    if (tab === "edit") area.current?.focus({ preventScroll: true });
  }, [tab]);

  const save = () => {
    const result = onSave(draft);
    if ("ok" in result) {
      setBase(draft);
      setMerged(0);
      setConflicts([]);
      setTab("preview");
      setJustSaved(true);
      return;
    }
    // The file changed since it was read: fold the other change in and keep
    // the person's text where both touched the same lines.
    const m = threeWay(draft, base, result.conflict);
    setBase(result.conflict);
    setDraft(m.text);
    setMerged(m.incoming.length + m.conflicts.length);
    setConflicts(m.conflicts);
    setJustSaved(false);
  };
  const pick = (c: MergeConflict, choice: ConflictPick) => {
    const lines = draft.split("\n");
    const next = choice === "mine" ? c.mine : choice === "theirs" ? c.theirs : [...c.mine, ...c.theirs];
    lines.splice(c.line, c.mine.length, ...next);
    const shift = next.length - c.mine.length;
    setDraft(lines.join("\n"));
    setConflicts((all) => all.filter((x) => x !== c).map((x) => (x.line > c.line ? { ...x, line: x.line + shift } : x)));
  };
  const cancel = () => {
    setDraft(base);
    setMerged(0);
    setConflicts([]);
    setTab("preview");
  };

  const preview =
    draft.trim() === "" ? (
      <div className="ie-empty" data-testid="editor-empty">
        {empty}
      </div>
    ) : keptPrefix && draft.startsWith(keptPrefix) ? (
      <div className="ie-doc" data-testid="editor-preview">
        <div className="ie-kept" data-testid="editor-kept">
          <p className="ie-mark">{t.kept}</p>
          <Markdown text={keptPrefix} document />
        </div>
        {draft.slice(keptPrefix.length).trim() ? (
          <div className="ie-added" data-testid="editor-added">
            <p className="ie-mark">{t.added}</p>
            <Markdown text={draft.slice(keptPrefix.length).trim()} document />
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
          setDraft(e.target.value);
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
    <section className="ie" data-testid={testId} data-tab={editLocked ? "locked" : tab} data-dirty={dirty || undefined} aria-label={label}>
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
        <div key={`${c.line}-${c.theirs.join("|")}`} data-testid="editor-conflict">
          <EditorConflict theirs={c.theirs} source="agent" onPick={(p) => pick(c, p)} />
        </div>
      ))}
      {editLocked ? (
        <div className="ie-body">
          {preview}
          <p className="ie-hint ie-locked" data-testid="editor-locked">
            <Icon name="clock" aria-hidden="true" />
            {editLocked}
          </p>
        </div>
      ) : (
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
            <span className="ie-state" data-state="saved" data-testid="editor-saved" role="status">
              {t.saved}
            </span>
          ) : null}
        </div>
      )}
      {source ? <div className="ie-source">{source}</div> : null}
      {beforeActions}
      <div className="ie-actions">
        <div className="ie-secondary">{secondary}</div>
        <div className="ie-primary">
          {dirty && !alwaysSavable ? (
            <ControlButton size="row" variant="secondary" data-testid="editor-cancel" onPress={cancel}>
              {t.cancel}
            </ControlButton>
          ) : dirty && alwaysSavable ? (
            <ControlButton size="row" variant="quiet" data-testid="editor-cancel" onPress={cancel}>
              {t.cancel}
            </ControlButton>
          ) : null}
          {canSave || (dirty && conflicts.length) ? (
            <ControlButton
              size="row"
              variant="primary"
              data-testid="editor-save"
              isDisabled={conflicts.length > 0}
              aria-describedby={conflicts.length ? `${testId}-blocked` : undefined}
              onPress={save}
            >
              {saveLabel ?? t.save}
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
