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
    return p ? at(p) : `GitHub ${subject}`;
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
          Avain vaihdettu.
          {replaced.length > 0 &&
            ` Sivuston aiempi kopio vaihdettiin uuteen ${replaced.length} henkilöltä: ${list(replaced.map((x) => nameOf(x.subject)))}.`}
          {missed.length > 0 &&
            ` Ei tavoitettu: ${list(missed.map((x) => nameOf(x.subject)))}. Heille ei kirjoitettu nyt mitään; anna uusi avain, kun heidän palvelunsa vastaa.`}
          {unconfirmed.length > 0 &&
            ` Tulos ei varmistunut: ${list(unconfirmed.map((x) => nameOf(x.subject)))}. Kopio on voinut vaihtua; tarkista antamalla avain uudelleen.`}
        </span>,
      );
      return;
    }
    const joined = people?.people.length ?? 0;
    setNotice(
      <span data-testid="set-notice">
        {had ? "Avain vaihdettu." : "Avain otettu käyttöön."} Uudet henkilöt
        saavat siitä kopion.
        {joined > 0 &&
          ` ${joined} jo liittynyttä eivät saa sitä itsestään; anna se heille alta.`}
      </span>,
    );
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
      Anna uusi avain heille…
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
                        <span data-testid="removed-notice">
                          Avain poistettu. Uudet henkilöt valitsevat AI-tilin
                          itse. Annetut kopiot jäivät.
                        </span>,
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
            Muutoksen tulos ei varmistunut.{" "}
            <ControlButton size="row" variant="quiet" onPress={reload}>
              Lataa uudelleen
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
              Sivuston aiemman avaimen kopio on {old.length} henkilöllä:{" "}
              {list(old.map(at))}. {giveOld}
            </span>
          </p>
        ) : null}
      </SiteKeyPage>
      {copies === "unavailable" ? (
        <div className="s-card">
          <div className="s-row" role="alert" data-testid="joined-unavailable">
            Jo liittyneitä ei voitu lukea.
            <ControlButton size="row" onPress={() => void loadCopies()}>
              Lataa uudelleen
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
