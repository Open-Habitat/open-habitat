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
import { Navigate, useLocation, useNavigate } from "react-router";
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
import { LoginCard, LoginErrorNotice } from "../components/LoginCard";
import { refused } from "../components/ModelPicker";
import type { ReturnConversation } from "../components/ReturnView";
import { AccountProfileOnboarding } from "./AccountProfileOnboarding";
import { BrowserConversation } from "./BrowserConversation";
import {
  dismissBundlePrompt,
  reloadForNewBundle,
  useBundleState,
  watchBundle,
} from "./bundleRelease";
import { ConversationJournal } from "./conversationJournal";
import { ConversationStore } from "./conversationStore";
import {
  canRecheckCreation,
  closeEmpty,
  createTracked,
  list as listConversations,
  NotAdmitted,
  type Session,
  setArchive,
} from "./conversations";
import { FallbackAccount } from "./FallbackAccount";
import { GitHubOnboarding } from "./GitHubOnboarding";
import { HistoryView } from "./HistoryView";
import { adoptCreation } from "./heldMessages";
import { NewConversationModelDialog } from "./NewConversationModelDialog";
import { NewWorkspace } from "./NewWorkspace";
import { CreatingConversation } from "./PendingConversation";
import { type Choice, loadPiModels, PiModelSelector } from "./PiModelSelector";
import { PiModelsProvider } from "./PiModels";
import {
  type AccountProfile,
  accountSession,
  type PiState,
  piStatus,
  sessionCSRF,
} from "./pi";
import { reconnectDiagnostic, reconnectFetch } from "./reconnectDiagnostic";
import { browserOwned, readSnapshot, sourceState } from "./snapshot";
import {
  authenticated,
  authenticationRequired,
  clearIdentity,
  filterChanged,
  loading,
  piRequired,
  type RootState,
  stale,
  unavailable,
} from "./store";
import { mutateWorkspace } from "./WorkspaceManagement";
import { WorkspacePage } from "./WorkspacePage";
import { WorkspaceRailView } from "./WorkspaceRailView";

const CatalogPreview =
  import.meta.env.VITE_ENABLE_TEST_FIXTURES === "true"
    ? lazy(() => import("../test/CatalogPreview"))
    : null;

