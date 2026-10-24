import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ControlButton } from "../components/ControlElements";
import {
  type PendingApp,
  ServerIntegrations,
} from "../components/ServerIntegrations";
import {
  type Provider,
  type ProviderId,
  readIntegrations,
} from "./integrations";
import { readServerOnboarding } from "./onboardingConfig";
import { readAccess } from "./serverAccess";
import {
  type AppChange,
  type AppFields,
  type AppProvider,
  appRefusal,
  changeIntegrationApp,
  type IntegrationApps,
  readIntegrationApps,
} from "./serverIntegrations";
import { settingsHref } from "./settingsRoute";

// The host side of Palvelimen ylläpito › Integraatiot. The broker's reply
// settles a change; the administrator's own catalog, read again after it,
// says whether the provider is now in use. An uncertain change stays
// uncertain until the administrator reads again; nothing is retried.
export function ServerIntegrationsSettings({ csrf }: { csrf?: string }) {
  const navigate = useNavigate();
  const [apps, setApps] = useState<IntegrationApps>();
  const [providers, setProviders] = useState<Provider[]>();
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [steps, setSteps] = useState<ProviderId[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<
    Partial<Record<ProviderId, PendingApp>>
  >({});
  const [problem, setProblem] = useState<{
    provider: ProviderId;
    text: string;
  }>();
  // Bumped when a change is sent and when its reply arrives: a read that a
  // change overtook may predate it, so it is read again rather than shown.
  const changes = useRef(0);
  const readCatalog = useCallback(async (signal?: AbortSignal) => {
    try {
      setProviders((await readIntegrations(signal)).providers);
      setCatalogFailed(false);
    } catch {
      if (!signal?.aborted) {
        setProviders(undefined);
        setCatalogFailed(true);
      }
    }
  }, []);
  const reload = useCallback(
    async (signal?: AbortSignal) => {
      try {
        let next: IntegrationApps;
        let at: number;
        do {
          at = changes.current;
          next = await readIntegrationApps(signal);
        } while (at !== changes.current);
        setApps(next);
        setFailed(false);
        setPending((p) =>
          Object.fromEntries(
            Object.entries(p).filter(([, c]) => c !== "uncertain"),
          ),
        );
      } catch {
        if (!signal?.aborted) setFailed(true);
      }
      await readCatalog(signal);
    },
    [readCatalog],
  );
  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    // Which providers have an onboarding step, and who the actors are; the
    // page works without either.
    void readServerOnboarding(controller.signal)
      .then((c) => setSteps(c.integrations.map((i) => i.provider)))
      .catch(() => {});
    void readAccess(controller.signal)
      .then((v) =>
        setNames(
          Object.fromEntries(
            v.entries
              .filter((e) => e.login_hint)
              .map((e) => [e.id, e.login_hint as string]),
          ),
        ),
      )
      .catch(() => {});
    return () => controller.abort();
  }, [reload]);
  const change = async (
    provider: AppProvider,
    fields?: AppFields,
  ): Promise<AppChange> => {
    if (!csrf) return { kind: "refused", code: "admin_required" };
    setProblem(undefined);
    setPending((p) => ({ ...p, [provider]: fields ? "set" : "clear" }));
    changes.current++;
    const result = await changeIntegrationApp(csrf, provider, fields);
    changes.current++;
    if (result.kind === "uncertain") {
      setPending((p) => ({ ...p, [provider]: "uncertain" }));
      return result;
    }
    if (result.kind === "changed") {
      setApps(result.view);
      // In use is the daemon's word, read after the broker's.
      await readCatalog();
    } else if (!fields)
      setProblem({
        provider,
        text:
          result.kind === "login"
            ? "Istunto on päättynyt. Kirjaudu uudelleen."
            : appRefusal(result.code),
      });
    setPending(({ [provider]: _, ...rest }) => rest);
    return result.kind === "login"
      ? { kind: "refused", code: "login" }
      : result;
  };
  if (!apps)
    return failed ? (
      <div className="s-row" role="alert">
        Integraatioiden asetuksia ei voitu ladata.
        <ControlButton size="row" onPress={() => void reload()}>
          Lataa uudelleen
        </ControlButton>
      </div>
    ) : (
      <p className="s-row">Ladataan integraatioita…</p>
    );
  return (
    <>
      {failed && (
        <div className="s-row" role="alert">
          Tietoja ei voitu päivittää.
          <ControlButton size="row" onPress={() => void reload()}>
            Lataa uudelleen
          </ControlButton>
        </div>
      )}
      {catalogFailed && (
        <p className="s-row" role="status" data-testid="si-catalog-unknown">
          Palvelujen tilaa ei voitu lukea.
        </p>
      )}
      <ServerIntegrations
        providers={providers}
        apps={apps}
        steps={steps}
        pending={pending}
        problem={problem}
        names={names}
        canWrite={!!csrf}
        onboardingHref={settingsHref("kayttoonotto")}
        onOpenOnboarding={() => navigate(settingsHref("kayttoonotto"))}
        onSave={(provider, fields) => change(provider, fields)}
        onRemove={(provider) => void change(provider)}
        onRefresh={() => void reload()}
      />
    </>
  );
}
