import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router";
import {
  AppShell,
  AccountShelf,
  AccountSettings,
  ConnectionBanner,
  InlineNotice,
  NavLink,
  WorkspaceRail,
  WorkspaceSection,
} from "../components";
import { accountLabel } from "../components/Account";
import { LoginCard, LoginErrorNotice } from "../components/LoginCard";
import { HistoryView } from "./HistoryView";
import { PiOnboarding } from "./PiOnboarding";
import { piStatus } from "./pi";
import {
  authenticated,
  authenticationRequired,
  piRequired,
  clearIdentity,
  filterChanged,
  loading,
  type RootState,
  unavailable,
} from "./store";
import { readSnapshot, sourceState, type Workspace } from "./snapshot";
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
    <section className="ah-workspace-detail">
      <p className="eyebrow">WORKSPACE · VAIN LUKU</p>
      <h1>{workspace.display_name ?? workspace.name}</h1>
      <p>
        Hakemisto: <code>{workspace.name}</code>
      </p>
      <dl className="ah-facts">
        <div>
          <dt>Lähde</dt>
          <dd>{fact("filesystem")}</dd>
        </div>
        <div>
          <dt>Git</dt>
          <dd>
            {fact("git")} ·{" "}
            {workspace.kind === "git_main_worktree"
              ? "Git-päätyöhakemisto"
              : workspace.kind === "git_linked_worktree"
                ? "Git-linkitetty työhakemisto"
                : "Ei vahvistettua Git-työhakemistoa"}
          </dd>
        </div>
        <div>
          <dt>Annotaatio</dt>
          <dd>{fact("annotation")}</dd>
        </div>
        <div>
          <dt>Muutokset</dt>
          <dd>
            {workspace.mutation_state === "read_only"
              ? "Vain luku"
              : "Muutosten tila ei ole tiedossa"}
          </dd>
        </div>
      </dl>
      <InlineNotice
        title="Agentteja ei vielä näytetä"
        description="Natiivin historian ja ohjauksen tila on tässä näkymässä tuntematon. Workspacen avaaminen ei käynnistä tai jatka agenttia."
      />
    </section>
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
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [logoutError, setLogoutError] = useState(false);
  const [settingsReturn, setSettingsReturn] = useState("/workspaces");
  const returningFromSettings = useRef(false);
  useEffect(() => {
    if (location.pathname !== "/settings" && returningFromSettings.current) {
      returningFromSettings.current = false;
      document.querySelector<HTMLElement>(".ah-account-shelf button")?.focus();
    }
  }, [location.pathname]);
  const identity = snapshot?.identity.web_identity_id;
  const priorIdentity = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (priorIdentity.current && identity !== priorIdentity.current) {
      setSettingsReturn("/workspaces");
      returningFromSettings.current = false;
      setExpanded({});
    }
    if (identity) priorIdentity.current = identity;
  }, [identity]);
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
  const refresh = useCallback(() => setRefreshKey((n) => n + 1), []);
  const requireLogin = useCallback(
    () => dispatch(authenticationRequired()),
    [dispatch],
  );
  // A tab can survive logout, remapping and native credential removal. Invalidate
  // the old snapshot before each revalidation, rather than displaying it under
  // a new cookie while a request is in flight.
  useEffect(() => {
    if (syntheticDemo || fixtureName || phase !== "authenticated") return;
    const revalidate = () => {
      dispatch(loading());
      refresh();
    };
    const interval = window.setInterval(revalidate, 30000);
    window.addEventListener("focus", revalidate);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", revalidate);
    };
  }, [dispatch, refresh, fixtureName, phase]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is the explicit refresh trigger, not read inside the effect.
  useEffect(() => {
    if (fixtureName?.startsWith("design") && CatalogPreview) return;
    const controller = new AbortController();
    dispatch(loading());
    const load = async () => {
      try {
        if (!syntheticDemo) {
          const status = await piStatus(controller.signal);
          if (controller.signal.aborted) return;
          if (status === "login") {
            dispatch(authenticationRequired());
            return;
          }
          if (status !== "usable") {
            dispatch(piRequired());
            return;
          }
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
        if (response.status === 428) {
          if (!controller.signal.aborted) dispatch(piRequired());
          return;
        }
        if (response.status === 401) {
          if (!controller.signal.aborted) dispatch(authenticationRequired());
          return;
        }
        if (
          !response.ok ||
          response.headers.get("content-type")?.split(";")[0] !==
            "application/json"
        )
          throw new Error("unavailable");
        const next = await readSnapshot(response);
        if (!controller.signal.aborted) dispatch(authenticated(next));
      } catch {
        if (!controller.signal.aborted) dispatch(unavailable());
      }
    };
    void load();
    return () => controller.abort();
  }, [dispatch, refreshKey, fixtureName, location.search, syntheticDemo]);
  const logout = async () => {
    setLogoutError(false);
    setSettingsReturn("/workspaces");
    if (syntheticDemo) {
      dispatch(clearIdentity());
      navigate("/workspaces?scenario=login", { replace: true });
      return;
    }
    // Hide every identity-scoped fact before the first write or new login.
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
      firstVisible
    )
      navigate(`/workspaces/${firstVisible}`, { replace: true });
  }, [snapshot, source, firstVisible, location.pathname, navigate]);
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
      : phase !== "authenticated"
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
        <p>Varmistetaan istunto ja workspacejen lähde.</p>
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
            description="Istunto voi olla edelleen voimassa. Lataa sivu ja yritä uudelleen."
            tone="danger"
          />
        ) : null}
      </>
    ) : phase === "pi_required" ? (
      <PiOnboarding
        onUsable={refresh}
        onLogin={requireLogin}
        onLogout={logout}
      />
    ) : phase === "daemon_unavailable" ? (
      <>
        <h1>Yhteyttä ei saatu</h1>
        <InlineNotice
          title="Workspacejen tilaa ei saatu"
          description="Daemon ei vastaa tai tilannekuva on virheellinen. Aiemman käyttäjän tietoja ei näytetä. Yritä uudelleen."
          tone="danger"
          actions={[{ label: "Päivitä", onPress: refresh }]}
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
        agent={selectedAgent}
        workspaceName={agentWorkspace.display_name ?? agentWorkspace.name}
        workspaceId={agentWorkspace.workspace_id}
      />
    ) : selectedAgentId ? (
      <InlineNotice
        title="Keskustelua ei löydy"
        description="Natiivia historiaa tai sen workspace-yhteyttä ei voida vahvistaa. Toista agenttia ei valita."
        tone="warning"
      />
    ) : selected ? (
      <>
        <WorkspaceDetails workspace={selected} />
        {source !== "confirmed" ? (
          <InlineNotice
            title="Lähteen havainto on osittainen"
            description="Näytetään vain havaittuja kohteita. Kokonaismäärä ja muut lähdetiedot ovat tuntemattomia."
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
            ? "Lähde tai sen havainto on osittainen tai tavoittamattomissa. Linkki säilyy; toista workspacea ei valita."
            : "Tuoreessa vahvistetussa listassa tätä workspacea ei ole."}
        </p>
      </>
    ) : (
      <>
        <h1>Workspacet</h1>
        <p>
          Valitse workspace vasemmalta. Valinta ei käynnistä eikä jatka
          agenttia.
        </p>
        {source === "absent" ? (
          <InlineNotice
            title="Lähdettä ei löydy"
            description="~/src puuttuu. Tämä ei tarkoita tyhjää listaa."
            tone="warning"
          />
        ) : source !== "confirmed" ? (
          <InlineNotice
            title="Lähteen tilaa ei voitu vahvistaa"
            description="Workspacejen määrä ei ole tiedossa."
            tone="warning"
          />
        ) : visible.length === 0 ? (
          <InlineNotice
            title="Workspaceja ei ole"
            description="~/src on olemassa mutta siellä ei ole näkyviä workspaceja."
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
    <AppShell
      connection={
        <>
          {syntheticDemo ? (
            <div className="ah-demo-banner" role="status">
              SYNTEETTINEN DEMO · Simuloitu identiteetti ja workspace-data · Ei
              oikeaa kirjautumista, agentteja eikä host-yhteyttä
            </div>
          ) : null}
          {phase === "authentication_required" ? null : (
            <ConnectionBanner
              state={
                phase === "authenticated"
                  ? "online"
                  : phase === "daemon_unavailable"
                    ? "daemon-unavailable"
                    : "loading"
              }
              hostWriteState={
                snapshot?.write_state === "read_only" ? "read_only" : "writable"
              }
            />
          )}
        </>
      }
      rail={
        phase === "authenticated" && snapshot ? (
          <WorkspaceRail
            collapsed={collapsed}
            serverLabel={window.location.host}
            connectionLabel={
              source === "confirmed" ? "Yhdistetty" : "Lähde osittainen"
            }
            connectionTone={source === "confirmed" ? "success" : "warning"}
            sessionActions={
              <AccountShelf
                name={accountLabel(snapshot.identity.display_name)}
                onSettings={openSettings}
                onLogout={logout}
              />
            }
            filterValue={filter}
            resultSummary={`${matches.length} ${source === "confirmed" ? "workspacea" : "havaittua workspacea · määrä voi olla puutteellinen"}`}
            summaryAction={
              <NavLink
                label="Kaikki workspacet"
                href="/workspaces"
                current={location.pathname === "/workspaces" ? "page" : false}
              />
            }
            listState={railState}
            onToggle={() => setCollapsed(!collapsed)}
            onFilter={(v) => dispatch(filterChanged(v))}
            onRefresh={refresh}
            onCreate={() => {}}
            createAvailability={{
              state: "read_only",
              reason: "Tämä näkymä on vain luku -tilassa.",
            }}
          >
            {matches.map((w) => (
              <WorkspaceSection
                key={w.workspace_id}
                workspaceId={w.workspace_id}
                name={w.display_name ?? w.name}
                href={`/workspaces/${w.workspace_id}`}
                expanded={expanded[w.workspace_id] ?? false}
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
                    href: `/agents/${a.agent_id}`,
                    title: a.title.display,
                    activityLabel: "Prosessi ei tiedossa",
                    controlLabel: "Vain luku",
                    selected: a.agent_id === selectedAgentId,
                  }))}
                onToggle={() =>
                  setExpanded({
                    ...expanded,
                    [w.workspace_id]: !(expanded[w.workspace_id] ?? false),
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
            phase === "authentication_required" ? "ah-login-view" : "ah-state"
          }
        >
          {main}
        </div>
      }
    />
  );
}
