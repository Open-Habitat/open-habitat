import { type ReactNode, useCallback, useEffect, useState } from "react";
import { ControlButton, ExternalLink } from "../components/ControlElements";
import { Modalish } from "../components/GuideParts";
import { Icon } from "../components/Icon";
import { LetterMark } from "../components/Integrations";
import { Menu } from "../components/Overlays";
import { PeopleRow } from "../components/ServerSection";
import { StatusMark } from "../components/Status";
import { formatDate, liveText } from "../i18n";
import { webSearchText } from "../text/webSearch";
import { usePiModels } from "./PiModels";
import {
  backendName,
  deleteSiteSearchKey,
  readSiteSearchKey,
  readWebSearchKey,
  refusalCodes,
  removeWebSearchKey,
  type SearchBackend,
  type SiteSearchKey,
  saveWebSearchKey,
  searchCoverage,
  setSiteSearchKey,
  shownBackends,
  validSearchKey,
  type WebSearchKeyState,
} from "./webSearch";
import "./WebSearchSettings.css";

// The web search key (Jari 2026-11-23, prototype round hakuavain-3,
// direction A "one service at a time"): each search service is a service
// row of its own among the server's integrations, and the person's key is a
// connected service's card on Tiedot agenteille, or a tile to add. The key
// works as the speech key does (SpeechSettings.tsx): saving tries it first,
// a site key reaches people through their own daemons, removing it recalls
// nothing, and a person's own key wins. Staan stays hidden until its
// coverage has been checked, so today the pages show one Brave row.

const txt = liveText(webSearchText);

const keyLink: Record<SearchBackend, string> = {
  brave: "https://brave.com/search/api/",
  staan: "https://staan.ai/",
};

