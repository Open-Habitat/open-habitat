import { type KeyboardEvent, useEffect, useId, useRef } from "react";
import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import { HabitatMark, type MarkState } from "./HabitatMark";
import { Icon } from "./Icon";
import "./Switcher.css";

/** Splits text into plain and marked parts: every word that contains a term
 * is marked, as the person's daemon matched it. */
export function markedParts(
  text: string,
  terms: readonly string[],
): { text: string; mark: boolean }[] {
  if (!terms.length) return [{ text, mark: false }];
  const parts: { text: string; mark: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(/\p{L}[\p{L}\p{N}'’-]*|\p{N}+/gu)) {
    const lower = m[0].toLocaleLowerCase();
    if (!terms.some((t) => lower.includes(t))) continue;
    const at = m.index ?? 0;
    if (at > last) parts.push({ text: text.slice(last, at), mark: false });
    parts.push({ text: m[0], mark: true });
    last = at + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), mark: false });
  return parts;
}

function Marked({ text, terms }: { text: string; terms: readonly string[] }) {
  return (
    <>
      {markedParts(text, terms).map((p, i) =>
        p.mark ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts of one fixed text.
          <mark key={i}>{p.text}</mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts of one fixed text.
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/** One row of the list, ready to show. */
export type SwitcherItem =
  | {
      kind: "conversation";
      key: string;
      title: string;
      /** Marked in the title when the query matched the name. */
      titleTerms: readonly string[];
      workspace: string;
      mark: MarkState;
      previous?: boolean;
      archived?: boolean;
      ago?: string;
      /** The sentence that stands for it, when a message matched. */
      line?: { who: string; text: string; terms: readonly string[] };
      /** Its other hits, which → opens under it. */
      more?: { count: number; open: boolean };
    }
  | {
      kind: "hit";
      key: string;
      who: string;
      text: string;
      terms: readonly string[];
      ago: string;
    }
  | { kind: "continue"; key: string; label: string };

export interface SwitcherWords {
  dialog: string;
  placeholder: string;
  previous: string;
  archived: string;
  more: (n: number) => string;
  moreLabel: (n: number, open: boolean) => string;
}

/**
 * The ⌘K list (prototype round 3, direction 1 Keskustelut): one ranked list
 * where a row is a conversation with its best matching sentence inside, its
 * other hits under it when opened. It returns the person's intents; the app
 * owns the query's search, the order and where a choice leads.
 */
export function Switcher({
  open,
  query,
  items,
  heading,
  status,
  empty,
  foot,
  words,
  selected,
  onQuery,
  onSelect,
  onChoose,
  onExpand,
  onClose,
}: {
  open: boolean;
  query: string;
  items: SwitcherItem[];
  /** Above the rows, as "Recently opened" over the empty query's list. */
  heading?: string;
  /** A line about message search (still building, not answering). */
  status?: string;
  /** Said when a query found nothing. */
  empty?: string;
  foot: string;
  words: SwitcherWords;
  selected: number;
  onQuery: (q: string) => void;
  onSelect: (index: number) => void;
  onChoose: (index: number) => void;
  onExpand: (index: number, open: boolean) => void;
  onClose: () => void;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const at = Math.min(selected, Math.max(0, items.length - 1));
  const cur = items[at];
  // biome-ignore lint/correctness/useExhaustiveDependencies: follow the selection after each render that may move it.
  useEffect(() => {
    list.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView?.({ block: "nearest" });
  }, [at, items.length]);
  const parentOf = (index: number) => {
    for (let i = index; i >= 0; i--)
      if (items[i].kind === "conversation") return i;
    return -1;
  };
  // → and ← belong to the field's caret unless the list has something to
  // open or close: → only at the end of the text, ← only when open.
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    const plain = !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length)
        onSelect(
          (at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length,
        );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (cur) onChoose(at);
    } else if (e.key === "ArrowRight" && plain) {
      const el = e.currentTarget;
      if (
        cur?.kind === "conversation" &&
        cur.more &&
        !cur.more.open &&
        el.selectionStart === el.value.length &&
        el.selectionEnd === el.value.length
      ) {
        e.preventDefault();
        onExpand(at, true);
      }
    } else if (e.key === "ArrowLeft" && plain) {
      if (cur?.kind === "hit") {
        e.preventDefault();
        onExpand(parentOf(at), false);
      } else if (cur?.kind === "conversation" && cur.more?.open) {
        e.preventDefault();
        onExpand(at, false);
      }
    }
  };
  return (
    <ModalOverlay
      className="ah-switcher-back"
      isOpen={open}
      isDismissable
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal className="ah-switcher-modal">
        <Dialog
          className="ah-switcher"
          aria-label={words.dialog}
          data-testid="switcher"
        >
          <div className="ah-switcher-field">
            <Icon name="search" />
            <input
              ref={input}
              autoFocus
              data-testid="switcher-input"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={cur ? `${listId}-${cur.key}` : undefined}
              aria-label={words.dialog}
              placeholder={words.placeholder}
              value={query}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => onQuery(e.target.value)}
              onKeyDown={keys}
            />
            <kbd className="ah-switcher-esc">Esc</kbd>
          </div>
          <div className="ah-switcher-body">
            {status ? (
              <p className="ah-switcher-status" data-testid="switcher-status">
                {status}
              </p>
            ) : null}
            <div
              className="ah-switcher-list"
              role="listbox"
              id={listId}
              aria-label={words.dialog}
              ref={list}
            >
              {heading && items.length ? (
                <div role="presentation" className="ah-switcher-head">
                  {heading}
                </div>
              ) : null}
              {items.map((it, i) => (
                // biome-ignore lint/a11y/useKeyWithClickEvents: the arrow keys and Enter choose from the field, which keeps focus (aria-activedescendant).
                <div
                  key={it.key}
                  role="option"
                  tabIndex={-1}
                  id={`${listId}-${it.key}`}
                  data-testid={`switcher-row-${it.key}`}
                  data-kind={it.kind}
                  className={
                    it.kind === "conversation"
                      ? "ah-switcher-card"
                      : it.kind === "hit"
                        ? "ah-switcher-hit"
                        : undefined
                  }
                  aria-selected={i === at}
                  // A press keeps focus in the field.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => i !== at && onSelect(i)}
                  onClick={() => {
                    onChoose(i);
                  }}
                >
                  {it.kind === "conversation" ? (
                    <>
                      <HabitatMark state={it.mark} size={16} />
                      <span className="ah-switcher-top">
                        <span className="ah-switcher-title">
                          <Marked text={it.title} terms={it.titleTerms} />
                        </span>
                        {it.previous ? (
                          <span className="ah-switcher-prev">
                            {words.previous}
                          </span>
                        ) : null}
                        {it.archived ? (
                          <span className="ah-switcher-tag">
                            {words.archived}
                          </span>
                        ) : null}
                      </span>
                      <span className="ah-switcher-meta">
                        <span className="ah-switcher-ws">{it.workspace}</span>
                        {it.ago ? <span>{it.ago}</span> : null}
                      </span>
                      {it.line ? (
                        <span className="ah-switcher-line">
                          <span className="ah-switcher-who">{it.line.who}</span>
                          <span className="ah-switcher-text">
                            <Marked text={it.line.text} terms={it.line.terms} />
                          </span>
                        </span>
                      ) : null}
                      {it.more ? (
                        <button
                          type="button"
                          className="ah-switcher-count"
                          data-testid={`switcher-more-${it.key}`}
                          aria-expanded={it.more.open}
                          aria-label={words.moreLabel(
                            it.more.count,
                            it.more.open,
                          )}
                          tabIndex={-1}
                          onClick={(e) => {
                            e.stopPropagation();
                            onExpand(i, !it.more?.open);
                            input.current?.focus();
                          }}
                        >
                          {words.more(it.more.count)}{" "}
                          <span aria-hidden="true">
                            {it.more.open ? "←" : "→"}
                          </span>
                        </button>
                      ) : null}
                    </>
                  ) : it.kind === "hit" ? (
                    <>
                      <span className="ah-switcher-who">{it.who}</span>
                      <span className="ah-switcher-snippet">
                        <Marked text={it.text} terms={it.terms} />
                      </span>
                      <span className="ah-switcher-ago">{it.ago}</span>
                    </>
                  ) : (
                    <>
                      <Icon name="search" />
                      <span className="ah-switcher-title">{it.label}</span>
                    </>
                  )}
                </div>
              ))}
              {empty && !items.length ? (
                <p className="ah-switcher-empty" data-testid="switcher-empty">
                  {empty}
                </p>
              ) : null}
            </div>
          </div>
          <p className="ah-switcher-foot">{foot}</p>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** The band above the field in a conversation opened from a hit. */
export function SearchBand({
  text,
  keyHint,
  closeLabel,
  onClose,
}: {
  text: string;
  keyHint: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="ah-search-band" data-testid="jump-band" role="status">
      <Icon name="search" />
      <span className="ah-search-band-text">{text}</span>
      <span className="ah-search-band-key">{keyHint}</span>
      <button
        type="button"
        className="ah-search-band-close"
        aria-label={closeLabel}
        data-testid="jump-close"
        onClick={onClose}
      >
        <Icon name="cross" />
      </button>
    </div>
  );
}

/** The rail's door to search: the touch entry, and where a mouse user
 * learns the key. */
export function SearchDoor({
  label,
  keyHint,
  onOpen,
}: {
  label: string;
  keyHint: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="ah-search-door"
      data-testid="search-door"
      aria-keyshortcuts="Meta+K Control+K /"
      onClick={onOpen}
    >
      <Icon name="search" />
      <span>{label}</span>
      <kbd>{keyHint}</kbd>
    </button>
  );
}
