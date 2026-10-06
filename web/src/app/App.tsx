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
import { useLocation, useNavigate } from "react-router";
import {
  AccountSettings,
  AppShell,
  ConnectionBanner,
  InlineNotice,
} from "../components";
import { LinkRow } from "../components/ControlElements";
import { LoginCard, LoginErrorNotice } from "../components/LoginCard";
import { ReturnView } from "../components/ReturnView";
import { BrowserConversation } from "./BrowserConversation";
import { ConversationJournal } from "./conversationJournal";
import { ConversationStore } from "./conversationStore";
import { list as listConversations, type Session } from "./conversations";
import { GitHubOnboarding } from "./GitHubOnboarding";
import { HistoryView } from "./HistoryView";
import { piStatus, sessionCSRF } from "./pi";
import { readSnapshot, sourceState, type Workspace } from "./snapshot";
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
import { sourceLabel, WorkspaceRailView } from "./WorkspaceRailView";
import { WorkspaceManagement } from "./WorkspaceManagement";

const CatalogPreview =
  import.meta.env.VITE_ENABLE_TEST_FIXTURES === "true"
    ? lazy(() => import("../test/CatalogPreview"))
    : null;

function safeRoute(path: string) {
  return path === "/" ||
    path === "/workspaces" ||
    path === "/settings" ||
    /^\/workspaces\/ws_[A-Za-z0-9_-]{8,80}$/.test(path) ||
    /^\/agents\/pi:[0-9a-fA-F-]{36}$/.test(path)
    ? path
    : "/workspaces";
}
function WorkspaceDetails({ workspace }: { workspace: Workspace }) {
  const fact = (source: string) =>
    sourceLabel(
      workspace.facts.find((f) => f.source === source)?.state ?? "unknown",
    );
  return (
    <header className="ah-workspace-detail">
      <LinkRow href="/workspaces" kind="inline" className="ah-back-link">
        Työtilat
      </LinkRow>
      <h1>{workspace.display_name ?? workspace.name}</h1>
      <p>
        Hakemisto <code>{workspace.name}</code>
      </p>
      <details className="ah-workspace-facts">
        <summary>Työtilan tiedot</summary>
        <dl className="ah-facts">
          <div>
            <dt>Hakemisto</dt>
            <dd>{fact("filesystem")}</dd>
          </div>
          <div>
            <dt>Git</dt>
            <dd>{fact("git")}</dd>
          </div>
          <div>
            <dt>Asetukset</dt>
            <dd>{fact("annotation")}</dd>
          </div>
          <div>
            <dt>Muutokset</dt>
            <dd>
              {workspace.mutation_state === "allowed"
                ? "Käytettävissä"
                : workspace.mutation_state === "blocked_unknown"
                  ? "Ei voitu vahvistaa"
                  : "Ei käytettävissä"}
            </dd>
          </div>
        </dl>
      </details>
    </header>
  );
}
export function App() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { phase, snapshot, filter } = useSelector(
    (s: RootState) => s.connection,
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [piCheckFailed, setPiCheckFailed] = useState(false);
  // Daemon catalog distinguishes browser-started Pi sessions from read-only
  // terminal history; it is not a cookie-scoped conversation lease.
  const [daemonSessions, setDaemonSessions] = useState<Session[]>([]);
  const [csrf, setCSRF] = useState<string>();
  // First load only. A successful onboarding attempt has already checked Pi.
  const piChecked = useRef(false);
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
  const [settingsReturn, setSettingsReturn] = useState("/workspaces");
  const returningFromSettings = useRef(false);
  useEffect(() => {
    if (location.pathname !== "/settings" && returningFromSettings.current) {
      returningFromSettings.current = false;
      (window.matchMedia("(max-width: 800px)").matches
        ? document.querySelector<HTMLElement>("[aria-label='Avaa navigaatio']")
        : document.querySelector<HTMLElement>("[data-account-controls] button")
      )?.focus();
    }
  }, [location.pathname]);
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
    returningFromSettings.current = false;
    setExpanded({});
    setDaemonSessions([]);
    setCSRF(undefined);
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
    dispatch(authenticationRequired());
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
  const statusListeners = useRef(new Set<(id: string, kind: string) => void>());
  const onStatusEvent = useCallback(
    (listener: (id: string, kind: string) => void) => {
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
    onStatusChange: (id: string, kind: string) => {
      statusListeners.current.forEach((listener) => {
        listener(id, kind);
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
            onStatusChange: (id, kind) =>
              journalCallbacks.current.onStatusChange(id, kind),
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
        if (!syntheticDemo && !piChecked.current) {
          const token = await sessionCSRF(controller.signal);
          if (!ready()) return;
          if (token === "login") return fail("login");
          setCSRF(token);
          const status = await piStatus(controller.signal);
          if (!ready()) return;
          if (status === "login") return fail("login");
          if (
            status === "missing" ||
            status === "unknown" ||
            status === "unavailable"
          ) {
            if (status === "missing")
              sessionStorage.removeItem("nah:github-step");
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
        if (!ready()) return;
        setPiCheckFailed(false);
        dispatch(authenticated(next));
        if (!syntheticDemo) {
          try {
            const catalog = await listConversations(controller.signal);
            if (ready()) setDaemonSessions(catalog);
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
  }, [dispatch, refreshKey, fixtureName, syntheticDemo, requireLogin]);
  const logout = async () => {
    loginFenced.current = true;
    clearPerson(priorIdentity.current);
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
  const firstVisible = visible[0]?.workspace_id;
  useEffect(() => {
    if (
      snapshot &&
      location.pathname === "/" &&
      phase === "authenticated" &&
      firstVisible
    )
      navigate(`/workspaces/${firstVisible}`, { replace: true });
  }, [snapshot, firstVisible, location.pathname, navigate, phase]);
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
  const main =
    phase === "authenticated" &&
    new URLSearchParams(location.search).has("pi_sign_in") ? (
      <GitHubOnboarding
        skipChooser
        forceSignIn
        onUsable={() => {
          navigate("/workspaces", { replace: true });
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
      <>
        <LoginCard
          onLogin={() => {
            if (syntheticDemo) return;
            window.location.assign(
              `/auth/github/start?return_to=${encodeURIComponent(safeRoute(location.pathname))}`,
            );
          }}
        />
        {new URLSearchParams(location.search).has("auth_error") ? (
          <LoginErrorNotice />
        ) : null}
        {logoutError ? (
          <InlineNotice
            title="Uloskirjautumista ei voitu vahvistaa"
            description="Istunto voi olla edelleen voimassa. Kun yhteys toimii, yritä uloskirjautumista uudelleen."
            tone="danger"
            actions={[
              { label: "Yritä uloskirjautumista uudelleen", onPress: logout },
            ]}
          />
        ) : null}
      </>
    ) : phase === "pi_required" ? (
      <GitHubOnboarding
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
    ) : location.pathname === "/settings" ? (
      <AccountSettings
        name="Oma tili"
        onLogout={logout}
        nativeState={snapshot?.auth?.native_github.state}
        onBack={() => {
          returningFromSettings.current = true;
          navigate(settingsReturn);
        }}
      />
    ) : selectedAgent && agentWorkspace && conversationStore ? (
      <HistoryView
        onLogin={onCurrentLogin}
        store={conversationStore}
        agent={selectedAgent}
        workspaceName={agentWorkspace.display_name ?? agentWorkspace.name}
        workspaceId={agentWorkspace.workspace_id}
      />
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
          <>
            <WorkspaceDetails workspace={selected} />
            {!syntheticDemo && phase === "authenticated" && (
              <WorkspaceManagement
                key={selected.workspace_id}
                workspace={selected}
                csrf={csrf}
                refresh={refresh}
                onCreated={(id) => navigate(`/workspaces/${id}`)}
                onHidden={() => navigate("/workspaces")}
              />
            )}
          </>
        ) : null}
        {!syntheticDemo &&
        identity &&
        conversationStore &&
        selected.facts.some(
          (f) => f.source === "filesystem" && f.state === "confirmed",
        ) ? (
          <BrowserConversation
            csrf={
              priorIdentity.current && priorIdentity.current !== identity
                ? undefined
                : csrf
            }
            onLogin={onCurrentLogin}
            store={conversationStore}
            workspace={selected}
            id={
              /^pi:[0-9a-fA-F-]{36}$/.test(
                new URLSearchParams(location.search).get("conversation") ?? "",
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
                    new URLSearchParams(location.search).get("conversation") &&
                  a.workspace_id === selected.workspace_id,
              )?.title.display
            }
            onSessionCreated={(session) => {
              setDaemonSessions((old) => [...old, session]);
              refresh(); // The new agent must be in the snapshot before its live turn is seeded.
            }}
          />
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
        {visible.length > 0 ? (
          <ReturnView
            store={conversationStore}
            conversations={(snapshot?.agents ?? [])
              .filter(
                (a) =>
                  a.history === "readable" &&
                  visible.some((w) => w.workspace_id === a.workspace_id),
              )
              .map((a) => {
                const workspace = visible.find(
                  (w) => w.workspace_id === a.workspace_id,
                );
                const daemonSession = daemonSessions.some(
                  (s) =>
                    s.agent_id === a.agent_id &&
                    s.workspace_id === a.workspace_id,
                );
                return {
                  id: a.agent_id,
                  href: daemonSession
                    ? `/workspaces/${a.workspace_id}?conversation=${a.agent_id}`
                    : `/agents/${a.agent_id}`,
                  title: a.title.display,
                  workspace: workspace?.display_name ?? workspace?.name ?? "",
                  browserSession: daemonSession,
                  process: phase === "stale" ? "stale" : a.process,
                };
              })}
          />
        ) : (
          <h1>Työtilat</h1>
        )}
        {!syntheticDemo &&
          phase === "authenticated" &&
          source === "confirmed" && (
            <WorkspaceManagement
              csrf={csrf}
              workspaces={snapshot?.workspaces}
              userObservationToken={snapshot?.user_observation_token}
              refresh={refresh}
              onCreated={(id) => navigate(`/workspaces/${id}`)}
            />
          )}
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
        />
      </Suspense>
    );
  return (
    <div key={identity}>
      <AppShell
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
                onRetry={phase === "stale" ? refresh : undefined}
                state={
                  phase === "stale"
                    ? "stale"
                    : phase === "authenticated"
                      ? "online"
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
              onFilter={(v) => dispatch(filterChanged(v))}
              onToggle={() => setCollapsed(!collapsed)}
              onRefresh={manualRefresh}
              onSettings={openSettings}
              onLogout={logout}
              pathname={location.pathname}
              search={location.search}
            />
          ) : undefined
        }
        main={
          <div
            className={
              phase === "authentication_required" ? "ah-login-view" : "ah-state"
            }
          >
            {main}
          </div>
        }
      />
    </div>
  );
}
