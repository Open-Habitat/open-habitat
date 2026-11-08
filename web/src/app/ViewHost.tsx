import {
  createContext,
  type ReactNode,
  type Ref,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type AgentNotice, AgentNoticeCard } from "../components/AgentNotice";
import { ControlButton } from "../components/ControlElements";
import {
  type AssetControls,
  type AssetItem,
  assetEntries,
  assetId,
  ConversationAssets,
} from "../components/ConversationAssets";
import {
  FileOfferCard,
  offerDownload,
  singleItem,
} from "../components/FileOffer";
import { GuidePanel } from "../components/GuidePanel";
import { Icon } from "../components/Icon";
import { OfferActions, OfferSeen } from "../components/OfferCard";
import { OfferPanel } from "../components/OfferPanel";
import {
  ViewOfferCard,
  type ViewOfferState,
  type ViewSummary,
  type ViewVisibility,
  viewDownload,
  viewFacts,
} from "../components/ViewOffer";
import { ViewPanel, ViewSplit } from "../components/ViewPanel";
import { useText } from "../i18n";
import { guideText } from "../text/guide";
import type { StartGoal } from "./composerReads";
import {
  type FileOfferSummary,
  noteOffer,
  offerTabPath,
  refreshOffers,
  resetFileOffers,
  useConversationOffers,
  useFileOffer,
  useFileOffers,
} from "./fileOffers";
import { readGuide, setGuide, useGuide } from "./goalGuide";
import {
  addressOf,
  defaultExpiry,
  isPublic,
  refreshViewLinks,
  setViewDuration,
  setViewPublic,
  useViewAddressMark,
  useViewLinks,
  useViewLinksFreshness,
  useViewLinksUnknown,
} from "./viewLinks";
import { listViews, mintViewURL, viewTabPath } from "./views";

// What an agent offers in a conversation, views (ADR 0032) and files, on one
// card that opens its item in the one right-hand panel beside the
// conversation; the same card closes it again (proto-offer-cards-consistent,
// Kortti, Viereen, Kulma). The conversation's chip beside the workers lists
// them (proto-conversation-assets) and opens them in the same panel. Nothing
// opens without a press, and the app never reads a view's content. One
// panel is open at a time, a started goal's guide (Opas) included: the
// conversation shown activates its guide owner, and the guide's open state
// lives in the tab's guide memory (goalGuide) so that a conversation created
// meanwhile takes it over.

type OfferControls = {
  /** The installation offers views (it has a view origin). */
  views: boolean;
  /** The item open in the panel. */
  openedId?: string;
  state: (id: string) => ViewOfferState;
  /** Open the item in the panel, or close it when it is the open one. */
  toggle: (item: AssetItem, opener: HTMLElement | null) => void;
  /** The item, or one file of a folder offer, in a tab of its own. */
  openTab: (item: AssetItem, path?: string) => void;
  /** The site's longest publication; absent where it shares nothing
   * publicly or the person's addresses are not known. */
  maxDays?: number;
  setPublic: (view: ViewSummary, on: boolean) => void;
  setDuration: (view: ViewSummary, days: number) => void;
  /** Why the last visibility change of a view did not go through. */
  problem: (id: string) => string | undefined;
  /** A card shows a view: the conversation's list knows it from now on. */
  noteView: (view: ViewSummary) => void;
  /** The person's views of one conversation, newest first. */
  viewsOf: (conversationId: string) => ViewSummary[];
  /** Read the person's views again (the list opened). */
  refreshViews: () => void;
};

const OfferContext = createContext<OfferControls | null>(null);

type GuideControls = {
  /** The guide owner of the conversation shown now. */
  active?: string;
  activate: (owner: string) => void;
  deactivate: (owner: string) => void;
  open: (owner: string, goal: StartGoal, page: string) => void;
  close: () => void;
};

const GuideContext = createContext<GuideControls | null>(null);

type Opened =
  | {
      kind: "view";
      view: ViewSummary;
      src?: string;
      failed?: boolean;
      opener: HTMLElement | null;
    }
  | {
      kind: "file";
      offer: FileOfferSummary;
      /** The file of a folder offer shown now. */
      path?: string;
      opener: HTMLElement | null;
    };

