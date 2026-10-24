import { useCallback, useEffect, useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { useLocation, useNavigate } from "react-router";
import {
  type LookupView,
  type RepoChoice,
  RepoFinder,
} from "../components/ClonePage";
import { ControlButton } from "../components/ControlElements";
import {
  OnboardingSettings,
  type OnboardingStep,
  type ProviderAvailability,
  type SaveState,
} from "../components/OnboardingSettings";
import {
  arrange,
  type CatalogRepo,
  exactName,
  type Since,
} from "../components/repoCatalog";
import { catalog, lookup, type Repo } from "./github";
import { readIntegrations } from "./integrations";
import {
  documentOf,
  maxDefaults,
  type OnboardingConfig,
  type OnboardingDocument,
  readServerOnboarding,
  refusalText,
  sameDocument,
  saveServerOnboarding,
} from "./onboardingConfig";
import { settingsHref } from "./settingsRoute";

// The finder's rows are links (production RepoFinder); picking one routes
// here with ?lisaa=owner/repo, which adds it to the draft and is replaced
// straight away, as the prototype did with its in-memory router.
const addParam = "lisaa";

function DefaultRepositoryFinder({
  added,
  onClose,
}: {
  added: string[];
  onClose: () => void;
}) {
  const [now] = useState(() => Date.now());
  const [repos, setRepos] = useState<{
    state: "loading" | "failed" | "ready";
    list: Repo[];
    complete: boolean;
    login?: string;
  }>({ state: "loading", list: [], complete: true });
  const [query, setQuery] = useState("");
  const [since, setSince] = useState<Since>("0");
  const [looked, setLooked] = useState<Record<string, LookupView>>({});
  useEffect(() => {
    const controller = new AbortController();
    void catalog(controller.signal)
      .then((c) =>
        setRepos({
          state: "ready",
          list: c.repositories,
          complete: c.complete,
          login: c.login,
        }),
      )
      .catch(() => {
        if (!controller.signal.aborted)
          setRepos({ state: "failed", list: [], complete: true });
      });
    return () => controller.abort();
  }, []);
  const isAdded = (name: string) =>
    added.some((a) => a.toLocaleLowerCase() === name.toLocaleLowerCase());
  const choice = (r: CatalogRepo): RepoChoice => ({
    ...r,
    href: `${settingsHref("kayttoonotto")}?${addParam}=${encodeURIComponent(r.full_name)}`,
    selected: isAdded(r.full_name),
    mark: isAdded(r.full_name) ? { label: "oletus", tone: "ok" } : undefined,
  });
  const typed = exactName(query);
  const inCatalog = (name: string) =>
    repos.list.find(
      (r) => r.full_name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
  const wanted = typed && repos.state !== "loading" && !inCatalog(typed);
  // biome-ignore lint/correctness/useExhaustiveDependencies: typed names the lookup.
  useEffect(() => {
    if (
      !wanted ||
      !typed ||
      (looked[typed] && looked[typed].state !== "failed")
    )
      return;
    const controller = new AbortController();
    const name = typed;
    const timer = setTimeout(() => {
      setLooked((old) => ({ ...old, [name]: { state: "searching", name } }));
      void lookup(name, controller.signal)
        .then((r) =>
          setLooked((old) => ({
            ...old,
            [name]:
              r.state === "found"
                ? { state: "found", name, repo: choice(r.repository) }
                : { state: "not_found", name },
          })),
        )
        .catch(() =>
          setLooked((old) => {
            if (!controller.signal.aborted)
              return { ...old, [name]: { state: "failed", name } };
            const { [name]: _, ...rest } = old;
            return rest;
          }),
        );
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [typed, wanted]);
  const found = typed ? looked[typed] : undefined;
  const typedLookup: LookupView | undefined = wanted
    ? found
      ? found.state === "found"
        ? { ...found, repo: choice(found.repo) }
        : found
      : { state: "searching", name: typed }
    : undefined;
  return (
    <ModalOverlay
      className="ah-overlay"
      isOpen
      isDismissable
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal className="ah-modal ob-finder-modal">
        <Dialog
          className="ah-dialog ob-finder"
          aria-label="Lisää oletusrepo"
          data-testid="onboarding-repository-finder"
        >
          <Heading slot="title">Lisää oletusrepo</Heading>
          <p className="ob-muted">
            Näet omat GitHub-repojesi. Uuden henkilön pääsy tarkistetaan hänen
            omalla tilillään.
          </p>
          <RepoFinder
            arrangement={arrange(repos.list.map(choice), {
              login: repos.login,
              query,
              since,
              now,
              taken: (r) => isAdded(r.full_name),
            })}
            query={query}
            onQuery={setQuery}
            since={since}
            onSince={setSince}
            now={now}
            lookup={typedLookup}
            incomplete={!repos.complete}
            state={repos.state}
          />
          <div className="ob-finder-foot">
            <span role="status" className="ob-muted">
              {added.length} / {maxDefaults} oletusrepoa
            </span>
            <ControlButton
              data-testid="onboarding-finder-done"
              size="page"
              onPress={onClose}
            >
              Valmis
            </ControlButton>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Asetukset › Käyttöönotto for a signed-in administrator. */
export function OnboardingAdministration({ csrf }: { csrf?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [saved, setSaved] = useState<OnboardingConfig>();
  const [draft, setDraft] = useState<OnboardingDocument>();
  const [loadError, setLoadError] = useState(false);
  const [availability, setAvailability] = useState<ProviderAvailability>({});
  const [facts, setFacts] = useState<Record<string, Repo>>({});
  const [step, setStep] = useState<OnboardingStep>("repositories");
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [preview, setPreview] = useState(false);
  const [finder, setFinder] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    const config = await readServerOnboarding(signal);
    setSaved(config);
    setDraft(documentOf(config));
    setLoadError(false);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch(() => {
      if (!controller.signal.aborted) setLoadError(true);
    });
    // Whether this installation offers each integration, read from the
    // administrator's own catalog; unknown when it cannot be read.
    void readIntegrations(controller.signal)
      .then((list) =>
        setAvailability(
          Object.fromEntries(list.providers.map((p) => [p.id, p.available])),
        ),
      )
      .catch(() => {});
    void catalog(controller.signal)
      .then((c) =>
        setFacts(
          Object.fromEntries(
            c.repositories.map((r) => [r.full_name.toLocaleLowerCase(), r]),
          ),
        ),
      )
      .catch(() => {});
    return () => controller.abort();
  }, [load]);

  // A finder row was picked: add it, then drop the parameter from the route.
  const picked = new URLSearchParams(location.search).get(addParam);
  const loaded = draft !== undefined;
  useEffect(() => {
    if (picked === null || !loaded) return;
    const name = exactName(picked);
    if (name)
      setDraft((d) =>
        !d ||
        d.repositories.defaults.length >= maxDefaults ||
        d.repositories.defaults.some(
          (x) => x.toLocaleLowerCase() === name.toLocaleLowerCase(),
        )
          ? d
          : {
              ...d,
              repositories: {
                ...d.repositories,
                defaults: [...d.repositories.defaults, name],
              },
            },
      );
    navigate(settingsHref("kayttoonotto"), { replace: true });
  }, [picked, loaded, navigate]);

  if (loadError)
    return (
      <div className="s-card">
        <div className="s-row" role="alert">
          Käyttöönoton asetuksia ei voitu ladata.
          <ControlButton
            size="row"
            onPress={() => void load().catch(() => setLoadError(true))}
          >
            Lataa uudelleen
          </ControlButton>
        </div>
      </div>
    );
  if (!saved || !draft)
    return <p role="status">Ladataan käyttöönoton asetuksia…</p>;
  const dirty = !sameDocument(draft, saved);
  return (
    <>
      <OnboardingSettings
        doc={draft}
        dirty={dirty}
        availability={availability}
        step={step}
        onStep={setStep}
        onChange={(next) => {
          setDraft(next);
          if (save.kind === "refused" || save.kind === "saved")
            setSave({ kind: "idle" });
        }}
        onAddRepository={() => setFinder(true)}
        facts={(name) => facts[name.toLocaleLowerCase()]}
        save={save}
        disabled={!csrf}
        onDiscard={() => {
          setDraft(documentOf(saved));
          // An unresolved save stays unresolved until the host is read again.
          if (save.kind !== "uncertain" && save.kind !== "conflict")
            setSave({ kind: "idle" });
        }}
        onReload={() => {
          // Whatever happened to the save, the host's version is the truth:
          // the draft starts again from it.
          void readServerOnboarding()
            .then((config) => {
              setSaved(config);
              setDraft(documentOf(config));
              setSave({ kind: "idle" });
            })
            .catch(() => {});
        }}
        onSave={() => {
          if (!csrf) return;
          setSave({ kind: "saving" });
          void saveServerOnboarding(csrf, saved.version, draft).then(
            (result) => {
              if (result.kind === "saved") {
                setSaved(result.config);
                setDraft(documentOf(result.config));
                setSave({ kind: "saved" });
              } else if (result.kind === "refused")
                setSave(
                  result.code === "version_conflict"
                    ? { kind: "conflict" }
                    : { kind: "refused", text: refusalText(result.code) },
                );
              else setSave({ kind: "uncertain" });
            },
          );
        }}
        preview={preview}
        onPreview={setPreview}
        host={window.location.host}
      />
      {finder ? (
        <DefaultRepositoryFinder
          added={draft.repositories.defaults}
          onClose={() => setFinder(false)}
        />
      ) : null}
    </>
  );
}
