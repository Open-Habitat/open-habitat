import "./ConversationAssets.css";
import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import type { FileOfferSummary, OfferState } from "../app/fileOffers";
import { formatDate, useText } from "../i18n";
import { conversationAssetsText } from "../text/conversationAssets";
import { ControlButton } from "./ControlElements";
import { offerFacts, offerKind } from "./FileOffer";
import { Icon } from "./Icon";
import { OfferMark, OfferSeen } from "./OfferCard";
import { useProcessView } from "./ProcessTray";
import { type ViewSummary, viewFacts } from "./ViewOffer";

// The conversation's views and files (proto-conversation-assets, rounds 1-3:
// Siru, Oma siru, A Kuvakkeet): a chip beside the workers above the message
// field counts them and opens their list in the workers' panel's place,
// newest first, a view's versions folded under its newest. A row opens its
// item in the right-hand panel and the same row closes it; the list stays
// open beside the item. A row is a link to the item's own tab, so a
// modified or middle click opens the tab as any link does. Each row carries
// the card's own icons at its right end under the pointer, always on touch.

/** One item the list can open: a view, or a file offer. */
export type AssetItem =
  | { kind: "view"; view: ViewSummary }
  | { kind: "file"; offer: FileOfferSummary; state: OfferState };

export const assetId = (item: AssetItem) =>
  item.kind === "view" ? item.view.view_id : item.offer.offer_id;

/** One row of the list: a view with its earlier versions (same title and
 * entry file), or one file offer. */
export type AssetEntry =
  | { kind: "view"; key: string; at: string; versions: ViewSummary[] }
  | {
      kind: "file";
      key: string;
      at: string;
      offer: FileOfferSummary;
      state: OfferState;
    };

/** The list's rows from a conversation's views and offers, newest first.
 * Views of the same title and entry file are one report's versions. The
 * entry alone does not tell reports apart: a single-file export is often
 * `index.html` or `offline.html`, and folding by it hid one report under
 * another's newest. */
