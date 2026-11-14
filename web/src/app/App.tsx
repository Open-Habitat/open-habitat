import {
  lazy,
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
  ConnectionBanner,
} from "../components";
import { accountLabel } from "../components/Account";
import { ArchiveNotice } from "../components/ArchiveNotice";
import { LinkRow } from "../components/ControlElements";
import { ExplainMode } from "../components/ExplainMode";
import { HomeWorkspaces } from "../components/HomeWorkspaces";
import { Landing } from "../components/Landing";
import { LoginCard, LoginErrorNotice } from "../components/LoginCard";
import { refused } from "../components/ModelPicker";
import { PageNotice } from "../components/PageNotice";
import type { ReturnConversation } from "../components/ReturnView";
import { StatusBell } from "../components/StatusBell";
import { setPersonalLanguage, textNow, useLanguage } from "../i18n";
import { agentResourcesText } from "../text/agentResources";
import { appText } from "../text/app";
import { navigationText } from "../text/navigation";
import { sharesText } from "../text/shares";
import { signInText } from "../text/signIn";
import { AccountProfileOnboarding } from "./AccountProfileOnboarding";
import { AgentResourcesPage } from "./AgentResourcesPage";
import { AISignInProvider } from "./AISignIn";
import {
  AccountPreferencesProvider,
  chooseQuietSort,
  chooseQuietWorkspace,
  type QuietSort,
  useConfirmedPreferences,
  useExperimentalFeature,
} from "./accountPreferences";
import { agentTitle } from "./agentTitle";
import { BrowserConversation } from "./BrowserConversation";
import type { LeaveSave } from "./BrowserDocument";
import {
  bundleDiagnostic,
  checkBundle,
  reloadForNewBundle,
  watchBundle,
} from "./bundleRelease";
import { WorkspaceArchive } from "./ConversationArchiveFlow";
import { CloneJobs } from "./cloneJobs";
import { ConversationJournal } from "./conversationJournal";
import { ConversationStore } from "./conversationStore";
import {
  canRecheckCreation,
  createTracked,
  list as listConversations,
  nameReply,
  readArchiveResult,
  readCloseResult,
  readTurnMarkResult,
  renameConversation,
  type Session,
  sendArchive,
  sendCloseEmpty,
  sendTurnMark,
  worktreeNameFrom,
} from "./conversations";
import { EditorSaveNotice } from "./EditorSaveNotice";
import { conversationLocation } from "./editorRoute";
import { FallbackAccount } from "./FallbackAccount";
import { seededRouteOpen } from "./firstRoute";
import { GitHubConnectionNotice } from "./GitHubConnectionNotice";
import { GitHubOnboarding } from "./GitHubOnboarding";
import {
  concerns,
  githubFault,
  githubOrgFault,
  githubProgress,
  markReconnect,
  takeReturnRoute,
  useGitHubRecovery,
} from "./githubConnection";
import {
  adoptGuide,
  creationGuideOwner,
  goalConversationName,
  guideOwner,
  readGuide,
  setGuide,
} from "./goalGuide";
import {
  HelperRestoreContext,
  useHelperArchiveConfirmation,
} from "./HelperArchiveFlow";
import { HistoryView } from "./HistoryView";
import { adoptCreation, creationKeys } from "./heldMessages";
import { helpersArchiveDetail } from "./helpersArchive";
import {
  archiveKey,
  closeKey,
  conversationNameKey,
  overlaid,
  parseKey,
  renameKey,
  turnMarkKey,
  visibilityKey,
} from "./hostOverlay";
import { useLanding } from "./landing";
import { type LandingFailure, useLandingRetry } from "./landingRetry";
import {
  LoadDiagnostic,
  type LoadRead,
  LoadReadError,
  observeLoadRead,
} from "./loadDiagnostic";
import {
  jsonWrite,
  MutationLayer,
  mutationFetch,
  refusalReason,
  useMutationLayer,
  WriteRefused,
} from "./mutations";
import { NewConversationModelDialog } from "./NewConversationModelDialog";
import { NewWorkspacePage } from "./NewWorkspacePage";
import { NameNotSaved, nameRefusal } from "./namingRefusal";
import type { Creation } from "./PendingConversation";
import { type Choice, loadPiModels, PiModelSelector } from "./PiModelSelector";
import { PiModelsProvider } from "./PiModels";
import {
  type AccountProfile,
  accountSession,
  piStatus,
  sessionCSRF,
} from "./pi";
import { reconnectDiagnostic, reconnectFetch } from "./reconnectDiagnostic";
import { interactionBlocksReload, watchReloadInput } from "./reloadSafety";
import { ServerBrowserRail, ServerBrowserSheetHost } from "./ServerBrowser";
import { SharesPage, SharesRail } from "./SharesPage";
import { ownWrites } from "./sentMessages";
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
import { StatusSource } from "./statusItems";
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
import { resetViewLinks } from "./viewLinks";
import type { DeletionOutcome } from "./WorkspaceDeletion";
import { WorkspaceEditor } from "./WorkspaceEditor";
import { WorkspacePage } from "./WorkspacePage";
import { useRailNow, WorkspaceRailView } from "./WorkspaceRailView";
import { workspaceIcons } from "./workspaceIcons";
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
// A close refusal in either language: the problem is kept as the text shown
// when it happened, and the language may have changed since.
const closeRefusal = (problem: string) =>
  [appText.fi, appText.en].some((t) =>
    problem.startsWith(t.closeRefused("").split(":")[0]),
  );

function Redirect({ held, ...props }: NavigateProps & { held: boolean }) {
  return held ? null : <Navigate {...props} />;
}
function safeRoute(path: string) {
  return path === "/" ||
    path === "/workspaces" ||
    settingsSection(path) !== undefined ||
    path === "/administration" ||
    path === "/resources" ||
    path === "/shares" ||
    /^\/workspaces\/ws_[A-Za-z0-9_-]{8,80}$/.test(path) ||
    /^\/agents\/pi:[0-9a-fA-F-]{36}$/.test(path)
    ? path
    : "/workspaces";
}
// Two reads that run side by side. A 401 from either wins over the other's
// failure; otherwise either failure fails both.
type SnapshotFailure =
  | "network"
  | "status"
  | "invalid"
  | "session"
  | "timeout"
  | "other";
