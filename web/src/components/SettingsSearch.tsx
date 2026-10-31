import type { KeyboardEvent, RefObject } from "react";
import { highlight, type SettingsHit } from "../app/settingsIndex";
import { liveText } from "../i18n";
import { settingsSearchText } from "../text/settingsSearch";
import { Icon } from "./Icon";

const txt = liveText(settingsSearchText);

function Marked({ text, query }: { text: string; query: string }) {
  return highlight(text, query).map((part, i) =>
    part.hit ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one fixed text.
      <mark key={i}>{part.text}</mark>
    ) : (
      part.text
    ),
  );
}

/** A description cut to begin near the word it matched. */
function snippet(text: string, query: string) {
  const at = highlight(text, query).findIndex((p) => p.hit);
  const before = highlight(text, query)
    .slice(0, Math.max(0, at))
    .reduce((n, p) => n + p.text.length, 0);
  const start = text.lastIndexOf(" ", Math.max(0, before - 24));
  return start > 0 ? `…${text.slice(start + 1)}` : text;
}

// Settings has one results list: the field and the list find each other by it.
const listId = "settings-search-results";

const summary = (n: number) => txt.summary(n);

export const settingsHitKey = (hit: SettingsHit) =>
  `${hit.kind}-${hit.row ?? hit.section}`;

/** The settings sidebar's search field. While it holds text, `results`
 * shows in place of the section list; the selection moves with the arrow
 * keys while focus stays in the field (macOS System Settings). */
export function SettingsSearchField({
  inputRef,
  query,
  hits,
  selected,
  onQuery,
  onKeyDown,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  hits: readonly SettingsHit[];
  selected: number;
  onQuery: (query: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const open = query.trim() !== "" && hits.length > 0;
  return (
    <div className="s-search">
      <div className="s-search-field">
        <Icon name="search" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          data-testid="settings-search"
          placeholder={txt.search}
          aria-label={txt.search}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open ? `${listId}-${settingsHitKey(hits[selected])}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {query ? (
          <button
            type="button"
            className="s-search-clear"
            data-testid="settings-search-clear"
            aria-label={txt.clear}
            onClick={() => {
              onQuery("");
              inputRef.current?.focus();
            }}
          >
            <Icon name="cross" />
          </button>
        ) : (
          <span className="s-search-key" aria-hidden="true">
            /
          </span>
        )}
      </div>
      <span
        className="s-search-summary"
        role="status"
        data-testid="settings-search-summary"
      >
        {query.trim() ? summary(hits.length) : ""}
      </span>
    </div>
  );
}

export function SettingsSearchResults({
  query,
  hits,
  selected,
  onPick,
}: {
  query: string;
  hits: readonly SettingsHit[];
  selected: number;
  onPick: (index: number) => void;
}) {
  if (!hits.length)
    return (
      <p className="s-results-none" data-testid="settings-search-none">
        {txt.noneBefore} <b>”{query.trim()}”</b>
        {txt.noneAfter}
      </p>
    );
  return (
    <div
      className="s-results"
      role="listbox"
      id={listId}
      aria-label={txt.results}
      data-testid="settings-search-results"
    >
      {hits.map((hit, i) => (
        // biome-ignore lint/a11y/useKeyWithClickEvents: the arrow keys and Enter choose a result from the search field, which keeps focus (aria-activedescendant).
        <div
          key={settingsHitKey(hit)}
          id={`${listId}-${settingsHitKey(hit)}`}
          role="option"
          aria-selected={i === selected}
          tabIndex={-1}
          className="s-result"
          data-testid={`settings-result-${settingsHitKey(hit)}`}
          // A press keeps focus in the field until the result is chosen.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(i)}
        >
          <Icon name={hit.icon} />
          <span className="s-result-text">
            <span className="s-result-label">
              <Marked text={hit.label} query={query} />
            </span>
            <span className="s-result-path">{hit.path}</span>
            {hit.synonym ? (
              <span className="s-result-why">
                {txt.matched} <Marked text={hit.synonym} query={query} />
              </span>
            ) : hit.desc ? (
              <span className="s-result-path">
                <Marked text={snippet(hit.desc, query)} query={query} />
              </span>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}
