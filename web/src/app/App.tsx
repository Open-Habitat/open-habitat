import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router";
import {
  AccountSettings,
  AccountShelf,
  AppShell,
  ConnectionBanner,
  InlineNotice,
  NavLink,
  WorkspaceRail,
  WorkspaceSection,
} from "../components";
import { accountLabel } from "../components/Account";
import { LoginCard, LoginErrorNotice } from "../components/LoginCard";
import {
  BrowserConversation,
  type ConversationPlace,
} from "./BrowserConversation";
import { GitHubOnboarding } from "./GitHubOnboarding";
import { HistoryView } from "./HistoryView";
import { list as listConversations, type Session } from "./conversations";
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
function sourceLabel(state: string) {
  return (
    (
      {
        confirmed: "Vahvistettu",
        absent: "Lähde puuttuu",
        unavailable: "Lähde ei ole saatavilla",
        unknown: "Tieto ei ole tiedossa",
        conflicting: "Ristiriitainen tieto",
      } as Record<string, string>
    )[state] ?? "Tieto ei ole tiedossa"
  );
}
function WorkspaceDetails({ workspace }: { workspace: Workspace }) {
  const fact = (source: string) =>
    sourceLabel(
      workspace.facts.find((f) => f.source === source)?.state ?? "unknown",
    );
  return (
    <header className="ah-workspace-detail">
      <Link to="/workspaces" className="ah-back-link">
        Työtilat
      </Link>
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
              {workspace.mutation_state === "read_only"
                ? "Ei käytettävissä"
                : "Tila ei tiedossa"}
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
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [browserSessions, setBrowserSessions] = useState<Session[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [identityEpoch, setIdentityEpoch] = useState(0);
  const sessionBinding = useRef<string | undefined>(undefined);
  const loginGeneration = useRef(0);
  const editorPlace = useRef<
    { editor: HTMLTextAreaElement; start: number; end: number } | undefined
  >(undefined);
  const captureEditor = useCallback(() => {
    const editor = document.activeElement;
    if (editor instanceof HTMLTextAreaElement)
      editorPlace.current = {
        editor,
        start: editor.selectionStart,
        end: editor.selectionEnd,
      };
  }, []);
  useLayoutEffect(() => {
    if (verifying || !editorPlace.current) return;
    const { editor, start, end } = editorPlace.current;
    editorPlace.current = undefined;
    if (editor.isConnected && !editor.disabled) {
      editor.focus({ preventScroll: true });
      editor.setSelectionRange(start, end);
    }
  }, [verifying]);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [logoutError, setLogoutError] = useState(false);
  const [settingsReturn, setSettingsReturn] = useState("/workspaces");
  const returningFromSettings = useRef(false);
  // Memory-only reading place. Revalidation masks the mounted view; a changed
  // login or a failed check drops both the snapshot and ephemeral UI state.
  const conversationPlace = useRef(new Map<string, ConversationPlace>());
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
  const priorIdentity = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (
      priorIdentity.current &&
      ((identity && identity !== priorIdentity.current) ||
        phase === "authentication_required" ||
        phase === "pi_required")
    ) {
      for (const key of Object.keys(sessionStorage))
        if (key.startsWith(`nah:`)) sessionStorage.removeItem(key);
      setSettingsReturn("/workspaces");
      returningFromSettings.current = false;
      setExpanded({});
      conversationPlace.current.clear();
    }
    if (identity) priorIdentity.current = identity;
  }, [identity, phase]);
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
    captureEditor();
    setVerifying(true);
    setRefreshKey((n) => n + 1);
  }, [captureEditor]);
  const manualRefresh = () => {
    setHistoryRefreshKey((n) => n + 1);
    refresh();
  };
  // A disconnected tab can recover without a page reload when the browser
  // announces a restored network. Do not retry writes or repeat on a timer.
  useEffect(() => {
    if (phase !== "daemon_unavailable" && phase !== "stale") return;
    window.addEventListener("online", refresh);
    return () => window.removeEventListener("online", refresh);
  }, [phase, refresh]);
  const requireLogin = useCallback(
    () => dispatch(authenticationRequired()),
    [dispatch],
  );
  // A click in an already foreground window is not a return to the tab.
  // Mask identity-scoped DOM on a real return until the cookie and snapshot
  // have both been verified. Keep it mounted to preserve the editor and scroll.
  useEffect(() => {
    if (
      syntheticDemo ||
      fixtureName ||
      (phase !== "authenticated" && phase !== "stale")
    )
      return;
    // The first authenticated render may happen in a background tab; there
    // need not have been a blur event for this listener to observe.
    let away = document.visibilityState === "hidden" || !document.hasFocus();
    const blur = () => {
      captureEditor();
      away = true;
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") away = true;
      else if (away) {
        away = false;
        refresh();
      }
    };
    const focus = () => {
      if (document.visibilityState === "visible" && away) {
        away = false;
        refresh();
      }
    };
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [refresh, captureEditor, fixtureName, phase]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is the explicit refresh trigger, not read inside the effect.
  useEffect(() => {
    if (fixtureName?.startsWith("design") && CatalogPreview) return;
    const controller = new AbortController();
    // A pending endpoint must not leave the identity mask up forever.
    let active = true;
    let verifiedToken: string | undefined;
    let timedOut = false;
    let retaining = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
      if (active && !retaining) void retain(verifiedToken);
    }, 10000);
    const generation = loginGeneration.current;
    if (!snapshot) dispatch(loading());
    const fail = (gate: "login" | "pi" | "unavailable") => {
      if (!active || generation !== loginGeneration.current) return;
      window.clearTimeout(timeout);
      sessionBinding.current = undefined;
      for (const key of Object.keys(sessionStorage))
        if (key.startsWith("nah:")) sessionStorage.removeItem(key);
      conversationPlace.current.clear();
      setBrowserSessions([]);
      setIdentityEpoch((n) => n + 1);
      if (gate === "login") dispatch(authenticationRequired());
      else if (gate === "pi") dispatch(piRequired());
      else dispatch(unavailable());
      editorPlace.current = undefined;
      setVerifying(false);
    };
    const retain = async (token?: string) => {
      if (retaining) return;
      retaining = true;
      if (!active || !snapshot || !token || sessionBinding.current !== token) {
        fail("unavailable");
        return;
      }
      try {
        // The cookie can change after the first check and before a failed
        // snapshot. Verify once more before leaving old facts on screen.
        const current = await sessionCSRF(AbortSignal.timeout(3000));
        if (!active || generation !== loginGeneration.current) return;
        if (current !== token)
          return fail(current === "login" ? "login" : "unavailable");
        dispatch(stale());
        window.clearTimeout(timeout);
        setVerifying(false);
      } catch {
        fail("unavailable");
      }
    };
    const load = async () => {
      try {
        let token: string | "login" | undefined;
        if (!syntheticDemo) {
          // On the initial unauthenticated load, avoid requesting a session
          // before the Pi gate: onboarding owns its own session binding.
          // Only the authenticated tab-return path overlaps these reads.
          const [status, session] = snapshot
            ? await Promise.all([
                piStatus(controller.signal),
                sessionCSRF(controller.signal),
              ])
            : [await piStatus(controller.signal), undefined];
          if (
            !active ||
            controller.signal.aborted ||
            generation !== loginGeneration.current
          )
            return;
          if (status === "login" || session === "login") return fail("login");
          if (status === "missing" || status === "unknown") {
            setPiCheckFailed(status === "unknown");
            return fail("pi");
          }
          token = session ?? (await sessionCSRF(controller.signal));
          // A failed authority check is not a transport outage. A different
          // session must never inherit the previous user's mounted content.
          if (snapshot && sessionBinding.current !== token) {
            for (const key of Object.keys(sessionStorage))
              if (key.startsWith("nah:")) sessionStorage.removeItem(key);
            conversationPlace.current.clear();
            setBrowserSessions([]);
            setIdentityEpoch((n) => n + 1);
            sessionBinding.current = undefined;
            dispatch(clearIdentity());
            window.clearTimeout(timeout);
            setVerifying(false);
            return;
          }
          verifiedToken = token;
          if (status === "unavailable") {
            // Retain already verified facts only for the same session. Initial
            // requests belong in the OpenAI step with an explicit check error.
            if (snapshot) await retain(token);
            else {
              setPiCheckFailed(true);
              fail("pi");
            }
            return;
          }
          // Unknown or malformed Pi status is not permission to retain.
          if (status !== "usable") return fail("unavailable");
        }
        if (
          !active ||
          controller.signal.aborted ||
          generation !== loginGeneration.current
        )
          return;
        if (token === "login") return fail("login");
        let response: Response;
        try {
          response = await fetch(
            syntheticDemo
              ? `/api/v1/snapshot?scenario=${new URLSearchParams(location.search).get("scenario") ?? "ready"}`
              : "/api/v1/snapshot",
            {
              credentials: "same-origin",
              cache: "no-store",
              signal: controller.signal,
            },
          );
        } catch {
          // Only the snapshot transport may fail while authority is verified.
          if (timedOut) return;
          if (snapshot && verifiedToken && !controller.signal.aborted) {
            await retain(verifiedToken);
            return;
          }
          throw new Error("snapshot transport");
        }
        if (response.status === 401) return fail("login");
        if (response.status === 403) return fail("unavailable");
        if (response.status === 428) return fail("pi");
        // The gateway rejects malformed daemon snapshots as 502 and foreign
        // identities as 403. A 503 is now a transient native/host outage.
        if (!active || generation !== loginGeneration.current) return;
        if (response.status === 502) return fail("unavailable");
        if (response.status >= 500) {
          if (snapshot) await retain(verifiedToken);
          else fail("unavailable");
          return;
        }
        if (
          !response.ok ||
          response.headers.get("content-type")?.split(";")[0] !==
            "application/json"
        )
          throw new Error("unavailable");
        const next = await readSnapshot(response);
        if (
          !active ||
          controller.signal.aborted ||
          generation !== loginGeneration.current
        )
          return;
        if (
          snapshot &&
          snapshot.identity.web_identity_id !== next.identity.web_identity_id
        ) {
          // A mismatched snapshot is not proof that this browser belongs to
          // the new identity. Clear rather than rendering either identity.
          return fail("login");
        }
        sessionBinding.current = token;
        setPiCheckFailed(false);
        dispatch(authenticated(next));
        window.clearTimeout(timeout);
        setVerifying(false);
        if (!syntheticDemo) {
          try {
            const controlled = await listConversations(controller.signal);
            if (
              active &&
              !controller.signal.aborted &&
              sessionBinding.current === token
            )
              setBrowserSessions(controlled);
          } catch {
            if (active && !controller.signal.aborted) setBrowserSessions([]);
          }
        }
      } catch {
        if (!timedOut) fail("unavailable");
      }
    };
    void load();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [dispatch, refreshKey, fixtureName, syntheticDemo]);
  const logout = async () => {
    setLogoutError(false);
    setSettingsReturn("/workspaces");
    if (syntheticDemo) {
      dispatch(clearIdentity());
      navigate("/workspaces?scenario=login", { replace: true });
      return;
    }
    // Hide every identity-scoped fact before the first write or new login.
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(`nah:`)) sessionStorage.removeItem(key);
    conversationPlace.current.clear();
    setBrowserSessions([]);
    editorPlace.current = undefined;
    loginGeneration.current++;
    sessionBinding.current = undefined;
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
      source === "confirmed" &&
      phase === "authenticated" &&
      firstVisible
    )
      navigate(`/workspaces/${firstVisible}`, { replace: true });
  }, [snapshot, source, firstVisible, location.pathname, navigate, phase]);
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
    if (verifying) return;
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
  }, [location.pathname, phase, verifying, selectedAgentId]);
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
    phase === "loading" ? (
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
        onUsable={refresh}
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
        name={accountLabel(snapshot?.identity.display_name ?? "")}
        nativeState={snapshot?.auth?.native_github.state}
        onBack={() => {
          returningFromSettings.current = true;
          navigate(settingsReturn);
        }}
      />
    ) : selectedAgent && agentWorkspace ? (
      <HistoryView
        stale={phase === "stale"}
        key={`${selectedAgent.agent_id}:${historyRefreshKey}`}
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
        <Link to="/workspaces">Kaikki työtilat</Link>
      </>
    ) : selected ? (
      <>
        {!new URLSearchParams(location.search).has("conversation") ? (
          <WorkspaceDetails workspace={selected} />
        ) : null}
        {!syntheticDemo &&
        identity &&
        selected.facts.some(
          (f) => f.source === "filesystem" && f.state === "confirmed",
        ) ? (
          <BrowserConversation
            stale={phase === "stale"}
            onRefreshStale={refresh}
            key={`${identity}:${selected.workspace_id}:${location.search}`}
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
            title={
              snapshot?.agents.find(
                (a) =>
                  a.agent_id ===
                    new URLSearchParams(location.search).get("conversation") &&
                  a.workspace_id === selected.workspace_id,
              )?.title.display
            }
            place={conversationPlace}
            onSessionCreated={(session) =>
              setBrowserSessions((old) => [...old, session])
            }
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
        <Link to="/workspaces">Kaikki työtilat</Link>
      </>
    ) : (
      <>
        <h1>Työtilat</h1>
        {visible.length > 0 ? (
          <>
            <p>
              Työtilasi ja niiden keskustelut löydät vasemmalta. Voit jatkaa
              lukemista avaamalla keskustelun.
            </p>
            <section className="ah-continue" aria-labelledby="continue-heading">
              <h2 id="continue-heading">Palaa keskusteluihin</h2>
              {snapshot?.agents.some(
                (a) =>
                  a.history === "readable" &&
                  visible.some((w) => w.workspace_id === a.workspace_id),
              ) ? (
                <ul className="ah-continue-list">
                  {snapshot.agents
                    .filter(
                      (a) =>
                        a.history === "readable" &&
                        visible.some((w) => w.workspace_id === a.workspace_id),
                    )
                    .slice(0, 3)
                    .map((a) => {
                      const workspace = visible.find(
                        (w) => w.workspace_id === a.workspace_id,
                      );
                      const browserSession = browserSessions.some(
                        (s) =>
                          s.agent_id === a.agent_id &&
                          s.workspace_id === a.workspace_id,
                      );
                      return (
                        <li key={a.agent_id}>
                          <Link
                            to={
                              browserSession
                                ? `/workspaces/${a.workspace_id}?conversation=${a.agent_id}`
                                : `/agents/${a.agent_id}`
                            }
                          >
                            {a.title.display}
                            <small>
                              {workspace?.display_name ?? workspace?.name}
                              {browserSession
                                ? " · Jatka työtä"
                                : " · Vain luettavissa"}
                            </small>
                          </Link>
                        </li>
                      );
                    })}
                </ul>
              ) : (
                <p>Keskusteluja ei vielä näy. Valitse työtila vasemmalta.</p>
              )}
            </section>
          </>
        ) : null}
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
    <>
      {verifying && snapshot ? (
        <div role="status" className="ah-identity-check">
          <span className="ah-identity-check-title">Agent Host</span>
          <span>Varmistetaan istuntoa…</span>
        </div>
      ) : null}
      <div
        key={identityEpoch}
        style={
          verifying && snapshot
            ? { visibility: "hidden", pointerEvents: "none" }
            : undefined
        }
        aria-hidden={verifying && snapshot ? true : undefined}
        inert={verifying && snapshot ? true : undefined}
      >
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
                  state={phase === "authenticated" ? "online" : "loading"}
                  hostWriteState={
                    phase === "stale" || snapshot?.write_state === "read_only"
                      ? "read_only"
                      : "writable"
                  }
                />
              )}
            </>
          }
          rail={
            (phase === "authenticated" || phase === "stale") && snapshot ? (
              <WorkspaceRail
                collapsed={collapsed}
                serverLabel={window.location.host}
                connectionLabel={
                  phase === "stale"
                    ? "Tiedot voivat olla vanhoja"
                    : source === "confirmed"
                      ? "Yhdistetty"
                      : "Tietoja puuttuu"
                }
                connectionTone={
                  phase === "stale"
                    ? "warning"
                    : source === "confirmed"
                      ? "success"
                      : "warning"
                }
                sessionActions={
                  <AccountShelf
                    name={accountLabel(snapshot.identity.display_name)}
                    onSettings={openSettings}
                    onLogout={logout}
                  />
                }
                filterValue={filter}
                resultSummary={`${matches.length} ${source === "confirmed" ? "työtilaa" : "löydettyä työtilaa"}`}
                summaryAction={
                  <NavLink
                    label="Kaikki työtilat"
                    href="/workspaces"
                    current={
                      location.pathname === "/workspaces" ? "page" : false
                    }
                  />
                }
                listState={railState}
                onToggle={() => setCollapsed(!collapsed)}
                onFilter={(v) => dispatch(filterChanged(v))}
                onRefresh={manualRefresh}
              >
                {matches.map((w) => (
                  <WorkspaceSection
                    key={w.workspace_id}
                    workspaceId={w.workspace_id}
                    name={w.display_name ?? w.name}
                    href={`/workspaces/${w.workspace_id}`}
                    expanded={
                      expanded[w.workspace_id] ??
                      Boolean(
                        snapshot.agents.some(
                          (a) => a.workspace_id === w.workspace_id,
                        ),
                      )
                    }
                    selected={selectedId === w.workspace_id}
                    summary={`${w.kind === "git_main_worktree" ? "Git" : "Hakemisto"} · ${sourceLabel(w.facts.find((f) => f.source === "filesystem")?.state ?? "unknown")}`}
                    mutationState={
                      snapshot.write_state === "read_only"
                        ? undefined
                        : w.mutation_state === "read_only"
                          ? "Vain luku"
                          : undefined
                    }
                    agents={snapshot.agents
                      .filter((a) => a.workspace_id === w.workspace_id)
                      .map((a) => ({
                        agentId: a.agent_id,
                        href: browserSessions.some(
                          (s) =>
                            s.agent_id === a.agent_id &&
                            s.workspace_id === w.workspace_id,
                        )
                          ? `/workspaces/${w.workspace_id}?conversation=${a.agent_id}`
                          : `/agents/${a.agent_id}`,
                        title: a.title.display,
                        activityLabel: "",
                        controlLabel: "",
                        selected:
                          a.agent_id === selectedAgentId ||
                          (selectedId === w.workspace_id &&
                            new URLSearchParams(location.search).get(
                              "conversation",
                            ) === a.agent_id),
                      }))}
                    onToggle={() =>
                      setExpanded({
                        ...expanded,
                        [w.workspace_id]: !(
                          expanded[w.workspace_id] ??
                          Boolean(
                            snapshot.agents.some(
                              (a) => a.workspace_id === w.workspace_id,
                            ),
                          )
                        ),
                      })
                    }
                  />
                ))}
              </WorkspaceRail>
            ) : undefined
          }
          main={
            <div
              className={
                phase === "authentication_required"
                  ? "ah-login-view"
                  : "ah-state"
              }
            >
              {phase === "stale" ? (
                <InlineNotice
                  title="Yhteys katkesi · tiedot voivat olla vanhoja"
                  description="Näet viimeksi vahvistetut tiedot. Toiminnot odottavat yhteyden palautumista."
                  tone="warning"
                  actions={[{ label: "Yritä uudelleen", onPress: refresh }]}
                />
              ) : null}
              {main}
            </div>
          }
        />
      </div>
    </>
  );
}
