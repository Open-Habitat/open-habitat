import { useCallback, useEffect, useRef, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { SiteKeyPage } from "../components/SiteKeySettings";
import {
  deleteSiteKey,
  type KeyProvider,
  readServerOnboarding,
  refusalText,
  type SaveResult,
  type SiteKey,
  setSiteKey,
} from "./onboardingConfig";

/** Palvelimen ylläpito › AI-avain: the site key read from and written to the
 * onboarding configuration, one write at a time. A write whose outcome is
 * unknown stops the page until the host is read again. */
export function SiteKeyAdministration({ csrf }: { csrf?: string }) {
  const [loaded, setLoaded] = useState<{ siteKey?: SiteKey }>();
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<
    { kind: "refused"; text: string } | { kind: "uncertain" }
  >();
  const writing = useRef(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    const config = await readServerOnboarding(signal);
    setLoaded({ siteKey: config.site_key });
    setLoadError(false);
    setProblem(undefined);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch(() => {
      if (!controller.signal.aborted) setLoadError(true);
    });
    return () => controller.abort();
  }, [load]);

  const keyWrite = async (write: (csrf: string) => Promise<SaveResult>) => {
    if (writing.current || !csrf) return false;
    writing.current = true;
    setBusy(true);
    setProblem(undefined);
    const result = await write(csrf);
    writing.current = false;
    setBusy(false);
    if (result.kind === "saved") {
      setLoaded({ siteKey: result.config.site_key });
      return true;
    }
    setProblem(
      result.kind === "refused" && result.code !== "version_conflict"
        ? { kind: "refused", text: refusalText(result.code) }
        : { kind: "uncertain" },
    );
    return false;
  };
  const reload = () => void load().catch(() => setLoadError(true));

  if (loadError)
    return (
      <div className="s-card">
        <div className="s-row" role="alert">
          AI-avainta ei voitu lukea.
          <ControlButton size="row" onPress={reload}>
            Lataa uudelleen
          </ControlButton>
        </div>
      </div>
    );
  if (!loaded) return <p role="status">Ladataan AI-avainta…</p>;
  const stopped = problem?.kind === "uncertain";
  return (
    <SiteKeyPage
      siteKey={loaded.siteKey}
      disabled={!csrf || busy || stopped}
      actions={
        csrf
          ? {
              set: (provider: KeyProvider, key: string) =>
                keyWrite((c) => setSiteKey(c, provider, key)),
              remove: (offer) => keyWrite((c) => deleteSiteKey(c, offer)),
            }
          : undefined
      }
    >
      {problem?.kind === "refused" ? (
        <p role="alert" className="sk-terms" data-testid="site-key-refused">
          {problem.text}
        </p>
      ) : stopped ? (
        <p role="alert" className="sk-terms" data-testid="site-key-uncertain">
          Muutoksen tulos ei varmistunut.{" "}
          <ControlButton size="row" variant="quiet" onPress={reload}>
            Lataa uudelleen
          </ControlButton>
        </p>
      ) : null}
    </SiteKeyPage>
  );
}
