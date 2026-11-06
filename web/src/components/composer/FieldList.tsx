import type { FilePreview, TreeFolder } from "../../app/composerReads";
import { useText } from "../../i18n";
import { fieldListText } from "../../text/fieldList";
import { Icon } from "../Icon";
import {
  type ChoiceGroup,
  ChoiceList,
  flatChoices,
  optionId,
} from "./ChoiceList";
import { PreviewPane } from "./Palette";

/** The composer's list inside the field box, between the text and the
 * button row (Kentän sisällä, Jari 3.11.2026): the files as a folder tree
 * or a search list with a box on every row for marking several, or the
 * commands, and on a desktop the selected row's preview beside it. The
 * composer owns the state and the keys; this draws them. */
export function FieldList({
  listId,
  kind,
  from,
  head,
  note,
  query,
  groups,
  selected,
  marks,
  searchInput,
  emptyText,
  preview,
  folder,
  onQuery,
  onKeyDown,
  onPick,
  onHover,
  onMark,
  onClearMarks,
  onAdd,
}: {
  listId: string;
  kind: "cmd" | "file";
  from: "button" | "caret";
  head: string;
  note?: string;
  query: string;
  groups: ChoiceGroup[];
  selected: number;
  marks: readonly string[];
  /** The list opened from its button has its own search line. */
  searchInput: boolean;
  emptyText: string;
  preview?: (path: string, signal: AbortSignal) => Promise<FilePreview>;
  /** The selected folder's contents, once read. */
  folder?: TreeFolder;
  onQuery: (query: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPick: (index: number) => void;
  onHover: (index: number) => void;
  onMark: (index: number) => void;
  onClearMarks: () => void;
  onAdd: () => void;
}) {
  const t = useText(fieldListText);
  const flat = flatChoices(groups);
  const files = kind === "file";
  const searching = !!query;
  const k = (key: string) => <kbd>{key}</kbd>;
  const mod =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform)
      ? "⌘"
      : "Ctrl";
  return (
    // biome-ignore lint/a11y: a press inside the list keeps the focus where typing goes; the keys stay with the field or the search.
    <div
      className="ah-choice-pop ah-choice-in"
      data-testid="composer-field-list"
      data-kind={kind}
      data-from={from}
      data-searching={searching || undefined}
      onMouseDown={(e) => {
        if (!(e.target as HTMLElement).closest("input")) e.preventDefault();
      }}
    >
      <div className="ah-choice-head">
        <span>{head}</span>
        {note ? (
          <span className="ah-choice-note" data-testid="composer-list-note">
            {note}
          </span>
        ) : null}
      </div>
      {searchInput ? (
        <label className="ah-choice-search">
          <Icon name={files ? "at" : "slash"} />
          <input
            data-testid="command-search"
            // biome-ignore lint/a11y/noAutofocus: the button opened this search; the focus goes to it as in the chosen round.
            autoFocus
            type="text"
            className="ah-choice-search-input"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={
              selected >= 0 ? optionId(listId, selected) : undefined
            }
            aria-label={files ? t.searchFile : t.searchCommand}
            placeholder={files ? t.searchFilePlaceholder : t.searchCommand}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </label>
      ) : null}
      <div className="ah-choice-body">
        <ChoiceList
          id={listId}
          label={head}
          groups={groups}
          selected={selected}
          checks={files ? { marked: marks, onMark } : undefined}
          emptyText={emptyText}
          onPick={onPick}
          onHover={onHover}
        />
        <section
          className="ah-pal-prev"
          aria-label={t.preview}
          aria-live="polite"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: Scrollable previews must be keyboard focusable.
          tabIndex={0}
        >
          <PreviewPane
            choice={flat[selected]}
            read={preview}
            folder={folder}
            describe
          />
        </section>
      </div>
      {marks.length ? (
        <div className="ah-choice-marked" data-testid="composer-marked">
          <span>{t.marked(marks.length)}</span>
          <span className="ah-crow-grow" />
          <button
            type="button"
            className="ah-choice-clear"
            data-testid="composer-marked-clear"
            onClick={onClearMarks}
          >
            {t.clear}
          </button>
          <button
            type="button"
            className="ah-choice-add"
            data-testid="composer-marked-add"
            onClick={onAdd}
          >
            {t.add(marks.length)}
          </button>
        </div>
      ) : null}
      <div className="ah-choice-keys">
        {from === "caret" && selected < 0 ? (
          <>
            {k("Tab")} {t.keyAddTop} · {k("↓")} {t.keySelects} · {k("Enter")}{" "}
            {t.keySendsAsIs} · {k("Esc")} {t.keyClose}
          </>
        ) : from === "caret" ? (
          <>
            {k("↑")}
            {k("↓")} {t.keySelect} · {k("Tab")} {t.keyAddTop} · {k("Enter")}{" "}
            {t.keyInsert} · {k("Esc")} {t.keyClose}
            {files ? (
              <>
                {" "}
                · {k(mod)}
                {k("P")} {t.keySearchAndSeveral}
              </>
            ) : null}
          </>
        ) : files ? (
          <>
            {k("↑")}
            {k("↓")} {t.keySelect} · {k("Tab")} {t.keyMark} · {k("Enter")}{" "}
            {t.keyInsert} ·{" "}
            {searching ? (
              <>
                {k("→")} {t.keyShowInFolder}
              </>
            ) : (
              <>
                {k("→")}
                {k("←")} {t.keyFolder}
              </>
            )}{" "}
            · {k("Esc")} {t.keyBackToText}
          </>
        ) : (
          <>
            {k("↑")}
            {k("↓")} {t.keySelect} · {k("Enter")} {t.keyAddToStart} · {k("Esc")}{" "}
            {t.keyBackToText}
          </>
        )}
        {from === "button" ? (
          <>
            {" "}
            · {k(mod)}
            {k("P")} {files ? t.keyToCommands : t.keyToFiles}
          </>
        ) : null}
      </div>
    </div>
  );
}
