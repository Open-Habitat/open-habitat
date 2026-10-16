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
import { NewWorkspace } from "./NewWorkspace";
import { PendingConversation } from "./PendingConversation";
import { type Choice, loadPiModels, PiModelSelector } from "./PiModelSelector";
import { PiModelsProvider } from "./PiModels";
import {
  type AccountProfile,
  accountSession,
  type PiState,
  piStatus,
  sessionCSRF,
} from "./pi";
import { readSnapshot, sourceState } from "./snapshot";
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
export function App() {
  const dispatch = useDispatch();
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
  const [workspaceMenuRequest, setWorkspaceMenuRequest] = useState<{
    id: string;
    action: "rename" | "hide";
  }>();
  const [archiveNotice, setArchiveNotice] = useState<{
    id: string;
    title: string;
    route: string;
  }>();
  const [railStartError, setRailStartError] = useState("");
  const [creationViews, setCreationViews] = useState<
    Record<string, { problem?: string; session?: Session }>
  >({});
  const currentRoute = useRef(location);
  currentRoute.current = location;
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
    setRailStartError("");
    setCreationViews({});
    setPendingArchive(new Set());
    setPendingClose(new Set());
    closeInFlight.current = false;
    confirmedClose.current.clear();
    setArchiveBusy(false);
    setArchiveNotice(undefined);
    archiveFocusPending.current = undefined;
    setWorkspaceMenuRequest(undefined);
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
      else if (ready() && snapshot) dispatch(stale());
      else if (ready()) dispatch(unavailable());
    };
    const load = async () => {
      if (!ready()) return;
      try {
        // Read the session on every refresh, not only the first Pi check:
        // another tab can replace the cookie without notifying this tab.
        const session = syntheticDemo
          ? undefined
          : await accountSession(controller.signal);
        if (!ready()) return;
        if (session === "login") return fail("login");
        if (
          session &&
          sessionBinding.current &&
          sessionBinding.current !== session.csrf
        ) {
          clearPerson(priorIdentity.current);
          dispatch(loading());
          sessionBinding.current = session.csrf;
          setRefreshKey((n) => n + 1);
          return;
        }
        if (session) {
          sessionBinding.current = session.csrf;
          // The session is authoritative for account controls even when the
          // daemon snapshot cannot be read. A changed binding was cleared above
          // before this profile can be presented with any retained snapshot.
          setCSRF(session.csrf);
          setProfile(session.profile);
        }
        const stillBound = async () => {
          if (!session) return true;
          const current = await sessionCSRF(controller.signal);
          if (!ready()) return false;
          if (current === session.csrf) return true;
          clearPerson(priorIdentity.current);
          dispatch(loading());
          sessionBinding.current = current === "login" ? undefined : current;
          setRefreshKey((n) => n + 1);
          return false;
        };
        if (!syntheticDemo && !piChecked.current) {
          const status = await piStatus(controller.signal);
          if (!ready()) return;
          if (!(await stillBound())) return;
          if (status === "login") return fail("login");
          if (
            status === "missing" ||
            status === "unknown" ||
            status === "unavailable"
          ) {
            if (status === "missing")
              sessionStorage.removeItem("nah:github-step");
            setCSRF(session?.csrf);
            setProfile(session?.profile);
            setPiCheckFailed(status !== "missing");
            return fail("pi");
          }
          piChecked.current = true;
        }
        const response = await fetch(
          syntheticDemo
            ? `/api/v1/snapshot?scenario=${new URLSearchParams(location.search).get("scenario") ?? "ready"}`
            : "/api/v1/snapshot",
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (!ready()) return;
        if (response.status === 401) return fail("login");
        if (response.status === 403 || response.status >= 500)
          return fail("unavailable");
        if (
          !response.ok ||
          response.headers.get("content-type")?.split(";")[0] !==
            "application/json"
        )
          throw new Error("unavailable");
        const next = await readSnapshot(response);
        if (!ready() || !(await stillBound())) return;
        setCSRF(session?.csrf);
        setProfile(session?.profile);
        setPiCheckFailed(false);
        dispatch(authenticated(next));
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
                  )
                    sessionStorage.removeItem(key);
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
  const visible =
    snapshot?.workspaces.filter(
      (w) => w.presence === "present" && w.visibility === "visible",
    ) ?? [];
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
  const selected = snapshot?.workspaces.find(
    (w) =>
      w.workspace_id === selectedId &&
      w.presence === "present" &&
      w.visibility === "visible",
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
        origin !== "home" &&
        `${window.location.pathname}${window.location.search}` === fromRoute
      ) {
        setArchiveNotice({
          id: agent.agent_id,
          title: agent.title.display,
          route: fromRoute,
        });
        archiveFocusPending.current = agent.workspace_id;
        navigate(`/workspaces/${agent.workspace_id}`);
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
  const defaultWorkspaceContext =
    /^\/workspaces\/ws_[A-Za-z0-9_-]{8,64}$/.test(location.pathname) &&
    !new URLSearchParams(location.search).has("conversation")
      ? location.pathname
      : "";
  // Refresh on a workspace landing or return from settings, not on snapshots
  // or every controlled-window switch. No preference is stored by this read.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the route context explicitly requests a fresh native default observation.
  useEffect(() => {
    if (phase !== "authenticated" || !identity || syntheticDemo) return;
    if (defaultSettingsOpen) {
      setDefaultStart(undefined);
      return;
    }
    if (!defaultWorkspaceContext && defaultStart?.identity === identity) return;
    const controller = new AbortController();
    setDefaultStart(undefined);
    void loadPiModels(controller.signal)
      .then((models) => {
        if (controller.signal.aborted) return;
        const chosen = models.models.find(
          (model) =>
            model.id === models.default_model &&
            (model.provider ?? "openai-codex") ===
              (models.default_provider ?? "openai-codex"),
        );
        setDefaultStart({
          identity,
          blocked: !!refused(chosen),
          unavailable: models.catalog_status === "unavailable",
        });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setDefaultStart({ identity, blocked: false, unavailable: true });
      });
    return () => controller.abort();
  }, [
    identity,
    phase,
    defaultSettingsOpen,
    defaultWorkspaceContext,
    defaultRefresh,
  ]);
  const createReason = (workspaceId: string, explicitChoice = false) => {
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
    if (!explicitChoice && defaultStart?.blocked)
      return "Pi:n oletusmalli ei ole käytettävissä. Valitse toinen malli.";
    return "";
  };
  const startFromHome = (workspaceId: string, choice?: Choice) => {
    if (
      !csrf ||
      railStarting.current.has(workspaceId) ||
      createReason(workspaceId, !!choice)
    )
      return;
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
  const workspaceMenuAction = (id: string, action: "rename" | "hide") => {
    setWorkspaceMenuRequest({ id, action });
    navigate(`/workspaces/${id}`);
  };
  const returnConversations: (ReturnConversation & { workspaceId: string })[] =
    (snapshot?.agents ?? [])
      .filter(
        (a) =>
          a.archive !== "archived" &&
          !pendingArchive.has(a.agent_id) &&
          !pendingClose.has(a.agent_id) &&
          visible.some((w) => w.workspace_id === a.workspace_id),
      )
      .map((a) => {
        const workspace = visible.find(
          (w) => w.workspace_id === a.workspace_id,
        );
        const daemonSession = daemonSessions.some(
          (s) => s.agent_id === a.agent_id && s.workspace_id === a.workspace_id,
        );
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
    if (conversation.command === "accepted" || agent.activity === "running")
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
        modelSelector={<PiModelSelector csrf={csrf} />}
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
              actionRequest={
                workspaceMenuRequest?.id === selected.workspace_id
                  ? workspaceMenuRequest.action
                  : undefined
              }
              onActionHandled={() => setWorkspaceMenuRequest(undefined)}
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
                !createReason(selected.workspace_id, true)
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
            creationViews[selected.workspace_id]?.session ? (
              <Navigate
                replace
                to={`/workspaces/${selected.workspace_id}?conversation=${creationViews[selected.workspace_id].session?.agent_id}`}
              />
            ) : (
              <PendingConversation
                workspace={selected}
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
            {(snapshot?.sources.find((f) => f.source === "annotation")
              ?.state !== "confirmed" ||
              snapshot?.sources.find((f) => f.source === "pi_history")
                ?.state !== "confirmed" ||
              snapshot?.agents.some(
                (a) =>
                  a.workspace_id === selected.workspace_id &&
                  a.archive === "archived",
              )) && (
              <details className="ah-workspace-archive">
                <summary>Arkisto</summary>
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
                          Arkisto voi olla puutteellinen: Pi:n historiaa ei
                          voitu kokonaan tarkistaa. Päivitä tiedot.
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
                                daemonSessions.some(
                                  (s) => s.agent_id === a.agent_id,
                                )
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
            )}
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
          conversations={returnConversations}
          newReason={createReason}
          onWorkspaceAction={
            phase === "authenticated" &&
            csrf &&
            snapshot?.write_state !== "read_only"
              ? workspaceMenuAction
              : undefined
          }
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
                state={
                  phase === "stale"
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
              onWorkspaceAction={
                phase === "authenticated" &&
                csrf &&
                snapshot.write_state !== "read_only"
                  ? workspaceMenuAction
                  : undefined
              }
              snapshot={snapshot}
              pendingArchive={new Set([...pendingArchive, ...pendingClose])}
              profile={profile}
              store={conversationStore}
              source={source}
              collapsed={collapsed && !mobileLayout}
              matches={matches}
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
                onCreated={() => {}}
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
