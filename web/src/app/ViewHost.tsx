import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type AgentNotice, AgentNoticeCard } from "../components/AgentNotice";
import { ControlButton } from "../components/ControlElements";
import { FileOfferCard, FileShelf } from "../components/FileOffer";
import { Icon } from "../components/Icon";
import {
  ViewOfferCard,
  type ViewOfferState,
  type ViewSummary,
} from "../components/ViewOffer";
import { ViewPanel, ViewSplit } from "../components/ViewPanel";
import {
  type FileOfferSummary,
  noteOffer,
  refreshOffers,
  resetFileOffers,
  useConversationOffers,
  useFileOffer,
  useFileOffers,
} from "./fileOffers";
import { listViews, mintViewURL, viewTabPath } from "./views";

// Agent HTML views (ADR 0032, prototype round 2 "Suora"): an offer card has
// both places on every press, the right-hand panel and an own browser tab.
// Nothing opens without a press, and the app never reads the view's content.
// The same right-hand panel holds the conversation's offered files (Hylly);
// one panel is open at a time.

type ViewControls = {
  state: (id: string) => ViewOfferState;
  open: (view: ViewSummary, opener: HTMLElement | null) => void;
  openTab: (view: ViewSummary) => void;
};

const ViewContext = createContext<ViewControls | null>(null);

type ShelfControls = {
  /** The conversation whose files the panel shows, when it is open. */
  openFor?: string;
  open: (conversationId: string, offerId?: string) => void;
  close: () => void;
};

const ShelfContext = createContext<ShelfControls | null>(null);

type Shelf = {
  conversationId: string;
  selected?: { offerId: string; path?: string };
  opener: HTMLElement | null;
};

type Opened = {
  view: ViewSummary;
  src?: string;
  failed?: boolean;
  opener: HTMLElement | null;
};

const minPanel = 320;
const minConversation = 360;

function panelBounds(total: number) {
  return { min: minPanel, max: Math.max(minPanel, total - minConversation) };
}