const openedId = (o: Opened) =>
  o.kind === "view" ? o.view.view_id : o.offer.offer_id;

// Below their sum the panel covers the conversation (ViewPanel.css).
const minPanel = 320;
// The guide is a narrow reading column, not a view.
const guidePanel = 400;
const minConversation = 360;

function panelBounds(total: number) {
  return { min: minPanel, max: Math.max(minPanel, total - minConversation) };
}

/** Whether anyone with a view's address may open it, as the person's
 * address store knows; absent where the site shares nothing publicly. */
function useViewVisibility(
  view: ViewSummary,
  controls: OfferControls,
): ViewVisibility | undefined {
  const links = useViewLinks();
  const unknownList = useViewLinksUnknown();
  const mark = useViewAddressMark(view.view_id);
  const address = addressOf(links, view.view_id);
  const shown = !!address && isPublic(address);
  return controls.maxDays
    ? {
        public: shown,
        until: shown ? address?.public_until : undefined,
        url: shown ? address?.url : undefined,
        maxDays: controls.maxDays,
        pending: mark === "busy",
        unknown: mark === "uncertain" || unknownList,
        onPublic: (on) => controls.setPublic(view, on),
        onDuration: (days) => controls.setDuration(view, days),
      }
    : undefined;
}

export function ViewHost({
  identity,
  csrf,
  children,
}: {
  /** A new person drops the previous person's open item. The children are
   * never remounted for it: they own their own state. */
  identity?: string;
  csrf?: string;
  children: ReactNode;
}) {
  // Views exist only where the installation configures a view origin; until
  // the list answers, no view offer is shown.
  const [enabled, setEnabled] = useState(false);
  const [views, setViews] = useState<ViewSummary[]>([]);
  const [states, setStates] = useState<Record<string, ViewOfferState>>({});
  const [opened, setOpened] = useState<Opened>();
  const [expanded, setExpanded] = useState(false);
  const [total, setTotal] = useState(() => window.innerWidth);
  const [width, setWidth] = useState(() => Math.round(window.innerWidth * 0.5));
  const [guideFor, setGuideFor] = useState<string>();
  const guide = useGuide(guideFor);
  const guideOpen = !!guide?.open;
  const [guideWidth, setGuideWidth] = useState(guidePanel);
  const guideFocus = useRef<HTMLElement | null | undefined>(undefined);
  const guideOwner = useRef(guideFor);
  guideOwner.current = guideFor;
  // Another panel takes the place of the guide; the guide stays known.
  const displaceGuide = useCallback(() => {
    const owner = guideOwner.current;
    const current = owner ? readGuide(owner) : undefined;
    if (owner && current?.open) setGuide(owner, { ...current, open: false });
  }, []);
  const title = useRef<HTMLHeadingElement>(null);
  const mintSeq = useRef(0);
  const viewSeq = useRef(0);
  const links = useViewLinks();
  const [problems, setProblems] = useState<Record<string, string>>({});
  // A refusal that answers after another person signed in is not theirs.
  const person = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: identity is the trigger, not an input.
  useEffect(() => {
    mintSeq.current++;
    viewSeq.current++;
    person.current++;
    setEnabled(false);
    setViews([]);
    setStates({});
    setOpened(undefined);
    setExpanded(false);
    setProblems({});
  }, [identity]);

  // Another person's offers are forgotten. The first identity is not a
  // change: a reset then would only discard what its cards just asked for.
  const offersOf = useRef(identity);
  useEffect(() => {
    if (offersOf.current === identity) return;
    offersOf.current = identity;
    resetFileOffers();
  }, [identity]);

  const readViews = useCallback((signal?: AbortSignal) => {
    const seq = ++viewSeq.current;
    return listViews(signal).then((list) => {
      if (signal?.aborted || seq !== viewSeq.current) return list;
      setEnabled(list !== null);
      if (list) setViews(list);
      return list;
    });
  }, []);

  useEffect(() => {
    if (!csrf) return;
    const abort = new AbortController();
    void readViews(abort.signal)
      .then((list) => {
        if (list && !abort.signal.aborted)
          void refreshViewLinks(abort.signal).catch(() => {
            // Without the list no card offers a link.
          });
      })
      .catch(() => {
        // An unreadable list leaves view offers hidden: they need the origin.
      });
    return () => abort.abort();
  }, [csrf, readViews]);

  useViewLinksFreshness(enabled);

  useEffect(() => {
    const resize = () => setTotal(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const setState = useCallback((id: string, state: ViewOfferState) => {
    setStates((before) => ({ ...before, [id]: state }));
  }, []);

  const openView = useCallback(
    (view: ViewSummary, opener: HTMLElement | null) => {
      if (!csrf) return;
      const seq = ++mintSeq.current;
      displaceGuide();
      setOpened((current) => {
        if (current?.kind === "view") setState(current.view.view_id, "idle");
        return { kind: "view", view, opener };
      });
      setState(view.view_id, "opening");
      void mintViewURL(csrf, view.view_id).then(
        (src) => {
          if (seq !== mintSeq.current) return;
          setOpened({ kind: "view", view, opener, src });
          setState(view.view_id, "open");
        },
        () => {
          if (seq !== mintSeq.current) return;
          setOpened({ kind: "view", view, opener, failed: true });
          setState(view.view_id, "failed");
        },
      );
    },
    [csrf, setState, displaceGuide],
  );

  const openFile = useCallback(
    (offer: FileOfferSummary, opener: HTMLElement | null, path?: string) => {
      mintSeq.current++;
      displaceGuide();
      setOpened((current) => {
        if (current?.kind === "view") setState(current.view.view_id, "idle");
        return { kind: "file", offer, path, opener };
      });
    },
    [setState, displaceGuide],
  );

  const close = useCallback(() => {
    mintSeq.current++;
    setOpened((current) => {
      if (current) {
        if (current.kind === "view") setState(current.view.view_id, "idle");
        // Return focus to the card or row the panel was opened from.
        window.setTimeout(() => {
          if (current.opener?.isConnected) current.opener.focus();
        }, 0);
      }
      return undefined;
    });
    setExpanded(false);
  }, [setState]);

  const current = opened ? openedId(opened) : undefined;
  const toggle = useCallback(
    (item: AssetItem, opener: HTMLElement | null) => {
      if (assetId(item) === current) close();
      else if (item.kind === "view") openView(item.view, opener);
      else openFile(item.offer, opener);
    },
    [current, close, openView, openFile],
  );

  // Resolve a view's address on the host in the new tab. Another tab may
  // have deleted it while this card was in the background; even a focus
  // refresh can still be in flight when the person presses the tab icon.
  const openTab = useCallback(
    (item: AssetItem, path?: string) => {
      if (item.kind === "view") {
        window.open(
          viewTabPath(item.view.view_id),
          "_blank",
          "noopener,noreferrer",
        );
        setState(item.view.view_id, "tab_requested");
      } else
        window.open(
          offerTabPath(item.offer.offer_id, path),
          "_blank",
          "noopener,noreferrer",
        );
    },
    [setState],
  );

  // The panel's title takes focus when an item opens, not when a folder
  // offer's panel moves between its files.
  useEffect(() => {
    if (current) title.current?.focus();
  }, [current]);

  const deactivateGuide = useCallback(
    (owner: string) =>
      setGuideFor((current) => (current === owner ? undefined : current)),
    [],
  );
  // An opened guide takes the panel from an opened item.
  useEffect(() => {
    if (!guideOpen) return;
    mintSeq.current++;
    setOpened((current) => {
      if (current?.kind === "view") setState(current.view.view_id, "idle");
      return undefined;
    });
    setExpanded(false);
  }, [guideOpen, setState]);
  // Opened from the top bar, the guide takes focus once it is shown; opened by
  // Aloita, the field keeps it for the placeholder just selected.
  const guideShown = !opened && guideOpen && guide;
  const guideVisible = !!guideShown;
  useEffect(() => {
    if (guideVisible && guideFocus.current !== undefined)
      title.current?.focus();
  }, [guideVisible]);

  const guideControls = useMemo<GuideControls>(
    () => ({
      active: guideFor,
      activate: setGuideFor,
      deactivate: deactivateGuide,
      open: (owner, goal, page) => {
        guideFocus.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        setGuide(owner, { goal, page, open: true });
      },
      close: () => {
        const owner = guideOwner.current;
        const current = owner ? readGuide(owner) : undefined;
        if (owner && current) setGuide(owner, { ...current, open: false });
        const opener = guideFocus.current;
        guideFocus.current = undefined;
        if (opener) window.setTimeout(() => opener.focus(), 0);
      },
    }),
    [guideFor, deactivateGuide],
  );

  const linkList = typeof links === "object" ? links : undefined;
  const maxDays = linkList && linkList.maxDays > 0 ? linkList.maxDays : 0;
  const change = useCallback(
    (view: ViewSummary, write: (csrf: string) => Promise<void>) => {
      if (!csrf) return;
      const id = view.view_id;
      const at = person.current;
      setProblems(({ [id]: _, ...rest }) => rest);
      void write(csrf).catch((error: Error) => {
        if (at !== person.current) return;
        setProblems((before) => ({ ...before, [id]: error.message }));
      });
    },
    [csrf],
  );
  const setPublic = useCallback(
    (view: ViewSummary, on: boolean) =>
      change(view, (csrf) =>
        setViewPublic(csrf, view.view_id, on, defaultExpiry(maxDays)),
      ),
    [change, maxDays],
  );
  const setDuration = useCallback(
    (view: ViewSummary, days: number) =>
      change(view, (csrf) => setViewDuration(csrf, view.view_id, days)),
    [change],
  );
  const noteView = useCallback((view: ViewSummary) => {
    setViews((before) =>
      before.some((v) => v.view_id === view.view_id)
        ? before
        : [view, ...before],
    );
  }, []);
  const refreshViews = useCallback(() => {
    void readViews().catch(() => {
      // The list keeps the views it knows.
    });
  }, [readViews]);
  const controls = useMemo<OfferControls>(
    () => ({
      views: enabled,
      openedId: current,
      state: (id) => states[id] ?? "idle",
      toggle,
      openTab,
      maxDays: maxDays || undefined,
      setPublic,
      setDuration,
      problem: (id) => problems[id],
      noteView,
      viewsOf: (conversationId) =>
        enabled
          ? views.filter((v) => v.conversation_id === conversationId)
          : [],
      refreshViews,
    }),
    [
      enabled,
      current,
      states,
      toggle,
      openTab,
      maxDays,
      setPublic,
      setDuration,
      problems,
      noteView,
      views,
      refreshViews,
    ],
  );
  const bounds = panelBounds(total);
  const shown = Math.min(
    Math.max(guideShown ? guideWidth : width, bounds.min),
    bounds.max,
  );

  return (
    <OfferContext.Provider value={controls}>
      <GuideContext.Provider value={guideControls}>
        <ViewSplit
          open={!!opened || !!guideShown}
          expanded={expanded}
          width={shown}
          min={bounds.min}
          max={bounds.max}
          onResize={(next) =>
            (guideShown ? setGuideWidth : setWidth)(
              Math.min(Math.max(next, bounds.min), bounds.max),
            )
          }
          onReset={() =>
            guideShown
              ? setGuideWidth(guidePanel)
              : setWidth(Math.round(total * 0.5))
          }
          onShowConversation={() => setExpanded(false)}
          panel={
            opened?.kind === "view" ? (
              <OpenedViewPanel
                opened={opened}
                controls={controls}
                expanded={expanded}
                titleRef={title}
                onToggleExpanded={() => setExpanded(!expanded)}
                onClose={close}
              />
            ) : opened?.kind === "file" ? (
              <OpenedFilePanel
                opened={opened}
                controls={controls}
                expanded={expanded}
                titleRef={title}
                onToggleExpanded={() => setExpanded(!expanded)}
                onSub={(path) =>
                  setOpened((o) => (o?.kind === "file" ? { ...o, path } : o))
                }
                onClose={close}
              />
            ) : guideShown ? (
              <GuidePanel
                goal={guideShown.goal}
                page={guideShown.page}
                titleRef={title}
                onClose={guideControls.close}
              />
            ) : null
          }
        >
          {children}
        </ViewSplit>
      </GuideContext.Provider>
    </OfferContext.Provider>
  );
}

/** A view's own icons: publish, its own tab and its zip. */
function ViewActions({
  view,
  controls,
  label = view.title,
}: {
  view: ViewSummary;
  controls: OfferControls;
  label?: string;
}) {
  const visibility = useViewVisibility(view, controls);
  return (
    <OfferActions
      label={label}
      publish={visibility}
      onTab={() => controls.openTab({ kind: "view", view })}
      download={viewDownload(view)}
    />
  );
}

function OpenedViewPanel({
  opened,
  controls,
  expanded,
  titleRef,
  onToggleExpanded,
  onClose,
}: {
  opened: Extract<Opened, { kind: "view" }>;
  controls: OfferControls;
  expanded: boolean;
  titleRef: Ref<HTMLHeadingElement>;
  onToggleExpanded: () => void;
  onClose: () => void;
}) {
  const visibility = useViewVisibility(opened.view, controls);
  const shown = visibility?.public && !visibility.unknown;
  return (
    <ViewPanel
      title={opened.view.title}
      facts={
        <>
          {viewFacts(opened.view).join(" · ")}
          {" · "}
          <OfferSeen words until={shown ? visibility?.until : undefined} />
        </>
      }
      src={opened.src}
      failed={opened.failed}
      expanded={expanded}
      titleRef={titleRef}
      onToggleExpanded={onToggleExpanded}
      actions={<ViewActions view={opened.view} controls={controls} />}
      onClose={onClose}
    />
  );
}

function OpenedFilePanel({
  opened,
  controls,
  expanded,
  titleRef,
  onToggleExpanded,
  onSub,
  onClose,
}: {
  opened: Extract<Opened, { kind: "file" }>;
  controls: OfferControls;
  expanded: boolean;
  titleRef: Ref<HTMLHeadingElement>;
  onToggleExpanded: () => void;
  onSub: (path?: string) => void;
  onClose: () => void;
}) {
  const state = useFileOffer(opened.offer.offer_id);
  return (
    <OfferPanel
      offer={opened.offer}
      state={state}
      path={opened.path}
      expanded={expanded}
      titleRef={titleRef}
      onToggleExpanded={onToggleExpanded}
      onSub={onSub}
      onTab={(path) =>
        controls.openTab({ kind: "file", offer: opened.offer, state }, path)
      }
      onClose={onClose}
    />
  );
}

/** A conversation notice: a view or file offer card, otherwise the plain
 * notice card. A view offer on an installation without views shows
 * nothing. */
export function NoticeEntry({ notice }: { notice: AgentNotice }) {
  const controls = useContext(OfferContext);
  const view = notice.view;
  if (notice.file_offer)
    return <FileOfferEntry offer={notice.file_offer} controls={controls} />;
  if (!view) return <AgentNoticeCard notice={notice} />;
  if (!controls?.views) return null;
  return <ViewOfferEntry view={view} controls={controls} />;
}

/** One view offer card. Every card of the same view shows the one address
 * state the person's store holds, and waits with the others while a change
 * to it is on its way. */
function ViewOfferEntry({
  view,
  controls,
}: {
  view: ViewSummary;
  controls: OfferControls;
}) {
  const visibility = useViewVisibility(view, controls);
  const noteView = controls.noteView;
  useEffect(() => {
    noteView(view);
  }, [view, noteView]);
  return (
    <ViewOfferCard
      view={view}
      state={controls.state(view.view_id)}
      open={controls.openedId === view.view_id}
      onToggle={(opener) => controls.toggle({ kind: "view", view }, opener)}
      onOpenTab={() => controls.openTab({ kind: "view", view })}
      visibility={visibility}
      problem={controls.problem(view.view_id)}
    />
  );
}

/** A conversation's file offer card: it reads the offer's facts and opens
 * the offer beside the conversation. */
function FileOfferEntry({
  offer,
  controls,
}: {
  offer: FileOfferSummary;
  controls: OfferControls | null;
}) {
  const state = useFileOffer(offer.offer_id);
  useEffect(() => {
    noteOffer(offer);
  }, [offer]);
  return (
    <FileOfferCard
      offer={offer}
      state={state}
      open={controls?.openedId === offer.offer_id}
      onToggle={
        controls
          ? (opener) => controls.toggle({ kind: "file", offer, state }, opener)
          : undefined
      }
      onTab={
        controls
          ? () => controls.openTab({ kind: "file", offer, state })
          : undefined
      }
    />
  );
}

/** The conversation's views and files: the chip beside the workers above
 * the message field, and its list. Nothing (null) while there are none, so
 * the strip that holds it is not drawn empty. */
export function useAssetsControl(conversationId?: string): ReactNode {
  const controls = useContext(OfferContext);
  const list = useConversationOffers(conversationId);
  const offers = Array.isArray(list) ? list : [];
  const states = useFileOffers(offers.map((o) => o.offer_id));
  const links = useViewLinks();
  if (!controls || !conversationId) return null;
  const views = controls.viewsOf(conversationId);
  const entries = assetEntries(
    views,
    offers.map((offer, i) => ({ offer, state: states[i] })),
  );
  if (!entries.length) return null;
  const assetControls: AssetControls = {
    openedId: controls.openedId,
    toggle: controls.toggle,
    href: (item) =>
      item.kind === "view"
        ? viewTabPath(item.view.view_id)
        : offerTabPath(item.offer.offer_id),
    until: (item) => {
      if (item.kind !== "view" || !controls.maxDays) return undefined;
      const address = addressOf(links, item.view.view_id);
      return address && isPublic(address)
        ? (address.public_until ?? undefined)
        : undefined;
    },
    actions: (item, label) =>
      item.kind === "view" ? (
        <ViewActions view={item.view} controls={controls} label={label} />
      ) : (
        <OfferActions
          label={label}
          onTab={() => controls.openTab(item)}
          download={offerDownload(
            item.offer,
            singleItem(
              item.state.state === "ready" ? item.state.manifest : undefined,
            ),
          )}
        />
      ),
  };
  return (
    <ConversationAssets
      entries={entries}
      unavailable={list === "unavailable"}
      controls={assetControls}
      onOpen={() => {
        refreshOffers(conversationId);
        controls.refreshViews();
      }}
    />
  );
}

/** The conversation header's guide toggle (Opas). It makes the conversation
 * shown the guide's owner, and appears only while the conversation has a
 * start-page goal: started in this tab or recorded by Pi as a skill call. */
export function GuideHeaderControl({
  owner,
  goal,
  page,
}: {
  owner?: string;
  goal?: StartGoal;
  page?: string;
}) {
  const t = useText(guideText);
  const host = useContext(GuideContext);
  const guide = useGuide(owner);
  const activate = host?.activate;
  const deactivate = host?.deactivate;
  useEffect(() => {
    if (!owner || !activate || !deactivate) return;
    activate(owner);
    return () => deactivate(owner);
  }, [owner, activate, deactivate]);
  const shown = guide?.goal ?? goal;
  if (!host || !owner || !shown) return null;
  const open = !!guide?.open && host.active === owner;
  return (
    <ControlButton
      data-testid="guide-toggle"
      size="row"
      variant="quiet"
      className="ah-guide-toggle"
      aria-label={open ? t.hide : t.show}
      title={t.guideFor(shown.title)}
      aria-pressed={open}
      onPress={() =>
        open ? host.close() : host.open(owner, shown, guide?.page ?? page ?? "")
      }
    >
      <Icon name="scroll" />{" "}
      <span className="ah-guide-toggle-label">{t.guide}</span>
    </ControlButton>
  );
}
