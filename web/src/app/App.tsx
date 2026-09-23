import { lazy, Suspense, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation } from "react-router";
import { ConnectionBanner } from "../components/ConnectionBanner";
import { EmptyWorkspace } from "../components/EmptyWorkspace";
import { LoginCard } from "../components/LoginCard";
import type { Bootstrap } from "./bootstrap";
import { fixtureBootstrap } from "./fixture";
import { loaded, type RootState } from "./store";
const CatalogPreview =
  import.meta.env.VITE_ENABLE_TEST_FIXTURES === "true"
    ? lazy(() => import("../test/CatalogPreview"))
    : null;

export function App() {
  const dispatch = useDispatch();
  const location = useLocation();
  const phase = useSelector((s: RootState) => s.connection.phase);
  const bootstrap = useSelector((s: RootState) => s.connection.bootstrap);
  const fixtureName =
    import.meta.env.VITE_ENABLE_TEST_FIXTURES === "true"
      ? new URLSearchParams(location.search).get("fixture")
      : null;
  useEffect(() => {
    const fixture = fixtureBootstrap();
    if (fixture) {
      dispatch(loaded(fixture));
      return;
    }
    const controller = new AbortController();
    fetch("/api/v1/bootstrap", {
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401)
          return {
            schema_version: 1,
            state: "authentication_required",
            server_label: window.location.host,
          } satisfies Bootstrap;
        if (!response.ok)
          return {
            schema_version: 1,
            state: "daemon_unavailable",
            server_label: window.location.host,
          } satisfies Bootstrap;
        return (await response.json()) as Bootstrap;
      })
      .then((value) => dispatch(loaded(value)))
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== "AbortError")
          dispatch(
            loaded({
              schema_version: 1,
              state: "daemon_unavailable",
              server_label: window.location.host,
            }),
          );
      });
    return () => controller.abort();
  }, [dispatch]);
  return (
    <div className="app">
      {!fixtureName?.startsWith("design") ? (
        <a className="skip" href="#main">
          Siirry sisältöön
        </a>
      ) : null}
      <ConnectionBanner state={phase} />
      {phase === "loading" ? (
        <main id="main">
          <h1>Ladataan</h1>
          <p>Varmistetaan istunto ja yhteys käyttäjän daemoniin.</p>
        </main>
      ) : null}
      {phase === "authentication_required" ? (
        <main id="main">
          <LoginCard />
        </main>
      ) : null}
      {phase === "daemon_unavailable" ? (
        <main id="main">
          <h1>Yhteyttä ei saatu</h1>
          <p>
            {bootstrap?.problem?.message ??
              "Käyttäjän daemon ei ole tällä hetkellä tavoitettavissa."}
          </p>
          <p>Viime komentoa ei lähetetä automaattisesti uudelleen.</p>
        </main>
      ) : null}
      {phase === "authenticated" &&
      fixtureName?.startsWith("design") &&
      CatalogPreview ? (
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
      ) : null}
      {phase === "authenticated" && !fixtureName?.startsWith("design") ? (
        <>
          <nav aria-label="Workspacet ja agentit">
            <strong>Native Agent Host</strong>
            <Link to="/workspaces">Workspacet</Link>
          </nav>
          <EmptyWorkspace path={location.pathname} />
        </>
      ) : null}
    </div>
  );
}