// A snapshot read that has not finished by then is on a dead connection;
// with one read at a time it would hold back every later one. The first load
// also waits for Pi's status, so it gets the gateway's own finite ceiling.
const snapshotReadTimeout = 20000;
const firstLoadTimeout = 60000;
/** A closed class for the diagnostic; the error text itself is never logged. */
function snapshotFailure(error: unknown): SnapshotFailure {
  if (error instanceof LoadReadError && error.cause !== undefined)
    return snapshotFailure(error.cause);
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
  useEffect(watchBundle, []);
  useEffect(watchReloadInput, []);
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
  // Every text below follows the language; reading it here rerenders the
  // frame when it changes.
  const language = useLanguage();
  const t = { app: appText[language], signIn: signInText[language] };
  const resourcesTitle = agentResourcesText[language];
  // Signed out, the language is the server default's and the browser's;
  // signed in, AccountPreferencesProvider names the person's.
  useEffect(() => {
    if (phase === "authentication_required") setPersonalLanguage(undefined);
  }, [phase]);
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
  const [landingFailure, setLandingFailure] =
    useState<LandingFailure>("network");
  const [landingAttempting, setLandingAttempting] = useState(false);
  // Daemon catalog distinguishes browser-started Pi sessions from read-only
  // terminal history; it is not a cookie-scoped conversation lease.
  const [daemonSessions, setDaemonSessions] = useState<Session[]>([]);
  const currentSessions = useRef(daemonSessions);
  currentSessions.current = daemonSessions;
  const [csrf, setCSRF] = useState<string>();
  // First load only. A successful onboarding attempt has already checked Pi.
  const piChecked = useRef(false);
  // The cookie is HttpOnly. Its session-bound CSRF is the browser's observable
  // fence across a logout/login in another tab, including while Pi is missing.
  const sessionBinding = useRef<string | undefined>(undefined);
  const identityMismatches = useRef(0);
  const loadDiagnostic = useRef(new LoadDiagnostic());
  // Consecutive snapshot refreshes that failed while the event stream stayed
  // open, and the timer of the next quiet retry.
  const quietRetry = useRef<{ timer?: number; failures: number }>({
    failures: 0,
  });
  const [collapsed, setCollapsed] = useState(false);
  // Beside an open editor the rail is compact unless the person widens it for
  // this editor session; the account menu stays in the rail either way.
  const [editorShown, setEditorShown] = useState(false);
  const [railBesideEditor, setRailBesideEditor] = useState(false);
  const showEditor = useCallback((shown: boolean) => {
    setEditorShown(shown);
    if (!shown) setRailBesideEditor(false);
  }, []);
  const railCompact = editorShown ? !railBesideEditor : collapsed;
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
  // Leaving the editor saved its text: the notice offers Kumoa to the person
  // and session that saved it, and to no one after them.
  const [editorSave, setEditorSave] = useState<
    LeaveSave & { id: number; identity?: string; csrf?: string }
  >();
  const editorSaveId = useRef(0);
  const [archiveNotice, setArchiveNotice] = useState<{
    id: string;
    title: string;
    route: string;
    problem?: string;
    /** What went with it: its named workers (Avustajat). */
    detail?: string;
  }>();
  const [trashOutcome, setTrashOutcome] = useState<DeletionOutcome>();
  const [railStartError, setRailStartError] = useState("");
  const [creationViews, setCreationViews] = useState<
    Record<
      string,
      {
        problem?: string;
        refused?: boolean;
        route?: "new" | "new-worktree";
        session?: Session;
        rechecked?: boolean;
        /** Refused at the limit on conversations working at once, and how
         * many times the person has tried again since. */
        capacity?: boolean;
        tries?: number;
      }
    >
  >({});
  // The workspace whose new-conversation view is dictating. The created
  // conversation waits until the dictation ends, as a swap would end it
  // and lose what was being said.
  const [creationDictating, setCreationDictating] = useState<string>();
  // The view each workspace's new conversation is shown in, and the view a
  // conversation created there keeps (BrowserConversation's viewKey).
  const creationViewKeys = useRef<Record<string, string>>({});
  const createdViews = useRef(new Map<string, string>());
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
              `[aria-label='${textNow(navigationText).openNavigation}']`,
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
  const helperConfirmation = useHelperArchiveConfirmation(csrf);
  const archiveInFlight = useRef(new Set<string>());
  const [helperRestores, setHelperRestores] = useState<{
    binding?: string;
    ids: ReadonlySet<string>;
  }>({ ids: new Set() });
  const [helperArchiveOpen, setHelperArchiveOpen] = useState(false);
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
    // The person's shared link URLs are bearer keys: never the next person's.
    resetViewLinks();
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
    setRecoveredUpdate(false);
    connectionLost.current = false;
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
  // One snapshot read at a time. Through the live route a read takes seconds
  // (observed: about 3 s), longer than a running turn's invalidations are apart.
  // When every request aborted the read before it, no read finished during a
  // turn, so a page waiting for one (stale, or a recovering journal) waited
  // out the whole turn, and Yhdistä's own read was aborted the same way. A
  // request during a read is answered by one more read right after it.
  const snapshotRead = useRef({ busy: false, again: false });
  const refresh = useCallback(() => {
    const read = snapshotRead.current;
    if (read.busy) read.again = true;
    else {
      // Busy from now: the read starts only after the next render.
      read.busy = true;
      setRefreshKey((n) => n + 1);
    }
  }, []);
  const landingRetry = useLandingRetry(
    landingAttempting && phase === "daemon_unavailable" ? "loading" : phase,
    landingFailure,
    refresh,
  );
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
  // The server now serves another bundle and this tab's reads fail: the old
  // bundle validates against its own contract, so a newer host's snapshot
  // can be one it rejects, and retrying repeats the same rejection.
  const [versionChanged, setVersionChanged] = useState(false);
  const [recoveredUpdate, setRecoveredUpdate] = useState(false);
  const connectionLost = useRef(false);
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
    if (connectionLost.current && !recoveredUpdate) {
      connectionLost.current = false;
      const generation = identityGeneration.current;
      void checkBundle().then((status) => {
        if (generation !== identityGeneration.current || status !== "newer")
          return;
        // Read blockers after the network read, not before: the person may
        // have started typing or sending while the check was in flight.
        if (
          interactionBlocksReload() ||
          ownWrites.snapshot().size ||
          mutations?.entries("").length
        ) {
          setRecoveredUpdate(true);
        } else {
          reloadForNewBundle();
        }
      });
    }
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
            // Creation replies precede the snapshot that discovers the agent.
            workspaceForAgent: (id) =>
              currentSessions.current.find((session) => session.agent_id === id)
                ?.workspace_id,
            onSnapshotNeeded: () => journalCallbacks.current.onSnapshotNeeded(),
            onWorkspaceChanged: (change) => dispatch(hostChanged(change)),
            onStatusChange: (id, kind, payload) =>
              journalCallbacks.current.onStatusChange(id, kind, payload),
            onLogin: () => journalCallbacks.current.onLogin(),
            onOffline: (value) => journalCallbacks.current.onOffline(value),
            onConnection: (state, reason) => {
              if (state === "failed") connectionLost.current = true;
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
  // A laptop's sleep or a changed network can leave the event stream looking
  // open but dead for good: no error arrives until the browser writes to that
  // connection. Reopen it at the validated cursor when the network returns or
  // the page wakes; a healthy stream loses nothing by it.
  useEffect(() => {
    if (!journal) return;
    const revive = () => journal.revive();
    let last = Date.now();
    const tick = window.setInterval(() => {
      const now = Date.now();
      // A hidden tab runs timers at most once a minute; a longer gap means
      // the machine slept or the tab was frozen.
      if (now - last > 90000) revive();
      last = now;
    }, 15000);
    window.addEventListener("online", revive);
    document.addEventListener("resume", revive);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("online", revive);
      document.removeEventListener("resume", revive);
    };
  }, [journal]);
  // A disconnected tab can recover without a page reload when the browser
  // announces a restored network. First-load recovery has its own bounded timer.
  useEffect(() => {
    if (phase !== "stale") return;
    window.addEventListener("online", refresh);
    return () => window.removeEventListener("online", refresh);
  }, [phase, refresh]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is the explicit refresh trigger, not read inside the effect.
  useEffect(() => {
    if (fixtureName?.startsWith("design") && CatalogPreview) return;
    const controller = new AbortController();
    let active = true;
    snapshotRead.current = { busy: true, again: false };
    let timedOut = false;
    const readStarted = performance.now();
    let diagnosticRead: LoadRead = piChecked.current
      ? "snapshot"
      : "onboarding";
    loadDiagnostic.current.attempt();
    const recordFailure = (phase: "landing" | "stale", error?: LoadReadError) =>
      loadDiagnostic.current.failed(
        error?.read ?? diagnosticRead,
        timedOut ? "timeout" : (error?.reason ?? "other"),
        error?.status ?? 0,
        phase,
        performance.now() - readStarted,
      );
    const deadline = window.setTimeout(
      () => {
        timedOut = true;
        controller.abort();
      },
      piChecked.current ? snapshotReadTimeout : firstLoadTimeout,
    );
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
    if (!snapshot && ready()) {
      if (phase === "daemon_unavailable") setLandingAttempting(true);
      else dispatch(loading());
    }
    const fail = (
      gate: "login" | "pi" | "unavailable",
      failure?: {
        outcome: SnapshotFailure;
        status?: number;
        diagnostic?: LoadReadError;
      },
    ) => {
      if (!ready()) return;
      if (gate === "login") {
        loadDiagnostic.current.clear();
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
        // Every failed read asks whether a release replaced this bundle. Only
        // a successful index read answers "newer": an unreachable server
        // keeps the ordinary retry, since reloading would lose the page.
        // A later read superseding this one does not void the answer.
        void checkBundle().then((status) => {
          if (status === "newer")
            bundleDiagnostic({ path: "snapshot-failed", release: status });
          if (generation === identityGeneration.current)
            setVersionChanged(status === "newer");
        });
        if (live) {
          // The open event stream proves the host reachable and keeps the
          // conversation current, so one failed read is not a lost
          // connection: a live turn refreshes at every interim reply and tool
          // end, and the banner flashed during working turns. Read again
          // later; a newer invalidation reads sooner and cancels this retry.
          const retry = quietRetry.current;
          retry.timer = window.setTimeout(
            refresh,
            Math.min(2000 * ++retry.failures, 15000),
          );
          return;
        }
        journal?.snapshotFailed();
        recordFailure("stale", failure?.diagnostic);
        dispatch(stale());
      } else if (ready()) {
        recordFailure("landing", failure?.diagnostic);
        setLandingFailure(
          !timedOut &&
            (failure?.diagnostic?.reason === "http" ||
              failure?.diagnostic?.reason === "invalid")
            ? "answer"
            : "network",
        );
        dispatch(unavailable());
      }
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
          : observeLoadRead("session", () => accountSession(controller.signal));
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
        diagnosticRead = "snapshot";
        const reads = await bothReads(
          sessionRead,
          observeLoadRead("snapshot", () =>
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
            diagnostic: new LoadReadError(
              "snapshot",
              response.ok ? "invalid" : "http",
              response.status,
            ),
          });
        const next = await observeLoadRead("snapshot", () =>
          readSnapshot(response),
        );
        if (!ready()) return;
        if (
          session &&
          session.webIdentityId !== next.identity.web_identity_id
        ) {
          // The cookie changed between the two reads. Start over as whoever
          // the cookie now names; a repeat means the two sides disagree.
          if (++identityMismatches.current > 2) {
            recordFailure(
              "landing",
              new LoadReadError("identity_pair", "identity_mismatch"),
            );
            // fail() would be fenced by the generation clearPerson advances.
            clearPerson(priorIdentity.current);
            sessionBinding.current = undefined;
            setLandingFailure("identity");
            dispatch(unavailable());
            return;
          }
          clearPerson(priorIdentity.current);
          sessionBinding.current = undefined;
          dispatch(loading());
          setRefreshKey((n) => n + 1);
          return;
        }
        if (session) loadDiagnostic.current.recovered(session.csrf);
        identityMismatches.current = 0;
        quietRetry.current.failures = 0;
        setVersionChanged(false);
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
          if (kind === "conversation" && field === "name") {
            const agent = next.agents.find((a) => a.agent_id === id);
            return !agent
              ? "unknown"
              : agent.title.display === entry.value
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
        if (ready() && (timedOut || !controller.signal.aborted))
          fail("unavailable", {
            outcome: timedOut ? "timeout" : snapshotFailure(error),
            diagnostic: error instanceof LoadReadError ? error : undefined,
          });
      }
    };
    void load().finally(() => {
      window.clearTimeout(deadline);
      if (!active) return;
      setLandingAttempting(false);
      const read = snapshotRead.current;
      // A request made during this read gets one more, still busy until then.
      read.busy = read.again;
      if (read.again) {
        read.again = false;
        setRefreshKey((n) => n + 1);
      }
    });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(deadline);
      window.clearTimeout(quietRetry.current.timer);
      snapshotRead.current.busy = false;
    };
  }, [
    dispatch,
    refresh,
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
  const archivedHere = selected
    ? (snapshot?.agents.filter(
        (a) =>
          a.workspace_id === selected.workspace_id && a.archive === "archived",
      ) ?? [])
    : [];
  // A conversation in a worktree runs in its place, not in the workspace's
  // main checkout (ADR 0025): its top bar reads the worktree's Git status.
  const conversationRoute = new URLSearchParams(location.search).get(
    "conversation",
  );
  // A conversation this tab created is shown at once, in the view it was
  // created in, while the address moves to it.
  const createdConversation =
    selected &&
    ["new", "new-worktree"].includes(conversationRoute ?? "") &&
    creationDictating !== selected.workspace_id
      ? creationViews[selected.workspace_id]?.session?.agent_id
      : undefined;
  const openConversation = createdConversation ?? conversationRoute;
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
  // The person's own GitHub connection (proto-github-connection-warning):
  // a settled fault, the confirmation once it works again, and the one
  // repair, which returns to this same page.
  const nativeGitHub = snapshot?.auth?.native_github;
  const githubWarning = githubFault(nativeGitHub?.state, nativeGitHub?.retry);
  const githubAttempt = githubProgress(
    nativeGitHub?.state,
    nativeGitHub?.retry,
  );
  const githubRecovery = useGitHubRecovery(
    identity,
    nativeGitHub?.state,
    nativeGitHub?.login,
  );
  // The page in the address bar, which is Settings when it lies over a view.
  // Whether a reconnect keeps the workflow scope when nobody says otherwise:
  // the person allowed it, or gh's token has it now. Read at call time.
  const keepWorkflow = useRef(false);
  const reconnectGitHub = useCallback(
    (workflow?: unknown) => {
      if (syntheticDemo) return;
      const returnTo = safeRoute(route.pathname);
      markReconnect(`${route.pathname}${route.search}`, returnTo);
      // Callers that are press handlers pass an event: only a boolean
      // chooses; anything else keeps what the person has.
      const scope =
        typeof workflow === "boolean" ? workflow : keepWorkflow.current;
      window.location.assign(
        `/auth/github/start?return_to=${encodeURIComponent(returnTo)}&reconnect=1${scope ? "&scope=workflow" : ""}`,
      );
    },
    [route.pathname, route.search],
  );
  useEffect(() => {
    const back = takeReturnRoute(route.pathname, route.search);
    if (back) navigate(back, { replace: true });
  }, [route.pathname, route.search, navigate]);
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
  // "/" is the home page's alias: replacing it with /workspaces shows the
  // same view, so it is not a navigation that moves the focus. The alias is
  // replaced only after the signed-in view has rendered, and focusing its
  // heading again took the focus from what the person had moved to since.
  const viewPath =
    location.pathname === "/" ? "/workspaces" : location.pathname;
  const previousView = useRef({ path: viewPath, phase: viewPhase });
  // Focus only on navigation or a new sign-in state, never on a snapshot refresh.
  // Settings owns its own entry focus and the conversation owns its editor focus.
  useLayoutEffect(() => {
    const previous = previousView.current;
    previousView.current = { path: viewPath, phase: viewPhase };
    if (previous.path === viewPath && previous.phase === viewPhase) return;
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
  }, [viewPath, location.pathname, viewPhase, selectedAgentId]);
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
  const sharesOn = useExperimentalFeature("shares-page", { identity, csrf });
  const resourcesOn = useExperimentalFeature("agent-resources-view", {
    identity,
    csrf,
  });
  const helpersOn = useExperimentalFeature("named-workers", {
    identity,
    csrf,
  });
  const confirmedPreferences = useConfirmedPreferences(identity, csrf);
  keepWorkflow.current =
    confirmedPreferences.github_workflow ||
    !!nativeGitHub?.scopes?.includes("workflow");
  const icons = useMemo(
    () => (snapshot ? workspaceIcons(snapshot.workspaces) : undefined),
    [snapshot],
  );
  const now = useRailNow({
    creations: Object.entries(creationViews).flatMap(([workspaceId, view]) => {
      if (view.rechecked) return [];
      if (
        view.session &&
        (!daemonSessions.some((s) => s.agent_id === view.session?.agent_id) ||
          snapshot?.agents.some((a) => a.agent_id === view.session?.agent_id))
      )
        return [];
      return [
        { workspaceId, agentId: view.session?.agent_id, route: view.route },
      ];
    }),
    names: new Map(
      (mutations?.entries<string>("conversation:") ?? [])
        .filter((entry) => entry.command === "conversation.name")
        .map((entry) => [parseKey(entry.key).id, entry.value]),
    ),
    store: conversationStore,
    snapshot,
    workspaces: visible,
    daemonSessions,
    phase,
    closing,
    selectedAgentId,
    selectedId,
    search: location.search,
    icons,
  });
  const quietChoice = {
    sort: confirmedPreferences.quiet_sort,
    workspace: confirmedPreferences.quiet_workspace,
    busy: !confirmedPreferences.loaded || !!confirmedPreferences.busy,
    error:
      confirmedPreferences.error === "quiet_sort" ||
      confirmedPreferences.error === "quiet_workspace",
    ...(identity && csrf
      ? {
          onSort: (sort: QuietSort) =>
            void chooseQuietSort(identity, sort, csrf),
          onWorkspace: (id: string | null) =>
            void chooseQuietWorkspace(identity, id, csrf),
        }
      : {}),
  };
  // With one visible workspace the rail names it instead of listing it
  // (Jari 31.10.2026); hidden workspaces do not count, and an
  // unconfirmed listing keeps the list, which says what is missing.
  const onlyWorkspace =
    (phase === "authenticated" || phase === "stale") &&
    source === "confirmed" &&
    visible.length === 1
      ? visible[0]
      : undefined;
  // The home page is /workspaces; replace the alias, never add a history
  // entry.
  useEffect(() => {
    if (!snapshot || phase !== "authenticated" || source !== "confirmed")
      return;
    if (route.pathname === "/")
      navigate(`/workspaces${route.search}${route.hash}`, { replace: true });
  }, [
    snapshot,
    phase,
    source,
    route.pathname,
    route.search,
    route.hash,
    navigate,
  ]);
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
      refused: t.app.closeRefused,
      reverted: t.app.closeReverted,
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
      refused: hidden ? t.app.archiveWorkspaceRefused : t.app.restoreRefused,
      reverted: hidden
        ? t.app.archiveWorkspaceReverted
        : t.app.restoreWorkspaceReverted,
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
      refused: t.app.renameRefused,
      reverted: t.app.renameReverted,
    });
    if (result.outcome === "login") requireLogin();
    if (result.outcome === "uncertain") refresh();
  };
  // Conversation archive and restore are optimistic as well. Leaving an
  // archived conversation happens at once; a refusal brings it back.
  const changeArchive = async (
    agent: Agent,
    archived: boolean,
    origin: "conversation" | "home" | "rail" = "conversation",
    // Called once the host confirms the change, not on a lost reply.
    onConfirmed?: () => void,
  ) => {
    // Repeated presses share one preflight/write; the inverse (Undo) must
    // still enter MutationLayer's queue while the first write is pending.
    const key = `${csrf}:${agent.agent_id}:${archived}`;
    if (archiveInFlight.current.has(key)) return false;
    archiveInFlight.current.add(key);
    try {
      return await performArchive(agent, archived, origin, onConfirmed);
    } finally {
      archiveInFlight.current.delete(key);
    }
  };
  const performArchive = async (
    agent: Agent,
    archived: boolean,
    // The rail archives in place unless the conversation is the open one.
    origin: "conversation" | "home" | "rail" = "conversation",
    onConfirmed?: () => void,
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
    const generation = identityGeneration.current;
    let helperDetail: string | undefined;
    if (archived && helpersOn) {
      const accepted = await helperConfirmation.confirm(
        agent.agent_id,
        agentTitle(agent.title),
        (runs) => {
          helperDetail = helpersArchiveDetail(runs);
        },
      );
      // The card's boolean is error feedback, not the archive state. A
      // cancelled question is not a failed write; native state stays put.
      if (!accepted) return origin === "home";
      if (
        generation !== identityGeneration.current ||
        sessionBinding.current !== writeCSRF
      )
        return false;
    }
    setArchiveProblem("");
    const fromRoute = `${currentRoute.current.pathname}${currentRoute.current.search}`;
    if (archived) {
      setArchiveNotice({
        id: agent.agent_id,
        title: agentTitle(agent.title),
        route: fromRoute,
        detail: helperDetail,
      });
      if (origin === "conversation") {
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
      confirmed: (reply) => {
        onConfirmed?.();
        if (!archived)
          setArchiveNotice((notice) =>
            notice?.id === agent.agent_id ? undefined : notice,
          );
        dispatch(
          hostChanged({
            kind: "archive",
            agent_id: agent.agent_id,
            archive: reply.archive,
            cursor: reply.event_cursor,
          }),
        );
        if (
          helpersOn &&
          generation === identityGeneration.current &&
          sessionBinding.current === writeCSRF
        ) {
          setHelperRestores((old) => {
            const ids = new Set(old.binding === writeCSRF ? old.ids : []);
            if (archived) ids.delete(agent.agent_id);
            else ids.add(agent.agent_id);
            return { binding: writeCSRF, ids };
          });
        }
      },
      refused: archived
        ? t.app.archiveConversationRefused
        : t.app.restoreRefused,
      reverted: archived
        ? t.app.archiveConversationReverted
        : t.app.restoreConversationReverted,
    });
    if (result.outcome === "login") requireLogin();
    if (result.outcome === "uncertain") refresh();
    // The notice, if any, stays and says why; the conversation is back. A
    // home card shows its own refusal.
    if (result.outcome === "refused" && origin !== "home") {
      if (archived || archiveNotice?.id === agent.agent_id) {
        // A late refusal must still be seen if its pending notice was
        // dismissed or replaced by another archive in the meantime.
        setArchiveNotice({
          id: agent.agent_id,
          title: agentTitle(agent.title),
          route: fromRoute,
          problem: result.text,
        });
      } else setArchiveProblem(result.text);
    }
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
      return t.app.createNeedsConnection;
    if (createPending.has(workspaceId)) return t.app.createPending;
    if (
      identity &&
      sessionStorage.getItem(`nah:${identity}:uncertain:${workspaceId}`)
    )
      return t.app.createUncertain;
    if (defaultStart?.identity !== identity) return t.app.loadingDefaultAgent;
    if (defaultStart?.unavailable) return t.app.modelsUnconfirmed;
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
      return false;
    if (!choice && newWorktree === undefined && defaultStart?.blocked) {
      setNewChoiceWorkspace(workspaceId);
      return false;
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
    // Trying again after a refusal at the limit is counted for its card.
    setCreationViews((old) => ({
      ...old,
      [workspaceId]: {
        route: newWorktree === undefined ? "new" : "new-worktree",
        ...(old[workspaceId]?.capacity
          ? { tries: (old[workspaceId]?.tries ?? 0) + 1 }
          : {}),
      },
    }));
    const pendingRoute = `/workspaces/${workspaceId}?conversation=${newWorktree === undefined ? "new" : "new-worktree"}`;
    navigate(pendingRoute);
    // A conversation started from a start-page goal is named after it.
    const goal = person
      ? readGuide(creationGuideOwner(person, workspaceId))?.goal
      : undefined;
    const name = goal ? goalConversationName(goal) : undefined;
    void createTracked(
      workspaceId,
      csrf,
      uncertainKey,
      current,
      choice,
      newWorktree,
      name,
    )
      .then((session) => {
        if (!session || !current()) return;
        // The new conversation takes over what was written meanwhile.
        if (person) {
          adoptCreation(person, workspaceId, session.agent_id);
          adoptGuide(person, workspaceId, session.agent_id);
          // A goal chosen while it was being created names it now.
          const chosen = readGuide(guideOwner(person, session.agent_id))?.goal;
          const late = chosen ? goalConversationName(chosen) : undefined;
          if (late && late !== name)
            void renameConversation(
              session.agent_id,
              session.workspace_id,
              late,
              csrf,
            ).catch(() => {
              /* The automatic title then stands; the person can rename. */
            });
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
            ? t.app.createRefused(refusalReason(error.code, error.status))
            : sessionStorage.getItem(uncertainKey)
              ? t.app.createUncertainNoResend
              : t.app.createSessionUnconfirmed;
          const capacity =
            refusal && (error as WriteRefused).code === "capacity_exceeded";
          setCreationViews((old) => ({
            ...old,
            [workspaceId]: {
              problem: message,
              refused: refusal,
              route: newWorktree === undefined ? "new" : "new-worktree",
              capacity,
              tries: capacity ? (old[workspaceId]?.tries ?? 0) : undefined,
            },
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
    return true;
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
  // A worktree's run names the conversation that started it; the workspace
  // page's worktree section shows its title and whether it is archived.
  const ownerConversation = (id: string) => {
    const a = snapshot?.agents.find((agent) => agent.agent_id === id);
    if (!a) return undefined;
    return {
      id,
      title: agentTitle(a.title),
      href: browserOwned(a, daemonSessions)
        ? `/workspaces/${a.workspace_id}?conversation=${a.agent_id}`
        : `/agents/${a.agent_id}`,
      archived: a.archive === "archived",
    };
  };
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
          revision: a.changed_at ?? a.observation_token,
          href: daemonSession
            ? `/workspaces/${a.workspace_id}?conversation=${a.agent_id}`
            : `/agents/${a.agent_id}`,
          title: agentTitle(a.title),
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
          pendingLabel: closing.has(a.agent_id) ? t.app.closing : undefined,
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
      return t.app.archiveUnavailable;
    if (closing.has(conversation.id)) return t.app.closingInProgress;
    if (!agent?.observation_token || agent.archive !== "active")
      return t.app.archiveStateUnconfirmed;
    if (conversation.process === "terminal_observed_live")
      return t.app.writerRunning;
    if (conversation.waitingOn?.length || agent.waiting_on?.length)
      return t.app.waitBackgroundAndTurn;
    if (
      conversation.runActive ||
      agent.run_active ||
      conversation.command === "accepted" ||
      agent.activity === "running"
    )
      return t.app.waitTurn;
    if (
      conversation.process === "daemon_managed_live" &&
      conversation.command !== "idle"
    )
      return t.app.processUnconfirmed;
    return "";
  };
  // A conversation whose Pi has written no history yet has nothing to keep
  // in the archive: putting it away closes it. The status read proves the
  // first entry before the catalog does, right after the first reply.
  const putAway = (id: string, origin: "home" | "conversation" | "rail") => {
    const agent = snapshot?.agents.find((a) => a.agent_id === id);
    if (!agent) return Promise.resolve(false);
    const status = conversationStore?.readMetadata().statuses.get(id);
    return agent.history === "missing" && status?.native_history !== "present"
      ? closeConversation(agent, origin === "conversation" ? origin : "home")
      : changeArchive(agent, true, origin);
  };
  const archiveFromCard = (id: string) => putAway(id, "home");
  // A rail row is archived like a home card, but the refusal shows in the
  // archive notice, and the open conversation is left as from its own page.
  const closeCreation = (ws: string) => {
    if (!creationViews[ws]?.refused) return;
    setRailStartError("");
    if (
      selectedId === ws &&
      ["new", "new-worktree"].includes(openConversation ?? "")
    )
      navigate(`/workspaces/${ws}`, { replace: true });
    setCreationViews((old) => {
      const next = { ...old };
      delete next[ws];
      return next;
    });
    for (const key of Object.values(creationKeys(identity ?? "", ws)))
      sessionStorage.removeItem(key);
    setGuide(creationGuideOwner(identity ?? "", ws), undefined);
  };
  const railArchive = {
    closes: (id: string) => {
      if (id.startsWith("new:")) return true;
      const agent = snapshot?.agents.find((a) => a.agent_id === id);
      const status = conversationStore?.readMetadata().statuses.get(id);
      if (!agent)
        return Object.values(creationViews).some(
          (view) => view.session?.agent_id === id,
        );
      return (
        agent.history === "missing" && status?.native_history !== "present"
      );
    },
    reason: (id: string) => {
      if (id.startsWith("new:"))
        return creationViews[id.slice(4)]?.refused
          ? ""
          : t.app.archiveStateUnconfirmed;
      const conversation = returnConversations.find((c) => c.id === id);
      return conversation
        ? cardArchiveReason(conversation)
        : t.app.archiveUnavailable;
    },
    run: (id: string) => {
      if (id.startsWith("new:")) return closeCreation(id.slice(4));
      const open = selectedAgentId === id || openConversation === id;
      void putAway(id, open ? "conversation" : "rail");
    },
  };
  // Nosta and Ei nyt (raise-to-your-turn): the person's daemon
  // keeps the mark, so it shows at once here and on their other devices.
  const changeTurn = (id: string, action: "raise" | "lower" | "not_now") => {
    const agent = snapshot?.agents.find((a) => a.agent_id === id);
    if (!agent || !csrf || !mutations || phase !== "authenticated") return;
    const token = csrf;
    const mark = action === "raise" ? "raised" : "not_now";
    // Ei nyt holds until a reply other than the one there now.
    const reply = mark === "not_now" ? agent.last_reply?.id : undefined;
    const at = new Date().toISOString();
    void mutations
      .run({
        command: "conversation.turn",
        key: turnMarkKey(id),
        value:
          mark === "raised"
            ? { state: "raised", at }
            : { state: "not_now", at, ...(reply ? { reply_id: reply } : {}) },
        send: (_commandId, signal) =>
          sendTurnMark(id, mark, reply, token, signal),
        read: (response) => readTurnMarkResult(response, id, mark),
        confirmed: (result) =>
          dispatch(
            hostChanged({
              kind: "turn",
              agent_id: id,
              turn_mark: result.turn_mark,
              cursor: result.event_cursor,
            }),
          ),
        refused: t.app.turnRefused,
      })
      .then((result) => {
        if (result.outcome === "login") requireLogin();
        if (result.outcome === "uncertain") refresh();
      });
  };
  // Up and down live only in the rail's rows (Jari 7.11.2026).
  const railTurn = { run: changeTurn };
  // Naming a conversation from the rail. Pi writes the name; a running Pi
  // directly, a resting one through its settled history.
  const railRename = {
    reason: (id: string) => {
      const agent = snapshot?.agents.find((a) => a.agent_id === id);
      if (
        !csrf ||
        phase !== "authenticated" ||
        snapshot?.write_state === "read_only"
      )
        return t.app.renameUnavailable;
      if (!agent) return t.app.conversationNotFound;
      if (agent.process === "terminal_observed_live")
        return t.app.writerRunning;
      return "";
    },
    // A conversation just started is open before a snapshot lists it, and
    // its page knows where it runs: naming it then must not fail in the
    // browser without asking the host (Jari 11.11.2026).
    save: async (id: string, name: string, workspaceId?: string) => {
      const agent = snapshot?.agents.find((a) => a.agent_id === id);
      const place = agent
        ? (agent.worktree_id ?? agent.workspace_id)
        : workspaceId;
      if (!place || !csrf || !mutations) throw new Error("unavailable");
      const result = await mutations.run({
        command: "conversation.name",
        key: conversationNameKey(id),
        value: name,
        send: (_commandId, signal) =>
          jsonWrite(
            "conversation.name",
            `/api/v1/conversations/${encodeURIComponent(id.replace(/^pi:/, ""))}/name`,
            { workspace_id: place, name },
            csrf,
            { signal },
          ),
        read: async (response) => nameReply(await response.json()),
        confirmed: (reply) =>
          dispatch(
            hostChanged({
              kind: "name",
              agent_id: id,
              name,
              cursor: reply.event_cursor,
            }),
          ),
        // The field says why, in naming's own words.
        refused: (_reason, code) => nameRefusal(code),
        reverted: t.app.renameReverted,
      });
      if (result.outcome === "login") requireLogin();
      if (result.outcome === "uncertain") refresh();
      if (result.outcome === "refused") throw new NameNotSaved(result.text);
      if (result.outcome !== "confirmed") throw new Error("rename_unconfirmed");
    },
  };
  // An empty worktree agent (ADR 0025), from the workspace page's icon row.
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
  const workspacePage = (ws: WorkspaceRecord) =>
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
        identity={identity}
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
        ownerConversation={ownerConversation}
        onRestoreConversation={(id) => {
          const agent = snapshot?.agents.find((a) => a.agent_id === id);
          return agent ? changeArchive(agent, false) : Promise.resolve(false);
        }}
        icon={icons?.get(ws.workspace_id)}
        onIconChanged={(change) => dispatch(hostChanged(change))}
        onLogin={requireLogin}
        refresh={refresh}
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
    else navigate("/workspaces");
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
      nativeReason={snapshot?.auth?.native_github.reason}
      nativeLogin={snapshot?.auth?.native_github.login}
      nativeScopes={snapshot?.auth?.native_github.scopes}
      onReconnect={reconnectGitHub}
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
              <LoginErrorNotice
                code={new URLSearchParams(location.search).get("auth_error")}
              />
            )}
            {logoutError && (
              <PageNotice
                data-testid="logout-uncertain"
                title={t.signIn.logoutUncertainTitle}
                description={t.signIn.logoutUncertainDetail}
                tone="neutral"
                actions={[
                  {
                    label: t.signIn.logoutRetry,
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
        failure={landingFailure}
        retry={{ ...landingRetry, attempting: landingAttempting }}
        onSignIn={() =>
          window.location.assign(
            `/auth/github/start?return_to=${encodeURIComponent(safeRoute(location.pathname))}`,
          )
        }
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
          <PageNotice
            data-testid="archive-error"
            title={
              closeRefusal(archiveProblem)
                ? t.app.closeFailed
                : t.app.archiveChangeFailed
            }
            description={archiveProblem}
            tone="danger"
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
          onRename={railRename.save}
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
          {uncertain ? t.app.conversationUncertain : t.app.conversationMissing}
        </h1>
        <PageNotice
          title={uncertain ? t.app.checkAgain : t.app.chooseAnother}
          description={
            uncertain
              ? t.app.conversationUncertainDetail
              : t.app.conversationMissingDetail
          }
          tone="neutral"
          actions={[{ label: t.app.retry, onPress: refresh }]}
        />
        <LinkRow href="/workspaces" kind="inline">
          {t.app.allWorkspaces}
        </LinkRow>
      </>
    ) : location.pathname === "/shares" &&
      sharesOn &&
      snapshot &&
      (phase === "authenticated" || phase === "stale") ? (
      <SharesPage key={identity} snapshot={snapshot} csrf={csrf} />
    ) : location.pathname === "/resources" &&
      resourcesOn &&
      (phase === "authenticated" || phase === "stale") ? (
      <AgentResourcesPage
        key={identity}
        github={snapshot?.auth?.native_github}
      />
    ) : location.pathname === "/workspaces/new" ? (
      <NewWorkspacePage
        github={githubWarning}
        onReconnect={syntheticDemo ? undefined : reconnectGitHub}
        csrf={csrf}
        token={snapshot?.user_observation_token}
        writeReason={
          syntheticDemo
            ? // Demo-only text stays out of the catalog, so the production
              // bundle never carries the demo's markers.
              language !== "fi"
              ? "Workspaces cannot be created in the synthetic demo."
              : "Synteettisessä demossa ei voi luoda työtiloja."
            : phase !== "authenticated" || !csrf
              ? t.app.workspaceNeedsConnection
              : snapshot?.write_state === "read_only"
                ? t.app.serverReadOnly
                : source !== "confirmed"
                  ? t.app.workspacesUnchecked
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
        {!new URLSearchParams(location.search).has("conversation")
          ? workspacePage(selected)
          : null}
        {new URLSearchParams(location.search).has("conversation") &&
          archiveProblem &&
          !archiveNotice && (
            <PageNotice
              data-testid="archive-error"
              title={
                closeRefusal(archiveProblem)
                  ? t.app.closeFailed
                  : t.app.archiveChangeFailed
              }
              description={archiveProblem}
              tone="danger"
            />
          )}
        {new URLSearchParams(location.search).has("conversation") &&
        !syntheticDemo &&
        identity &&
        conversationStore &&
        selected.facts.some(
          (f) => f.source === "filesystem" && f.state === "confirmed",
        )
          ? (() => {
              const route =
                new URLSearchParams(location.search).get("conversation") ?? "";
              const ws = selected.workspace_id;
              const creationRoute = ["new", "new-worktree"].includes(route);
              const uncertainCreation = sessionStorage.getItem(
                `nah:${identity}:uncertain:${ws}`,
              );
              if (creationRoute && creationViews[ws]?.rechecked)
                return (
                  <Redirect
                    held={!!settingsOver}
                    replace
                    to={`/workspaces/${ws}`}
                  />
                );
              // Nothing is being created and no earlier creation is uncertain
              // (for example, it was reconciled just before a reload): there
              // is no conversation to wait for here.
              if (
                route === "new" &&
                !creationViews[ws] &&
                !createPending.has(ws) &&
                !uncertainCreation
              )
                return (
                  <Redirect
                    held={!!settingsOver}
                    replace
                    to={`/workspaces/${ws}`}
                  />
                );
              const id = creationRoute
                ? createdConversation
                : /^pi:[0-9a-fA-F-]{36}$/.test(route)
                  ? route
                  : undefined;
              // The view a conversation is created in stays its view once it
              // has an ID, so the field the person types in is not replaced.
              let viewKey: string | undefined;
              let creation: Creation | undefined;
              if (creationRoute) {
                // A concurrent render of the new route can resume after the
                // ID route retired its workspace key. Once adopted, the
                // conversation's key wins; never give it a second view.
                viewKey = id ? createdViews.current.get(id) : undefined;
                if (!viewKey)
                  viewKey = creationViewKeys.current[ws] ??=
                    `${identity}:new:${ws}:${crypto.randomUUID()}`;
                if (id) createdViews.current.set(id, viewKey);
              } else if (id) {
                viewKey = createdViews.current.get(id);
                // A later + in this workspace is a new view.
                if (viewKey && creationViewKeys.current[ws] === viewKey)
                  delete creationViewKeys.current[ws];
              }
              if (creationRoute && !id) {
                const worktree = route === "new-worktree";
                // A worktree agent waits for its first message before
                // anything is created (ADR 0025).
                const firstMessage =
                  worktree &&
                  !creationViews[ws] &&
                  !createPending.has(ws) &&
                  !uncertainCreation;
                creation = {
                  onDictating: (active) => {
                    if (active) return setCreationDictating(ws);
                    // What was said or typed while the created
                    // conversation waited joins its draft too.
                    const session = creationViews[ws]?.session;
                    if (session && identity) {
                      adoptCreation(identity, ws, session.agent_id);
                      adoptGuide(identity, ws, session.agent_id);
                    }
                    setCreationDictating((old) =>
                      old === ws ? undefined : old,
                    );
                  },
                  worktree: worktree
                    ? {
                        base: selected.git_summary?.branch,
                        dirty: selected.git_summary?.dirty_count,
                        blocked: firstMessage
                          ? createReason(ws) || undefined
                          : undefined,
                        onFirstMessage: firstMessage
                          ? (text) =>
                              startFromHome(
                                ws,
                                undefined,
                                worktreeNameFrom(text),
                              )
                          : undefined,
                      }
                    : undefined,
                  onRetry: canRecheckCreation(`nah:${identity}:uncertain:${ws}`)
                    ? manualRefresh
                    : undefined,
                  retryLabel: t.app.checkCreation,
                  onClose: creationViews[ws]?.refused
                    ? () => closeCreation(ws)
                    : undefined,
                  refused: creationViews[ws]?.refused,
                  capacity: creationViews[ws]?.capacity
                    ? { tries: creationViews[ws]?.tries ?? 0 }
                    : undefined,
                  onCreateAgain:
                    creationViews[ws]?.refused && !createReason(ws)
                      ? worktree
                        ? // The text is back in the field; sending it
                          // again is the new attempt.
                          () =>
                            setCreationViews((old) => {
                              const next = { ...old };
                              delete next[ws];
                              return next;
                            })
                        : () => startFromHome(ws)
                      : undefined,
                  problem:
                    creationViews[ws]?.problem ??
                    (creationViews[ws] || firstMessage
                      ? undefined
                      : t.app.creationUnconfirmed),
                };
              }
              return (
                <>
                  {creationRoute ? (
                    id ? (
                      <Redirect
                        held={!!settingsOver}
                        replace
                        to={`/workspaces/${ws}?conversation=${id}`}
                      />
                    ) : null
                  ) : closeProblem && closeProblem[0] === closeKey(route) ? (
                    <PageNotice
                      title={t.app.closeFailed}
                      description={closeProblem[1]}
                      tone="danger"
                      actions={[
                        {
                          label: t.app.dismissNotice,
                          onPress: () => mutations?.dismiss(closeProblem[0]),
                        },
                      ]}
                    />
                  ) : null}
                  <BrowserConversation
                    viewKey={viewKey}
                    creation={creation}
                    github={
                      <GitHubConnectionNotice
                        warning={
                          concerns(githubWarning, {
                            provider: snapshot?.auth?.provider,
                            // A worktree's place has the workspace's origin.
                            githubWorkspace:
                              !!selected.git_summary?.github_repo,
                          })
                            ? githubWarning
                            : // An organisation's restriction only where its
                              // repository is worked on: others still work.
                              githubOrgFault(
                                nativeGitHub?.restricted_orgs,
                                selected.git_summary?.github_repo,
                              )
                        }
                        progress={githubAttempt}
                        recovery={githubRecovery}
                        onReconnect={
                          syntheticDemo ? undefined : reconnectGitHub
                        }
                      />
                    }
                    csrf={
                      priorIdentity.current &&
                      priorIdentity.current !== identity
                        ? undefined
                        : csrf
                    }
                    onLogin={onCurrentLogin}
                    store={conversationStore}
                    archive={
                      id
                        ? snapshot?.agents.find((a) => a.agent_id === id)
                        : undefined
                    }
                    onArchive={changeArchive}
                    onClose={closeConversation}
                    onRename={railRename.save}
                    closeBusy={closing.has(id ?? "")}
                    workspace={conversationWorkspace ?? selected}
                    id={id}
                    identity={identity}
                    journalOffline={journalOffline}
                    serverUnavailable={phase === "stale"}
                    recoverySnapshot={snapshot}
                    onStatusEvent={onStatusEvent}
                    title={(() => {
                      const open = snapshot?.agents.find(
                        (a) => a.agent_id === id && a.workspace_id === ws,
                      );
                      return open && agentTitle(open.title);
                    })()}
                    nextWaiting={{ yours: now.yours }}
                    onSessionCreated={(session) => {
                      setDaemonSessions((old) => [...old, session]);
                      refresh(); // The new agent must be in the snapshot before its live turn is seeded.
                    }}
                  />
                </>
              );
            })()
          : null}
        {!new URLSearchParams(location.search).has("conversation") ? (
          <>
            {/* An open archive notice carries the problem itself. */}
            {archiveProblem && !archiveNotice && (
              <PageNotice
                data-testid="archive-error"
                title={
                  closeRefusal(archiveProblem)
                    ? t.app.closeFailed
                    : t.app.archiveChangeFailed
                }
                description={archiveProblem}
                tone="danger"
              />
            )}
            <details
              className="ah-workspace-archive"
              open={helperArchiveOpen}
              onToggle={(event) =>
                setHelperArchiveOpen(event.currentTarget.open)
              }
            >
              <summary>
                {t.app.archive} ·{" "}
                {snapshot?.sources.find((f) => f.source === "annotation")
                  ?.state !== "confirmed" ||
                snapshot?.sources.find((f) => f.source === "pi_history")
                  ?.state !== "confirmed"
                  ? "?"
                  : archivedHere.length}
              </summary>
              {snapshot?.sources.find((f) => f.source === "annotation")
                ?.state !== "confirmed" ? (
                <section
                  data-testid="workspace-archive-panel"
                  aria-label={t.app.workspaceArchive}
                >
                  <h2 data-testid="archive-title">{t.app.archive}</h2>
                  <p data-testid="archive-metadata-unavailable">
                    {t.app.archiveMarksUnreadRefresh}
                  </p>
                </section>
              ) : (
                <WorkspaceArchive
                  binding={csrf}
                  open={helperArchiveOpen}
                  helpers={helpersOn}
                  count={
                    snapshot.sources.find((f) => f.source === "pi_history")
                      ?.state !== "confirmed"
                      ? "?"
                      : archivedHere.length
                  }
                  entries={archivedHere.map((a) => ({
                    id: a.agent_id,
                    title: agentTitle(a.title),
                    href: browserOwned(a, daemonSessions)
                      ? `/workspaces/${selected.workspace_id}?conversation=${a.agent_id}`
                      : `/agents/${a.agent_id}`,
                    archivedAt: a.archived_at,
                    note:
                      a.history !== "readable"
                        ? t.app.historyUnreadable
                        : undefined,
                    restoreReason:
                      a.history !== "readable"
                        ? t.app.historyUnconfirmed
                        : !csrf || phase !== "authenticated"
                          ? t.app.restoreNeedsConnection
                          : undefined,
                  }))}
                  onRestore={(agentId, confirmed) => {
                    const a = archivedHere.find((x) => x.agent_id === agentId);
                    if (a)
                      void changeArchive(a, false, "conversation", confirmed);
                  }}
                >
                  {snapshot.sources.find((f) => f.source === "pi_history")
                    ?.state !== "confirmed" && (
                    <p role="status">{t.app.archiveMaybeIncomplete}</p>
                  )}
                </WorkspaceArchive>
              )}
            </details>
          </>
        ) : null}
        {source !== "confirmed" ? (
          <PageNotice
            data-testid="catalog-partial"
            title={t.app.catalogPartialTitle}
            description={t.app.catalogPartialDetail}
            tone="neutral"
          />
        ) : null}
      </>
    ) : selectedId ? (
      <>
        <h1
          data-testid="conversation-observation"
          data-state={uncertain ? "unknown" : "missing"}
        >
          {uncertain ? t.app.targetUncertain : t.app.targetMissing}
        </h1>
        <p>
          {uncertain ? t.app.targetUncertainDetail : t.app.targetMissingDetail}
        </p>
        <PageNotice
          title={t.app.whatNow}
          actions={[{ label: t.app.retry, onPress: refresh }]}
        />
        <LinkRow href="/workspaces" kind="inline">
          {t.app.allWorkspaces}
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
          >
            <PageNotice
              data-testid="archive-incomplete"
              title={t.app.archiveIncompleteTitle}
              description={[
                snapshot.sources.find((f) => f.source === "annotation")
                  ?.state !== "confirmed"
                  ? t.app.archiveMarksUnread
                  : "",
                snapshot.sources.find((f) => f.source === "pi_history")
                  ?.state !== "confirmed"
                  ? t.app.archiveHistoryUnread
                  : "",
                t.app.refreshData,
              ]
                .filter(Boolean)
                .join(" ")}
              tone="neutral"
            />
          </div>
        )}
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
        {source === "absent" ? (
          <PageNotice
            data-testid="catalog-missing"
            title={t.app.catalogMissingTitle}
            description={t.app.catalogMissingDetail}
            actions={[{ label: t.app.retry, onPress: refresh }]}
            tone="neutral"
          />
        ) : source !== "confirmed" ? (
          <PageNotice
            data-testid="workspaces-partial"
            title={t.app.workspacesPartialTitle}
            description={t.app.workspacesPartialDetail}
            actions={[{ label: t.app.retry, onPress: refresh }]}
            tone="neutral"
          />
        ) : visible.length === 0 ? (
          <PageNotice
            data-testid="workspaces-empty"
            title={t.app.workspacesEmptyTitle}
            description={t.app.workspacesEmptyDetail}
            actions={[{ label: t.app.refreshAction, onPress: refresh }]}
          />
        ) : null}
      </>
    );
  if (fixtureName?.startsWith("design") && CatalogPreview)
    return (
      <Suspense
        fallback={
          <main id="main">
            <h1>{t.app.loadingCatalog}</h1>
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
  const editorRoute = conversationLocation(location);
  // A conversation's top bar carries the bell; elsewhere, and while Settings
  // lies over the conversation, the rail or the phone's toolbar does. One
  // bell per screen.
  const conversationBell = editorRoute && !settingsLayer;
  const editorWorkspaceId = selectedAgentId
    ? agentWorkspace &&
      (selectedAgent?.worktree_id ?? agentWorkspace.workspace_id)
    : (conversationWorkspace ?? selected)?.workspace_id;
  // The sign-in window names the conversations whose messages wait.
  const aiSignInTitle = (id: string) => {
    const agent = snapshot?.agents.find((a) => a.agent_id === id);
    return agent ? agentTitle(agent.title) : undefined;
  };
  return (
    <AccountPreferencesProvider identity={identity} csrf={csrf}>
      {helperConfirmation.dialog}
      <PiModelsProvider key={identity} enabled={!!identity}>
        <AISignInProvider
          key={identity}
          identity={identity ?? ""}
          csrf={csrf}
          reported={
            phase === "authenticated" || phase === "stale"
              ? snapshot?.auth?.ai_refused
              : undefined
          }
          titles={aiSignInTitle}
          onRefresh={refresh}
        >
          <StatusSource
            enabled={!!identity}
            pathname={location.pathname}
            github={
              (phase === "authenticated" || phase === "stale") &&
              concerns(githubWarning, { provider: snapshot?.auth?.provider })
                ? githubWarning
                : undefined
            }
            onReconnect={syntheticDemo ? undefined : reconnectGitHub}
          >
            <AppShell
              modeBar={
                <>
                  <ExplainMode />
                  <ServerBrowserSheetHost identity={identity} csrf={csrf} />
                </>
              }
              bell={conversationBell ? undefined : <StatusBell />}
              navigationBadge={now.yours.length}
              className={landing.entering ? "ah-landing-enter" : undefined}
              mobileTitle={
                (selectedAgent && agentTitle(selectedAgent.title)) ??
                (selected
                  ? (selected.display_name ?? selected.name)
                  : undefined) ??
                (isSettingsRoute(location.pathname)
                  ? t.app.settings
                  : location.pathname === "/shares" && sharesOn
                    ? sharesText[language].title
                    : location.pathname === "/resources" && resourcesOn
                      ? resourcesTitle.title
                      : location.pathname === "/workspaces/new"
                        ? t.app.newWorkspace
                        : t.app.home)
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
                  {syntheticDemo ? (
                    <div className="ah-demo-banner" role="status">
                      {language !== "fi"
                        ? "SYNTHETIC DEMO · Simulated identity and workspace data · No real sign-in, agents or host connection"
                        : "SYNTEETTINEN DEMO · Simuloitu identiteetti ja workspace-data · Ei oikeaa kirjautumista, agentteja eikä host-yhteyttä"}
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
                      onReload={reloadForNewBundle}
                      connectionDetail={
                        versionChanged ? undefined : journalConnection.reason
                      }
                      state={
                        recoveredUpdate ||
                        ((phase === "stale" || journalOffline) &&
                          versionChanged)
                          ? "version-changed"
                          : (phase === "stale" || journalOffline) &&
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
                !landing.show ? (
                  <WorkspaceRailView
                    shares={
                      sharesOn ? (
                        <SharesRail
                          current={location.pathname === "/shares"}
                          collapsed={railCompact && !mobileLayout}
                        />
                      ) : undefined
                    }
                    resources={resourcesOn}
                    browser={
                      railCompact && !mobileLayout ? undefined : (
                        <ServerBrowserRail identity={identity} csrf={csrf} />
                      )
                    }
                    only={onlyWorkspace}
                    bell={conversationBell ? undefined : <StatusBell />}
                    phase={phase}
                    snapshot={snapshot}
                    profile={profile}
                    source={source}
                    collapsed={railCompact && !mobileLayout}
                    now={now}
                    quietChoice={quietChoice}
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
                    onToggle={() =>
                      editorShown
                        ? setRailBesideEditor(!railBesideEditor)
                        : setCollapsed(!collapsed)
                    }
                    onRefresh={manualRefresh}
                    onSettings={openSettings}
                    onLogout={() => setLogoutPrompt(true)}
                    onAdministration={() => navigate(settingsHref("palvelin"))}
                    pathname={location.pathname}
                    clones={cloneJobs}
                    archiveConversation={railArchive}
                    renameConversation={railRename}
                    turnConversation={railTurn}
                    icons={icons}
                  />
                ) : undefined
              }
              overlays={
                <>
                  {trashOutcome ? (
                    <TrashNotice
                      key={`${trashOutcome.result.workspace_id}:${trashOutcome.result.entry ?? ""}`}
                      outcome={trashOutcome}
                      csrf={csrf}
                      refresh={refresh}
                      onClose={() => setTrashOutcome(undefined)}
                    />
                  ) : null}
                  {editorSave &&
                  csrf &&
                  editorSave.csrf === csrf &&
                  editorSave.identity === identity ? (
                    <EditorSaveNotice
                      key={editorSave.id}
                      save={editorSave}
                      csrf={csrf}
                      onClose={() => setEditorSave(undefined)}
                    />
                  ) : null}
                  {archiveNotice ? (
                    <ArchiveNotice
                      kind="archive"
                      key={archiveNotice.id}
                      title={archiveNotice.title}
                      message={
                        archiveNotice.problem
                          ? t.app.archiveChangeFailed
                          : undefined
                      }
                      detail={
                        archiveNotice.problem ? undefined : archiveNotice.detail
                      }
                      busy={
                        !archiveNotice.problem &&
                        snapshot?.agents.find(
                          (a) => a.agent_id === archiveNotice.id,
                        )?.archive !== "archived"
                      }
                      problem={archiveNotice.problem}
                      onClose={() => {
                        setArchiveNotice(undefined);
                        setArchiveProblem("");
                      }}
                      onRestore={
                        archiveNotice.problem
                          ? undefined
                          : () => {
                              const agent = snapshot?.agents.find(
                                (a) => a.agent_id === archiveNotice.id,
                              );
                              if (!agent) return;
                              void changeArchive(agent, false).then(
                                (restored) => {
                                  if (!restored) return;
                                  navigate(archiveNotice.route);
                                  setArchiveNotice(undefined);
                                },
                              );
                            }
                      }
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
                            <PageNotice
                              data-testid="rail-creation-problem"
                              title={t.app.railCreateUncertain}
                              description={railStartError}
                              tone="neutral"
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
                            <HelperRestoreContext.Provider
                              value={
                                helpersOn && helperRestores.binding === csrf
                                  ? helperRestores.ids
                                  : new Set()
                              }
                            >
                              {editorRoute ? (
                                <WorkspaceEditor
                                  journal={journal}
                                  workspaceId={editorWorkspaceId}
                                  identity={identity}
                                  onShownChange={showEditor}
                                  onLeaveSaved={(save) =>
                                    setEditorSave({
                                      ...save,
                                      id: ++editorSaveId.current,
                                      identity,
                                      csrf,
                                    })
                                  }
                                  csrf={
                                    phase === "authenticated" ||
                                    phase === "stale"
                                      ? csrf
                                      : undefined
                                  }
                                >
                                  {main}
                                </WorkspaceEditor>
                              ) : (
                                main
                              )}
                            </HelperRestoreContext.Provider>
                          </ViewHost>
                        </div>
                      }
                    />
                  </Routes>
                </>
              }
            />
          </StatusSource>
        </AISignInProvider>
      </PiModelsProvider>
    </AccountPreferencesProvider>
  );
}
