import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FilePreview } from "../../app/composerReads";
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

const TABS: [PaletteTab, string][] = [
  ["all", "Tiedostot"],
  ["changed", "Muutetut"],
  ["cmd", "Komennot"],
];

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
  const state = usePreview(choice, read);
  if (!choice) return <p className="ah-pal-none">Ei valittua.</p>;
  if (choice.type === "status")
    return <p className="ah-pal-none">{choice.text}</p>;
  if (choice.type === "command")
    return (
      <>
        <h2>/{choice.name}</h2>
        <p>{choice.description}</p>
        <dl>
          <dt>Lähde</dt>
          <dd>{choice.tag}</dd>
        </dl>
        <p className="ah-pal-explain">
          {choice.run
            ? "Ajetaan heti, kun valitset sen. Ei lähetä mitään agentille."
            : choice.terminalOnly
              ? "Tämä laajennuksen komento avaa agentin päätteen valikon, joten selain ei voi ajaa sitä."
              : `Lisätään viestin alkuun. Kun lähetät viestin, agentti ${choice.tone === "skill" ? "lataa taidon" : choice.tone === "prompt" ? "laajentaa pohjan" : "ajaa komennon"}.`}
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
        <p className="ah-pal-none">Esikatselua ei saatu.</p>
      ) : !p ? (
        <p className="ah-pal-none">Luetaan…</p>
      ) : p.kind === "binary" ? (
        <p className="ah-pal-none">Binääritiedosto: ei esikatselua.</p>
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
        aria-label="Sulje valitsin"
        onClick={onClose}
      />
      <div
        className="ah-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Valitse tiedostot tai komento"
      >
        <div className="ah-pal-tabs" role="tablist">
          {TABS.map(([key, label]) => (
            <button
              key={key}
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
              {label}
              {key === "changed" && changedCount !== undefined ? (
                <span className="ah-pal-n">{changedCount}</span>
              ) : null}
            </button>
          ))}
        </div>
        <label className="ah-choice-search">
          <Icon name={tab === "cmd" ? "slash" : "at"} />
          <input
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
            aria-label="Hae"
            placeholder={
              tab === "cmd"
                ? "Hae komentoa tai taitoa"
                : "Hae tiedostoa · Tab merkitsee useamman"
            }
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </label>
        <div className="ah-pal-body">
          <ChoiceList
            id={listId}
            label={tab === "cmd" ? "Komennot" : "Tiedostot"}
            groups={groups}
            selected={selected}
            marks={tab === "cmd" ? undefined : marks}
            emptyText={`Ei osumia${query ? ` haulle “${query}”` : ""}.`}
            onPick={onPick}
            onHover={onHover}
          />
          <section
            className="ah-pal-prev"
            aria-label="Esikatselu"
            aria-live="polite"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: Scrollable previews must be keyboard focusable.
            tabIndex={0}
          >
            <PreviewPane choice={flat[selected]} read={preview} />
          </section>
        </div>
        <div className="ah-choice-keys">
          {tab === "cmd" ? (
            <>
              <kbd>↑</kbd>
              <kbd>↓</kbd> valitse · <kbd>Enter</kbd> lisää viestin alkuun
            </>
          ) : (
            <>
              <kbd>Tab</kbd> merkitse · <kbd>Enter</kbd>{" "}
              {n > 1 ? `lisää ${n} polkua` : "lisää polku"}
            </>
          )}{" "}
          · <kbd>{MOD}</kbd>
          <kbd>P</kbd> seuraava välilehti · <kbd>Esc</kbd> takaisin kenttään
          {tab === "cmd" ? null : (
            <span className="ah-pal-where">
              lisätään muodossa{" "}
              {shell ? (
                <>
                  <code>polku</code> komentoon
                </>
              ) : (
                <code>@polku</code>
              )}
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
