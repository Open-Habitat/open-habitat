# components/composer/Palette.tsx

Generated from web/src/components/composer/Palette.tsx; do not edit.

```tsx
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FilePreview } from "../../app/composerReads";
import { useText } from "../../i18n";
import { paletteText } from "../../text/palette";
import { Icon } from "../Icon";
import {
  type Choice,
  type ChoiceGroup,
  ChoiceList,
  flatChoices,
  GitBadge,
  optionId,
} from "./ChoiceList";

export type PaletteTab = "changed" | "all" | "cmd";

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl";

const TABS: PaletteTab[] = ["all", "changed", "cmd"];

/** The selected file's preview: Git's diff of a changed file, otherwise the
 * file's first lines, read when the selection rests on it. */
function usePreview(
  choice: Choice | undefined,
  read?: (path: string, signal: AbortSignal) => Promise<FilePreview>,
) {
  const path = choice?.type === "file" ? choice.path : "";
  const [state, setState] = useState<{
    path: string;
    preview?: FilePreview;
    failed?: boolean;
  }>({ path: "" });
  useEffect(() => {
    if (!path || !read) return;
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      read(path, abort.signal).then(
        (preview) => setState({ path, preview }),
        () => {
          if (!abort.signal.aborted) setState({ path, failed: true });
        },
      );
    }, 150);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
    };
  }, [path, read]);
  return state.path === path ? state : { path };
}

function PreviewPane({
  choice,
  read,
}: {
  choice: Choice | undefined;
  read?: (path: string, signal: AbortSignal) => Promise<FilePreview>;
}) {
  const t = useText(paletteText);
  const state = usePreview(choice, read);
  if (!choice) return <p className="ah-pal-none">{t.nothingSelected}</p>;
  if (choice.type === "status")
    return <p className="ah-pal-none">{choice.text}</p>;
  if (choice.type === "command")
    return (
      <>
        <h2>/{choice.name}</h2>
        <p>{choice.description}</p>
        <dl>
          <dt>{t.source}</dt>
          <dd>{choice.tag}</dd>
        </dl>
        <p className="ah-pal-explain">
          {choice.run
            ? t.runsAtOnce
            : choice.terminalOnly
              ? t.terminalOnly
              : choice.tone === "skill"
                ? t.addsSkill
                : choice.tone === "prompt"
                  ? t.addsPrompt
                  : t.addsCommand}
        </p>
      </>
    );
  const p = state.preview;
  return (
    <>
      <h2 className="ah-pal-mono">
        {choice.path} {choice.git ? <GitBadge mark={choice.git} /> : null}
      </h2>
      {state.failed ? (
        <p className="ah-pal-none">{t.previewFailed}</p>
      ) : !p ? (
        <p className="ah-pal-none">{t.reading}</p>
      ) : p.kind === "binary" ? (
        <p className="ah-pal-none">{t.binary}</p>
      ) : (
        <pre className={p.kind === "diff" ? "ah-pal-diff" : undefined}>
          {p.kind === "diff"
            ? p.text.split("\n").map((line, i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: preview lines are positional.
                  key={i}
                  className={
                    line.startsWith("+") && !line.startsWith("+++")
                      ? "ah-pal-add"
                      : line.startsWith("-") && !line.startsWith("---")
                        ? "ah-pal-del"
                        : undefined
                  }
                >
                  {line}
                  {"\n"}
                </span>
              ))
            : p.text}
          {p.truncated ? "…" : ""}
        </pre>
      )}
    </>
  );
}

/** Ctrl/⌘+P: a picker over the conversation for files and
 * commands, with a preview and Tab to mark several files. Esc returns to the
 * field at the same caret. */
export function Palette({
  listId,
  tab,
  query,
  groups,
  selected,
  marks,
  shell,
  changedCount,
  preview,
  onQuery,
  onTab,
  onPick,
  onHover,
  onKeyDown,
  onClose,
}: {
  listId: string;
  tab: PaletteTab;
  query: string;
  groups: ChoiceGroup[];
  selected: number;
  marks: Set<string>;
  shell: boolean;
  changedCount?: number;
  preview?: (path: string, signal: AbortSignal) => Promise<FilePreview>;
  onQuery: (query: string) => void;
  onTab: (tab: PaletteTab) => void;
  onPick: (index: number) => void;
  onHover: (index: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClose: () => void;
}) {
  const t = useText(paletteText);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const flat = flatChoices(groups);
  const n = marks.size;
  // Over the whole page: an ancestor of the composer may be a containing
  // block for fixed positioning.
  return createPortal(
    <div className="ah-palette-host">
      <button
        type="button"
        className="ah-palette-scrim"
        tabIndex={-1}
        aria-label={t.close}
        onClick={onClose}
      />
      <div
        data-testid="composer-palette"
        className="ah-palette"
        role="dialog"
        aria-modal="true"
        aria-label={t.dialog}
      >
        <div className="ah-pal-tabs" role="tablist">
          {TABS.map((key) => (
            <button
              key={key}
              data-testid={`palette-tab-${key}`}
              type="button"
              role="tab"
              aria-selected={tab === key}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onTab(key);
                input.current?.focus();
              }}
            >
              {t.tabs[key]}
              {key === "changed" && changedCount !== undefined ? (
                <span className="ah-pal-n">{changedCount}</span>
              ) : null}
            </button>
          ))}
        </div>
        <label className="ah-choice-search">
          <Icon name={tab === "cmd" ? "slash" : "at"} />
          <input
            data-testid="file-search"
            ref={input}
            type="text"
            className="ah-choice-search-input"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={
              selected >= 0 && flat[selected]?.type !== "status"
                ? optionId(listId, selected)
                : undefined
            }
            aria-label={t.search}
            placeholder={tab === "cmd" ? t.searchCommand : t.searchFile}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </label>
        <div className="ah-pal-body">
          <ChoiceList
            id={listId}
            label={tab === "cmd" ? t.commands : t.files}
            groups={groups}
            selected={selected}
            marks={tab === "cmd" ? undefined : marks}
            emptyText={t.noMatches(query)}
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
            <PreviewPane choice={flat[selected]} read={preview} />
          </section>
        </div>
        <div
          data-testid="palette-hints"
          data-mark-count={n}
          className="ah-choice-keys"
        >
          {tab === "cmd" ? (
            <>
              <kbd>↑</kbd>
              <kbd>↓</kbd> {t.select} · <kbd>Enter</kbd> {t.addToStart}
            </>
          ) : (
            <>
              <kbd>Tab</kbd> {t.mark} · <kbd>Enter</kbd> {t.addPaths(n)}
            </>
          )}{" "}
          · <kbd>{MOD}</kbd>
          <kbd>P</kbd> {t.nextTab} · <kbd>Esc</kbd> {t.backToField}
          {tab === "cmd" ? null : (
            <span className="ah-pal-where">
              {shell
                ? t.insertedInCommand(<code>{t.path}</code>)
                : t.insertedAs(<code>@{t.path}</code>)}
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

```
