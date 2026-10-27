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
import {
  ViewOfferCard,
  type ViewOfferState,
  type ViewSummary,
} from "../components/ViewOffer";
import { ViewPanel, ViewSplit } from "../components/ViewPanel";
import { listViews, mintViewURL, viewTabPath } from "./views";

// Agent HTML views (ADR 0032, prototype round 2 "Suora"): an offer card has
// both places on every press, the right-hand panel and an own browser tab.
// Nothing opens without a press, and the app never reads the view's content.

type ViewControls = {
  state: (id: string) => ViewOfferState;
  open: (view: ViewSummary, opener: HTMLElement | null) => void;
  openTab: (view: ViewSummary) => void;
};

const ViewContext = createContext<ViewControls | null>(null);

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
    setExpanded(false);
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

  // The panel's title takes focus when a view opens.
  useEffect(() => {
    if (opened) title.current?.focus();
  }, [opened?.view.view_id, opened]);

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
      <ViewSplit
        open={!!opened}
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
          ) : null
        }
      >
        {children}
      </ViewSplit>
    </ViewContext.Provider>
  );
}

/** A conversation notice: an HTML view offer when it carries a view and the
 * installation offers views, otherwise the plain notice card. A view offer on an installation without views shows
 * nothing. */
export function NoticeEntry({ notice }: { notice: AgentNotice }) {
  const views = useContext(ViewContext);
  const view = notice.view;
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