const day = (iso: string) =>
  formatDate(new Date(iso), {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

export function BackendMark({
  backend,
  small,
}: {
  backend: SearchBackend;
  small?: boolean;
}) {
  return (
    <LetterMark
      mark={backend === "brave" ? "Br" : "St"}
      tone={backend === "brave" ? 3 : 1}
      small={small}
    />
  );
}

/** Why a key was not saved, by the code its save answered; undefined when
 * the outcome is not a refusal and the state must be read again. */
function refusal(error: unknown, backend: SearchBackend): string | undefined {
  const code = error instanceof Error ? error.message : "";
  if (!refusalCodes.includes(code as (typeof refusalCodes)[number]))
    return undefined;
  const name = backendName[backend];
  return code === "search_key_rejected"
    ? txt.rejected(name)
    : code === "search_limit_reached"
      ? txt.limit(name)
      : txt.unavailable(name);
}

/** The key's dialog, a sister of the services' Aseta tunnukset… dialog.
 * Saving tries the key first; a refused key keeps the dialog open with the
 * reason, and anything uncertain closes it and reads the state again. */
function KeyDialog({
  admin,
  backend,
  replaces,
  onSave,
  onClose,
}: {
  admin: boolean;
  backend: SearchBackend;
  /** The other service whose key this one would replace. */
  replaces?: SearchBackend;
  /** Resolves with a refusal to show, or undefined when the dialog closes. */
  onSave: (key: string) => Promise<string | undefined>;
  onClose: () => void;
}) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState("");
  const name = backendName[backend];
  const trimmed = key.trim();
  const wrong = key.length > 0 && !validSearchKey(trimmed);
  const save = async () => {
    if (!validSearchKey(trimmed) || busy) return;
    setBusy(true);
    setRefused("");
    const why = await onSave(trimmed);
    setBusy(false);
    if (why) setRefused(why);
    else onClose();
  };
  return (
    <Modalish
      testId="search-key-dialog"
      title={admin ? txt.siteDialog(name) : txt.personDialog(name)}
      dismissable={!busy}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="s-desc ws-lead">{admin ? txt.siteIntro : txt.usedFor}</p>
      <form
        className="ws-key-form"
        data-testid="search-key-form"
        data-backend={backend}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {replaces ? (
          <p className="s-desc ws-warn" data-testid="search-key-replaces">
            <Icon name="info" />
            {(admin ? txt.replacesSite : txt.replacesOwn)(
              backendName[replaces],
            )}
          </p>
        ) : null}
        <label className="s-field">
          {txt.apiKey(name)}
          <input
            data-testid="search-key-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            maxLength={256}
            value={key}
            aria-invalid={wrong || undefined}
            onChange={(event) => {
              setKey(event.target.value);
              setRefused("");
            }}
          />
        </label>
        <p className={`s-desc${wrong ? " s-bad" : ""}`}>
          {wrong ? (
            <span role="alert">{txt.notKey}</span>
          ) : (
            <>
              {admin ? txt.siteSaveNote : txt.saveNote}{" "}
              <ExternalLink
                href={keyLink[backend]}
                target="_blank"
                rel="noopener noreferrer"
              >
                {txt.getKey(name)}
              </ExternalLink>
            </>
          )}
        </p>
        <div className="s-actions">
          {busy ? null : (
            <ControlButton
              data-testid="search-key-cancel"
              size="row"
              variant="quiet"
              onPress={onClose}
            >
              {txt.cancel}
            </ControlButton>
          )}
          <ControlButton
            data-testid="search-key-save"
            size="row"
            variant="primary"
            type="submit"
            isDisabled={busy || !validSearchKey(trimmed)}
          >
            {txt.save}
          </ControlButton>
        </div>
      </form>
      {busy ? (
        <p
          className="s-desc ws-line"
          role="status"
          data-testid="search-key-checking"
        >
          {admin ? txt.giving : txt.checking(name)}
        </p>
      ) : null}
      {refused ? (
        <p
          className="s-desc s-bad ws-line"
          role="alert"
          data-testid="search-key-rejected"
        >
          {refused}
        </p>
      ) : null}
      <details className="s-more ws-more" data-testid="search-key-more">
        <summary>{txt.more}</summary>
        <ul>
          {admin ? (
            <>
              <li>{txt.siteNative}</li>
              <li>{txt.siteCopy}</li>
              <li>{txt.siteJoined}</li>
              <li>{txt.siteLimit}</li>
            </>
          ) : (
            <>
              <li>{txt.goesTo}</li>
              <li>{txt.stored(<code>~/.config/web-search/key.json</code>)}</li>
            </>
          )}
        </ul>
      </details>
    </Modalish>
  );
}

const givenText = (given: SiteSearchKey["given"]) => {
  const entries = Object.entries(given ?? {}).filter(([, n]) => n);
  if (!entries.length) return "";
  return `${entries.map(([word, n]) => `${n} ${txt.given[word] ?? word}`).join(", ")}.${given?.not_reached || given?.unknown ? txt.missed : ""}`;
};

/** Palvelinintegraatiot: one row per search service at the end of the
 * server's services, like Google and Dropbox. The shared key is set in the
 * row's dialog and changed or removed in its Avain menu, as Tunnukset is;
 * who got a copy stays on the row. */
export function SiteSearchRows({ csrf }: { csrf?: string }) {
  const [state, setState] = useState<SiteSearchKey | "unavailable">();
  const [open, setOpen] = useState<SearchBackend>();
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState("");
  const load = useCallback((signal?: AbortSignal) => {
    readSiteSearchKey(signal)
      .then((s) => {
        if (!signal?.aborted) setState(s);
      })
      .catch(() => {
        if (!signal?.aborted) setState("unavailable");
      });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  if (state === undefined) return null;
  if (state === "unavailable")
    return (
      <PeopleRow
        className="si-row"
        testId="site-search-unavailable"
        mark={<BackendMark backend="brave" small />}
        name={<span className="si-name">{backendName.brave}</span>}
        detail={
          <span className="si-bad" role="alert">
            <Icon name="warning" />
            {txt.siteReadFailed}
          </span>
        }
        cells={[<StatusMark key="state" label="—" />]}
        end={
          <ControlButton size="row" onPress={() => load()}>
            {txt.reload}
          </ControlButton>
        }
      />
    );
  const site = state.site_key;
  const save = async (backend: SearchBackend, key: string) => {
    if (!csrf) return undefined;
    setNote("");
    setProblem("");
    try {
      setState(await setSiteSearchKey(csrf, backend, key));
      return undefined;
    } catch (error) {
      const why = refusal(error, backend);
      if (why) return why;
      setProblem(txt.uncertain);
      load();
      return undefined;
    }
  };
  const remove = async () => {
    if (!csrf) return;
    setNote("");
    setProblem("");
    try {
      setState(await deleteSiteSearchKey(csrf));
      setNote(txt.siteRemoved);
    } catch {
      setProblem(txt.uncertain);
      load();
    }
  };
  return (
    <>
      {shownBackends.map((backend, i) => {
        const mine = site?.backend === backend;
        const name = backendName[backend];
        return (
          <PeopleRow
            key={backend}
            className="si-row"
            testId={`site-search-row-${backend}`}
            row={`server-${backend}`}
            data-site={mine ? "set" : "none"}
            mark={<BackendMark backend={backend} small />}
            name={
              <span className="si-main">
                <span className="si-name">{name}</span>
              </span>
            }
            detail={
              <>
                <span
                  className="ml-provnote"
                  data-testid={`site-search-detail-${backend}`}
                >
                  {mine
                    ? txt.siteRow(site.suffix, day(site.set_at))
                    : site
                      ? txt.serviceOther(backendName[site.backend])
                      : txt.siteRowNone}
                </span>
                {mine && givenText(state.given) ? (
                  <span
                    className="ml-provnote"
                    role="status"
                    data-testid="site-search-given"
                  >
                    {givenText(state.given)}
                  </span>
                ) : null}
                {note && i === 0 ? (
                  <span
                    className="ml-provnote"
                    role="status"
                    data-testid="site-search-removed"
                  >
                    {note}
                  </span>
                ) : null}
                {problem && i === 0 ? (
                  <span
                    className="si-bad"
                    role="alert"
                    data-testid="site-search-problem"
                  >
                    <Icon name="warning" />
                    {problem}
                  </span>
                ) : null}
              </>
            }
            cells={[
              mine ? (
                <StatusMark
                  key="state"
                  kind="success"
                  tone="success"
                  label={txt.offered}
                  data-testid="site-search-status"
                />
              ) : site ? (
                <StatusMark key="state" label={txt.notInUse} />
              ) : (
                <StatusMark
                  key="state"
                  tone="warning"
                  label={txt.notOffered}
                  data-testid="site-search-status"
                />
              ),
            ]}
            end={
              mine ? (
                <span data-testid="site-search-menu">
                  <Menu
                    label={txt.keyMenuOf(name)}
                    trigger={<span>{txt.keyMenu}</span>}
                    placement="bottom end"
                    heading={
                      <span className="si-app ws-menu-head">
                        {txt.siteKeyState(name, site.suffix, day(site.set_at))}
                      </span>
                    }
                    items={[
                      {
                        id: "replace",
                        label: txt.changeKeyDots,
                        availability: csrf
                          ? undefined
                          : { state: "disabled" as const, reason: "" },
                      },
                      {
                        id: "remove",
                        label: txt.removeKey,
                        danger: true,
                        availability: csrf
                          ? undefined
                          : { state: "disabled" as const, reason: "" },
                      },
                    ]}
                    onAction={(k) =>
                      k === "replace" ? setOpen(backend) : void remove()
                    }
                  />
                </span>
              ) : (
                <ControlButton
                  data-testid={`site-search-set-${backend}`}
                  size="row"
                  variant={site ? "quiet" : "secondary"}
                  isDisabled={!csrf}
                  onPress={() => setOpen(backend)}
                >
                  {txt.setKey}
                </ControlButton>
              )
            }
          />
        );
      })}
      {open ? (
        <KeyDialog
          admin
          backend={open}
          replaces={site && site.backend !== open ? site.backend : undefined}
          onSave={(key) => save(open, key)}
          onClose={() => setOpen(undefined)}
        />
      ) : null}
    </>
  );
}

/** Where the person's search key goes on Tiedot agenteille: card among the
 * connected accounts, tiles among those to add, extra (a dialog or a
 * problem) after them. */
export type WebSearchPlaces = {
  card?: ReactNode;
  tiles?: ReactNode;
  extra?: ReactNode;
};

/** The person's search key on Tiedot agenteille: the card of a connected
 * service under Yhdistetyt tilit when there is a key, and a tile per other
 * service under Lisää tili. IntegrationsOverview places both. */
export function useWebSearchPerson(
  csrf: string | undefined,
  enabled: boolean,
): WebSearchPlaces {
  const models = usePiModels();
  const [state, setState] = useState<WebSearchKeyState | "unavailable">();
  const [open, setOpen] = useState<SearchBackend>();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const load = useCallback((signal?: AbortSignal) => {
    readWebSearchKey(signal)
      .then((s) => {
        if (!signal?.aborted) setState(s);
      })
      .catch(() => {
        if (!signal?.aborted) setState("unavailable");
      });
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, enabled]);
  if (!enabled || state === undefined) return {};
  if (state === "unavailable")
    return {
      card: (
        <p
          className="ig-notice"
          role="alert"
          data-testid="search-key-unavailable"
          data-settings-row="web-search"
          tabIndex={-1}
        >
          <Icon name="warning" />
          <span>{txt.readFailed}</span>
          <ControlButton size="row" onPress={() => load()}>
            {txt.reload}
          </ControlButton>
        </p>
      ),
    };
  const providers = models?.data
    ? [
        ...new Set(
          models.data.models.flatMap((m) => (m.provider ? [m.provider] : [])),
        ),
      ]
    : undefined;
  const coverage = searchCoverage(state.native_providers, providers);
  const key =
    state.present && state.backend && state.suffix && state.source
      ? { backend: state.backend, suffix: state.suffix, source: state.source }
      : undefined;
  const save = async (backend: SearchBackend, k: string) => {
    if (!csrf) return undefined;
    setProblem("");
    try {
      setState(await saveWebSearchKey(csrf, backend, k));
      return undefined;
    } catch (error) {
      const why = refusal(error, backend);
      if (why) return why;
      setProblem(txt.uncertain);
      load();
      return undefined;
    }
  };
  const remove = async () => {
    if (!csrf) return;
    setBusy(true);
    setProblem("");
    try {
      setState(await removeWebSearchKey(csrf));
    } catch {
      setProblem(txt.uncertain);
      load();
    } finally {
      setBusy(false);
    }
  };
  const problemLine = problem ? (
    <p className="ig-notice" role="alert" data-testid="search-key-failed">
      <Icon name="warning" />
      <span>{problem}</span>
    </p>
  ) : null;
  const dialog = open ? (
    <KeyDialog
      admin={false}
      backend={open}
      replaces={
        key?.source === "own" && key.backend !== open ? key.backend : undefined
      }
      onSave={(k) => save(open, k)}
      onClose={() => setOpen(undefined)}
    />
  ) : null;
  const card = key ? (
    <section
      className="ig-provider"
      data-settings-row="web-search"
      tabIndex={-1}
      aria-label={backendName[key.backend]}
    >
      <article
        className="ig-card"
        data-testid="search-key"
        data-source={key.source}
        data-backend={key.backend}
      >
        <div className="ig-acc">
          <BackendMark backend={key.backend} />
          <div>
            <span className="ig-rn">{backendName[key.backend]}</span>
            <span className="ig-meta" data-testid="search-key-source">
              {key.source === "site"
                ? txt.admins(key.suffix)
                : txt.own(key.suffix)}
            </span>
          </div>
          <ControlButton
            data-testid="search-key-replace"
            size="row"
            variant={state.refused_at ? "primary" : "secondary"}
            isDisabled={!csrf || busy || !shownBackends.includes(key.backend)}
            onPress={() => setOpen(key.backend)}
          >
            {key.source === "site" ? txt.addOwn : txt.replace}
          </ControlButton>
          <ControlButton
            data-testid="search-key-remove"
            size="row"
            variant="quiet"
            isDisabled={!csrf || busy}
            onPress={() => void remove()}
          >
            {txt.remove}
          </ControlButton>
        </div>
        {state.refused_at ? (
          <p
            className="ig-notice"
            role="status"
            data-testid="search-key-refused"
          >
            <Icon name="warning" />
            <span>
              {txt.refused(
                backendName[key.backend],
                formatDate(new Date(state.refused_at), {
                  day: "numeric",
                  month: "numeric",
                }),
              )}
            </span>
          </p>
        ) : null}
        <div className="ig-svc" data-testid="search-key-service">
          <span className="ig-ic sm">
            <Icon name="globe" />
          </span>
          <div>
            <span className="ig-rn">{txt.search}</span>
            <span className="ig-meta" data-testid="search-key-users">
              {coverage
                ? txt.users(coverage.needers, coverage.natives)
                : txt.usersUnknown}
            </span>
          </div>
          <div className="ig-sv">
            {state.refused_at ? (
              <StatusMark tone="danger" kind="error" label={txt.notAnswering} />
            ) : (
              <StatusMark tone="success" kind="success" label={txt.inUse} />
            )}
          </div>
        </div>
      </article>
      {problemLine}
    </section>
  ) : null;
  const tiles = shownBackends
    .filter((b) => b !== key?.backend)
    .map((backend, i) => {
      // The reason to add a key is said once, on the first tile.
      const meta =
        key?.source === "own"
          ? { text: txt.tileReplaces(backendName[key.backend]), bad: false }
          : !key && i === 0 && coverage?.needers.length
            ? { text: txt.tileNeed(coverage.needers), bad: true }
            : !key && i === 0 && coverage?.natives.length
              ? { text: txt.tileCovered(coverage.natives), bad: false }
              : { text: txt.tilePlain, bad: false };
      return (
        <div
          key={backend}
          className="ig-tile"
          data-testid={`search-tile-${backend}`}
          data-settings-row={key || i ? undefined : "web-search"}
          tabIndex={-1}
        >
          <BackendMark backend={backend} />
          <div>
            <span className="ig-rn">{backendName[backend]}</span>
            <span
              className={`ig-meta${meta.bad ? " ws-bad" : ""}`}
              data-testid="search-tile-meta"
            >
              {meta.bad ? <Icon name="warning" /> : null}
              {meta.text}
            </span>
          </div>
          <ControlButton
            data-testid={`search-add-${backend}`}
            size="row"
            variant={meta.bad ? "primary" : "secondary"}
            isDisabled={!csrf}
            onPress={() => setOpen(backend)}
          >
            {txt.addKeyDots}
          </ControlButton>
        </div>
      );
    });
  return {
    card: card ?? undefined,
    tiles: tiles.length ? tiles : undefined,
    extra:
      dialog || (!key && problemLine) ? (
        <>
          {!key ? problemLine : null}
          {dialog}
        </>
      ) : undefined,
  };
}
