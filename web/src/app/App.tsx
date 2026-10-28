import {
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  type Location,
  Navigate,
  type NavigateProps,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import {
  AccountLogoutDialog,
  AccountSettings,
  AppShell,
  Button,
  ConnectionBanner,
  InlineNotice,
  NewVersionBanner,
} from "../components";
import { accountLabel } from "../components/Account";
import { ArchiveNotice } from "../components/ArchiveNotice";
import { LinkRow } from "../components/ControlElements";
import { HomeWorkspaces } from "../components/HomeWorkspaces";
import { Landing } from "../components/Landing";
import { LoginCard, LoginErrorNotice } from "../components/LoginCard";
import { refused } from "../components/ModelPicker";
import { ArchivedWorkspaces } from "../components/Navigation";
import type { ReturnConversation } from "../components/ReturnView";
import { AccountProfileOnboarding } from "./AccountProfileOnboarding";
import { BrowserConversation } from "./BrowserConversation";
import {
  dismissBundlePrompt,
  reloadForNewBundle,
  useBundleState,
  watchBundle,
} from "./bundleRelease";
import { CloneJobs } from "./cloneJobs";
import { ConversationJournal } from "./conversationJournal";
import { ConversationStore } from "./conversationStore";
import {
  canRecheckCreation,
  createTracked,
  list as listConversations,
  readArchiveResult,
  readCloseResult,
  type Session,
  sendArchive,
  sendCloseEmpty,
  worktreeNameFrom,
} from "./conversations";
import { FallbackAccount } from "./FallbackAccount";
import { seededRouteOpen } from "./firstRoute";
import { GitHubOnboarding } from "./GitHubOnboarding";
import { adoptGuide } from "./goalGuide";
import { HistoryView } from "./HistoryView";
import { adoptCreation } from "./heldMessages";
import {
  archiveKey,
  closeKey,
  overlaid,
  parseKey,
  renameKey,
  visibilityKey,
} from "./hostOverlay";
import { useLanding } from "./landing";
import {
  MutationLayer,
  mutationFetch,
  refusalReason,
  useMutationLayer,
  WriteRefused,
} from "./mutations";
import { NewConversationModelDialog } from "./NewConversationModelDialog";
import { NewWorkspacePage } from "./NewWorkspacePage";
import { CreatingConversation } from "./PendingConversation";
import { type Choice, loadPiModels, PiModelSelector } from "./PiModelSelector";
import { PiModelsProvider } from "./PiModels";
import {
  type AccountProfile,
  accountSession,
  piStatus,
  sessionCSRF,
} from "./pi";
import { reconnectDiagnostic, reconnectFetch } from "./reconnectDiagnostic";
import { SingleWorkspaceBarView } from "./SingleWorkspaceBarView";
import {
  StoragePressureNotice,
  StoragePressureProvider,
} from "./StoragePressure";
import {
  isSettingsRoute,
  settingsHref,
  settingsSection,
} from "./settingsRoute";
import {
  browserOwned,
  placeWorkspace,
  readSnapshot,
  sourceState,
  worktreeMerged,
} from "./snapshot";
import {
  authenticated,
  authenticationRequired,
  clearIdentity,
  filterChanged,
  hostChanged,
  loading,
  piRequired,
  type RootState,
  stale,
  streamOpen,
  unavailable,
} from "./store";
import { TrashNotice } from "./TrashNotice";
import { ViewHost } from "./ViewHost";
import type { DeletionOutcome } from "./WorkspaceDeletion";
import { WorkspaceEditor } from "./WorkspaceEditor";
import { WorkspacePage } from "./WorkspacePage";
import { useRailNow, WorkspaceRailView } from "./WorkspaceRailView";
import {
  readWorkspaceResult,
  sendWorkspace,
  workspaceChange,
} from "./workspaceWrites";

const CatalogPreview =
  import.meta.env.VITE_ENABLE_TEST_FIXTURES === "true"
    ? lazy(() => import("../test/CatalogPreview"))
    : null;

/** A redirect of the view under Settings waits until Settings closes, so
 * work that finishes meanwhile does not take the person out of Settings. */
function Redirect({ held, ...props }: NavigateProps & { held: boolean }) {
  return held ? null : <Navigate {...props} />;
}
function safeRoute(path: string) {
  return path === "/" ||
    path === "/workspaces" ||
    settingsSection(path) !== undefined ||
    path === "/administration" ||
    /^\/workspaces\/ws_[A-Za-z0-9_-]{8,80}$/.test(path) ||
    /^\/agents\/pi:[0-9a-fA-F-]{36}$/.test(path)
    ? path
    : "/workspaces";
}
// Two reads that run side by side. A 401 from either wins over the other's
// failure; otherwise either failure fails both.
type SnapshotFailure = "network" | "status" | "invalid" | "session" | "other";
/** A closed class for the diagnostic; the error text itself is never logged. */
function snapshotFailure(error: unknown): SnapshotFailure {
  if (!(error instanceof Error)) return "other";
  if (error.message === "invalid session") return "session";
  if (
    error instanceof SyntaxError ||
    /^(invalid|oversize|missing) snapshot/.test(error.message)
  )
    return "invalid";
  // fetch rejects with a TypeError when the request never got a response;
  // a TypeError from our own code is not a network failure.
  if (
    error instanceof TypeError &&
    /fetch|load failed|network/i.test(error.message)
  )
    return "network";
  return "other";
}
async function bothReads<A, B>(
  a: Promise<A>,
  b: Promise<B>,
  aLogin: (value: A) => boolean,
  bLogin: (value: B) => boolean,
): Promise<[A, B] | "login"> {
  const [x, y] = await Promise.allSettled([a, b]);
  if (
    (x.status === "fulfilled" && aLogin(x.value)) ||
    (y.status === "fulfilled" && bLogin(y.value))
  )
    return "login";
  if (x.status === "rejected") throw x.reason;
  if (y.status === "rejected") throw y.reason;
  return [x.value, y.value];
}
export function App() {
  const dispatch = useDispatch();
  const bundle = useBundleState();
  useEffect(watchBundle, []);
  const navigate = useNavigate();
  // The router's location. Settings opened from inside the app lies over the
  // view it was opened from, which stays mounted under it at its own location
  // (`location` below), so closing Settings brings that view back as it was:
  // its conversation, editor and panels, without a remount.
  const route = useLocation();
  const outside = useRef<Location | undefined>(undefined);
  if (!isSettingsRoute(route.pathname) && route.pathname !== "/administration")
    outside.current = route;
  const defaultSettingsOpen = isSettingsRoute(route.pathname);
  const piSignInOpen = new URLSearchParams(route.search).has("pi_sign_in");
  const {
    phase,
    snapshot: hostSnapshot,
    filter,
  } = useSelector((s: RootState) => s.connection);
  const landing = useLanding(
    phase === "loading"
      ? "loading"
      : phase === "daemon_unavailable"
        ? "failed"
        : "off",
  );
  // A Pi sign-in started from Settings takes the page itself, as it does
  // elsewhere; a deep link has no view under it and closes to the home view.
  const settingsOver =
    isSettingsRoute(route.pathname) &&
    settingsSection(route.pathname) !== undefined &&
    !piSignInOpen &&
    (phase === "authenticated" || phase === "stale") &&
    !landing.show
      ? outside.current
      : undefined;
  const location = settingsOver ?? route;
  const [refreshKey, setRefreshKey] = useState(0);
  const [piCheckFailed, setPiCheckFailed] = useState(false);
  // Daemon catalog distinguishes browser-started Pi sessions from read-only
  // terminal history; it is not a cookie-scoped conversation lease.
  const [daemonSessions, setDaemonSessions] = useState<Session[]>([]);
  const [csrf, setCSRF] = useState<string>();
  // First load only. A successful onboarding attempt has already checked Pi.
  const piChecked = useRef(false);
  // The cookie is HttpOnly. Its session-bound CSRF is the browser's observable
  // fence across a logout/login in another tab, including while Pi is missing.
  const sessionBinding = useRef<string | undefined>(undefined);
  const identityMismatches = useRef(0);
  // Consecutive snapshot refreshes that failed while the event stream stayed
  // open, and the timer of the next quiet retry.
  const quietRetry = useRef<{ timer?: number; failures: number }>({
    failures: 0,
  });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileLayout, setMobileLayout] = useState(
    () => window.matchMedia?.("(max-width: 800px)").matches ?? false,
  );
  useEffect(() => {
    const query = window.matchMedia?.("(max-width: 800px)");
    if (!query) return;
    const change = () => setMobileLayout(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  const [logoutError, setLogoutError] = useState(false);
  const [archiveProblem, setArchiveProblem] = useState("");
  const archiveFocusPending = useRef<string | undefined>(undefined);
  const [archiveNotice, setArchiveNotice] = useState<{
    id: string;
    title: string;
    route: string;
  }>();
  const [trashOutcome, setTrashOutcome] = useState<DeletionOutcome>();
  const [modeNotice, setModeNotice] = useState<{
    key: number;
    single: boolean;
    text: string;
  }>();
  const [modeEnter, setModeEnter] = useState(false);
  // The visible count last seen for this person: a change across 1 is a mode change.
  const modeSeen = useRef<{ identity: string; count: number }>(undefined);
  const [railStartError, setRailStartError] = useState("");
  const [creationViews, setCreationViews] = useState<
    Record<
      string,
      {
        problem?: string;
        refused?: boolean;
        session?: Session;
        rechecked?: boolean;
      }
    >
  >({});
  // Where the person actually is: work that finishes later must not pull
  // them out of Settings.
  const currentRoute = useRef(route);
  currentRoute.current = route;
  const [newChoiceWorkspace, setNewChoiceWorkspace] = useState<string>();
  const [defaultRefresh, setDefaultRefresh] = useState(0);
  const [createPending, setCreatePending] = useState<Set<string>>(new Set());
  const [defaultStart, setDefaultStart] = useState<{
    identity: string;
    blocked: boolean;
    unavailable: boolean;
  }>();
  const railStarting = useRef(new Set<string>());
  const [logoutPrompt, setLogoutPrompt] = useState(false);
  const [settingsFromMenu, setSettingsFromMenu] = useState(false);
  const returningFromSettings = useRef(false);
  useEffect(() => {
    if (!isSettingsRoute(route.pathname) && returningFromSettings.current) {
      returningFromSettings.current = false;
      // Onboarding focuses its newly mounted heading in an effect; return focus afterwards.
      requestAnimationFrame(() => {
        (window.matchMedia("(max-width: 800px)").matches
          ? (document.querySelector<HTMLElement>(
              "[aria-label='Avaa navigaatio']",
            ) ??
            document.querySelector<HTMLElement>(
              "[data-account-controls] button",
            ))
          : document.querySelector<HTMLElement>(
              "[data-account-controls] button",
            )
        )?.focus();
      });
    }
  }, [route.pathname]);
  const [profile, setProfile] = useState<AccountProfile>();
  const [profileSkipped, setProfileSkipped] = useState(false);
  const identity = hostSnapshot?.identity.web_identity_id;
  const conversationStore = useMemo(
    () => (identity ? new ConversationStore(identity) : undefined),
    [identity],
  );
  useEffect(() => {
    if (hostSnapshot) conversationStore?.applySnapshot(hostSnapshot);
  }, [conversationStore, hostSnapshot]);
  // This person's clone jobs, as the daemon keeps them (ADR 0024): read for
  // the rail block, the clone page and onboarding, followed while one runs.
  // Bound to the session rather than the snapshot's identity, so the clones
  // onboarding queues before any snapshot exists carry on into the workspace
  // view; a new login is a new binding and a new store.
  const refreshRef = useRef<() => void>(() => {});
  const cloneOwner = csrf ?? identity;
  const cloneJobs = useMemo(
    () =>
      cloneOwner ? new CloneJobs(() => refreshRef.current(), csrf) : undefined,
    [cloneOwner, csrf],
  );
  useEffect(() => {
    void cloneJobs?.refresh();
    return () => cloneJobs?.dispose();
  }, [cloneJobs]);
  // Unconfirmed commands of this person (ADR 0023): presented over the host
  // snapshot, never kept beyond confirmation, failure or this identity.
  const mutations = useMemo(
    () => (identity ? new MutationLayer() : undefined),
    [identity],
  );
  // A new identity drops every command of the previous one.
  const previousMutations = useRef<MutationLayer | undefined>(undefined);
  useLayoutEffect(() => {
    if (previousMutations.current !== mutations)
      previousMutations.current?.dispose();
    previousMutations.current = mutations;
  }, [mutations]);
  const mutationsRef = useRef(mutations);
  mutationsRef.current = mutations;
  const mutationVersion = useMutationLayer(mutations);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the version is the layer's change signal.
  const snapshot = useMemo(
    () => overlaid(hostSnapshot, mutations),
    [hostSnapshot, mutations, mutationVersion],
  );
  const priorIdentity = useRef<string | undefined>(undefined);
  const identityGeneration = useRef(0);
  const owned = useRef<{
    store?: ConversationStore;
    journal?: ConversationJournal;
    mutations?: MutationLayer;
  }>({});
  // Invalidate callbacks before aborting reads or clearing the visible snapshot.
  // Local concealment does not prove the server session ended.
  const clearPerson = useCallback((person?: string) => {
    ++identityGeneration.current;
    window.clearTimeout(quietRetry.current.timer);
    quietRetry.current = { failures: 0 };
    owned.current.journal?.stop();
    owned.current.store?.dispose(); // also cancels every pending page read
    owned.current = {};
    railStarting.current.clear();
    setCreatePending(new Set());
    setDefaultStart(undefined);
    setNewChoiceWorkspace(undefined);
    setRailStartError("");
    setCreationViews({});
    owned.current.mutations?.dispose();
    setArchiveNotice(undefined);
    setTrashOutcome(undefined);
    setModeNotice(undefined);
    modeSeen.current = undefined;
    archiveFocusPending.current = undefined;
    // After a reload at the login boundary we no longer know which person
    // owned this tab. Clear only identity-scoped keys, not global onboarding.
    for (const key of Object.keys(sessionStorage))
      if (
        person
          ? key.startsWith(`nah:${person}:`)
          : /^nah:wid_[A-Za-z0-9_-]{8,80}:/.test(key)
      )
        sessionStorage.removeItem(key);
    setJournalOffline(false);
    setJournalConnection({ state: "online" });
    outside.current = undefined;
    setSettingsFromMenu(false);
    returningFromSettings.current = false;
    setDaemonSessions([]);
    setCSRF(undefined);
    setProfile(undefined);
    setProfileSkipped(false);
    piChecked.current = false;
  }, []);
  useLayoutEffect(() => {
    if (priorIdentity.current && identity !== priorIdentity.current) {
      clearPerson(priorIdentity.current);
      if (identity) setRefreshKey((n) => n + 1);
    }
    if (identity) priorIdentity.current = identity;
  }, [identity, clearPerson]);
  const openSettings = () => {
    setSettingsFromMenu(true);
    navigate("/settings");
  };
  const syntheticDemo = import.meta.env.VITE_SYNTHETIC_DEMO === "true";
  const fixtureName =
    import.meta.env.VITE_ENABLE_TEST_FIXTURES === "true"
      ? new URLSearchParams(route.search).get("fixture")
      : null;
  const refresh = useCallback(() => {
    setRefreshKey((n) => n + 1);
  }, []);
  // A clone that finishes during onboarding must not reload the app: with
  // no snapshot yet, a reload would unmount the AI sign-in.
  refreshRef.current = phase === "pi_required" ? () => {} : refresh;
  // An observed 401 wins over any already-running snapshot/list read. A later
  // successful response cannot re-authenticate this tab without a new login.
  const loginFenced = useRef(false);
  const requireLogin = useCallback(() => {
    if (loginFenced.current) return;
    loginFenced.current = true;
    clearPerson(priorIdentity.current);
    sessionBinding.current = undefined;
    dispatch(authenticationRequired());
  }, [clearPerson, dispatch]);
  // Settings focuses its heading on mount; a return from its Pi sign-in puts
  // focus on the row that now shows the result: Claude's row when Claude
  // signed in, otherwise the OpenAI row's button that opened the flow.
  // Claude's own button stays disabled until its state is read, so its row
  // takes the focus.
  const piSignInFocus = useRef<"openai" | "claude">(undefined);
  useEffect(() => {
    if (!piSignInFocus.current || piSignInOpen) return;
    const row = piSignInFocus.current;
    piSignInFocus.current = undefined;
    document
      .querySelector<HTMLElement>(
        row === "claude"
          ? "[data-testid='claude-sign-in']"
          : "[data-testid='pi-sign-in']",
      )
      ?.focus();
  }, [piSignInOpen]);
  const sessionChanged = useCallback(() => {
    clearPerson(priorIdentity.current);
    sessionBinding.current = undefined;
    dispatch(loading());
    setRefreshKey((n) => n + 1);
  }, [clearPerson, dispatch]);
  const activeId = useRef<string | undefined>(undefined);
  const routeAgent =
    new URLSearchParams(location.search).get("conversation") ??
    location.pathname.replace("/agents/", "");
  activeId.current = /^pi:[0-9a-fA-F-]{36}$/.test(routeAgent)
    ? routeAgent
    : undefined;
  useEffect(() => {
    conversationStore?.setVisible(
      routeAgent.startsWith("pi:") ? activeId.current : undefined,
    );
    const onVisible = () => conversationStore?.setVisible(activeId.current);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [conversationStore, routeAgent]);
  const statusListeners = useRef(
    new Set<
      (id: string, kind: string, payload?: Record<string, unknown>) => void
    >(),
  );
  const onStatusEvent = useCallback(
    (
      listener: (
        id: string,
        kind: string,
        payload?: Record<string, unknown>,
      ) => void,
    ) => {
      statusListeners.current.add(listener);
      return () => {
        statusListeners.current.delete(listener);
      };
    },
    [],
  );
  const [journalOffline, setJournalOffline] = useState(false);
  const [journalConnection, setJournalConnection] = useState<{
    state: "connecting" | "online" | "failed";
    reason?: string;
  }>({ state: "online" });
  // Callbacks read the latest render; the journal itself belongs to the store,
  // not the selected route or a particular snapshot response.
  const journalCallbacks = useRef({
    onSnapshotNeeded: refresh,
    onStatusChange: (
      id: string,
      kind: string,
      payload?: Record<string, unknown>,
    ) => {
      statusListeners.current.forEach((listener) => {
        listener(id, kind, payload);
      });
    },
    onLogin: requireLogin,
    onOffline: setJournalOffline,
    onOpen: () => {},
  });
  journalCallbacks.current.onSnapshotNeeded = refresh;
  // A stream that opens proves the host reachable and carries the live facts
  // again: a stale page leaves its connection notice and reads the snapshot
  // now rather than at the next invalidation.
  journalCallbacks.current.onOpen = () => {
    if (phase !== "stale") return;
    dispatch(streamOpen());
    refresh();
  };
  journalCallbacks.current.onLogin = requireLogin;
  const journal = useMemo(
    () =>
      conversationStore
        ? new ConversationJournal(conversationStore, {
            activeId: () => activeId.current,
            onSnapshotNeeded: () => journalCallbacks.current.onSnapshotNeeded(),
            onWorkspaceChanged: (change) => dispatch(hostChanged(change)),
            onStatusChange: (id, kind, payload) =>
              journalCallbacks.current.onStatusChange(id, kind, payload),
            onLogin: () => journalCallbacks.current.onLogin(),
            onOffline: (value) => journalCallbacks.current.onOffline(value),
            onConnection: (state, reason) => {
              setJournalConnection({ state, reason });
              if (state === "online") journalCallbacks.current.onOpen();
            },
          })
        : undefined,
    [conversationStore, dispatch],
  );
  // Layout cleanup closes the old connection before a new identity can paint.
  useLayoutEffect(() => {
    owned.current = { store: conversationStore, journal, mutations };
    return () => {
      if (owned.current.store === conversationStore) {
        journal?.stop();
        conversationStore?.dispose();
        // The layer is dropped by clearPerson on an identity change, not here:
        // a development remount must not end this person's commands.
        owned.current = {};
      }
    };
  }, [conversationStore, journal, mutations]);
  const journalSnapshot = useRef(hostSnapshot);
  journalSnapshot.current = hostSnapshot;
  const journalEnabled =
    !!snapshot &&
    (phase === "authenticated" || phase === "stale") &&
    !syntheticDemo &&
    !fixtureName;
  useEffect(() => {
    if (journalEnabled && journalSnapshot.current)
      journal?.start(journalSnapshot.current);
    return () => journal?.stop();
  }, [journal, journalEnabled]);
  useEffect(() => {
    if (hostSnapshot && (phase === "authenticated" || phase === "stale"))
      journal?.resume(hostSnapshot);
  }, [hostSnapshot, journal, phase]);
  useEffect(() => {
    if (!journalOffline) return;
    const timer = window.setInterval(refresh, 60000);
    return () => window.clearInterval(timer);
  }, [journalOffline, refresh]);
  const manualRefresh = () => {
    reconnectDiagnostic({ event: "manual-retry" });
    journal?.retry();
    if (selectedAgentId) {
      conversationStore?.markStale(selectedAgentId);
      void conversationStore?.reconnect(selectedAgentId);
    }
    refresh();
  };
  // A disconnected tab can recover without a page reload when the browser
  // announces a restored network. Do not retry writes or repeat on a timer.
  useEffect(() => {
    if (phase !== "daemon_unavailable" && phase !== "stale") return;
    window.addEventListener("online", refresh);
    return () => window.removeEventListener("online", refresh);
  }, [phase, refresh]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is the explicit refresh trigger, not read inside the effect.
  useEffect(() => {
    if (fixtureName?.startsWith("design") && CatalogPreview) return;
    const controller = new AbortController();
    let active = true;
    const generation = identityGeneration.current;
    // Every page's normal read can reconcile a persisted creation marker.
    // Capture before reading: neither an in-flight write nor a newer attempt
    // may be released by this snapshot/list pair. Identity is checked below.
    const recheck = new Map(
      Object.keys(sessionStorage)
        .filter((key) => key.startsWith("nah:") && canRecheckCreation(key))
        .map((key) => [key, sessionStorage.getItem(key) ?? ""] as const),
    );
    // A read that starts now is the receipt of any command already uncertain.
    const receiptMark = mutationsRef.current?.mark() ?? 0;
    const ready = () =>
      active &&
      generation === identityGeneration.current &&
      !loginFenced.current;
    if (!snapshot && ready()) dispatch(loading());
    const fail = (
      gate: "login" | "pi" | "unavailable",
      failure?: { outcome: SnapshotFailure; status?: number },
    ) => {
      if (!ready()) return;
      if (gate === "login") {
        setCSRF(undefined);
        requireLogin();
      } else if (ready() && gate === "pi") dispatch(piRequired());
      else if (ready() && snapshot) {
        const live = !!journal?.live();
        reconnectDiagnostic({
          event: "snapshot-failed",
          outcome: failure?.outcome ?? "other",
          status: failure?.status,
          live,
        });
        if (live) {
          // The open event stream proves the host reachable and keeps the
          // conversation current, so one failed read is not a lost
          // connection: a live turn refreshes at every interim reply and tool
          // end, and the banner flashed during working turns. Read again
          // later; a newer invalidation reads sooner and cancels this retry.
          const retry = quietRetry.current;
          retry.timer = window.setTimeout(
            () => setRefreshKey((n) => n + 1),
            Math.min(2000 * ++retry.failures, 15000),
          );
          return;
        }
        journal?.snapshotFailed();
        dispatch(stale());
      } else if (ready()) dispatch(unavailable());
    };
    const load = async () => {
      if (!ready()) return;
      try {
        // Read the session on every refresh, because another tab can replace
        // the cookie without notifying this tab, but beside the snapshot, not
        // around it. The snapshot is rendered only when it names the same
        // web identity as this session read, so a response for another person
        // never renders even if the cookie changed while both were in flight.
        const sessionRead = syntheticDemo
          ? Promise.resolve(undefined)
          : accountSession(controller.signal);
        sessionRead.catch(() => {});
        // A changed CSRF means another login replaced this tab's cookie.
        const bind = (
          session: Exclude<Awaited<typeof sessionRead>, "login">,
        ) => {
          if (!session) return true;
          if (
            sessionBinding.current &&
            sessionBinding.current !== session.csrf
          ) {
            clearPerson(priorIdentity.current);
            dispatch(loading());
            sessionBinding.current = session.csrf;
            setRefreshKey((n) => n + 1);
            return false;
          }
          sessionBinding.current = session.csrf;
          // The session is authoritative for account controls even when the
          // daemon snapshot cannot be read. A changed binding was cleared above
          // before this profile can be presented with any retained snapshot.
          setCSRF(session.csrf);
          setProfile(session.profile);
          return true;
        };
        if (!syntheticDemo && !piChecked.current) {
          const reads = await bothReads(
            sessionRead,
            piStatus(controller.signal),
            (value) => value === "login",
            (value) => value === "login",
          );
          if (!ready()) return;
          if (reads === "login") return fail("login");
          const [session, status] = reads;
          if (session === "login" || status === "login") return; // bothReads answered "login" already
          if (!bind(session)) return;
          if (
            status === "missing" ||
            status === "unknown" ||
            status === "unavailable"
          ) {
            // Pi status names no identity, so its gate still confirms that
            // the cookie it was read with is the one this session describes.
            const current = await sessionCSRF(controller.signal);
            if (!ready()) return;
            if (current !== session?.csrf) {
              clearPerson(priorIdentity.current);
              dispatch(loading());
              sessionBinding.current =
                current === "login" ? undefined : current;
              setRefreshKey((n) => n + 1);
              return;
            }
            if (status === "missing")
              sessionStorage.removeItem("nah:github-step");
            setPiCheckFailed(status !== "missing");
            return fail("pi");
          }
          // Usable Pi credentials end onboarding, unless they came from the
          // site key seeded at the sign-in that created this account: then
          // the route is walked until the person's own first-route mark
          // exists. Only where the route is shown; a deep link goes on.
          const path = window.location.pathname;
          if (
            session &&
            (path === "/" || path === "/workspaces") &&
            (await seededRouteOpen(session.webIdentityId, controller.signal))
          ) {
            if (!ready()) return;
            sessionStorage.removeItem("nah:github-step");
            setPiCheckFailed(false);
            return fail("pi");
          }
          if (!ready()) return;
          piChecked.current = true;
        }
        const reads = await bothReads(
          sessionRead,
          reconnectFetch(
            "/api/v1/snapshot",
            syntheticDemo
              ? `/api/v1/snapshot?scenario=${new URLSearchParams(route.search).get("scenario") ?? "ready"}`
              : "/api/v1/snapshot",
            {
              credentials: "same-origin",
              cache: "no-store",
              signal: controller.signal,
            },
          ),
          (value) => value === "login",
          (value) => value.status === 401,
        );
        if (!ready()) return;
        if (reads === "login") return fail("login");
        const [session, response] = reads;
        if (session === "login") return; // as above
        if (!bind(session)) return;
        if (
          response.status === 403 ||
          response.status >= 500 ||
          !response.ok ||
          response.headers.get("content-type")?.split(";")[0] !==
            "application/json"
        )
          return fail("unavailable", {
            outcome: "status",
            status: response.status,
          });
        const next = await readSnapshot(response);
        if (!ready()) return;
        if (
          session &&
          session.webIdentityId !== next.identity.web_identity_id
        ) {
          // The cookie changed between the two reads. Start over as whoever
          // the cookie now names; a repeat means the two sides disagree.
          if (++identityMismatches.current > 2) {
            // fail() would be fenced by the generation clearPerson advances.
            clearPerson(priorIdentity.current);
            sessionBinding.current = undefined;
            dispatch(unavailable());
            return;
          }
          clearPerson(priorIdentity.current);
          sessionBinding.current = undefined;
          dispatch(loading());
          setRefreshKey((n) => n + 1);
          return;
        }
        identityMismatches.current = 0;
        quietRetry.current.failures = 0;
        setPiCheckFailed(false);
        dispatch(authenticated(next));
        mutationsRef.current?.reconcile(receiptMark, (entry) => {
          const { kind, id, field } = parseKey(entry.key);
          if (kind === "workspace" && field === "visibility") {
            const w = next.workspaces.find((x) => x.workspace_id === id);
            return !w
              ? "unknown"
              : w.visibility === entry.value
                ? "confirmed"
                : "reverted";
          }
          if (kind === "workspace" && field === "name") {
            const w = next.workspaces.find((x) => x.workspace_id === id);
            return !w
              ? "confirmed"
              : (w.display_name ?? w.name) === (entry.value || w.name)
                ? "confirmed"
                : "reverted";
          }
          if (kind === "conversation" && field === "archive") {
            const a = next.agents.find((x) => x.agent_id === id);
            return !a
              ? "unknown"
              : a.archive === entry.value
                ? "confirmed"
                : "reverted";
          }
          if (kind === "conversation" && field === "close")
            return next.agents.some((x) => x.agent_id === id)
              ? "reverted"
              : "confirmed";
          return "unknown";
        });
        if (!syntheticDemo) {
          try {
            const catalog = await listConversations(controller.signal);
            if (ready()) {
              if (next.write_state !== "read_only") {
                for (const [key, attempt] of recheck) {
                  if (
                    key.startsWith(
                      `nah:${next.identity.web_identity_id}:uncertain:`,
                    ) &&
                    canRecheckCreation(key) &&
                    sessionStorage.getItem(key) === attempt
                  ) {
                    sessionStorage.removeItem(key);
                    const workspace = key.slice(
                      `nah:${next.identity.web_identity_id}:uncertain:`.length,
                    );
                    setCreationViews((old) => ({
                      ...old,
                      [workspace]: { rechecked: true },
                    }));
                  }
                }
                if (recheck.size) setRailStartError("");
              }
              setDaemonSessions(catalog);
            }
          } catch (error) {
            if (ready() && (error as Error).message === "identity_lost")
              fail("login");
          }
        }
      } catch (error) {
        if (ready() && !controller.signal.aborted)
          fail("unavailable", { outcome: snapshotFailure(error) });
      }
    };
    void load();
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(quietRetry.current.timer);
    };
  }, [
    dispatch,
    refreshKey,
    fixtureName,
    syntheticDemo,
    requireLogin,
    clearPerson,
  ]);
  const logout = async () => {
    setLogoutPrompt(false);
    loginFenced.current = true;
    clearPerson(priorIdentity.current);
    sessionBinding.current = undefined;
    setLogoutError(false);
    if (syntheticDemo) {
      dispatch(clearIdentity());
      navigate("/workspaces?scenario=login", { replace: true });
      return;
    }
    dispatch(clearIdentity());
    navigate("/workspaces", { replace: true });
    try {
      const response = await fetch("/auth/session", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("session unavailable");
      const session: unknown = await response.json();
      if (
        typeof session !== "object" ||
        session === null ||
        !("csrf" in session) ||
        typeof session.csrf !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/.test(session.csrf)
      )
        throw new Error("invalid session");
      const result = await mutationFetch("account.logout", "/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Origin: window.location.origin,
          "X-Agent-Host-CSRF": session.csrf,
        },
      });
      if (result.status !== 204) throw new Error("logout failed");
      navigate("/workspaces", { replace: true });
    } catch {
      setLogoutError(true);
    }
  };
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const onCurrentLogin = useCallback(() => {
    if (identity && currentIdentity.current === identity) requireLogin();
  }, [identity, requireLogin]);
  const workspaces = snapshot?.workspaces ?? [];
  // Presentation of unconfirmed commands, all from the one layer.
  const visibilityProblem = (() => {
    const found = mutations
      ?.problemsWith("workspace:")
      .find(([key]) => key.endsWith(":visibility"));
    return found ? { id: found[0].split(":")[1], text: found[1] } : undefined;
  })();
  const closing = new Set(
    (mutations?.entries("conversation:") ?? [])
      .filter((e) => e.key.endsWith(":close"))
      .map((e) => e.key.slice("conversation:".length, -":close".length)),
  );
  const visible = workspaces.filter(
    (w) => w.presence === "present" && w.visibility === "visible",
  );
  const archivedWorkspaces = workspaces.filter(
    (w) => w.presence === "present" && w.visibility === "hidden",
  );
  const matches = visible.filter((w) =>
    (w.display_name ?? w.name)
      .toLocaleLowerCase()
      .includes(filter.toLocaleLowerCase()),
  );
  const source = snapshot ? sourceState(snapshot) : "unknown";
  const selectedId = /^\/workspaces\/(ws_[A-Za-z0-9_-]{8,80})$/.exec(
    location.pathname,
  )?.[1];
  const selected = workspaces.find(
    (w) => w.workspace_id === selectedId && w.presence === "present",
  );
  // A conversation in a worktree runs in its place, not in the workspace's
  // main checkout (ADR 0025): its top bar reads the worktree's Git status.
  const openConversation = new URLSearchParams(location.search).get(
    "conversation",
  );
  const conversationWorkspace = useMemo(() => {
    if (!selected || !openConversation) return selected;
    const placeId =
      snapshot?.agents.find(
        (a) =>
          a.agent_id === openConversation &&
          a.workspace_id === selected.workspace_id,
      )?.worktree_id ??
      daemonSessions.find(
        (s) =>
          s.agent_id === openConversation &&
          s.workspace_id !== selected.workspace_id &&
          (s.worktree_of === selected.workspace_id ||
            selected.worktrees?.some((w) => w.worktree_id === s.workspace_id)),
      )?.workspace_id;
    if (!placeId) return selected;
    // Just created: the snapshot that names the place is on its way.
    const place = selected.worktrees?.find(
      (w) => w.worktree_id === placeId,
    ) ?? {
      worktree_id: placeId,
      entry: "",
      name: "",
      path: "",
    };
    return placeWorkspace(selected, place);
  }, [selected, openConversation, snapshot, daemonSessions]);
  const selectedAgentId = /^\/agents\/(pi:[0-9a-fA-F-]{36})$/.exec(
    location.pathname,
  )?.[1];
  // A landing held for its minimum time still counts as loading here, so the
  // destination is focused when it actually renders. A failed background
  // refresh only marks the same view stale: during a turn every interim reply
  // refreshes the snapshot, and treating that flip as a new view took the
  // focus from the composer a person was typing in.
  const viewPhase =
    landing.show && phase !== "daemon_unavailable"
      ? "loading"
      : phase === "stale"
        ? "authenticated"
        : phase;
  const previousView = useRef({ path: location.pathname, phase: viewPhase });
  // Focus only on navigation or a new sign-in state, never on a snapshot refresh.
  // Settings owns its own entry focus and the conversation owns its editor focus.
  useLayoutEffect(() => {
    const previous = previousView.current;
    previousView.current = { path: location.pathname, phase: viewPhase };
    if (previous.path === location.pathname && previous.phase === viewPhase)
      return;
    if (
      isSettingsRoute(location.pathname) ||
      viewPhase === "loading" ||
      viewPhase === "pi_required"
    )
      return;
    if (returningFromSettings.current) return;
    if (viewPhase === "authenticated" && selectedAgentId) return;
    const main = document.getElementById("main");
    // A failed load focuses its own line, not the landing's wordmark.
    const heading =
      main?.querySelector<HTMLElement>("h2.ah-landing-say") ??
      main?.querySelector<HTMLElement>("h1");
    if (heading) heading.tabIndex = -1;
    (heading ?? main)?.focus({ preventScroll: true });
  }, [location.pathname, viewPhase, selectedAgentId]);
  // Archive removes the focused control while changing only the query string.
  // Focus after that route's DOM commit, not in a frame racing its mount.
  useLayoutEffect(() => {
    const wanted = archiveFocusPending.current;
    if (!wanted) return;
    if (selectedId !== wanted) {
      archiveFocusPending.current = undefined;
      return;
    }
    if (new URLSearchParams(location.search).has("conversation")) return;
    const heading = document.querySelector<HTMLElement>("main h1");
    if (heading) {
      heading.focus({ preventScroll: true });
      archiveFocusPending.current = undefined;
    }
  }, [selectedId, location.search]);
  const selectedAgent = snapshot?.agents.find(
    (a) => a.agent_id === selectedAgentId,
  );
  const agentWorkspace = snapshot?.workspaces.find(
    (w) =>
      w.workspace_id === selectedAgent?.workspace_id &&
      w.presence === "present",
  );
  const uncertain =
    source !== "confirmed" ||
    snapshot?.workspaces.some((w) =>
      w.facts.some((f) => f.source === "filesystem" && f.state !== "confirmed"),
    );
  const railState =
    phase === "loading"
      ? "loading"
      : phase !== "authenticated" && phase !== "stale"
        ? "error"
        : source === "absent"
          ? "source-absent"
          : source !== "confirmed" && visible.length === 0
            ? "unknown"
            : visible.length === 0
              ? "empty"
              : matches.length === 0 &&
                  !archivedWorkspaces.some((w) =>
                    (w.display_name ?? w.name)
                      .toLocaleLowerCase()
                      .includes(filter.toLocaleLowerCase()),
                  )
                ? "filtered-empty"
                : "ready";
  const now = useRailNow({
    store: conversationStore,
    snapshot,
    workspaces: visible,
    daemonSessions,
    phase,
    closing,
    selectedAgentId,
    selectedId,
    search: location.search,
  });
  // Single-workspace mode (Yläpalkissa, Jari 18.10.2026) follows the number
  // of visible native workspaces in the snapshot; nothing is stored, and
  // hidden workspaces do not count. An unconfirmed listing keeps the sidebar,
  // which says what is missing.
  const onlyWorkspace =
    (phase === "authenticated" || phase === "stale") &&
    source === "confirmed" &&
    visible.length === 1
      ? visible[0]
      : undefined;
  // Canonical home in single-workspace mode; replace aliases, never add a
  // history entry. Conversation deep links keep their workspace and query.
  useEffect(() => {
    if (!snapshot || phase !== "authenticated" || source !== "confirmed")
      return;
    const home = onlyWorkspace ? "/" : "/workspaces";
    if (route.pathname === (onlyWorkspace ? "/workspaces" : "/"))
      navigate(`${home}${route.search}${route.hash}`, { replace: true });
  }, [
    snapshot,
    phase,
    source,
    onlyWorkspace,
    route.pathname,
    route.search,
    route.hash,
    navigate,
  ]);
  const visibleCount = source === "confirmed" ? visible.length : undefined;
  const onlyName = onlyWorkspace
    ? (onlyWorkspace.display_name ?? onlyWorkspace.name)
    : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a change of the count or the person is a mode change; the name is read at that moment.
  useEffect(() => {
    if (!identity || visibleCount === undefined || phase !== "authenticated")
      return;
    const previous = modeSeen.current;
    modeSeen.current = { identity, count: visibleCount };
    if (!previous || previous.identity !== identity) return;
    const wasSingle = previous.count === 1;
    const isSingle = visibleCount === 1;
    // No workspaces is the start view, not a mode of its own to announce.
    if (wasSingle === isSingle || visibleCount === 0) return;
    // A notice on every mode change: it is rare and changes the whole frame.
    setModeNotice({
      key: Date.now(),
      single: isSingle,
      text: isSingle
        ? previous.count === 0
          ? `${onlyName} on ainoa työtilasi, joten näkymä keskittyy siihen. Sivupalkki tulee esiin, kun lisäät toisen työtilan.`
          : "Jäljellä on yksi työtila, joten näkymä keskittyy siihen."
        : `Työtiloja on nyt ${visibleCount === 2 ? "kaksi" : visibleCount}, joten sivupalkki näyttää ne ryhminä.`,
    });
    setModeEnter(true);
  }, [identity, visibleCount, phase]);
  useEffect(() => {
    if (!modeEnter) return;
    const timer = window.setTimeout(() => setModeEnter(false), 400);
    return () => window.clearTimeout(timer);
  }, [modeEnter]);
  type Agent = NonNullable<typeof snapshot>["agents"][number];
  type WorkspaceRecord = NonNullable<typeof snapshot>["workspaces"][number];
  // Closing an empty conversation is a pending command: the conversation
  // stays in the lists, dimmed and marked, until the daemon confirms it.
  const closeConversation = async (
    agent: Agent,
    origin: "conversation" | "home" = "conversation",
  ) => {
    if (
      !csrf ||
      !mutations ||
      phase !== "authenticated" ||
      mutations.get(closeKey(agent.agent_id)) ||
      !agent.agent_id.startsWith("pi:")
    )
      return false;
    const token = csrf;
    const route = `${location.pathname}${location.search}`;
    setArchiveProblem("");
    if (origin !== "home")
      navigate(`/workspaces/${agent.workspace_id}`, { replace: true });
    const result = await mutations.run({
      command: "conversation.close_empty",
      key: closeKey(agent.agent_id),
      value: true,
      send: (_id, signal) => sendCloseEmpty(agent.agent_id, token, signal),
      read: readCloseResult,
      confirmed: (reply) => {
        setDaemonSessions((old) =>
          old.filter((s) => s.agent_id !== agent.agent_id),
        );
        dispatch(
          hostChanged({
            kind: "closed",
            agent_id: agent.agent_id,
            cursor: reply.event_cursor,
          }),
        );
      },
      refused: (reason) =>
        `Sulkemista ei tehty: ${reason} Keskustelussa voi olla sisältöä.`,
      reverted: "Sulkeminen ei tallentunut. Keskustelu on yhä listassa.",
    });
    if (result.outcome === "login") requireLogin();
    else if (result.outcome === "uncertain") refresh();
    // A refusal reverts in place: back to the conversation, with the reason.
    else if (
      result.outcome === "refused" &&
      origin !== "home" &&
      `${window.location.pathname}${window.location.search}` ===
        `/workspaces/${agent.workspace_id}`
    )
      navigate(route, { replace: true });
    return result.outcome !== "refused" && result.outcome !== "login";
  };
  const closeProblem = mutations
    ?.problemsWith("conversation:")
    .find(([key]) => key.endsWith(":close"));
  // Workspace archive and restore are optimistic (ADR 0023): shown at once,
  // confirmed by the reply's change, reverted with a reason when refused.
  const changeVisibility = async (
    workspace: WorkspaceRecord,
    hidden: boolean,
  ) => {
    const id = workspace.workspace_id;
    const token = workspace.observation_token;
    if (
      !csrf ||
      !mutations ||
      phase !== "authenticated" ||
      !token ||
      workspace.mutation_state !== "allowed"
    )
      return false;
    const writeCSRF = csrf;
    const result = await mutations.run({
      command: "workspace.visibility",
      key: visibilityKey(id),
      value: hidden ? "hidden" : "visible",
      send: (commandId, signal) =>
        sendWorkspace(
          "workspace.visibility",
          {
            action: "visibility",
            workspace_id: id,
            observation_token: token,
            hidden,
          },
          writeCSRF,
          commandId,
          signal,
        ),
      read: readWorkspaceResult,
      confirmed: (reply) => {
        const change = workspaceChange(reply);
        if (change) dispatch(hostChanged(change));
        else refresh();
      },
      refused: (reason) =>
        hidden
          ? `Arkistointia ei tehty: ${reason} Työtila näkyy taas.`
          : `Palautusta ei tehty: ${reason}`,
      reverted: hidden
        ? "Arkistointi ei tallentunut. Työtila näkyy taas."
        : "Palautus ei tallentunut. Työtila on yhä arkistossa.",
    });
    if (result.outcome === "login") requireLogin();
    // The next read is the receipt of a lost reply.
    if (result.outcome === "uncertain") refresh();
    return result.outcome !== "refused" && result.outcome !== "login";
  };
  const renameWorkspace = async (
    workspace: WorkspaceRecord,
    display: string,
  ) => {
    const id = workspace.workspace_id;
    const token = workspace.observation_token;
    if (
      !csrf ||
      !mutations ||
      phase !== "authenticated" ||
      !token ||
      workspace.mutation_state !== "allowed"
    )
      return;
    const writeCSRF = csrf;
    const result = await mutations.run({
      command: "workspace.rename",
      key: renameKey(id),
      value: display,
      send: (commandId, signal) =>
        sendWorkspace(
          "workspace.rename",
          {
            action: "settings",
            workspace_id: id,
            observation_token: token,
            display_name: display,
          },
          writeCSRF,
          commandId,
          signal,
        ),
      read: readWorkspaceResult,
      confirmed: (reply) => {
        const change = workspaceChange(reply);
        if (change) dispatch(hostChanged(change));
        else refresh();
        // The first rename gives the workspace its durable ID.
        if (
          reply.workspace_id !== id &&
          currentRoute.current.pathname === `/workspaces/${id}`
        )
          navigate(
            `/workspaces/${reply.workspace_id}${currentRoute.current.search}`,
            { replace: true },
          );
      },
      refused: (reason) => `Nimeä ei vaihdettu: ${reason}`,
      reverted: "Uusi nimi ei tallentunut. Aiempi nimi palautettiin.",
    });
    if (result.outcome === "login") requireLogin();
    if (result.outcome === "uncertain") refresh();
  };
  // Conversation archive and restore are optimistic as well. Leaving an
  // archived conversation happens at once; a refusal brings it back.
  const changeArchive = async (
    agent: Agent,
    archived: boolean,
    origin: "conversation" | "home" = "conversation",
  ) => {
    const token = agent.observation_token;
    if (
      !csrf ||
      !mutations ||
      phase !== "authenticated" ||
      !token ||
      agent.archive === "unknown" ||
      (agent.archive === "archived") === archived
    )
      return false;
    const writeCSRF = csrf;
    setArchiveProblem("");
    const fromRoute = `${location.pathname}${location.search}`;
    if (archived) {
      setArchiveNotice({
        id: agent.agent_id,
        title: agent.title.display,
        route: fromRoute,
      });
      if (origin !== "home") {
        archiveFocusPending.current = agent.workspace_id;
        navigate(`/workspaces/${agent.workspace_id}`);
      }
    }
    const result = await mutations.run({
      command: "conversation.archive",
      key: archiveKey(agent.agent_id),
      value: archived ? "archived" : "active",
      send: (commandId, signal) =>
        sendArchive(
          agent.agent_id,
          // The daemon resolves the conversation's own directory: a
          // worktree conversation's is its place.
          agent.worktree_id ?? agent.workspace_id,
          token,
          archived,
          writeCSRF,
          commandId,
          signal,
        ),
      read: (response, commandId) =>
        readArchiveResult(response, agent.agent_id, archived, commandId),
      confirmed: (reply) =>
        dispatch(
          hostChanged({
            kind: "archive",
            agent_id: agent.agent_id,
            archive: reply.archive,
            cursor: reply.event_cursor,
          }),
        ),
      refused: (reason) =>
        archived
          ? `Arkistointia ei tehty: ${reason} Keskustelu palautettiin listaan.`
          : `Palautusta ei tehty: ${reason}`,
      reverted: archived
        ? "Arkistointi ei tallentunut. Keskustelu on yhä listassa."
        : "Palautus ei tallentunut. Keskustelu on yhä arkistossa.",
    });
    if (result.outcome === "login") requireLogin();
    if (result.outcome === "uncertain") refresh();
    // The notice, if any, stays and says why; the conversation is back. A
    // home card shows its own refusal.
    if (result.outcome === "refused" && origin !== "home")
      setArchiveProblem(result.text);
    return result.outcome !== "refused" && result.outcome !== "login";
  };
  // Leaving settings rereads the default: a credential or Pi sign-in there can
  // change it without a model save.
  const settingsWasOpen = useRef(defaultSettingsOpen);
  useEffect(() => {
    if (settingsWasOpen.current && !defaultSettingsOpen)
      setDefaultRefresh((value) => value + 1);
    settingsWasOpen.current = defaultSettingsOpen;
  }, [defaultSettingsOpen]);
  // The sidebar's + needs the default agent's admission observation. Read it
  // once per identity, then again only on a confirmed default save, a return
  // from settings or an explicit recheck: the catalog helper costs Pi's whole
  // model runtime, so route entry and snapshots do not trigger it. This read
  // writes no default.
  const defaultObserved = useRef<number>(-1);
  useEffect(() => {
    if (phase !== "authenticated" || !identity || syntheticDemo) return;
    if (
      defaultStart?.identity === identity &&
      defaultObserved.current === defaultRefresh
    )
      return;
    const controller = new AbortController();
    void loadPiModels(controller.signal)
      .then((models) => {
        if (controller.signal.aborted) return;
        const chosen = models.models.find(
          (model) =>
            model.id === models.default_model &&
            (model.provider ?? "openai-codex") ===
              (models.default_provider ?? "openai-codex"),
        );
        defaultObserved.current = defaultRefresh;
        setDefaultStart({
          identity,
          blocked: !!refused(chosen),
          unavailable: models.catalog_status === "unavailable",
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        defaultObserved.current = defaultRefresh;
        setDefaultStart({ identity, blocked: false, unavailable: true });
      });
    return () => controller.abort();
  }, [identity, phase, defaultRefresh, defaultStart]);
  const createReason = (workspaceId: string) => {
    if (
      !csrf ||
      phase !== "authenticated" ||
      snapshot?.write_state === "read_only"
    )
      return "Päivitä yhteys ennen uuden keskustelun luontia.";
    if (createPending.has(workspaceId)) return "Luonti on käynnissä.";
    if (
      identity &&
      sessionStorage.getItem(`nah:${identity}:uncertain:${workspaceId}`)
    )
      return "Luonnin tulos epävarma. Tarkista keskustelulista ja natiivi historia ennen uutta yritystä.";
    if (defaultStart?.identity !== identity)
      return "Ladataan oletusagentin tietoja.";
    if (defaultStart?.unavailable)
      return "Agentin malliluetteloa ei voitu vahvistaa. Tarkista kirjautuminen.";
    return "";
  };
  // A worktree agent (ADR 0025) starts like any conversation, except that
  // its first message names the branch and the daemon makes the worktree.
  const startFromHome = (
    workspaceId: string,
    choice?: Choice,
    newWorktree?: string,
  ) => {
    if (
      !csrf ||
      railStarting.current.has(workspaceId) ||
      createReason(workspaceId)
    )
      return;
    if (!choice && newWorktree === undefined && defaultStart?.blocked) {
      setNewChoiceWorkspace(workspaceId);
      return;
    }
    setNewChoiceWorkspace(undefined);
    railStarting.current.add(workspaceId);
    setCreatePending((old) => new Set(old).add(workspaceId));
    const person = identity;
    const version = identityGeneration.current;
    const current = () =>
      currentIdentity.current === person &&
      identityGeneration.current === version;
    const uncertainKey = `nah:${person}:uncertain:${workspaceId}`;
    setRailStartError("");
    setCreationViews((old) => ({ ...old, [workspaceId]: {} }));
    const pendingRoute = `/workspaces/${workspaceId}?conversation=${newWorktree === undefined ? "new" : "new-worktree"}`;
    navigate(pendingRoute);
    void createTracked(
      workspaceId,
      csrf,
      uncertainKey,
      current,
      choice,
      newWorktree,
    )
      .then((session) => {
        if (!session || !current()) return;
        // The new conversation takes over what was written meanwhile.
        if (person) {
          adoptCreation(person, workspaceId, session.agent_id);
          adoptGuide(person, workspaceId, session.agent_id);
        }
        setDaemonSessions((old) => [...old, session]);
        refresh();
        setCreationViews((old) => ({ ...old, [workspaceId]: { session } }));
      })
      .catch((error) => {
        if (!current()) return;
        if ((error as Error).message === "identity_lost") requireLogin();
        else {
          // A definite refusal (such as 429 capacity) created nothing: say
          // why and leave + usable. Only a lost reply or 5xx is uncertain.
          const refusal = error instanceof WriteRefused;
          const message = refusal
            ? `Uutta keskustelua ei luotu: ${refusalReason(error.code, error.status)}`
            : sessionStorage.getItem(uncertainKey)
              ? "Luonnin tulos epävarma. Tarkista tiedot ennen uutta yritystä; pyyntöä ei lähetetä automaattisesti uudelleen."
              : "Istuntoa ei voitu vahvistaa. Luontia ei lähetetty.";
          setCreationViews((old) => ({
            ...old,
            [workspaceId]: { problem: message, refused: refusal },
          }));
          if (
            `${currentRoute.current.pathname}${currentRoute.current.search}` !==
            pendingRoute
          )
            setRailStartError(message);
        }
      })
      .finally(() => {
        if (!current()) return;
        railStarting.current.delete(workspaceId);
        setCreatePending((old) => {
          const next = new Set(old);
          next.delete(workspaceId);
          return next;
        });
      });
  };
  // A workspace made with "Luo työtila" gets one conversation, opened with
  // focus in its field (Jari 16.10.2026). The new workspace's ID is known only
  // once a snapshot shows it.
  const [autoStart, setAutoStart] = useState<{
    name: string;
    identity: string;
    route: string;
    until: number;
  }>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new snapshot or default-agent observation can make the start possible.
  useEffect(() => {
    if (!autoStart) return;
    // Never pull the person away from somewhere they went meanwhile.
    if (
      autoStart.identity !== identity ||
      Date.now() > autoStart.until ||
      `${route.pathname}${route.search}` !== autoStart.route
    ) {
      setAutoStart(undefined);
      return;
    }
    const created = snapshot?.workspaces.find(
      (w) => w.name === autoStart.name && w.presence === "present",
    );
    if (!created || createReason(created.workspace_id)) return;
    setAutoStart(undefined);
    startFromHome(created.workspace_id);
  }, [autoStart, snapshot, identity, defaultStart, csrf, phase, route]);
  const returnConversations: (ReturnConversation & { workspaceId: string })[] =
    (snapshot?.agents ?? [])
      .filter(
        (a) =>
          a.archive !== "archived" &&
          snapshot?.workspaces.some(
            (w) =>
              w.workspace_id === a.workspace_id && w.presence === "present",
          ),
      )
      .map((a) => {
        const workspace = snapshot?.workspaces.find(
          (w) => w.workspace_id === a.workspace_id,
        );
        const daemonSession = browserOwned(a, daemonSessions);
        return {
          id: a.agent_id,
          workspaceId: a.workspace_id,
          revision: a.observation_token,
          href: daemonSession
            ? `/workspaces/${a.workspace_id}?conversation=${a.agent_id}`
            : `/agents/${a.agent_id}`,
          title: a.title.display,
          workspace: workspace?.display_name ?? workspace?.name ?? "",
          browserSession: daemonSession,
          history: a.history,
          process: phase === "stale" ? "stale" : a.process,
          command:
            phase === "stale"
              ? undefined
              : a.activity === "running"
                ? "accepted"
                : a.activity === "idle"
                  ? "idle"
                  : undefined,
          liveActivity:
            phase === "stale"
              ? undefined
              : a.activity === "running"
                ? a.live_tail.at(-1)?.kind
                : undefined,
          runActive: phase === "stale" ? undefined : a.run_active,
          waitingOn: phase === "stale" ? undefined : a.waiting_on,
          pendingQuestion: phase !== "stale" && !!a.pending_question,
          pendingLabel: closing.has(a.agent_id) ? "Suljetaan…" : undefined,
          worktree: a.worktree_id
            ? (() => {
                const place = workspace?.worktrees?.find(
                  (w) => w.worktree_id === a.worktree_id,
                );
                const git = place?.git_summary;
                return {
                  branch: place?.branch ?? git?.branch,
                  base: git?.base?.name,
                  ahead: git?.base?.ahead,
                  behind: git?.base?.behind,
                  dirty: git?.dirty_count,
                  merged: worktreeMerged(place),
                };
              })()
            : undefined,
        };
      });
  const cardArchiveReason = (conversation: ReturnConversation) => {
    const agent = snapshot?.agents.find((a) => a.agent_id === conversation.id);
    if (
      !csrf ||
      phase !== "authenticated" ||
      snapshot?.write_state === "read_only"
    )
      return "Arkistointi ei ole käytettävissä.";
    if (closing.has(conversation.id)) return "Sulkeminen kesken.";
    if (!agent?.observation_token || agent.archive !== "active")
      return "Arkiston tilaa ei voida vahvistaa.";
    if (conversation.process === "terminal_observed_live")
      return "Kirjoittaja on käynnissä.";
    if (conversation.waitingOn?.length || agent.waiting_on?.length)
      return "Odota taustatyön valmistumista ja agentin vuoron päättymistä.";
    if (
      conversation.runActive ||
      agent.run_active ||
      conversation.command === "accepted" ||
      agent.activity === "running"
    )
      return "Odota agentin vuoron päättymistä.";
    if (
      conversation.process === "daemon_managed_live" &&
      conversation.command !== "idle"
    )
      return "Prosessin tilaa ei voitu vahvistaa.";
    return "";
  };
  // A conversation whose Pi has written no history yet has nothing to keep
  // in the archive: putting it away closes it.
  const archiveFromCard = (id: string) => {
    const agent = snapshot?.agents.find((a) => a.agent_id === id);
    if (!agent) return Promise.resolve(false);
    return agent.history === "missing"
      ? closeConversation(agent, "home")
      : changeArchive(agent, true, "home");
  };
  // An empty worktree agent (ADR 0025): the workspace page's icon row, or
  // the top bar's menu in single-workspace mode.
  const newWorktree = (ws: WorkspaceRecord) =>
    !createReason(ws.workspace_id) &&
    !syntheticDemo &&
    phase === "authenticated" &&
    csrf &&
    snapshot?.write_state !== "read_only" &&
    ws.mutation_state === "allowed"
      ? (id: string) => {
          // A settled earlier creation in this workspace is not
          // this one; a pending or uncertain one still is.
          if (!createPending.has(id))
            setCreationViews((old) => {
              if (!old[id]?.session && !old[id]?.rechecked && !old[id]?.refused)
                return old;
              const next = { ...old };
              delete next[id];
              return next;
            });
          navigate(`/workspaces/${id}?conversation=new-worktree`);
        }
      : undefined;
  const workspacePage = (
    ws: WorkspaceRecord,
    single = false,
    archived?: ReactNode,
  ) =>
    conversationStore ? (
      <WorkspacePage
        key={ws.workspace_id}
        onVisibility={(hidden) => changeVisibility(ws, hidden)}
        visibilityPhase={mutations?.get(visibilityKey(ws.workspace_id))?.phase}
        visibilityProblem={
          visibilityProblem?.id === ws.workspace_id
            ? visibilityProblem.text
            : undefined
        }
        onRename={(display) => void renameWorkspace(ws, display)}
        conversationProblem={closeProblem?.[1]}
        onDismissProblem={
          closeProblem ? () => mutations?.dismiss(closeProblem[0]) : undefined
        }
        renamePhase={mutations?.get(renameKey(ws.workspace_id))?.phase}
        renameProblem={mutations?.problem(renameKey(ws.workspace_id))}
        onArchive={archiveFromCard}
        archiveReason={cardArchiveReason}
        workspace={ws}
        conversations={returnConversations.filter(
          (c) => c.workspaceId === ws.workspace_id,
        )}
        store={conversationStore}
        csrf={
          phase === "authenticated" && snapshot?.write_state !== "read_only"
            ? csrf
            : undefined
        }
        startReason={createReason(ws.workspace_id)}
        onRecheckCreation={
          identity &&
          canRecheckCreation(`nah:${identity}:uncertain:${ws.workspace_id}`)
            ? manualRefresh
            : undefined
        }
        defaultUnavailable={
          defaultStart?.identity === identity && !!defaultStart?.unavailable
        }
        onRefreshDefault={() => setDefaultRefresh((value) => value + 1)}
        defaultRefused={
          defaultStart?.identity === identity && !!defaultStart?.blocked
        }
        onNewChoice={
          !createReason(ws.workspace_id)
            ? (id, choice) => startFromHome(id, choice)
            : undefined
        }
        onNew={
          !createReason(ws.workspace_id) &&
          !syntheticDemo &&
          phase === "authenticated" &&
          csrf &&
          snapshot?.write_state !== "read_only" &&
          ws.mutation_state === "allowed" &&
          ws.facts.some(
            (f) => f.source === "filesystem" && f.state === "confirmed",
          )
            ? startFromHome
            : undefined
        }
        onNewWorktree={newWorktree(ws)}
        refresh={refresh}
        single={single}
        archived={archived}
        archivedPlace={onlyWorkspace ? "home" : "rail"}
        onDeleted={(outcome) => {
          setTrashOutcome(outcome);
          navigate("/workspaces");
        }}
      />
    ) : null;
  // A forced Pi sign-in returns to the view that opened it, whether it
  // finished or the person went back: the settings section with focus on the
  // signed-in provider's row, or the conversation whose model sign-in failed.
  const returnFromPiSignIn = (signedIn?: "claude") => {
    const conversation = new URLSearchParams(location.search).get(
      "conversation",
    );
    if (
      isSettingsRoute(location.pathname) &&
      settingsSection(location.pathname) !== undefined
    ) {
      piSignInFocus.current = signedIn === "claude" ? "claude" : "openai";
      navigate(location.pathname, { replace: true });
    } else
      navigate(
        conversation &&
          /^\/workspaces\/ws_[A-Za-z0-9_-]{8,64}$/.test(location.pathname) &&
          /^pi:[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/.test(
            conversation,
          )
          ? `${location.pathname}?conversation=${encodeURIComponent(conversation)}`
          : "/workspaces",
        { replace: true },
      );
  };
  // Closing Settings returns to the view it was opened from, or to the home
  // view when it was opened from a link with nothing before it.
  const closeSettings = () => {
    returningFromSettings.current = true;
    setSettingsFromMenu(false);
    const back = outside.current;
    if (back)
      navigate(`${back.pathname}${back.search}${back.hash}`, {
        state: back.state,
      });
    else navigate(onlyWorkspace ? "/" : "/workspaces");
  };
  const settingsView = (
    <AccountSettings
      editorIdentity={identity}
      routeSection={settingsSection(route.pathname)}
      routeRow={route.hash.slice(1) || undefined}
      onNavigate={navigate}
      workspaces={snapshot?.workspaces}
      onNewWorkspace={() => navigate("/workspaces/new")}
      profile={
        profile ?? {
          name: accountLabel(snapshot?.identity.display_name ?? ""),
          email: "",
          avatar_url: "",
        }
      }
      onLogout={() => setLogoutPrompt(true)}
      nativeState={snapshot?.auth?.native_github.state}
      nativeLogin={snapshot?.auth?.native_github.login}
      onReconnect={() => {
        if (syntheticDemo) return;
        window.location.assign(
          `/auth/github/start?return_to=${encodeURIComponent(safeRoute(route.pathname))}&reconnect=1`,
        );
      }}
      onPiSignIn={() => navigate(`${route.pathname}?pi_sign_in=1`)}
      modelSelector={
        <PiModelSelector
          csrf={csrf}
          onChoice={() => {
            setDefaultStart(undefined);
            setDefaultRefresh((value) => value + 1);
          }}
        />
      }
      csrf={csrf}
      onDisconnect={refresh}
      onWorkspacesChanged={refresh}
      onClose={closeSettings}
    />
  );
  // The view under Settings is shown only once Settings closes. A profile
  // that still asks for its name keeps that page instead, as before.
  const profileRequired =
    !syntheticDemo &&
    !!profile &&
    !profileSkipped &&
    (!profile.name || !profile.email);
  const settingsLayer = !!settingsOver && !profileRequired;
  useLayoutEffect(() => {
    if (!settingsLayer) return;
    // The layer covers main's visible box from the top; the view under it
    // gets its scroll position back when Settings closes.
    const view = document.getElementById("main");
    if (!view) return;
    const top = view.scrollTop;
    view.scrollTop = 0;
    return () => {
      view.scrollTop = top;
    };
  }, [settingsLayer]);
  const main =
    landing.show && phase !== "daemon_unavailable" ? (
      <Landing
        state="connecting"
        name={profile?.name.trim().split(/\s+/)[0] || undefined}
        server={window.location.hostname}
        revealed={landing.revealed}
        slow={landing.slow}
      />
    ) : phase === "authenticated" &&
      new URLSearchParams(location.search).has("pi_sign_in") ? (
      <GitHubOnboarding
        preferredName={profile?.name}
        preferredEmail={profile?.email}
        clones={cloneJobs}
        skipChooser
        forceSignIn
        onSessionChanged={sessionChanged}
        onUsable={(signedIn) => {
          const conversation = new URLSearchParams(location.search).get(
            "conversation",
          );
          if (conversation) conversationStore?.discardStatus(conversation);
          returnFromPiSignIn(signedIn);
          refresh();
        }}
        onReturn={() => returnFromPiSignIn()}
        onLogin={requireLogin}
        onLogout={logout}
      />
    ) : phase === "authentication_required" ? (
      <LoginCard
        onLogin={() => {
          if (syntheticDemo) return;
          window.location.assign(
            `/auth/github/start?return_to=${encodeURIComponent(safeRoute(location.pathname))}`,
          );
        }}
        notice={
          <>
            {new URLSearchParams(location.search).has("auth_error") && (
              <LoginErrorNotice />
            )}
            {logoutError && (
              <InlineNotice
                data-testid="logout-uncertain"
                title="Uloskirjautumista ei voitu vahvistaa"
                description="Istunto voi olla edelleen voimassa. Kun yhteys toimii, yritä uloskirjautumista uudelleen."
                tone="danger"
                actions={[
                  {
                    label: "Yritä uloskirjautumista uudelleen",
                    onPress: logout,
                  },
                ]}
              />
            )}
          </>
        }
      />
    ) : !syntheticDemo &&
      profile &&
      !profileSkipped &&
      (!profile.name || !profile.email) ? (
      <AccountProfileOnboarding
        profile={profile}
        csrf={csrf}
        onSaved={setProfile}
        onLogin={requireLogin}
        onSkip={() => setProfileSkipped(true)}
      />
    ) : location.pathname === "/administration" ? (
      <Navigate to={settingsHref("palvelin")} replace />
    ) : isSettingsRoute(location.pathname) &&
      settingsSection(location.pathname) === undefined ? (
      <Navigate to="/settings" replace />
    ) : isSettingsRoute(location.pathname) &&
      (phase === "authenticated" || phase === "stale" || settingsFromMenu) ? (
      settingsView
    ) : phase === "pi_required" ? (
      <GitHubOnboarding
        preferredName={profile?.name}
        preferredEmail={profile?.email}
        clones={cloneJobs}
        onSessionChanged={sessionChanged}
        skipChooser={
          piCheckFailed ||
          (location.pathname !== "/" && location.pathname !== "/workspaces")
        }
        onUsable={() => {
          piChecked.current = true;
          refresh();
        }}
        onLogin={requireLogin}
        onLogout={logout}
      />
    ) : phase === "daemon_unavailable" ? (
      <Landing
        state="failed"
        server={window.location.hostname}
        revealed
        slow={false}
        onRetry={refresh}
      />
    ) : selectedAgent &&
      agentWorkspace &&
      selectedAgent.archive !== "archived" &&
      !(location.state as { readOnly?: boolean } | null)?.readOnly &&
      browserOwned(selectedAgent, daemonSessions) ? (
      // A browser conversation opens with its composer, never as read-only
      // history; its Pi starts only when the person sends.
      <Redirect
        held={!!settingsOver}
        replace
        to={`/workspaces/${agentWorkspace.workspace_id}?conversation=${selectedAgent.agent_id}`}
      />
    ) : selectedAgent && agentWorkspace && conversationStore ? (
      <>
        {/* An open archive notice carries the problem itself. */}
        {archiveProblem && !archiveNotice && (
          <InlineNotice
            data-testid="archive-error"
            title={
              archiveProblem.startsWith("Sulkemista")
                ? "Sulkeminen epäonnistui"
                : "Arkiston muutosta ei tehty"
            }
            description={archiveProblem}
            tone="warning"
          />
        )}
        <HistoryView
          onLogin={onCurrentLogin}
          store={conversationStore}
          agent={selectedAgent}
          restoreAvailable={
            !!csrf &&
            phase === "authenticated" &&
            selectedAgent.history === "readable" &&
            !!selectedAgent.observation_token
          }
          onRestore={() => void changeArchive(selectedAgent, false)}
          onArchive={() => void changeArchive(selectedAgent, true)}
          onTitleComplete={refresh}
          csrf={phase === "authenticated" ? csrf : undefined}
          workspaceName={agentWorkspace.display_name ?? agentWorkspace.name}
          workspacePath={agentWorkspace.path}
          workspaceId={agentWorkspace.workspace_id}
        />
      </>
    ) : selectedAgentId ? (
      <>
        <h1
          data-testid="conversation-observation"
          data-state={uncertain ? "unknown" : "missing"}
        >
          {uncertain
            ? "Keskustelun tilaa ei voitu tarkistaa"
            : "Keskustelua ei löydy"}
        </h1>
        <InlineNotice
          title={
            uncertain
              ? "Tarkista tiedot uudelleen"
              : "Valitse toinen keskustelu"
          }
          description={
            uncertain
              ? "Kaikkia tietoja ei saatu. Keskustelua ei voi vielä todeta poistuneeksi."
              : "Se ei näy työtiloissasi. Palaa työtiloihin tai tarkista tiedot uudelleen."
          }
          tone="warning"
          actions={[{ label: "Yritä uudelleen", onPress: refresh }]}
        />
        <LinkRow href="/workspaces" kind="inline">
          Kaikki työtilat
        </LinkRow>
      </>
    ) : location.pathname === "/workspaces/new" ? (
      <NewWorkspacePage
        csrf={csrf}
        token={snapshot?.user_observation_token}
        writeReason={
          syntheticDemo
            ? "Synteettisessä demossa ei voi luoda työtiloja."
            : phase !== "authenticated" || !csrf
              ? "Yhteys pitää vahvistaa ennen työtilan luontia."
              : snapshot?.write_state === "read_only"
                ? "Palvelin on vain luku -tilassa."
                : source !== "confirmed"
                  ? "Työtiloja ei voitu tarkistaa. Päivitä tiedot ennen työtilan luontia."
                  : undefined
        }
        workspaces={workspaces}
        store={cloneJobs}
        refresh={refresh}
        onCreated={(name) => {
          if (identity)
            setAutoStart({
              name,
              identity,
              route: `${location.pathname}${location.search}`,
              until: Date.now() + 60000,
            });
        }}
        onOpen={(w) => {
          // A fresh clone gets its first conversation, as Luo työtila does
          // (Jari 16.10.2026); a workspace with conversations just opens.
          if (snapshot?.agents.some((a) => a.workspace_id === w.workspace_id))
            navigate(`/workspaces/${w.workspace_id}`);
          else if (!createReason(w.workspace_id)) startFromHome(w.workspace_id);
          else navigate(`/workspaces/${w.workspace_id}`);
        }}
      />
    ) : selected ? (
      <>
        {!new URLSearchParams(location.search).has("conversation") ? (
          onlyWorkspace?.workspace_id === selected.workspace_id ? (
            // The only workspace's page is the home page.
            <Redirect held={!!settingsOver} to="/" replace />
          ) : conversationStore ? (
            workspacePage(selected)
          ) : null
        ) : null}
        {new URLSearchParams(location.search).has("conversation") &&
          archiveProblem && (
            <InlineNotice
              data-testid="archive-error"
              title={
                archiveProblem.startsWith("Sulkemista")
                  ? "Sulkeminen epäonnistui"
                  : "Arkiston muutosta ei tehty"
              }
              description={archiveProblem}
              tone="warning"
            />
          )}
        {new URLSearchParams(location.search).has("conversation") &&
        !syntheticDemo &&
        identity &&
        conversationStore &&
        selected.facts.some(
          (f) => f.source === "filesystem" && f.state === "confirmed",
        ) ? (
          ["new", "new-worktree"].includes(
            new URLSearchParams(location.search).get("conversation") ?? "",
          ) ? (
            creationViews[selected.workspace_id]?.rechecked ? (
              <Redirect
                held={!!settingsOver}
                replace
                to={`/workspaces/${selected.workspace_id}`}
              />
            ) : creationViews[selected.workspace_id]?.session ? (
              <Redirect
                held={!!settingsOver}
                replace
                to={`/workspaces/${selected.workspace_id}?conversation=${creationViews[selected.workspace_id].session?.agent_id}`}
              />
            ) : new URLSearchParams(location.search).get("conversation") ===
                "new" &&
              !creationViews[selected.workspace_id] &&
              !createPending.has(selected.workspace_id) &&
              !sessionStorage.getItem(
                `nah:${identity}:uncertain:${selected.workspace_id}`,
              ) ? (
              // Nothing is being created and no earlier creation is uncertain
              // (for example, it was reconciled just before a reload): there
              // is no conversation to wait for here.
              <Redirect
                held={!!settingsOver}
                replace
                to={`/workspaces/${selected.workspace_id}`}
              />
            ) : (
              (() => {
                const worktree =
                  new URLSearchParams(location.search).get("conversation") ===
                  "new-worktree";
                // A worktree agent waits for its first message before
                // anything is created (ADR 0025).
                const firstMessage =
                  worktree &&
                  !creationViews[selected.workspace_id] &&
                  !createPending.has(selected.workspace_id) &&
                  !sessionStorage.getItem(
                    `nah:${identity}:uncertain:${selected.workspace_id}`,
                  );
                return (
                  <CreatingConversation
                    key={`${identity}:${selected.workspace_id}`}
                    workspace={selected}
                    identity={identity}
                    worktree={
                      worktree
                        ? {
                            base: selected.git_summary?.branch,
                            dirty: selected.git_summary?.dirty_count,
                            blocked: firstMessage
                              ? createReason(selected.workspace_id) || undefined
                              : undefined,
                            onFirstMessage: firstMessage
                              ? (text) =>
                                  startFromHome(
                                    selected.workspace_id,
                                    undefined,
                                    worktreeNameFrom(text),
                                  )
                              : undefined,
                          }
                        : undefined
                    }
                    onRetry={
                      canRecheckCreation(
                        `nah:${identity}:uncertain:${selected.workspace_id}`,
                      )
                        ? manualRefresh
                        : undefined
                    }
                    retryLabel="Tarkista luonnin tulos"
                    refused={creationViews[selected.workspace_id]?.refused}
                    onCreateAgain={
                      creationViews[selected.workspace_id]?.refused &&
                      !createReason(selected.workspace_id)
                        ? worktree
                          ? // The text is back in the field; sending it
                            // again is the new attempt.
                            () =>
                              setCreationViews((old) => {
                                const next = { ...old };
                                delete next[selected.workspace_id];
                                return next;
                              })
                          : () => startFromHome(selected.workspace_id)
                        : undefined
                    }
                    problem={
                      creationViews[selected.workspace_id]?.problem ??
                      (creationViews[selected.workspace_id] || firstMessage
                        ? undefined
                        : "Luonnin tilaa ei voida vahvistaa. Tarkista keskustelulista ja natiivi historia.")
                    }
                  />
                );
              })()
            )
          ) : (
            <>
              {closeProblem &&
              closeProblem[0] ===
                closeKey(
                  new URLSearchParams(location.search).get("conversation") ??
                    "",
                ) ? (
                <InlineNotice
                  title="Sulkeminen epäonnistui"
                  description={closeProblem[1]}
                  tone="warning"
                  actions={[
                    {
                      label: "Sulje ilmoitus",
                      onPress: () => mutations?.dismiss(closeProblem[0]),
                    },
                  ]}
                />
              ) : null}
              <BrowserConversation
                csrf={
                  priorIdentity.current && priorIdentity.current !== identity
                    ? undefined
                    : csrf
                }
                onLogin={onCurrentLogin}
                store={conversationStore}
                archive={snapshot?.agents.find(
                  (a) =>
                    a.agent_id ===
                    new URLSearchParams(location.search).get("conversation"),
                )}
                onArchive={changeArchive}
                onClose={closeConversation}
                closeBusy={closing.has(
                  new URLSearchParams(location.search).get("conversation") ??
                    "",
                )}
                workspace={conversationWorkspace ?? selected}
                id={
                  /^pi:[0-9a-fA-F-]{36}$/.test(
                    new URLSearchParams(location.search).get("conversation") ??
                      "",
                  )
                    ? (new URLSearchParams(location.search).get(
                        "conversation",
                      ) ?? undefined)
                    : undefined
                }
                identity={identity}
                journalOffline={journalOffline}
                serverUnavailable={phase === "stale"}
                recoverySnapshot={snapshot}
                onStatusEvent={onStatusEvent}
                title={
                  snapshot?.agents.find(
                    (a) =>
                      a.agent_id ===
                        new URLSearchParams(location.search).get(
                          "conversation",
                        ) && a.workspace_id === selected.workspace_id,
                  )?.title.display
                }
                onSessionCreated={(session) => {
                  setDaemonSessions((old) => [...old, session]);
                  refresh(); // The new agent must be in the snapshot before its live turn is seeded.
                }}
              />
            </>
          )
        ) : null}
        {!new URLSearchParams(location.search).has("conversation") ? (
          <>
            {/* An open archive notice carries the problem itself. */}
            {archiveProblem && !archiveNotice && (
              <InlineNotice
                data-testid="archive-error"
                title={
                  archiveProblem.startsWith("Sulkemista")
                    ? "Sulkeminen epäonnistui"
                    : "Arkiston muutosta ei tehty"
                }
                description={archiveProblem}
                tone="warning"
              />
            )}
            <details className="ah-workspace-archive">
              <summary>
                Arkisto ·{" "}
                {snapshot?.sources.find((f) => f.source === "annotation")
                  ?.state !== "confirmed" ||
                snapshot?.sources.find((f) => f.source === "pi_history")
                  ?.state !== "confirmed"
                  ? "?"
                  : snapshot.agents.filter(
                      (a) =>
                        a.workspace_id === selected.workspace_id &&
                        a.archive === "archived",
                    ).length}
              </summary>
              <section
                data-testid="workspace-archive-panel"
                aria-label="Työtilan arkisto"
              >
                <h2 data-testid="archive-title">Arkisto</h2>
                {snapshot?.sources.find((f) => f.source === "annotation")
                  ?.state !== "confirmed" ? (
                  <p data-testid="archive-metadata-unavailable">
                    Keskustelujen arkistomerkintöjä ei voitu lukea. Emme voi
                    näyttää, mitkä keskustelut on arkistoitu. Päivitä tiedot.
                  </p>
                ) : (
                  <>
                    {snapshot.sources.find((f) => f.source === "pi_history")
                      ?.state !== "confirmed" && (
                      <p role="status">
                        Arkisto voi olla puutteellinen: keskustelujen
                        agenttihistoriaa puuttuu tai sitä ei voitu lukea. Osa
                        keskusteluista voi puuttua arkistosta. Päivitä tiedot.
                      </p>
                    )}
                    {snapshot.agents
                      .filter(
                        (a) =>
                          a.workspace_id === selected.workspace_id &&
                          a.archive === "archived",
                      )
                      .map((a) => (
                        <p key={a.agent_id}>
                          <LinkRow
                            href={
                              browserOwned(a, daemonSessions)
                                ? `/workspaces/${selected.workspace_id}?conversation=${a.agent_id}`
                                : `/agents/${a.agent_id}`
                            }
                            kind="inline"
                          >
                            {a.title.display}
                          </LinkRow>{" "}
                          {a.history !== "readable" && (
                            <span>Historia ei ole luettavissa. </span>
                          )}
                          <Button
                            data-testid="restore-conversation"
                            size="row"
                            label="Palauta näkyviin"
                            variant="quiet"
                            onPress={() => void changeArchive(a, false)}
                            availability={
                              !csrf ||
                              phase !== "authenticated" ||
                              a.history !== "readable"
                                ? {
                                    state: "unknown",
                                    reason:
                                      a.history !== "readable"
                                        ? "Historiaa ei voitu vahvistaa"
                                        : "Päivitä yhteys ennen palautusta",
                                  }
                                : { state: "enabled" }
                            }
                          />
                        </p>
                      ))}
                  </>
                )}
              </section>
            </details>
          </>
        ) : null}
        {source !== "confirmed" ? (
          <InlineNotice
            data-testid="catalog-partial"
            title="Kaikkia työtiloja ei voitu tarkistaa"
            description="Kaikkia työtiloja ei voitu tarkistaa. Näet vain löytyneet työtilat; kokeile päivittää tiedot myöhemmin."
            tone="warning"
          />
        ) : null}
      </>
    ) : selectedId ? (
      <>
        <h1
          data-testid="conversation-observation"
          data-state={uncertain ? "unknown" : "missing"}
        >
          {uncertain
            ? "Kohteen tilaa ei voida vahvistaa"
            : "Kohdetta ei enää löydy"}
        </h1>
        <p>
          {uncertain
            ? "Kaikkia työtiloja ei voitu tarkistaa. Tätä työtilaa ei löytynyt saaduista tiedoista. Yritä uudelleen."
            : "Tätä työtilaa ei enää löydy. Voit valita toisen työtilan."}
        </p>
        <InlineNotice
          title="Mitä voit tehdä?"
          actions={[{ label: "Yritä uudelleen", onPress: refresh }]}
        />
        <LinkRow href="/workspaces" kind="inline">
          Kaikki työtilat
        </LinkRow>
      </>
    ) : (
      <>
        {snapshot?.sources.some(
          (f) =>
            (f.source === "annotation" || f.source === "pi_history") &&
            f.state !== "confirmed",
        ) && (
          <div
            data-history-state={
              snapshot?.sources.find((f) => f.source === "pi_history")?.state
            }
            data-annotation-state={
              snapshot?.sources.find((f) => f.source === "annotation")?.state
            }
            className={onlyWorkspace ? "ah-workspace-home-notice" : undefined}
          >
            <InlineNotice
              data-testid="archive-incomplete"
              title="Arkistoa ei voitu kokonaan tarkistaa"
              description={[
                snapshot.sources.find((f) => f.source === "annotation")
                  ?.state !== "confirmed"
                  ? "Keskustelujen arkistomerkintöjä ei voitu lukea. Emme voi näyttää, mitkä keskustelut on arkistoitu."
                  : "",
                snapshot.sources.find((f) => f.source === "pi_history")
                  ?.state !== "confirmed"
                  ? "Keskustelujen agenttihistoriaa puuttuu tai sitä ei voitu lukea. Osa keskusteluista voi puuttua arkistosta."
                  : "",
                "Päivitä tiedot.",
              ]
                .filter(Boolean)
                .join(" ")}
              tone="warning"
            />
          </div>
        )}
        {onlyWorkspace ? (
          workspacePage(
            onlyWorkspace,
            true,
            <ArchivedWorkspaces
              workspaces={archivedWorkspaces.map((w) => ({
                id: w.workspace_id,
                name: w.display_name ?? w.name,
                href: `/workspaces/${w.workspace_id}`,
                selected: false,
              }))}
              onRestore={
                csrf &&
                phase === "authenticated" &&
                snapshot?.write_state !== "read_only"
                  ? (id) => {
                      const w = archivedWorkspaces.find(
                        (a) => a.workspace_id === id,
                      );
                      if (w) void changeVisibility(w, false);
                    }
                  : undefined
              }
              restoreReason={
                phase === "stale"
                  ? "Yhteys poikki."
                  : snapshot?.write_state === "read_only"
                    ? "Vain luku."
                    : undefined
              }
              problem={visibilityProblem?.text}
            />,
          )
        ) : (
          <HomeWorkspaces
            key={identity}
            workspaces={visible}
            conversations={returnConversations.filter((c) =>
              visible.some((w) => w.workspace_id === c.workspaceId),
            )}
            newReason={createReason}
            store={conversationStore}
            archiveReason={cardArchiveReason}
            onArchive={archiveFromCard}
            onNew={
              phase === "authenticated" &&
              csrf &&
              snapshot?.write_state !== "read_only"
                ? startFromHome
                : undefined
            }
            onCreate={
              !syntheticDemo &&
              phase === "authenticated" &&
              csrf &&
              source === "confirmed" &&
              snapshot?.write_state !== "read_only"
                ? () => navigate("/workspaces/new")
                : undefined
            }
          />
        )}
        {source === "absent" ? (
          <InlineNotice
            data-testid="catalog-missing"
            title="Työtilakansiota ei löydy"
            description="Työtilakansiota ei löydy. Jos loit sen juuri, kokeile päivittää tiedot."
            actions={[{ label: "Yritä uudelleen", onPress: refresh }]}
            tone="warning"
          />
        ) : source !== "confirmed" ? (
          <InlineNotice
            data-testid="workspaces-partial"
            title="Työtiloja ei voitu vahvistaa"
            description="Kaikkia työtiloja ei voitu tarkistaa. Näet vain löytyneet työtilat."
            actions={[{ label: "Yritä uudelleen", onPress: refresh }]}
            tone="warning"
          />
        ) : visible.length === 0 ? (
          <InlineNotice
            data-testid="workspaces-empty"
            title="Työtiloja ei vielä ole"
            description="Työtilakansiossa ei ole vielä näkyviä työtiloja. Jos loit sellaisen juuri, päivitä tiedot."
            actions={[{ label: "Päivitä tiedot", onPress: refresh }]}
          />
        ) : null}
      </>
    );
  if (fixtureName?.startsWith("design") && CatalogPreview)
    return (
      <Suspense
        fallback={
          <main id="main">
            <h1>Ladataan katalogia</h1>
          </main>
        }
      >
        <CatalogPreview
          scenario={fixtureName === "design-unhappy" ? "unhappy" : "happy"}
          toolLayout={fixtureName === "design-tool-layout"}
          quietTurn={fixtureName === "design-quiet-turn"}
        />
      </Suspense>
    );
  // The workspace editor sits beside a workspace's conversation; the wrapper
  // is there on every conversation route, so opening it remounts nothing.
  const editorRoute = !!(selectedId && openConversation) || !!selectedAgentId;
  const editorWorkspaceId = selectedAgentId
    ? agentWorkspace &&
      (selectedAgent?.worktree_id ?? agentWorkspace.workspace_id)
    : (conversationWorkspace ?? selected)?.workspace_id;
  return (
    <PiModelsProvider key={identity} enabled={!!identity}>
      <StoragePressureProvider enabled={!!identity}>
        <AppShell
          navigationBadge={now.yours.length}
          className={
            [
              landing.entering ? "ah-landing-enter" : "",
              modeEnter ? "ah-mode-enter" : "",
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
          topBar={
            onlyWorkspace && snapshot && conversationStore && !landing.show ? (
              <SingleWorkspaceBarView
                workspace={onlyWorkspace}
                phase={phase}
                source={source}
                profile={profile}
                identityName={snapshot.identity.display_name}
                pathname={location.pathname}
                newReason={createReason(onlyWorkspace.workspace_id)}
                onNew={
                  csrf &&
                  phase === "authenticated" &&
                  snapshot.write_state !== "read_only"
                    ? () => startFromHome(onlyWorkspace.workspace_id)
                    : undefined
                }
                onAdd={
                  !syntheticDemo &&
                  phase === "authenticated" &&
                  csrf &&
                  snapshot.write_state !== "read_only"
                    ? () => navigate("/workspaces/new")
                    : undefined
                }
                onRename={
                  csrf &&
                  phase === "authenticated" &&
                  snapshot.write_state !== "read_only" &&
                  onlyWorkspace.mutation_state === "allowed"
                    ? (display) => void renameWorkspace(onlyWorkspace, display)
                    : undefined
                }
                onNewWorktree={
                  onlyWorkspace.kind === "git_main_worktree"
                    ? newWorktree(onlyWorkspace)
                    : undefined
                }
                newWorktreeReason={createReason(onlyWorkspace.workspace_id)}
                onSettings={openSettings}
                onLogout={() => setLogoutPrompt(true)}
                onAdministration={() => navigate(settingsHref("palvelin"))}
              />
            ) : undefined
          }
          mobileTitle={
            selectedAgent?.title.display ??
            (selected ? (selected.display_name ?? selected.name) : undefined) ??
            (isSettingsRoute(location.pathname)
              ? "Asetukset"
              : location.pathname === "/workspaces/new"
                ? "Uusi työtila"
                : "Etusivu")
          }
          fallbackAccount={
            profile &&
            (phase === "pi_required" || phase === "daemon_unavailable") ? (
              <FallbackAccount
                profile={profile}
                onSettings={openSettings}
                onAdministration={() => navigate(settingsHref("palvelin"))}
                onLogout={() => setLogoutPrompt(true)}
              />
            ) : undefined
          }
          connection={
            <>
              <StoragePressureNotice />

              {bundle.status === "newer" && !bundle.dismissed ? (
                <NewVersionBanner
                  onReload={reloadForNewBundle}
                  onLater={dismissBundlePrompt}
                />
              ) : null}
              {syntheticDemo ? (
                <div className="ah-demo-banner" role="status">
                  SYNTEETTINEN DEMO · Simuloitu identiteetti ja workspace-data ·
                  Ei oikeaa kirjautumista, agentteja eikä host-yhteyttä
                </div>
              ) : null}
              {phase === "authentication_required" ||
              phase === "pi_required" ||
              phase === "daemon_unavailable" ||
              landing.show ? null : (
                <ConnectionBanner
                  onRetry={
                    phase === "stale" || journalOffline
                      ? manualRefresh
                      : undefined
                  }
                  connectionDetail={journalConnection.reason}
                  state={
                    (phase === "stale" || journalOffline) &&
                    journalConnection.state === "connecting"
                      ? "connecting"
                      : phase === "stale"
                        ? "stale"
                        : phase === "authenticated"
                          ? journalOffline
                            ? "reconnecting"
                            : "online"
                          : "loading"
                  }
                  hostWriteState={
                    snapshot?.write_state === "read_only"
                      ? "read_only"
                      : "writable"
                  }
                />
              )}
            </>
          }
          rail={
            (phase === "authenticated" || phase === "stale") &&
            snapshot &&
            conversationStore &&
            !onlyWorkspace &&
            !landing.show ? (
              <WorkspaceRailView
                phase={phase}
                snapshot={snapshot}
                profile={profile}
                source={source}
                collapsed={collapsed && !mobileLayout}
                now={now}
                matches={matches}
                archived={archivedWorkspaces}
                onRestoreWorkspace={
                  csrf &&
                  phase === "authenticated" &&
                  snapshot.write_state !== "read_only"
                    ? (w) => void changeVisibility(w, false)
                    : undefined
                }
                visibilityProblem={
                  visibilityProblem && visibilityProblem.id !== selectedId
                    ? visibilityProblem.text
                    : undefined
                }
                filter={filter}
                railState={railState}
                selectedId={selectedId}
                newReason={createReason}
                onNewConversation={
                  csrf &&
                  phase === "authenticated" &&
                  snapshot.write_state !== "read_only"
                    ? startFromHome
                    : undefined
                }
                onCreateWorkspace={
                  !syntheticDemo &&
                  phase === "authenticated" &&
                  csrf &&
                  source === "confirmed" &&
                  snapshot.write_state !== "read_only"
                    ? () => navigate("/workspaces/new")
                    : undefined
                }
                onFilter={(v) => dispatch(filterChanged(v))}
                onToggle={() => setCollapsed(!collapsed)}
                onRefresh={manualRefresh}
                onSettings={openSettings}
                onLogout={() => setLogoutPrompt(true)}
                onAdministration={() => navigate(settingsHref("palvelin"))}
                pathname={location.pathname}
                clones={cloneJobs}
              />
            ) : undefined
          }
          overlays={
            <>
              {trashOutcome ? (
                <TrashNotice
                  key={`${trashOutcome.result.workspace_id}:${trashOutcome.result.entry ?? ""}`}
                  outcome={trashOutcome}
                  note={modeNotice?.single ? modeNotice.text : undefined}
                  csrf={csrf}
                  refresh={refresh}
                  onClose={() => {
                    setTrashOutcome(undefined);
                    if (modeNotice?.single) setModeNotice(undefined);
                  }}
                />
              ) : null}
              {modeNotice && !(trashOutcome && modeNotice.single) ? (
                <ArchiveNotice
                  key={modeNotice.key}
                  message={modeNotice.text}
                  wrap
                  busy={false}
                  onClose={() => setModeNotice(undefined)}
                />
              ) : null}
              {archiveNotice ? (
                <ArchiveNotice
                  key={archiveNotice.id}
                  title={archiveNotice.title}
                  busy={
                    snapshot?.agents.find(
                      (a) => a.agent_id === archiveNotice.id,
                    )?.archive !== "archived"
                  }
                  problem={archiveProblem}
                  onClose={() => setArchiveNotice(undefined)}
                  onRestore={() => {
                    const agent = snapshot?.agents.find(
                      (a) => a.agent_id === archiveNotice.id,
                    );
                    if (!agent) return;
                    void changeArchive(agent, false).then((restored) => {
                      if (!restored) return;
                      navigate(archiveNotice.route);
                      setArchiveNotice(undefined);
                    });
                  }}
                />
              ) : null}
              <AccountLogoutDialog
                open={
                  logoutPrompt &&
                  (phase === "authenticated" ||
                    phase === "pi_required" ||
                    phase === "daemon_unavailable")
                }
                onClose={() => setLogoutPrompt(false)}
                onConfirm={logout}
              />
              {newChoiceWorkspace && phase === "authenticated" && csrf && (
                <NewConversationModelDialog
                  key={`${identity}:${newChoiceWorkspace}`}
                  csrf={csrf}
                  onClose={() => setNewChoiceWorkspace(undefined)}
                  onCreate={(choice) =>
                    startFromHome(newChoiceWorkspace, choice)
                  }
                />
              )}
            </>
          }
          main={
            <>
              {settingsLayer ? (
                <div className="ah-settings-layer">
                  <div className="ah-state">{settingsView}</div>
                </div>
              ) : null}
              {/* The view keeps its own location under Settings, also for the
                  components that read it themselves. */}
              <Routes location={location}>
                <Route
                  path="*"
                  element={
                    <div
                      className={
                        phase === "authentication_required"
                          ? "ah-login-view"
                          : "ah-state"
                      }
                      inert={settingsLayer}
                      data-under-settings={settingsLayer || undefined}
                    >
                      {railStartError ? (
                        <InlineNotice
                          title="Keskustelun luonnin tulos epävarma"
                          description={railStartError}
                          tone="warning"
                        />
                      ) : null}
                      <ViewHost
                        identity={identity}
                        csrf={
                          phase === "authenticated" || phase === "stale"
                            ? csrf
                            : undefined
                        }
                      >
                        {editorRoute ? (
                          <WorkspaceEditor
                            workspaceId={editorWorkspaceId}
                            identity={identity}
                            csrf={
                              phase === "authenticated" || phase === "stale"
                                ? csrf
                                : undefined
                            }
                          >
                            {main}
                          </WorkspaceEditor>
                        ) : (
                          main
                        )}
                      </ViewHost>
                    </div>
                  }
                />
              </Routes>
            </>
          }
        />
      </StoragePressureProvider>
    </PiModelsProvider>
  );
}
