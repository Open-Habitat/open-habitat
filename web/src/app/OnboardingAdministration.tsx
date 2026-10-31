import { useCallback, useEffect, useRef, useState } from "react";
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
import { liveText } from "../i18n";
import { onboardingSettingsText } from "../text/onboardingSettings";
import type { NativeState } from "./CodeHostSettings";
import { GitHubPlaceNotice } from "./GitHubConnectionNotice";
import { catalog, GitHubError, lookup, type Repo } from "./github";
import { githubFault, lookupView } from "./githubConnection";
import { readIntegrations } from "./integrations";
import {
  deleteSiteKey,
  documentOf,
  maxDefaults,
  type OnboardingConfig,
  type OnboardingDocument,
  readinessOf,
  readServerOnboarding,
  refusalText,
  type SaveResult,
  type SiteKey,
  sameDocument,
  saveServerOnboarding,
} from "./onboardingConfig";
import { settingsHref } from "./settingsRoute";

const txt = liveText(onboardingSettingsText);

// The finder's rows are links (production RepoFinder): picking one routes here
// with ?lisaa=owner/repo, picking a chosen one again with ?pois=owner/repo.
// The page applies it, saves, and replaces the route straight away.
const addParam = "lisaa";
const removeParam = "pois";

function DefaultRepositoryFinder({
  added,
  onClose,
  nativeState,
  onReconnect,
}: {
  added: string[];
  onClose: () => void;
  nativeState?: NativeState;
  onReconnect?: () => void;
}) {
  const fault = githubFault(nativeState);
  const [now] = useState(() => Date.now());
  const [repos, setRepos] = useState<{
    state: "loading" | "failed" | "ready";
    list: Repo[];
    complete: boolean;
    login?: string;
    /** The daemon could not use the GitHub credentials (409). */
    auth?: boolean;
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
      .catch((e) => {
        if (!controller.signal.aborted)
          setRepos({
            state: "failed",
            list: [],
            complete: true,
            auth: e instanceof GitHubError && e.code === "auth",
          });
      });
    return () => controller.abort();
  }, []);
  const isAdded = (name: string) =>
    added.some((a) => a.toLocaleLowerCase() === name.toLocaleLowerCase());
  // A chosen row stays where it was picked, marked, and picking it again
  // takes it off (Jari 24.10.2026).
  const choice = (r: CatalogRepo): RepoChoice => ({
    ...r,
    href: `${settingsHref("kayttoonotto")}?${isAdded(r.full_name) ? removeParam : addParam}=${encodeURIComponent(r.full_name)}`,
    selected: isAdded(r.full_name),
    mark: isAdded(r.full_name) ? { label: txt.chosen, tone: "ok" } : undefined,
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
                : lookupView(name, r),
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
  // GitHub could not be asked about the name: saving needs no GitHub, and
  // each new person's own access is checked at their sign-in anyway, so the
  // name can be chosen as typed (typed-repo-unselectable-without-github).
  const unchecked = (name: string): LookupView => ({
    state: "unchecked",
    name,
    reason: fault ? txt.githubFault : txt.githubSilent,
    href: `${settingsHref("kayttoonotto")}?${isAdded(name) ? removeParam : addParam}=${encodeURIComponent(name)}`,
    selected: isAdded(name),
  });
  const typedLookup: LookupView | undefined = wanted
    ? found
      ? found.state === "found"
        ? { ...found, repo: choice(found.repo) }
        : found.state === "failed"
          ? unchecked(found.name)
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
          aria-label={txt.addDefault}
          data-testid="onboarding-repository-finder"
        >
          <div className="ob-finder-body">
            <Heading slot="title">{txt.addDefault}</Heading>
            <p className="ob-muted">{txt.finderLead}</p>
            <RepoFinder
              arrangement={arrange(repos.list.map(choice), {
                login: repos.login,
                query,
                since,
                now,
                taken: () => false,
              })}
              query={query}
              onQuery={setQuery}
              since={since}
              onSince={setSince}
              now={now}
              lookup={typedLookup}
              incomplete={!repos.complete}
              state={repos.state}
              failure={
                fault || repos.auth ? (
                  <GitHubPlaceNotice
                    warning={fault}
                    onReconnect={onReconnect}
                    also={txt.typeName}
                  />
                ) : undefined
              }
            />
          </div>
          <div className="ob-finder-foot">
            <span role="status" className="ob-muted">
              {txt.defaultReposCount(added.length, maxDefaults)}
            </span>
            <ControlButton
              data-testid="onboarding-finder-done"
              size="page"
              onPress={onClose}
            >
              {txt.done}
            </ControlButton>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Asetukset › Käyttöönotto for a signed-in administrator. Every change is
 * saved as it is made (Jari 24.10.2026), each under the version this page last
 * read or wrote. One write is in flight at a time; changes made meanwhile are
 * sent together after it under the version it returned. A conflict or an
 * unconfirmed write stops editing until the host is read again, so nothing is
 * ever overwritten on a guess. */
export function OnboardingAdministration({
  csrf,
  nativeState,
  onReconnect,
}: {
  csrf?: string;
  /** The administrator's own GitHub connection, which the finder uses. */
  nativeState?: NativeState;
  onReconnect?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<OnboardingDocument>();
  const [siteKey, setSiteKeyView] = useState<SiteKey>();
  // A key write replaces the page's state with the host's when it answers,
  // so nothing else is edited meanwhile.
  const [keyBusy, setKeyBusy] = useState(false);
  const keyWriting = useRef(false);
  const [loadError, setLoadError] = useState(false);
  const [availability, setAvailability] = useState<ProviderAvailability>({});
  const [facts, setFacts] = useState<Record<string, Repo>>({});
  const [step, setStep] = useState<OnboardingStep>("repositories");
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [preview, setPreview] = useState(false);
  const [finder, setFinder] = useState(false);
  // The host's version the next write is based on, the document the
  // administrator last made, and whether a write is on its way.
  const base = useRef<OnboardingConfig>(undefined);
  const latest = useRef<OnboardingDocument>(undefined);
  const writing = useRef(false);
  const stopped = useRef(false);

  const adopt = useCallback((config: OnboardingConfig) => {
    base.current = config;
    latest.current = documentOf(config);
    stopped.current = false;
    setDoc(latest.current);
    setSiteKeyView(config.site_key);
  }, []);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const config = await readServerOnboarding(signal);
      if (writing.current) return;
      adopt(config);
      setLoadError(false);
    },
    [adopt],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch(() => {
      if (!controller.signal.aborted) setLoadError(true);
    });
    // Whether this installation has each integration ready, read from the
    // administrator's own catalog; unknown, and so not offered, when it
    // cannot be read.
    void readIntegrations(controller.signal)
      .then((list) => setAvailability(readinessOf(list)))
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

  const flush = useCallback(() => {
    const from = base.current;
    const sent = latest.current;
    if (writing.current || stopped.current || !csrf || !from || !sent) return;
    if (sameDocument(sent, from)) {
      setSave((s) => (s.kind === "saving" ? { kind: "saved" } : s));
      return;
    }
    writing.current = true;
    setSave({ kind: "saving" });
    void saveServerOnboarding(csrf, from.version, sent).then((result) => {
      writing.current = false;
      if (result.kind === "saved") {
        base.current = result.config;
        setSiteKeyView(result.config.site_key);
        if (latest.current && sameDocument(latest.current, sent)) {
          // The host's canonical form of what was sent.
          latest.current = documentOf(result.config);
          setDoc(latest.current);
          setSave({ kind: "saved" });
        } else flush();
        return;
      }
      if (result.kind === "refused" && result.code !== "version_conflict") {
        // Nothing was written: the page shows the host's version again.
        latest.current = documentOf(from);
        setDoc(latest.current);
        setSave({ kind: "refused", text: refusalText(result.code) });
        return;
      }
      stopped.current = true;
      setSave(
        result.kind === "refused"
          ? { kind: "conflict" }
          : { kind: "uncertain" },
      );
    });
  }, [csrf]);
  const change = useCallback(
    (next: OnboardingDocument) => {
      if (stopped.current || !latest.current || keyWriting.current) return;
      latest.current = next;
      setDoc(next);
      setSave((s) => (s.kind === "refused" ? { kind: "idle" } : s));
      flush();
    },
    [flush],
  );

  // The site AI key is stored and removed by its own writes, never inside the
  // autosaved document. One runs only between document writes, and its reply
  // is the host's whole configuration, which the page then starts from.
  const keyWrite = useCallback(
    async (write: (csrf: string) => Promise<SaveResult>) => {
      if (writing.current || stopped.current || !csrf) return false;
      writing.current = true;
      keyWriting.current = true;
      setKeyBusy(true);
      setSave({ kind: "saving" });
      const result = await write(csrf);
      writing.current = false;
      keyWriting.current = false;
      setKeyBusy(false);
      if (result.kind === "saved") {
        adopt(result.config);
        setSave({ kind: "saved" });
        return true;
      }
      if (result.kind === "refused" && result.code !== "version_conflict") {
        setSave({ kind: "refused", text: refusalText(result.code) });
        return false;
      }
      stopped.current = true;
      setSave({ kind: "uncertain" });
      return false;
    },
    [csrf, adopt],
  );
  // The key itself is set on the AI-avain tab; leaving the key way here
  // removes it.
  const keyActions = {
    remove: (offer: Parameters<typeof deleteSiteKey>[1]) =>
      keyWrite((c) => deleteSiteKey(c, offer)),
  };

  // A finder row was picked: add or remove it, then drop the parameter.
  const search = new URLSearchParams(location.search);
  const picked = search.get(addParam);
  const unpicked = search.get(removeParam);
  const loaded = doc !== undefined;
  useEffect(() => {
    if ((picked === null && unpicked === null) || !loaded) return;
    const d = latest.current;
    const same = (a: string, b: string) =>
      a.toLocaleLowerCase() === b.toLocaleLowerCase();
    const name = exactName(picked ?? unpicked ?? "");
    if (d && name) {
      const defaults = d.repositories.defaults;
      const has = defaults.some((x) => same(x, name));
      const next =
        picked !== null
          ? has || defaults.length >= maxDefaults
            ? defaults
            : [...defaults, name]
          : defaults.filter((x) => !same(x, name));
      if (next.length !== defaults.length)
        change({ ...d, repositories: { ...d.repositories, defaults: next } });
    }
    navigate(settingsHref("kayttoonotto"), { replace: true });
  }, [picked, unpicked, loaded, navigate, change]);

  if (loadError)
    return (
      <div className="s-card">
        <div className="s-row" role="alert">
          {txt.loadFailed}
          <ControlButton
            size="row"
            onPress={() => void load().catch(() => setLoadError(true))}
          >
            {txt.reload}
          </ControlButton>
        </div>
      </div>
    );
  if (!doc) return <p role="status">{txt.loading}</p>;
  return (
    <>
      <OnboardingSettings
        doc={doc}
        availability={availability}
        step={step}
        onStep={setStep}
        onChange={change}
        onAddRepository={() => setFinder(true)}
        facts={(name) => facts[name.toLocaleLowerCase()]}
        save={save}
        disabled={
          !csrf ||
          save.kind === "conflict" ||
          save.kind === "uncertain" ||
          keyBusy
        }
        onReload={() => {
          // Whatever happened to the write, the host's version is the truth:
          // the page starts again from it.
          void readServerOnboarding()
            .then((config) => {
              if (writing.current) return;
              adopt(config);
              setSave({ kind: "idle" });
            })
            .catch(() => {});
        }}
        preview={preview}
        onPreview={setPreview}
        host={window.location.host}
        siteKey={siteKey}
        // Offered only between document writes: a key write must not start
        // while one is on its way.
        keyActions={csrf && save.kind !== "saving" ? keyActions : undefined}
        keyLink={{
          href: settingsHref("aiavain"),
          onOpen: () => navigate(settingsHref("aiavain")),
        }}
      />
      {finder ? (
        <DefaultRepositoryFinder
          added={doc.repositories.defaults}
          onClose={() => setFinder(false)}
          nativeState={nativeState}
          onReconnect={onReconnect}
        />
      ) : null}
    </>
  );
}