function safeRoute(path: string) {
  return path === "/" ||
    path === "/workspaces" ||
    path === "/settings" ||
    path === "/administration" ||
    /^\/workspaces\/ws_[A-Za-z0-9_-]{8,80}$/.test(path) ||
    /^\/agents\/pi:[0-9a-fA-F-]{36}$/.test(path)
    ? path
    : "/workspaces";
}
// Two reads that run side by side. A 401 from either wins over the other's
// failure; otherwise either failure fails both.
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
  const location = useLocation();
  const { phase, snapshot, filter } = useSelector(
    (s: RootState) => s.connection,
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [newWorkspace, setNewWorkspace] = useState(false);
  const [piCheckFailed, setPiCheckFailed] = useState(false);
  const [settingsPiState, setSettingsPiState] = useState<
    PiState | "checking" | "unavailable"
  >("checking");
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [logoutError, setLogoutError] = useState(false);
  const [archiveProblem, setArchiveProblem] = useState("");
  const archiveFocusPending = useRef<string | undefined>(undefined);
  const [archiveNotice, setArchiveNotice] = useState<{
    id: string;
    title: string;
    route: string;
  }>();
  const [railStartError, setRailStartError] = useState("");
  const [creationViews, setCreationViews] = useState<
    Record<string, { problem?: string; session?: Session; rechecked?: boolean }>
  >({});
  const currentRoute = useRef(location);
  currentRoute.current = location;
  const [newChoiceWorkspace, setNewChoiceWorkspace] = useState<string>();
  const [defaultRefresh, setDefaultRefresh] = useState(0);
  const [createPending, setCreatePending] = useState<Set<string>>(new Set());
  const [defaultStart, setDefaultStart] = useState<{
    identity: string;
    blocked: boolean;
    unavailable: boolean;
  }>();
  const railStarting = useRef(new Set<string>());
  const [archiveBusy, setArchiveBusy] = useState(false);
  // A local presentation mask only: the host remains authoritative and failures
  // remove it. Retain it across stale snapshot reads until the host confirms.
  const [pendingArchive, setPendingArchive] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingClose, setPendingClose] = useState<Set<string>>(
    () => new Set(),
  );
  // Workspace archive and restore show at once as a presentation overlay; the
  // next snapshot confirms it and a refused write removes it.
  const [pendingVisibility, setPendingVisibility] = useState<
    ReadonlyMap<string, "hidden" | "visible">
  >(() => new Map());
  const visibilityInFlight = useRef(new Set<string>());
  // Completed writes by workspace, numbered: a snapshot read that starts after
  // a write completed retires its overlay even if the host now disagrees.
  const visibilityWritten = useRef(new Map<string, number>());
  const [visibilityProblem, setVisibilityProblem] = useState<{
    id: string;
    text: string;
  }>();
  const closeInFlight = useRef(false);
  const confirmedClose = useRef(new Set<string>());
  const archiveInFlight = useRef(false);
  const [logoutPrompt, setLogoutPrompt] = useState(false);
  const [settingsReturn, setSettingsReturn] = useState("/workspaces");
  const [settingsFromMenu, setSettingsFromMenu] = useState(false);
  const returningFromSettings = useRef(false);
  useEffect(() => {
    if (location.pathname !== "/settings" && returningFromSettings.current) {
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
  }, [location.pathname]);
  const [profile, setProfile] = useState<AccountProfile>();
  const [profileSkipped, setProfileSkipped] = useState(false);
  const identity = snapshot?.identity.web_identity_id;
  const conversationStore = useMemo(
    () => (identity ? new ConversationStore(identity) : undefined),
    [identity],
  );
  useEffect(() => {
    if (snapshot) conversationStore?.applySnapshot(snapshot);
  }, [conversationStore, snapshot]);
  const priorIdentity = useRef<string | undefined>(undefined);
  const identityGeneration = useRef(0);
  const owned = useRef<{
    store?: ConversationStore;
    journal?: ConversationJournal;
  }>({});
  // Invalidate callbacks before aborting reads or clearing the visible snapshot.
  // Local concealment does not prove the server session ended.
  const clearPerson = useCallback((person?: string) => {
    ++identityGeneration.current;
    owned.current.journal?.stop();
    owned.current.store?.dispose(); // also cancels every pending page read
    owned.current = {};
    setNewWorkspace(false);
    railStarting.current.clear();
    setCreatePending(new Set());
    setDefaultStart(undefined);
    setNewChoiceWorkspace(undefined);
    setRailStartError("");
    setCreationViews({});
    setPendingArchive(new Set());
    setPendingClose(new Set());
    setPendingVisibility(new Map());
    visibilityInFlight.current.clear();
    visibilityWritten.current.clear();
    setVisibilityProblem(undefined);
    closeInFlight.current = false;
    confirmedClose.current.clear();
    setArchiveBusy(false);
    setArchiveNotice(undefined);
    archiveFocusPending.current = undefined;
    archiveInFlight.current = false;
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
    setSettingsReturn("/workspaces");
    setSettingsFromMenu(false);
    returningFromSettings.current = false;
    setExpanded({});
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
    setSettingsPiState("checking");
    setSettingsReturn(
      safeRoute(location.pathname) === "/settings"
        ? "/workspaces"
        : safeRoute(location.pathname),
    );
    navigate("/settings");
  };
  const syntheticDemo = import.meta.env.VITE_SYNTHETIC_DEMO === "true";
  const fixtureName =
    import.meta.env.VITE_ENABLE_TEST_FIXTURES === "true"
      ? new URLSearchParams(location.search).get("fixture")
      : null;
  const refresh = useCallback(() => {
    setRefreshKey((n) => n + 1);
  }, []);
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
  // Separate from the first-load gate: report the current native credential
  // state, not the state observed when this browser first authenticated.
  useEffect(() => {
    if (
      location.pathname !== "/settings" ||
      !identity ||
      (phase !== "authenticated" && phase !== "stale")
    )
      return;
    const controller = new AbortController();
    setSettingsPiState("checking");
    void piStatus(controller.signal)
      .then((state) => {
        if (controller.signal.aborted) return;
        if (state === "login") requireLogin();
        else setSettingsPiState(state);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSettingsPiState("unavailable");
      });
    return () => controller.abort();
  }, [location.pathname, phase, identity, requireLogin]);
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
  });
  journalCallbacks.current.onSnapshotNeeded = refresh;
  journalCallbacks.current.onLogin = requireLogin;
  const journal = useMemo(
    () =>
      conversationStore
        ? new ConversationJournal(conversationStore, {
            activeId: () => activeId.current,
            onSnapshotNeeded: () => journalCallbacks.current.onSnapshotNeeded(),
            onStatusChange: (id, kind, payload) =>
              journalCallbacks.current.onStatusChange(id, kind, payload),
            onLogin: () => journalCallbacks.current.onLogin(),
            onOffline: (value) => journalCallbacks.current.onOffline(value),
            onConnection: (state, reason) =>
              setJournalConnection({ state, reason }),
          })
        : undefined,
    [conversationStore],
  );
  // Layout cleanup closes the old connection before a new identity can paint.
  useLayoutEffect(() => {
    owned.current = { store: conversationStore, journal };
    return () => {
      if (owned.current.store === conversationStore) {
        journal?.stop();
        conversationStore?.dispose();
        owned.current = {};
      }
    };
  }, [conversationStore, journal]);
  const journalSnapshot = useRef(snapshot);
  journalSnapshot.current = snapshot;
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
    if (snapshot && (phase === "authenticated" || phase === "stale"))
      journal?.resume(snapshot);
  }, [snapshot, journal, phase]);
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
    const settledVisibility = new Map(visibilityWritten.current);
    const ready = () =>
      active &&
      generation === identityGeneration.current &&
      !loginFenced.current;
    if (!snapshot && ready()) dispatch(loading());
    const fail = (gate: "login" | "pi" | "unavailable") => {
      if (!ready()) return;
      if (gate === "login") {
        setCSRF(undefined);
        requireLogin();
      } else if (ready() && gate === "pi") dispatch(piRequired());
      else if (ready() && snapshot) {
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
          piChecked.current = true;
        }
        const reads = await bothReads(
          sessionRead,
          reconnectFetch(
            "/api/v1/snapshot",
            syntheticDemo
              ? `/api/v1/snapshot?scenario=${new URLSearchParams(location.search).get("scenario") ?? "ready"}`
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
        if (response.status === 403 || response.status >= 500)
          return fail("unavailable");
        if (
          !response.ok ||
          response.headers.get("content-type")?.split(";")[0] !==
            "application/json"
        )
          throw new Error("unavailable");
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
        setPiCheckFailed(false);
        dispatch(authenticated(next));
        if (settledVisibility.size) {
          const retired = [...settledVisibility].filter(
            ([id, n]) =>
              visibilityWritten.current.get(id) === n &&
              !visibilityInFlight.current.has(id),
          );
          for (const [id] of retired) visibilityWritten.current.delete(id);
          setPendingVisibility((old) => {
            const nextMap = new Map(old);
            for (const [id] of retired) nextMap.delete(id);
            return nextMap.size === old.size ? old : nextMap;
          });
        }
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
      } catch {
        if (ready() && !controller.signal.aborted) fail("unavailable");
      }
    };
    void load();
    return () => {
      active = false;
      controller.abort();
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
      const result = await fetch("/auth/logout", {
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
  const workspaces =
    snapshot?.workspaces.map((w) => {
      const pending = pendingVisibility.get(w.workspace_id);
      return pending ? { ...w, visibility: pending } : w;
    }) ?? [];
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
  useEffect(() => {
    if (snapshot && location.pathname === "/" && phase === "authenticated")
      navigate("/workspaces", { replace: true });
  }, [snapshot, location.pathname, navigate, phase]);
  const selectedId = /^\/workspaces\/(ws_[A-Za-z0-9_-]{8,80})$/.exec(
    location.pathname,
  )?.[1];
  const selected = workspaces.find(
    (w) => w.workspace_id === selectedId && w.presence === "present",
  );
  const selectedAgentId = /^\/agents\/(pi:[0-9a-fA-F-]{36})$/.exec(
    location.pathname,
  )?.[1];
  const previousView = useRef({ path: location.pathname, phase });
  // Focus only on navigation or a new sign-in state, never on a snapshot refresh.
  // Settings owns its own entry focus and the conversation owns its editor focus.
  useLayoutEffect(() => {
    const previous = previousView.current;
    previousView.current = { path: location.pathname, phase };
    if (previous.path === location.pathname && previous.phase === phase) return;
    if (
      location.pathname === "/settings" ||
      phase === "loading" ||
      phase === "pi_required"
    )
      return;
    if (returningFromSettings.current) return;
    if (phase === "authenticated" && selectedAgentId) return;
    const main = document.getElementById("main");
    const heading = main?.querySelector<HTMLElement>("h1");
    if (heading) heading.tabIndex = -1;
    (heading ?? main)?.focus({ preventScroll: true });
  }, [location.pathname, phase, selectedAgentId]);
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
              : matches.length === 0
                ? "filtered-empty"
                : "ready";
  useEffect(() => {
    if (!snapshot) return;
    setPendingArchive((previous) => {
      if (
        ![...previous].some((id) =>
          snapshot.agents.some(
            (a) => a.agent_id === id && a.archive === "archived",
          ),
        )
      )
        return previous;
      return new Set(
        [...previous].filter(
          (id) =>
            !snapshot.agents.some(
              (a) => a.agent_id === id && a.archive === "archived",
            ),
        ),
      );
    });
  }, [snapshot]);
  const closeConversation = async (
    agent: NonNullable<typeof snapshot>["agents"][number],
  ) => {
    if (
      !csrf ||
      phase !== "authenticated" ||
      closeInFlight.current ||
      !agent.agent_id.startsWith("pi:")
    )
      return;
    closeInFlight.current = true;
    const person = identity;
    const route = `${location.pathname}${location.search}`;
    setArchiveProblem("");
    setPendingClose((old) => new Set(old).add(agent.agent_id));
    navigate(`/workspaces/${agent.workspace_id}`, { replace: true });
    try {
      await closeEmpty(agent.agent_id, csrf);
      if (currentIdentity.current !== person) return;
      confirmedClose.current.add(agent.agent_id);
      setDaemonSessions((old) =>
        old.filter((s) => s.agent_id !== agent.agent_id),
      );
      refresh();
    } catch (error) {
      if (currentIdentity.current !== person) return;
      setPendingClose((old) => {
        const next = new Set(old);
        next.delete(agent.agent_id);
        return next;
      });
      if ((error as Error).message === "identity_lost") requireLogin();
      setArchiveProblem(
        error instanceof NotAdmitted
          ? "Sulkemista ei tehty: keskustelussa on sisältöä tai kirjoittajaa ei voida sulkea turvallisesti."
          : "Sulkemista ei voitu vahvistaa. Keskustelu palautettiin näkyviin; tarkista natiivi tila.",
      );
      if (
        `${window.location.pathname}${window.location.search}` ===
        `/workspaces/${agent.workspace_id}`
      )
        navigate(route, { replace: true });
      refresh();
    } finally {
      if (currentIdentity.current === person) closeInFlight.current = false;
    }
  };
  useEffect(() => {
    if (!snapshot) return;
    setPendingClose((old) => {
      const next = new Set(
        [...old].filter(
          (id) =>
            !confirmedClose.current.has(id) ||
            snapshot.agents.some((a) => a.agent_id === id),
        ),
      );
      for (const id of confirmedClose.current)
        if (!next.has(id)) confirmedClose.current.delete(id);
      return next.size === old.size ? old : next;
    });
  }, [snapshot]);
  useEffect(() => {
    if (!snapshot) return;
    setPendingVisibility((old) => {
      const next = new Map(old);
      for (const [id, value] of old)
        if (
          !visibilityInFlight.current.has(id) &&
          snapshot.workspaces.find((w) => w.workspace_id === id)?.visibility ===
            value
        )
          next.delete(id);
      return next.size === old.size ? old : next;
    });
  }, [snapshot]);
  const changeVisibility = async (
    workspace: NonNullable<typeof snapshot>["workspaces"][number],
    hidden: boolean,
  ) => {
    const id = workspace.workspace_id;
    if (
      !csrf ||
      phase !== "authenticated" ||
      visibilityInFlight.current.has(id) ||
      !workspace.observation_token ||
      workspace.mutation_state !== "allowed"
    )
      return false;
    const person = identity;
    visibilityInFlight.current.add(id);
    setVisibilityProblem(undefined);
    setPendingVisibility((old) =>
      new Map(old).set(id, hidden ? "hidden" : "visible"),
    );
    let ok = true;
    try {
      await mutateWorkspace(
        {
          action: "visibility",
          workspace_id: id,
          observation_token: workspace.observation_token,
          hidden,
        },
        csrf,
      );
    } catch {
      ok = false;
    }
    if (currentIdentity.current !== person) return false;
    visibilityInFlight.current.delete(id);
    if (ok)
      visibilityWritten.current.set(
        id,
        (visibilityWritten.current.get(id) ?? 0) + 1,
      );
    if (!ok) {
      setPendingVisibility((old) => {
        const next = new Map(old);
        next.delete(id);
        return next;
      });
      setVisibilityProblem({
        id,
        text: hidden
          ? "Arkistointia ei voitu vahvistaa. Työtila näkyy taas; päivitä tiedot ennen uutta yritystä."
          : "Palautusta ei voitu vahvistaa. Päivitä tiedot ennen uutta yritystä.",
      });
    }
    refresh();
    return ok;
  };
  const changeArchive = async (
    agent: NonNullable<typeof snapshot>["agents"][number],
    archived: boolean,
    origin: "conversation" | "home" = "conversation",
  ) => {
    if (
      !csrf ||
      phase !== "authenticated" ||
      archiveInFlight.current ||
      (archived && pendingArchive.has(agent.agent_id)) ||
      !agent.observation_token ||
      agent.archive === "unknown"
    )
      return false;
    archiveInFlight.current = true;
    setArchiveBusy(true);
    setArchiveProblem("");
    const person = identity;
    const fromRoute = `${location.pathname}${location.search}`;
    if (archived) setPendingArchive((old) => new Set(old).add(agent.agent_id));
    try {
      await setArchive(
        agent.agent_id,
        agent.workspace_id,
        agent.observation_token,
        archived,
        agent.archive === "archived" ? "archived" : "active",
        csrf,
      );
      if (currentIdentity.current !== person) return false;
      if (!archived)
        setPendingArchive((old) => {
          const next = new Set(old);
          next.delete(agent.agent_id);
          return next;
        });
      else if (
        `${window.location.pathname}${window.location.search}` === fromRoute
      ) {
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
      refresh();
      return true;
    } catch (error) {
      if (currentIdentity.current !== person) return false;
      if (archived)
        setPendingArchive((old) => {
          const next = new Set(old);
          next.delete(agent.agent_id);
          return next;
        });
      if ((error as Error).message === "identity_lost") requireLogin();
      if (origin !== "home")
        setArchiveProblem(
          error instanceof NotAdmitted
            ? "Arkistointia ei tehty: keskustelun tila muuttui tai kirjoittaja on aktiivinen. Päivitä tiedot."
            : "Arkistoinnin tulos on epävarma. Päivitä tilanne ennen uutta yritystä.",
        );
      refresh();
      return false;
    } finally {
      if (currentIdentity.current === person) {
        archiveInFlight.current = false;
        setArchiveBusy(false);
      }
    }
  };
  const defaultSettingsOpen = location.pathname === "/settings";
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
      return "Pi:n malliluetteloa ei voitu vahvistaa. Tarkista kirjautuminen.";
    return "";
  };
  const startFromHome = (workspaceId: string, choice?: Choice) => {
    if (
      !csrf ||
      railStarting.current.has(workspaceId) ||
      createReason(workspaceId)
    )
      return;
    if (!choice && defaultStart?.blocked) {
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
    const pendingRoute = `/workspaces/${workspaceId}?conversation=new`;
    navigate(pendingRoute);
    void createTracked(workspaceId, csrf, uncertainKey, current, choice)
      .then((session) => {
        if (!session || !current()) return;
        // The new conversation takes over what was written meanwhile.
        if (person) adoptCreation(person, workspaceId, session.agent_id);
        setDaemonSessions((old) => [...old, session]);
        refresh();
        setCreationViews((old) => ({ ...old, [workspaceId]: { session } }));
      })
      .catch((error) => {
        if (!current()) return;
        if ((error as Error).message === "identity_lost") requireLogin();
        else {
          const message = sessionStorage.getItem(uncertainKey)
            ? "Luonnin tulos epävarma. Tarkista tiedot ennen uutta yritystä; pyyntöä ei lähetetä automaattisesti uudelleen."
            : "Istuntoa ei voitu vahvistaa. Luontia ei lähetetty.";
          setCreationViews((old) => ({
            ...old,
            [workspaceId]: { problem: message },
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
      `${location.pathname}${location.search}` !== autoStart.route
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
  }, [autoStart, snapshot, identity, defaultStart, csrf, phase, location]);
  const returnConversations: (ReturnConversation & { workspaceId: string })[] =
    (snapshot?.agents ?? [])
      .filter(
        (a) =>
          a.archive !== "archived" &&
          !pendingArchive.has(a.agent_id) &&
          !pendingClose.has(a.agent_id) &&
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
    if (archiveBusy) return "Arkistointi kesken.";
    if (!agent?.observation_token || agent.archive !== "active")
      return "Arkiston tilaa ei voida vahvistaa.";
    if (conversation.process === "terminal_observed_live")
      return "Kirjoittaja on käynnissä.";
    if (conversation.waitingOn?.length || agent.waiting_on?.length)
      return "Odota prosessin tai spinoffin valmistumista ja agentin vuoron päättymistä.";
    if (
      conversation.runActive ||
      agent.run_active ||
      conversation.command === "accepted" ||
      agent.activity === "running"
    )
      return "Odota Pi:n vuoron päättymistä.";
    if (
      conversation.process === "daemon_managed_live" &&
      conversation.command !== "idle"
    )
      return "Prosessin tilaa ei voitu vahvistaa.";
    return "";
  };
  const archiveFromCard = (id: string) => {
    const agent = snapshot?.agents.find((a) => a.agent_id === id);
    return agent ? changeArchive(agent, true, "home") : Promise.resolve(false);
  };
  const main =
    phase === "authenticated" &&
    new URLSearchParams(location.search).has("pi_sign_in") ? (
      <GitHubOnboarding
        skipChooser
        forceSignIn
        onSessionChanged={sessionChanged}
        onUsable={() => {
          const params = new URLSearchParams(location.search);
          const conversation = params.get("conversation");
          if (conversation) conversationStore?.discardStatus(conversation);
          navigate(
            conversation &&
              /^\/workspaces\/ws_[A-Za-z0-9_-]{8,64}$/.test(
                location.pathname,
              ) &&
              /^pi:[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/.test(
                conversation,
              )
              ? `${location.pathname}?conversation=${encodeURIComponent(conversation)}`
              : "/workspaces",
            { replace: true },
          );
          refresh();
        }}
        onLogin={requireLogin}
        onLogout={logout}
      />
    ) : phase === "loading" ? (
      <>
        <h1>Ladataan</h1>
        <p>Haetaan työtiloja…</p>
      </>
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
    ) : (location.pathname === "/settings" ||
        location.pathname === "/administration") &&
      (phase === "authenticated" || phase === "stale" || settingsFromMenu) ? (
      <AccountSettings
        key={location.pathname}
        administration={location.pathname === "/administration"}
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
        piState={settingsPiState}
        onPiSignIn={() => navigate("/settings?pi_sign_in=1")}
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
        onBack={() => {
          returningFromSettings.current = true;
          setSettingsFromMenu(false);
          navigate(settingsReturn);
        }}
      />
    ) : phase === "pi_required" ? (
      <GitHubOnboarding
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
      <>
        <h1>Yhteyttä ei saatu</h1>
        <InlineNotice
          title="Työtiloja ei voitu näyttää"
          description="Tietoja ei voitu tarkistaa. Tämä ei tarkoita, että työtilasi olisivat kadonneet. Tarkista yhteys ja yritä uudelleen."
          tone="danger"
          actions={[{ label: "Yritä uudelleen", onPress: refresh }]}
        />
      </>
    ) : selectedAgent &&
      agentWorkspace &&
      selectedAgent.archive !== "archived" &&
      !(location.state as { readOnly?: boolean } | null)?.readOnly &&
      browserOwned(selectedAgent, daemonSessions) ? (
      // A browser conversation opens with its composer, never as read-only
      // history; its Pi starts only when the person sends.
      <Navigate
        replace
        to={`/workspaces/${agentWorkspace.workspace_id}?conversation=${selectedAgent.agent_id}`}
      />
    ) : selectedAgent && agentWorkspace && conversationStore ? (
      <>
        {archiveProblem && (
          <InlineNotice
            title={
              archiveProblem.startsWith("Sulkemista")
                ? "Sulkeminen epäonnistui"
                : "Arkiston tila epävarma"
            }
            description={archiveProblem}
            tone="warning"
          />
        )}
        <HistoryView
          onLogin={onCurrentLogin}
          store={conversationStore}
          agent={selectedAgent}
          archiveBusy={archiveBusy}
          restoreAvailable={
            !!csrf &&
            phase === "authenticated" &&
            selectedAgent.history === "readable" &&
            !!selectedAgent.observation_token &&
            !archiveBusy
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
        <h1>
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
    ) : selected ? (
      <>
        {!new URLSearchParams(location.search).has("conversation") ? (
          conversationStore ? (
            <WorkspacePage
              key={selected.workspace_id}
              onVisibility={(hidden) => changeVisibility(selected, hidden)}
              visibilityPending={pendingVisibility.has(selected.workspace_id)}
              visibilityProblem={
                visibilityProblem?.id === selected.workspace_id
                  ? visibilityProblem.text
                  : undefined
              }
              onArchive={archiveFromCard}
              archiveReason={cardArchiveReason}
              workspace={selected}
              conversations={returnConversations.filter(
                (c) => c.workspaceId === selected.workspace_id,
              )}
              store={conversationStore}
              csrf={
                phase === "authenticated" &&
                snapshot?.write_state !== "read_only"
                  ? csrf
                  : undefined
              }
              startReason={createReason(selected.workspace_id)}
              onRecheckCreation={
                identity &&
                canRecheckCreation(
                  `nah:${identity}:uncertain:${selected.workspace_id}`,
                )
                  ? manualRefresh
                  : undefined
              }
              defaultUnavailable={
                defaultStart?.identity === identity &&
                !!defaultStart?.unavailable
              }
              onRefreshDefault={() => setDefaultRefresh((value) => value + 1)}
              defaultRefused={
                defaultStart?.identity === identity && !!defaultStart?.blocked
              }
              onNewChoice={
                !createReason(selected.workspace_id)
                  ? (id, choice) => startFromHome(id, choice)
                  : undefined
              }
              onNew={
                !createReason(selected.workspace_id) &&
                !syntheticDemo &&
                phase === "authenticated" &&
                csrf &&
                snapshot?.write_state !== "read_only" &&
                selected.mutation_state === "allowed" &&
                selected.facts.some(
                  (f) => f.source === "filesystem" && f.state === "confirmed",
                )
                  ? startFromHome
                  : undefined
              }
              refresh={refresh}
            />
          ) : null
        ) : null}
        {new URLSearchParams(location.search).has("conversation") &&
          archiveProblem && (
            <InlineNotice
              title={
                archiveProblem.startsWith("Sulkemista")
                  ? "Sulkeminen epäonnistui"
                  : "Arkiston tila epävarma"
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
          new URLSearchParams(location.search).get("conversation") === "new" ? (
            creationViews[selected.workspace_id]?.rechecked ? (
              <Navigate replace to={`/workspaces/${selected.workspace_id}`} />
            ) : creationViews[selected.workspace_id]?.session ? (
              <Navigate
                replace
                to={`/workspaces/${selected.workspace_id}?conversation=${creationViews[selected.workspace_id].session?.agent_id}`}
              />
            ) : !creationViews[selected.workspace_id] &&
              !createPending.has(selected.workspace_id) &&
              !sessionStorage.getItem(
                `nah:${identity}:uncertain:${selected.workspace_id}`,
              ) ? (
              // Nothing is being created and no earlier creation is uncertain
              // (for example, it was reconciled just before a reload): there
              // is no conversation to wait for here.
              <Navigate replace to={`/workspaces/${selected.workspace_id}`} />
            ) : (
              <CreatingConversation
                key={`${identity}:${selected.workspace_id}`}
                workspace={selected}
                identity={identity}
                onRetry={
                  canRecheckCreation(
                    `nah:${identity}:uncertain:${selected.workspace_id}`,
                  )
                    ? manualRefresh
                    : undefined
                }
                retryLabel="Tarkista luonnin tulos"
                problem={
                  creationViews[selected.workspace_id]?.problem ??
                  (creationViews[selected.workspace_id]
                    ? undefined
                    : "Luonnin tilaa ei voida vahvistaa. Tarkista keskustelulista ja natiivi historia.")
                }
              />
            )
          ) : (
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
              archiveBusy={archiveBusy}
              closeBusy={[...pendingClose].some(
                (id) => !confirmedClose.current.has(id),
              )}
              archiveAwaitingSnapshot={pendingArchive.has(
                new URLSearchParams(location.search).get("conversation") ?? "",
              )}
              workspace={selected}
              id={
                /^pi:[0-9a-fA-F-]{36}$/.test(
                  new URLSearchParams(location.search).get("conversation") ??
                    "",
                )
                  ? (new URLSearchParams(location.search).get("conversation") ??
                    undefined)
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
          )
        ) : null}
        {!new URLSearchParams(location.search).has("conversation") ? (
          <>
            {archiveProblem && (
              <InlineNotice
                title={
                  archiveProblem.startsWith("Sulkemista")
                    ? "Sulkeminen epäonnistui"
                    : "Arkiston tila epävarma"
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
              <section aria-label="Työtilan arkisto">
                <h2>Arkisto</h2>
                {snapshot?.sources.find((f) => f.source === "annotation")
                  ?.state !== "confirmed" ? (
                  <p>Arkistoa ei voitu lukea. Päivitä tiedot.</p>
                ) : (
                  <>
                    {snapshot.sources.find((f) => f.source === "pi_history")
                      ?.state !== "confirmed" && (
                      <p role="status">
                        Arkisto voi olla puutteellinen: Pi:n historiaa ei voitu
                        kokonaan tarkistaa. Päivitä tiedot.
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
                            label="Palauta näkyviin"
                            variant="quiet"
                            onPress={() => void changeArchive(a, false)}
                            availability={
                              archiveBusy ||
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
            title="Kaikkia työtiloja ei voitu tarkistaa"
            description="Kaikkia työtiloja ei voitu tarkistaa. Näet vain löytyneet työtilat; kokeile päivittää tiedot myöhemmin."
            tone="warning"
          />
        ) : null}
      </>
    ) : selectedId ? (
      <>
        <h1>
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
          <InlineNotice
            title="Arkistoa ei voitu kokonaan tarkistaa"
            description="Osa Pi:n historiasta tai arkistomerkinnöistä on poissa käytöstä. Tyhjä lista ei vahvista tyhjää arkistoa."
            tone="warning"
          />
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
              ? () => setNewWorkspace(true)
              : undefined
          }
        />
        {source === "absent" ? (
          <InlineNotice
            title="Työtilakansiota ei löydy"
            description="Työtilakansiota ei löydy. Jos loit sen juuri, kokeile päivittää tiedot."
            actions={[{ label: "Yritä uudelleen", onPress: refresh }]}
            tone="warning"
          />
        ) : source !== "confirmed" ? (
          <InlineNotice
            title="Työtiloja ei voitu vahvistaa"
            description="Kaikkia työtiloja ei voitu tarkistaa. Näet vain löytyneet työtilat."
            actions={[{ label: "Yritä uudelleen", onPress: refresh }]}
            tone="warning"
          />
        ) : visible.length === 0 ? (
          <InlineNotice
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
  return (
    <PiModelsProvider key={identity} enabled={!!identity}>
      <AppShell
        mobileTitle={
          selectedAgent?.title.display ??
          (selected ? (selected.display_name ?? selected.name) : undefined) ??
          (location.pathname === "/settings" ? "Asetukset" : "Etusivu")
        }
        fallbackAccount={
          profile &&
          (phase === "pi_required" || phase === "daemon_unavailable") ? (
            <FallbackAccount
              profile={profile}
              onSettings={openSettings}
              onAdministration={() => navigate("/administration")}
              onLogout={() => setLogoutPrompt(true)}
            />
          ) : undefined
        }
        connection={
          <>
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
            phase === "daemon_unavailable" ? null : (
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
          conversationStore ? (
            <WorkspaceRailView
              phase={phase}
              snapshot={snapshot}
              pendingArchive={new Set([...pendingArchive, ...pendingClose])}
              profile={profile}
              store={conversationStore}
              source={source}
              collapsed={collapsed && !mobileLayout}
              matches={matches}
              archived={archivedWorkspaces}
              pendingVisibility={pendingVisibility}
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
              selectedAgentId={selectedAgentId}
              daemonSessions={daemonSessions}
              expanded={expanded}
              onExpand={setExpanded}
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
                  ? () => setNewWorkspace(true)
                  : undefined
              }
              onFilter={(v) => dispatch(filterChanged(v))}
              onToggle={() => setCollapsed(!collapsed)}
              onRefresh={manualRefresh}
              onSettings={openSettings}
              onLogout={() => setLogoutPrompt(true)}
              onAdministration={() => navigate("/administration")}
              pathname={location.pathname}
              search={location.search}
            />
          ) : undefined
        }
        overlays={
          <>
            {archiveNotice ? (
              <ArchiveNotice
                key={archiveNotice.id}
                title={archiveNotice.title}
                busy={
                  archiveBusy ||
                  snapshot?.agents.find((a) => a.agent_id === archiveNotice.id)
                    ?.archive !== "archived"
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
                onCreate={(choice) => startFromHome(newChoiceWorkspace, choice)}
              />
            )}
            {newWorkspace && csrf && (
              <NewWorkspace
                csrf={csrf}
                available={
                  phase === "authenticated" &&
                  source === "confirmed" &&
                  snapshot?.write_state !== "read_only"
                }
                token={snapshot?.user_observation_token}
                refresh={refresh}
                onClose={() => setNewWorkspace(false)}
                onCreated={(name) => {
                  if (identity)
                    setAutoStart({
                      name,
                      identity,
                      route: `${location.pathname}${location.search}`,
                      until: Date.now() + 60000,
                    });
                }}
              />
            )}
          </>
        }
        main={
          <div
            className={
              phase === "authentication_required" ? "ah-login-view" : "ah-state"
            }
          >
            {railStartError ? (
              <InlineNotice
                title="Keskustelun luonnin tulos epävarma"
                description={railStartError}
                tone="warning"
              />
            ) : null}
            {main}
          </div>
        }
      />
    </PiModelsProvider>
  );
}
