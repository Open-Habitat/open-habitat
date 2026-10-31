import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ControlButton } from "../components/ControlElements";
import { Icon } from "../components/Icon";
import {
  at,
  earlierHolders,
  GiveDialog,
  JoinedCard,
  list,
} from "../components/SiteKeyCopies";
import { SiteKeyPage } from "../components/SiteKeySettings";
import { liveText } from "../i18n";
import { siteKeyText } from "../text/siteKey";
import {
  deleteSiteKey,
  type KeyProvider,
  readServerOnboarding,
  refusalText,
  type SaveResult,
  type SiteKey,
  setSiteKey,
} from "./onboardingConfig";
import {
  type CopyCheck,
  checkCopy,
  type GiveOutcome,
  giveCopy,
  type JoinedPerson,
  readSiteKeyCopies,
  type SiteKeyCopies,
} from "./siteKeyCopies";

const txt = liveText(siteKeyText);

/** Palvelimen ylläpito › AI-avain: the site key read from and written to the
 * onboarding configuration, one write at a time, and below it the people
 * who joined earlier with what the site has given them. A write whose
 * outcome is unknown stops the page until the host is read again. */
export function SiteKeyAdministration({ csrf }: { csrf?: string }) {
  const [loaded, setLoaded] = useState<{ siteKey?: SiteKey }>();
  const [loadError, setLoadError] = useState(false);
  const [copies, setCopies] = useState<SiteKeyCopies | "unavailable">();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<
    { kind: "refused"; text: string } | { kind: "uncertain" }
  >();
  const [notice, setNotice] = useState<ReactNode>();
  const [giving, setGiving] = useState<JoinedPerson[]>();
  const writing = useRef(false);

  const loadCopies = useCallback(async (signal?: AbortSignal) => {
    try {
      const c = await readSiteKeyCopies(signal);
      if (!signal?.aborted) setCopies(c);
      return c;
    } catch {
      if (!signal?.aborted) setCopies("unavailable");
    }
  }, []);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const config = await readServerOnboarding(signal);
      setLoaded({ siteKey: config.site_key });
      setLoadError(false);
      setProblem(undefined);
      void loadCopies(signal);
    },
    [loadCopies],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch(() => {
      if (!controller.signal.aborted) setLoadError(true);
    });
    return () => controller.abort();
  }, [load]);

  const people = copies && copies !== "unavailable" ? copies : undefined;
  const nameOf = (subject: string) => {
    const p = people?.people.find((x) => x.id === subject);
    return p ? at(p) : txt.github(subject);
  };
  const keyWrite = async (
    write: (csrf: string) => Promise<SaveResult>,
    after?: (r: Extract<SaveResult, { kind: "saved" }>, had?: SiteKey) => void,
  ) => {
    if (writing.current || !csrf) return false;
    writing.current = true;
    setBusy(true);
    setProblem(undefined);
    setNotice(undefined);
    const had = loaded?.siteKey;
    const result = await write(csrf);
    writing.current = false;
    setBusy(false);
    if (result.kind === "saved") {
      setLoaded({ siteKey: result.config.site_key });
      after?.(result, had);
      void loadCopies();
      return true;
    }
    setProblem(
      result.kind === "refused" && result.code !== "version_conflict"
        ? { kind: "refused", text: refusalText(result.code) }
        : { kind: "uncertain" },
    );
    return false;
  };
  const afterSet = (
    r: Extract<SaveResult, { kind: "saved" }>,
    had?: SiteKey,
  ) => {
    const rotation = r.config.rotation ?? [];
    const replaced = rotation.filter(
      (x) => x.outcome === "replaced" || x.outcome === "already_current",
    );
    const missed = rotation.filter((x) => x.outcome === "not_reached");
    const unconfirmed = rotation.filter((x) => x.outcome === "unknown");
    if (rotation.length > 0) {
      setNotice(
        <span data-testid="replaced-notice">
          {txt.rotated}
          {replaced.length > 0 &&
            txt.replacedFor(
              replaced.length,
              list(replaced.map((x) => nameOf(x.subject))),
            )}
          {missed.length > 0 &&
            txt.missed(list(missed.map((x) => nameOf(x.subject))))}
          {unconfirmed.length > 0 &&
            txt.unconfirmed(list(unconfirmed.map((x) => nameOf(x.subject))))}
        </span>,
      );
      return;
    }
    const joined = people?.people.length ?? 0;
    setNotice(
      <span data-testid="set-notice">
        {had ? txt.rotated : txt.taken} {txt.newGet}
        {joined > 0 && txt.joinedDontGet(joined)}
      </span>,
    );
  };
  const reload = () => void load().catch(() => setLoadError(true));

  if (loadError)
    return (
      <div className="s-card">
        <div className="s-row" role="alert">
          {txt.readFailed}
          <ControlButton size="row" onPress={reload}>
            {txt.reload}
          </ControlButton>
        </div>
      </div>
    );
  if (!loaded) return <p role="status">{txt.loading}</p>;
  const stopped = problem?.kind === "uncertain";
  const siteKey = loaded.siteKey;
  const old = people && siteKey ? earlierHolders(people) : [];
  const giveOld = old.length > 0 && (
    <ControlButton
      size="row"
      variant="secondary"
      data-testid="give-old"
      isDisabled={busy || stopped || !csrf}
      onPress={() => {
        setNotice(undefined);
        setGiving(old);
      }}
    >
      {txt.giveNew}
    </ControlButton>
  );
  return (
    <div className="sk-stack">
      <SiteKeyPage
        siteKey={siteKey}
        disabled={!csrf || busy || stopped || giving !== undefined}
        holders={people?.people.filter((p) => p.copy).map(at)}
        actions={
          csrf
            ? {
                set: (provider: KeyProvider, key: string) =>
                  keyWrite((c) => setSiteKey(c, provider, key), afterSet),
                remove: (offer) =>
                  keyWrite(
                    (c) => deleteSiteKey(c, offer),
                    () =>
                      setNotice(
                        <span data-testid="removed-notice">{txt.removed}</span>,
                      ),
                  ),
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
            {txt.uncertain}{" "}
            <ControlButton size="row" variant="quiet" onPress={reload}>
              {txt.reload}
            </ControlButton>
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="sk-notice" data-testid="notice">
            <Icon name="info" />
            <span>
              {notice} {giveOld}
            </span>
          </p>
        ) : old.length > 0 ? (
          <p className="sk-notice" data-testid="old-copies">
            <Icon name="warning" />
            <span>
              {txt.oldCopies(old.length, list(old.map(at)))} {giveOld}
            </span>
          </p>
        ) : null}
      </SiteKeyPage>
      {copies === "unavailable" ? (
        <div className="s-card">
          <div className="s-row" role="alert" data-testid="joined-unavailable">
            {txt.joinedFailed}
            <ControlButton size="row" onPress={() => void loadCopies()}>
              {txt.reload}
            </ControlButton>
          </div>
        </div>
      ) : people ? (
        <JoinedCard
          copies={people}
          disabled={!csrf || busy || stopped}
          onGive={(targets) => {
            setNotice(undefined);
            setGiving(targets);
          }}
        />
      ) : null}
      {giving && siteKey && csrf && (
        <GiveDialog
          targets={giving}
          siteKey={siteKey}
          check={async (p): Promise<CopyCheck> => {
            const c = await checkCopy(csrf, p.id);
            return typeof c === "string" ? c : "unknown";
          }}
          give={async (p): Promise<GiveOutcome> => {
            const o = await giveCopy(csrf, p.id, siteKey);
            return typeof o === "string" ? o : "not_reached";
          }}
          onClose={(changed) => {
            setGiving(undefined);
            if (changed) void loadCopies();
          }}
        />
      )}
    </div>
  );
}