export function ViewHost({
  identity,
  csrf,
  children,
}: {
  /** A new person drops the previous person's open view. The children are
   * never remounted for it: they own their own state. */
  identity?: string;
  csrf?: string;
  children: ReactNode;
}) {
  // Views exist only where the installation configures a view origin; until
  // the list answers, no offer is shown.
  const [enabled, setEnabled] = useState(false);
  const [states, setStates] = useState<Record<string, ViewOfferState>>({});
  const [opened, setOpened] = useState<Opened>();
  const [shelf, setShelf] = useState<Shelf>();
  const [expanded, setExpanded] = useState(false);
  const [total, setTotal] = useState(() => window.innerWidth);
  const [width, setWidth] = useState(() => Math.round(window.innerWidth * 0.5));
  const title = useRef<HTMLHeadingElement>(null);
  const mintSeq = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: identity is the trigger, not an input.
  useEffect(() => {
    mintSeq.current++;
    setEnabled(false);
    setStates({});
    setOpened(undefined);
    setShelf(undefined);
    setExpanded(false);
  }, [identity]);

  // Another person's offers are forgotten. The first identity is not a
  // change: a reset then would only discard what its cards just asked for.
  const offersOf = useRef(identity);
  useEffect(() => {
    if (offersOf.current === identity) return;
    offersOf.current = identity;
    resetFileOffers();
  }, [identity]);

  useEffect(() => {
    if (!csrf) return;
    const abort = new AbortController();
    void listViews(abort.signal)
      .then((views) => {
        if (!abort.signal.aborted) setEnabled(views !== null);
      })
      .catch(() => {
        // An unreadable list leaves offers hidden: they need the origin.
      });
    return () => abort.abort();
  }, [csrf]);

  useEffect(() => {
    const resize = () => setTotal(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const setState = useCallback((id: string, state: ViewOfferState) => {
    setStates((before) => ({ ...before, [id]: state }));
  }, []);

  const open = useCallback(
    (view: ViewSummary, opener: HTMLElement | null) => {
      if (!csrf) return;
      const seq = ++mintSeq.current;
      setShelf(undefined);
      setOpened({ view, opener });
      setState(view.view_id, "opening");
      void mintViewURL(csrf, view.view_id).then(
        (src) => {
          if (seq !== mintSeq.current) return;
          setOpened({ view, opener, src });
          setState(view.view_id, "open");
        },
        () => {
          if (seq !== mintSeq.current) return;
          setOpened({ view, opener, failed: true });
          setState(view.view_id, "failed");
        },
      );
    },
    [csrf, setState],
  );

  // The tab opens synchronously with noopener on this app's own page, which
  // mints and replaces itself, so no popup blocker sees an async open.
  const openTab = useCallback(
    (view: ViewSummary) => {
      window.open(viewTabPath(view.view_id), "_blank", "noopener,noreferrer");
      setState(view.view_id, "tab_requested");
    },
    [setState],
  );

  const close = useCallback(() => {
    mintSeq.current++;
    setOpened((current) => {
      if (current) {
        setState(current.view.view_id, "idle");
        // Return focus to the card's button the panel was opened from.
        window.setTimeout(() => current.opener?.focus(), 0);
      }
      return undefined;
    });
    setExpanded(false);
  }, [setState]);

  const openShelf = useCallback(
    (conversationId: string, offerId?: string) => {
      const opener =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      mintSeq.current++;
      setOpened((current) => {
        if (current) setState(current.view.view_id, "idle");
        return undefined;
      });
      setShelf({
        conversationId,
        opener,
        selected: offerId ? { offerId } : undefined,
      });
      refreshOffers(conversationId);
    },
    [setState],
  );

  const closeShelf = useCallback(() => {
    setShelf((current) => {
      if (current) window.setTimeout(() => current.opener?.focus(), 0);
      return undefined;
    });
    setExpanded(false);
  }, []);

  // The panel's title takes focus when a view or the file panel opens, not
  // when a file is chosen in the panel.
  const shelfFor = shelf?.conversationId;
  useEffect(() => {
    if (opened || shelfFor) title.current?.focus();
  }, [opened?.view.view_id, opened, shelfFor]);

  const shelfControls = useMemo<ShelfControls>(
    () => ({
      openFor: shelf?.conversationId,
      open: openShelf,
      close: closeShelf,
    }),
    [shelf?.conversationId, openShelf, closeShelf],
  );

  const controls = useMemo<ViewControls | null>(
    () =>
      enabled
        ? {
            state: (id) => states[id] ?? "idle",
            open,
            openTab,
          }
        : null,
    [enabled, states, open, openTab],
  );
  const bounds = panelBounds(total);
  const shown = Math.min(Math.max(width, bounds.min), bounds.max);

  return (
    <ViewContext.Provider value={controls}>
      <ShelfContext.Provider value={shelfControls}>
        <ViewSplit
          open={!!opened || !!shelf}
          expanded={expanded}
          width={shown}
          min={bounds.min}
          max={bounds.max}
          onResize={(next) =>
            setWidth(Math.min(Math.max(next, bounds.min), bounds.max))
          }
          onReset={() => setWidth(Math.round(total * 0.5))}
          onShowConversation={() => setExpanded(false)}
          panel={
            opened ? (
              <ViewPanel
                title={opened.view.title}
                src={opened.src}
                failed={opened.failed}
                expanded={expanded}
                titleRef={title}
                onToggleExpanded={() => setExpanded(!expanded)}
                onOpenTab={() => openTab(opened.view)}
                onClose={close}
              />
            ) : shelf ? (
              <ShelfPanel
                shelf={shelf}
                titleRef={title}
                onSelect={(selected) => setShelf({ ...shelf, selected })}
                onClose={closeShelf}
              />
            ) : null
          }
        >
          {children}
        </ViewSplit>
      </ShelfContext.Provider>
    </ViewContext.Provider>
  );
}

/** A conversation notice: an HTML view offer when it carries a view and the
 * installation offers views, otherwise the plain notice card. A view offer on an installation without views shows
 * nothing. */
export function NoticeEntry({ notice }: { notice: AgentNotice }) {
  const views = useContext(ViewContext);
  const view = notice.view;
  if (notice.file_offer) return <FileOfferEntry offer={notice.file_offer} />;
  if (!view) return <AgentNoticeCard notice={notice} />;
  if (!views) return null;
  return (
    <ViewOfferCard
      view={view}
      state={views.state(view.view_id)}
      onOpen={(opener) => views.open(view, opener)}
      onOpenTab={() => views.openTab(view)}
    />
  );
}

/** A conversation's file offer: its card, which reads the offer's facts and
 * opens the conversation's file panel at it. */
function FileOfferEntry({ offer }: { offer: FileOfferSummary }) {
  const state = useFileOffer(offer.offer_id);
  const shelf = useContext(ShelfContext);
  useEffect(() => {
    noteOffer(offer);
  }, [offer]);
  return (
    <FileOfferCard
      offer={offer}
      state={state}
      onShowFiles={
        shelf
          ? (offerId) => shelf.open(offer.conversation_id, offerId)
          : undefined
      }
    />
  );
}

function ShelfPanel({
  shelf,
  titleRef,
  onSelect,
  onClose,
}: {
  shelf: Shelf;
  titleRef: React.Ref<HTMLHeadingElement>;
  onSelect: (selected: { offerId: string; path: string }) => void;
  onClose: () => void;
}) {
  const list = useConversationOffers(shelf.conversationId);
  const offers = Array.isArray(list) ? list : [];
  const states = useFileOffers(offers.map((o) => o.offer_id));
  // Opened from a card, the panel shows that offer's first file.
  const first =
    shelf.selected && !shelf.selected.path ? shelf.selected : undefined;
  const firstIndex = first
    ? offers.findIndex((o) => o.offer_id === first.offerId)
    : -1;
  const firstState = firstIndex >= 0 ? states[firstIndex] : undefined;
  const firstPath =
    firstState?.state === "ready"
      ? firstState.manifest.items[0]?.path
      : undefined;
  useEffect(() => {
    if (first && firstPath)
      onSelect({ offerId: first.offerId, path: firstPath });
  }, [first, firstPath, onSelect]);
  return (
    <FileShelf
      offers={offers.map((offer, i) => ({ offer, state: states[i] }))}
      unavailable={list === "unavailable"}
      selected={shelf.selected}
      titleRef={titleRef}
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}

/** The conversation header's file panel toggle, with the conversation's
 * offered file count; nothing while the conversation has none. */
export function FilesHeaderControl({
  conversationId,
}: {
  conversationId?: string;
}) {
  const shelf = useContext(ShelfContext);
  const list = useConversationOffers(conversationId);
  if (!shelf || !conversationId || !Array.isArray(list) || list.length === 0)
    return null;
  const count = list.reduce((n, o) => n + o.files, 0);
  const open = shelf.openFor === conversationId;
  return (
    <ControlButton
      data-testid="toggle-file-shelf"
      size="row"
      variant="quiet"
      className="ah-files-toggle"
      aria-label={`Tiedostot: ${count}`}
      title="Keskustelun tiedostot"
      aria-pressed={open}
      onPress={() => (open ? shelf.close() : shelf.open(conversationId))}
    >
      <Icon name="file" /> <span>{count}</span>
    </ControlButton>
  );
}