export function assetEntries(
  views: ViewSummary[],
  offers: { offer: FileOfferSummary; state: OfferState }[],
): AssetEntry[] {
  const byReport = new Map<string, ViewSummary[]>();
  const newestFirst = [...views].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  for (const v of newestFirst) {
    const report = JSON.stringify([v.title, v.entry]);
    byReport.set(report, [...(byReport.get(report) ?? []), v]);
  }
  return [
    ...[...byReport.values()].map((versions) => ({
      kind: "view" as const,
      key: versions[0].view_id,
      at: versions[0].created_at,
      versions,
    })),
    ...offers.map(({ offer, state }) => ({
      kind: "file" as const,
      key: offer.offer_id,
      at: offer.created_at,
      offer,
      state,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
}

/** What the list asks of its host for each item. */
export type AssetControls = {
  openedId?: string;
  toggle: (item: AssetItem, opener: HTMLElement | null) => void;
  /** The item's own tab, the row's link. */
  href: (item: AssetItem) => string;
  /** The end of the item's publication while public. */
  until: (item: AssetItem) => string | undefined;
  /** The item's own icons: the same row as on its card. */
  actions: (item: AssetItem, label: string) => ReactNode;
};

function time(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return formatDate(
    d,
    today
      ? { hour: "2-digit", minute: "2-digit" }
      : { day: "numeric", month: "numeric" },
  );
}

/** A row's link: a plain press opens the item beside, or closes it when it
 * is the open one; a modified or middle click is left to the browser. */
function RowLink({
  item,
  controls,
  className,
  testId,
  children,
}: {
  item: AssetItem;
  controls: AssetControls;
  className: string;
  testId: string;
  children: ReactNode;
}) {
  const open = controls.openedId === assetId(item);
  const click = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return;
    event.preventDefault();
    controls.toggle(item, event.currentTarget);
  };
  return (
    <a
      href={controls.href(item)}
      className={className}
      data-testid={testId}
      aria-current={open || undefined}
      onClick={click}
    >
      {children}
    </a>
  );
}

function EntryRow({
  entry,
  controls,
  onLocate,
}: {
  entry: AssetEntry;
  controls: AssetControls;
  onLocate: (id: string) => void;
}) {
  const t = useText(conversationAssetsText);
  const [unfolded, setUnfolded] = useState(false);
  const flag = (id: string) => ({
    "data-open": controls.openedId === id || undefined,
  });
  const locate = (id: string, label: string) => (
    <ControlButton
      size="row"
      variant="quiet"
      className="ah-offer-ib"
      data-testid="asset-locate"
      aria-label={`${t.locate}: ${label}`}
      title={t.locate}
      onPress={() => onLocate(id)}
    >
      <Icon name="message" />
    </ControlButton>
  );
  if (entry.kind === "file") {
    const item: AssetItem = {
      kind: "file",
      offer: entry.offer,
      state: entry.state,
    };
    const id = entry.offer.offer_id;
    const until = controls.until(item);
    return (
      <li
        className="ah-asset-entry"
        data-testid="asset-entry"
        data-kind="file"
        data-id={id}
      >
        <div className="ah-asset-line" {...flag(id)}>
          <RowLink
            item={item}
            controls={controls}
            className="ah-asset-row"
            testId="asset-open"
          >
            <OfferMark kind={offerKind(entry.offer, entry.state)} size="s" />
            <span className="ah-asset-text">
              <span className="ah-asset-title">{entry.offer.title}</span>
              <span className="ah-asset-meta">
                {until ? <OfferSeen until={until} /> : null}
                {offerFacts(entry.offer, entry.state).join(" · ")}
                <span className="ah-asset-meta-time">
                  {" · "}
                  {time(entry.at)}
                </span>
              </span>
            </span>
            <span className="ah-asset-time">{time(entry.at)}</span>
          </RowLink>
          {entry.state.state === "ready" ? (
            <span className="ah-asset-acts">
              {controls.actions(item, entry.offer.title)}
              {locate(id, entry.offer.title)}
            </span>
          ) : null}
        </div>
      </li>
    );
  }
  const [newest, ...older] = entry.versions;
  const row = (view: ViewSummary, n?: number) => {
    const item: AssetItem = { kind: "view", view };
    const until = controls.until(item);
    return (
      <div className="ah-asset-line" {...flag(view.view_id)}>
        <RowLink
          item={item}
          controls={controls}
          className={n ? "ah-asset-row ah-asset-row-older" : "ah-asset-row"}
          testId={n ? "asset-open-older" : "asset-open"}
        >
          {n ? (
            <span className="ah-asset-version" title={t.version(n)}>
              {n}
            </span>
          ) : (
            <OfferMark kind="view" size="s" />
          )}
          <span className="ah-asset-text">
            <span className="ah-asset-title">{view.title}</span>
            {n ? null : (
              <span className="ah-asset-meta">
                {until ? <OfferSeen until={until} /> : null}
                {viewFacts(view).join(" · ")}
                <span className="ah-asset-meta-time">
                  {" · "}
                  {time(view.created_at)}
                </span>
              </span>
            )}
          </span>
          <span className="ah-asset-time">{time(view.created_at)}</span>
        </RowLink>
        <span className="ah-asset-acts">
          {controls.actions(item, view.title)}
          {locate(view.view_id, view.title)}
        </span>
      </div>
    );
  };
  return (
    <li
      className="ah-asset-entry"
      data-testid="asset-entry"
      data-kind="view"
      data-id={newest.view_id}
    >
      {row(newest)}
      {older.length ? (
        <button
          type="button"
          className="ah-asset-versions"
          data-testid="asset-versions"
          aria-expanded={unfolded}
          title={unfolded ? t.hideVersions : t.showVersions}
          onClick={() => setUnfolded(!unfolded)}
        >
          <span className="ah-asset-versions-stack" aria-hidden="true" />
          {t.versions(entry.versions.length)}
          <Icon name={unfolded ? "up" : "down"} />
        </button>
      ) : null}
      {unfolded ? (
        <ul className="ah-asset-older" data-testid="asset-older">
          {older.map((v, i) => (
            <li key={v.view_id}>{row(v, older.length - i)}</li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Scrolls the item's card into view if the conversation has loaded it. */
function locateCard(id: string): boolean {
  const card = document.querySelector<HTMLElement>(
    `[data-view-id="${CSS.escape(id)}"][data-testid="view-offer"], [data-offer-id="${CSS.escape(id)}"][data-testid="file-offer"]`,
  );
  if (!card) return false;
  card.scrollIntoView({ block: "center", behavior: "smooth" });
  card.dataset.located = "true";
  window.setTimeout(() => {
    delete card.dataset.located;
  }, 1600);
  return true;
}

/** The chip beside the workers and the list it opens. Nothing while the
 * conversation has neither views nor files. */
export function ConversationAssets({
  entries,
  unavailable,
  controls,
  onOpen,
}: {
  entries: AssetEntry[];
  /** The conversation's offers could not be read just now. */
  unavailable?: boolean;
  controls: AssetControls;
  /** The list opened: its sources are read again. */
  onOpen?: () => void;
}) {
  const t = useText(conversationAssetsText);
  const process = useProcessView();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const chip = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const views = entries.filter((e) => e.kind === "view").length;
  const files = entries.length - views;
  // One floating panel at a time: the workers' panel takes the place.
  const workersPanel = process?.panel;
  useEffect(() => {
    if (workersPanel) setOpen(false);
  }, [workersPanel]);
  useEffect(() => {
    if (!open) return;
    setNotice("");
    // Closes on Escape and on a press outside the list, its chip, the
    // opened item and the menus the icons open.
    const down = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (
        pop.current?.contains(target) ||
        chip.current?.contains(target) ||
        target?.closest?.(".ah-view-pane, .ah-popover, [role='dialog']")
      )
        return;
      setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (!pop.current?.contains(document.activeElement)) return;
      setOpen(false);
      chip.current?.focus();
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  if (!entries.length) return null;
  const toggle = () => {
    const next = !open;
    if (next) {
      process?.setPanel(null);
      onOpen?.();
    }
    setOpen(next);
  };
  const rowControls: AssetControls = {
    ...controls,
    toggle: (item, opener) => {
      controls.toggle(item, opener);
      // Where the item covers the conversation (a phone), the list closes.
      window.requestAnimationFrame(() => {
        const el = pop.current;
        if (el && !el.checkVisibility?.({ visibilityProperty: true }))
          setOpen(false);
      });
    },
  };
  const label = t.chip(views, files);
  return (
    <>
      {open ? (
        <div
          ref={pop}
          className="ah-bg-pop ah-assets-pop"
          role="dialog"
          aria-label={t.title}
          data-testid="assets-list"
        >
          <div className="ah-bg-tabs ah-assets-head">
            <span className="ah-assets-title">
              <span className="ah-assets-count-view" aria-hidden="true">
                {"</>"}
              </span>{" "}
              {t.list} <span className="ah-bg-tab-n">{entries.length}</span>
            </span>
            <ControlButton
              className="ah-bg-x"
              size="inline"
              variant="quiet"
              aria-label={t.close}
              data-testid="assets-close"
              onPress={() => {
                setOpen(false);
                chip.current?.focus();
              }}
            >
              <Icon name="cross" />
            </ControlButton>
          </div>
          <div className="ah-bg-pop-body">
            {notice ? (
              <p className="ah-assets-notice" role="status">
                {notice}
              </p>
            ) : null}
            {unavailable ? (
              <p className="ah-assets-notice" role="status">
                {t.unavailable}
              </p>
            ) : null}
            <ul className="ah-assets" data-testid="assets-rows">
              {entries.map((entry) => (
                <EntryRow
                  key={entry.key}
                  entry={entry}
                  controls={rowControls}
                  onLocate={(id) => {
                    if (locateCard(id)) setOpen(false);
                    else setNotice(t.notLoaded);
                  }}
                />
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      <ControlButton
        ref={chip}
        data-testid="assets-chip"
        data-views={views}
        data-files={files}
        size="inline"
        presentation="pill"
        className="ah-bg-badge ah-assets-chip"
        aria-expanded={open}
        aria-label={label}
        title={t.title}
        onPress={toggle}
      >
        {views ? (
          <>
            <span className="ah-assets-count-view" aria-hidden="true">
              {"</>"}
            </span>
            <span className="ah-bg-n">{views}</span>
          </>
        ) : null}
        {files ? (
          <>
            <Icon name="file" className="ah-bg-kind-ic" />
            <span className="ah-bg-n">{files}</span>
          </>
        ) : null}
      </ControlButton>
    </>
  );
}
