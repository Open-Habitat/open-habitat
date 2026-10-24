import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import "./Integrations.css";
import {
  type Account,
  clockTime,
  type Folder,
  gigabytes,
  type IntegrationList,
  type LoginView,
  minutesLeft,
  needsSignIn,
  type PasswordAccount,
  type Provider,
  type ProviderId,
  redirectMatches,
  type Service,
  type ServiceId,
  type ServiceState,
  type SyncFailure,
  type SyncProgress,
  safeHttps,
  selectedBytes,
  syncedTime,
} from "../app/integrations";
import { ControlButton, controlClassName, Segmented } from "./ControlElements";
import { Icon, type IconName } from "./Icon";
import { Checkbox, TextField } from "./Primitives";

// Asetukset › Integraatiot in the accepted "Tili" direction (ADR 0026,
// proto-integrations): one card per provider account with its services
// inside, sign-in in a dialog whose steps each take their own row, and the
// agent-exposure warning both before sign-in and beside the accounts. These
// components draw what the app layer hands them and return intents.

type Copy = {
  name: string;
  mark: string;
  tone: 1 | 2 | 3;
  /** Where the person signs in, as a sentence subject: "Google". */
  site: string;
  /** Genitive: "Googlen". */
  gen: string;
  /** Illative: "Googleen". */
  ill: string;
};

export const providerCopy: Record<ProviderId, Copy> = {
  google: {
    name: "Google",
    mark: "G",
    tone: 1,
    site: "Google",
    gen: "Googlen",
    ill: "Googleen",
  },
  microsoft: {
    name: "Microsoft 365",
    mark: "M",
    tone: 2,
    site: "Microsoft",
    gen: "Microsoftin",
    ill: "Microsoft 365:een",
  },
  imap: {
    name: "Sähköposti (IMAP)",
    mark: "@",
    tone: 3,
    site: "Postipalvelin",
    gen: "postipalvelimen",
    ill: "postipalvelimelle",
  },
  caldav: {
    name: "Kalenteri (CalDAV)",
    mark: "C",
    tone: 3,
    site: "DAV-palvelin",
    gen: "DAV-palvelimen",
    ill: "DAV-palvelimelle",
  },
  carddav: {
    name: "Yhteystiedot (CardDAV)",
    mark: "C",
    tone: 3,
    site: "DAV-palvelin",
    gen: "DAV-palvelimen",
    ill: "DAV-palvelimelle",
  },
  dropbox: {
    name: "Dropbox",
    mark: "D",
    tone: 3,
    site: "Dropbox",
    gen: "Dropboxin",
    ill: "Dropboxiin",
  },
};

const serviceNames: Record<ProviderId, Partial<Record<ServiceId, string>>> = {
  google: {
    mail: "Gmail",
    calendar: "Google-kalenteri",
    contacts: "Google-yhteystiedot",
    drive: "Google Drive",
  },
  microsoft: {
    mail: "Outlook-posti",
    calendar: "Outlook-kalenteri",
    contacts: "Yhteystiedot",
    onedrive: "OneDrive ja SharePoint",
    sharepoint: "SharePoint",
  },
  imap: {
    mail: "Posti",
    calendar: "Kalenteri (CalDAV)",
    contacts: "Yhteystiedot (CardDAV)",
  },
  caldav: { calendar: "Kalenteri (CalDAV)" },
  carddav: { contacts: "Yhteystiedot (CardDAV)" },
  dropbox: { dropbox: "Dropbox" },
};

const serviceIcons: Record<ServiceId, IconName> = {
  mail: "mail",
  calendar: "calendar",
  contacts: "contacts",
  drive: "folder",
  onedrive: "folder",
  sharepoint: "folder",
  dropbox: "folder",
};

const fileServices: ServiceId[] = [
  "drive",
  "onedrive",
  "sharepoint",
  "dropbox",
];

export function serviceName(provider: ProviderId, id: ServiceId): string {
  return serviceNames[provider][id] ?? id;
}

function CloudFolderHint() {
  return (
    <p className="ig-meta">
      OneDriven tai Dropboxin synkronoitu kansio välittää tiedostoja oman
      koneesi ja agentin välillä. Jaa siellä esimerkiksi kuvakaappauksia, tai
      pyydä agenttia tallentamaan sinne sähköpostiliitteet, jotka haluat omalle
      koneellesi. Synkronoi sama kansio myös omalla koneellasi.
    </p>
  );
}

/** What the agent gets from a service, in a sentence. */
function gets(provider: ProviderId, service: Service): ReactNode {
  if (service.directory)
    return (
      <>
        Kansio <code>{service.directory}</code>, jota agentit käyttävät
        tavallisilla tiedostotyökaluilla
      </>
    );
  if (provider === "imap")
    return (
      <>
        Agentit hakevat ja lukevat postia ja tekevät luonnoksia komennolla{" "}
        <code>himalaya</code>
      </>
    );
  return <>Agentit käyttävät tätä taidon personal-data kautta</>;
}

export function ProviderMark({
  provider,
  small,
}: {
  provider: ProviderId;
  small?: boolean;
}) {
  const copy = providerCopy[provider];
  return (
    <span
      className={`ig-mark ig-tone-${copy.tone}${small ? " sm" : ""}`}
      aria-hidden="true"
    >
      {copy.mark}
    </span>
  );
}

/** The agent-exposure warning: it informs, it is not a permission system. */
export function AgentWarning() {
  return (
    <div className="ig-warn" role="note">
      <Icon name="shield" />
      <div>
        <strong>
          Agentit voivat lukea ja käyttää kaikkea, mitä tähän liität.
        </strong>{" "}
        Ne voivat lähettää postia, muuttaa kalenteria ja muokata tai poistaa
        tiedostoja sinun nimissäsi. Liitetty viesti tai tiedosto voi myös
        sisältää ohjeita, joita agentti yrittää noudattaa. Liitä vain se, mitä
        haluat agenttien käyttävän.
      </div>
    </div>
  );
}

const stateText: Record<ServiceState, string> = {
  ok: "Toimii",
  syncing: "Synkronoi",
  sync_failed: "Synkronointi epäonnistui",
  credentials_rejected: "Tunnus tai salasana ei kelpaa",
  login_expired: "Kirjautuminen vanhentunut",
  unreachable: "Palvelimeen ei saada yhteyttä",
  sync_restarting: "Synkronointi pysähtyi, käynnistetään uudelleen",
  quota_full: "Kiintiö täynnä, synkronointi pysähtyi",
  unknown: "Tilaa ei saatu selville",
};

const failureText: Record<SyncFailure, string> = {
  quota_insufficient: "Valitut tiedostot eivät mahdu kiintiöön",
  quota_unavailable: "Vapaata tilaa ei voitu tarkistaa",
  initial_sync_incomplete: "Ensimmäinen synkronointi jäi kesken",
  initial_sync_resume_failed:
    "Ensimmäisen synkronoinnin jatkaminen epäonnistui",
  delete_limit: "Pysäytetty: liian monta poistoa kerralla",
  needs_resync: "Pysähtyi eikä jatku itsestään",
  remote_unreachable: "Palveluun ei saada yhteyttä, yritetään uudelleen",
  pass_failed: "Viimeisin synkronointi epäonnistui, yritetään uudelleen",
};

// What a failed ordinary pass asks of the person. Retried failures need
// nothing; the two native safeguards wait for someone to look.
const failureHelp: Partial<Record<SyncFailure, string>> = {
  delete_limit:
    "Synkronointi olisi poistanut yli puolet tiedostoista, joten se pysäytettiin eikä mitään poistettu. Jos poistit tiedostot tarkoituksella, pyydä ylläpitäjää hyväksymään poistot.",
  needs_resync:
    "Edellisen synkronoinnin tiedot puuttuvat, joten synkronointi ei jatka omin päin. Tiedostot säilyvät molemmissa paikoissa. Pyydä ylläpitäjää tarkistamaan tilanne.",
};

function SyncProgressStatus({ progress: p }: { progress: SyncProgress }) {
  return (
    <span
      data-testid="integration-sync-progress"
      className="ig-sync-progress"
      role="status"
    >
      Nykyinen erä:{" "}
      {p.phase === "inventory"
        ? "Lasketaan valittujen tiedostojen kokoa ja tarkistetaan tila"
        : p.phase === "preparing"
          ? "Luetaan tiedostoluetteloa"
          : "Kopioidaan tiedostoja"}
      {" · "}
      {minutesLeft(p.elapsed_seconds)} kulunut
      {p.total_bytes > 0 && (
        <>
          {" "}
          · {gigabytes(p.bytes)} / {gigabytes(p.total_bytes)}
        </>
      )}
      {p.total_files > 0 && (
        <>
          {" "}
          · {p.files} / {p.total_files} tiedostoa
        </>
      )}
      {p.total_bytes > 0 && (
        <span className="ig-bar" aria-hidden="true">
          <span
            style={{
              width: `${Math.min(100, (100 * p.bytes) / p.total_bytes)}%`,
            }}
          />
        </span>
      )}
    </span>
  );
}

function ServiceStatus({
  service,
  checking,
}: {
  service: Service;
  checking: boolean;
}) {
  if (checking)
    return (
      <span className="ig-st">
        <span className="ig-spin" aria-hidden="true" />
        Tarkistetaan…
      </span>
    );
  const bad = [
    "credentials_rejected",
    "login_expired",
    "quota_full",
    "sync_failed",
  ].includes(service.state);
  const warn = ["unreachable", "sync_restarting", "unknown"].includes(
    service.state,
  );
  // An ok file service with a pass running is syncing right now.
  const passing = service.state === "ok" && !!service.progress;
  const text = service.failure
    ? failureText[service.failure]
    : passing
      ? "Synkronoidaan nyt"
      : service.state === "ok" && service.directory
        ? "Synkronoi jatkuvasti"
        : stateText[service.state];
  return (
    <span
      data-testid="integration-service-state"
      data-state={service.state}
      data-failure={service.failure}
      className={`ig-st${bad ? " bad" : warn ? " warn" : service.state === "ok" ? " ok" : ""}`}
    >
      <Icon
        name={
          bad || warn
            ? "warning"
            : service.state === "syncing" || passing
              ? "refresh"
              : "check"
        }
      />
      {text}
    </span>
  );
}

export function AccountCard({
  account,
  checking,
  onCheck,
  onSignInAgain,
  onStopSync,
  onRemove,
}: {
  account: Account;
  checking: boolean;
  onCheck: () => void;
  onSignInAgain?: () => void;
  onStopSync?: () => void;
  onRemove: () => void;
}) {
  const copy = providerCopy[account.provider];
  return (
    <article
      data-testid={`integration-account-${account.provider}`}
      className="ig-card"
      aria-label={`${copy.name} · ${account.address}`}
    >
      <div className="ig-acc">
        <ProviderMark provider={account.provider} />
        <div>
          <span className="ig-rn">{copy.name}</span>
          <span className="ig-meta">{account.address}</span>
        </div>
        {needsSignIn(account) && onSignInAgain ? (
          <ControlButton
            data-testid="integration-reauth"
            size="row"
            variant="primary"
            onPress={onSignInAgain}
          >
            Kirjaudu uudelleen
          </ControlButton>
        ) : null}
        <ControlButton
          data-testid="integration-recheck"
          size="row"
          variant="quiet"
          isDisabled={checking}
          onPress={onCheck}
        >
          <Icon name="refresh" />
          Tarkista
        </ControlButton>
        <ControlButton
          data-testid="integration-remove-open"
          size="row"
          variant="quiet"
          onPress={onRemove}
        >
          Poista…
        </ControlButton>
      </div>
      {account.services.map((s) => (
        <div
          data-testid={`integration-service-${s.id}`}
          className="ig-svc"
          key={s.id}
        >
          <span className="ig-ic sm">
            <Icon name={serviceIcons[s.id]} />
          </span>
          <div>
            <span className="ig-rn">{serviceName(account.provider, s.id)}</span>
            <span className="ig-meta">{gets(account.provider, s)}</span>
            {s.progress &&
              !(
                s.state === "sync_failed" && s.progress.phase === "inventory"
              ) && <SyncProgressStatus progress={s.progress} />}
            {s.state === "syncing" && onStopSync && (
              <ControlButton
                data-testid="integration-sync-stop"
                size="row"
                variant="quiet"
                onPress={onStopSync}
              >
                Keskeytä synkronointi
              </ControlButton>
            )}
            {(s.state === "sync_restarting" || s.state === "sync_failed") &&
              s.failure &&
              failureHelp[s.failure] && (
                <span className="ig-meta">{failureHelp[s.failure]}</span>
              )}
            {s.state === "sync_failed" &&
              !failureHelp[s.failure ?? "pass_failed"] && (
                <span className="ig-meta">
                  {s.failure === "initial_sync_incomplete" ||
                  s.failure === "initial_sync_resume_failed"
                    ? "Kirjaudu uudelleen ja valitse synkronointi, niin ensimmäinen synkronointi tehdään loppuun. Jo kopioidut tiedostot säilyvät."
                    : s.failure
                      ? "Vapauta tilaa tai pyydä ylläpitäjältä lisää tilaa ja yritä uudelleen. Mitään ei kopioitu."
                      : "Kirjaudu uudelleen ja yritä synkronointia uudelleen. Jo kopioidut tiedostot säilyvät."}
                </span>
              )}
          </div>
          <div className="ig-sv">
            <ServiceStatus service={s} checking={checking} />
            {checking ? null : s.directory ? (
              // A file service's moving clock is its last successful pass,
              // not the status check: only that says the files sync.
              <span data-testid="integration-last-synced" className="ig-meta">
                {s.last_synced_at && syncedTime(s.last_synced_at) ? (
                  <>
                    Synkronoitu{" "}
                    <time dateTime={s.last_synced_at}>
                      {syncedTime(s.last_synced_at)}
                    </time>
                  </>
                ) : (
                  "Ei vielä synkronoitu"
                )}
              </span>
            ) : clockTime(account.checked_at) ? (
              <span data-testid="integration-checked-at" className="ig-meta">
                Tarkistettu klo {clockTime(account.checked_at)}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </article>
  );
}

const skillNotice: Partial<Record<IntegrationList["skill"], string>> = {
  blocked:
    "Kotihakemistossasi on oma taito ~/.agents/skills/personal-data, joten agenttien tietokarttaa ei kirjoitettu sen päälle. Agentit eivät näe yhdistettyjä tilejä ennen kuin siirrät oman taitosi muualle.",
  failed:
    "Agenttien tietokarttaa (~/.agents/skills/personal-data) ei saatu ajan tasalle. Se korjautuu, kun lisäät tai poistat tilin.",
};

/** The section's body: the accounts the tools hold and the providers. */
export function IntegrationsOverview({
  list,
  checking,
  onCheck,
  onConnect,
  onSignInAgain,
  onStopSync,
  onRemove,
  compact = false,
}: {
  list: IntegrationList;
  /** Inside onboarding: the step says what the integration is for and the
   * connect dialog carries the agent warning, so the page's own lead,
   * headings and closing note are left out. */
  compact?: boolean;
  /** Accounts whose check is under way; "all" for the whole page. */
  checking: Set<string> | "all";
  onCheck: (account?: Account) => void;
  onConnect: (provider: Provider) => void;
  onSignInAgain: (account: Account) => void;
  onStopSync?: (account: Account) => void;
  onRemove: (account: Account) => void;
}) {
  const key = (a: Account) => `${a.provider}:${a.address}`;
  const isChecking = (a: Account) => checking === "all" || checking.has(key(a));
  const connected = list.providers.filter((p) =>
    list.accounts.some((a) => a.provider === p.id),
  );
  const rest = list.providers.filter(
    (p) => !list.accounts.some((a) => a.provider === p.id),
  );
  return (
    <div className="ig-main">
      {compact ? null : (
        <>
          <p className="ig-intro">
            Liitä muiden palvelujen tilisi, niin agenttisi voivat käyttää niiden
            tiedostoja, postia ja kalentereita.
          </p>
          <CloudFolderHint />
          <AgentWarning />
        </>
      )}
      {skillNotice[list.skill] ? (
        <p className="ig-notice" role="status">
          <Icon name="warning" />
          <span>{skillNotice[list.skill]}</span>
        </p>
      ) : null}
      {connected.length > 0 && (
        <>
          {compact ? null : <h3 className="ig-h3">Yhdistetyt tilit</h3>}
          {connected.map((p) => (
            <section
              className="ig-provider"
              key={p.id}
              aria-label={providerCopy[p.id].name}
            >
              {list.accounts
                .filter((a) => a.provider === p.id)
                .map((a) => (
                  <AccountCard
                    key={key(a)}
                    account={a}
                    checking={isChecking(a)}
                    onCheck={() => onCheck(a)}
                    onSignInAgain={
                      p.available ? () => onSignInAgain(a) : undefined
                    }
                    onStopSync={onStopSync ? () => onStopSync(a) : undefined}
                    onRemove={() => onRemove(a)}
                  />
                ))}
              {p.available ? (
                <div className="ig-another">
                  <ControlButton
                    data-testid={`integration-add-${p.id}`}
                    size="row"
                    variant="quiet"
                    onPress={() => onConnect(p)}
                  >
                    <Icon name="plus" />
                    Lisää toinen{" "}
                    {p.id === "imap"
                      ? "sähköpostitili"
                      : `${providerCopy[p.id].name}-tili`}
                  </ControlButton>
                </div>
              ) : null}
            </section>
          ))}
        </>
      )}
      {rest.length > 0 && (
        <>
          {compact ? null : <h3 className="ig-h3">Lisää tili</h3>}
          <div className="ig-tiles">
            {rest.map((p) => (
              <div
                data-testid={`integration-tile-${p.id}`}
                className="ig-tile"
                key={p.id}
              >
                <ProviderMark provider={p.id} />
                <div>
                  <span className="ig-rn">{providerCopy[p.id].name}</span>
                  <span className="ig-meta">
                    {p.available
                      ? p.services.map((s) => serviceName(p.id, s)).join(" · ")
                      : p.unavailable_reason === "app_credentials_required"
                        ? "Odottaa palvelimen ylläpitäjän sovellusasetuksia"
                        : "Ei käytettävissä tällä palvelimella"}
                  </span>
                </div>
                <ControlButton
                  data-testid="integration-connect-open"
                  size="row"
                  variant="secondary"
                  isDisabled={!p.available}
                  onPress={() => onConnect(p)}
                >
                  Yhdistä…
                </ControlButton>
              </div>
            ))}
          </div>
        </>
      )}
      {compact ? null : (
        <p className="ig-foot">
          Tila luetaan suoraan työkaluilta sinun käyttäjänäsi. Kirjautumistiedot
          ovat vain kotihakemistossasi; palvelin ei tallenna niitä eikä listaa
          liitoksiasi muualle. Uudet keskustelut näkevät liitoksen heti;
          käynnissä oleva keskustelu näkee sen, kun lataat sen uudelleen.
        </p>
      )}
    </div>
  );
}

// ---------- The connect dialog ----------

export type ConnectStage =
  | { stage: "intro" }
  | { stage: "password"; relogin?: string; error?: string; busy?: boolean }
  | { stage: "login"; view: LoginView; error?: string; busy?: boolean }
  | { stage: "connected"; address: string; relogin?: boolean }
  | { stage: "uncertain" };

function Steps({ provider, view }: { provider: Provider; view: LoginView }) {
  const files = provider.services.find((s) => fileServices.includes(s));
  // Microsoft has its own two-grant counter until authentication finishes.
  // Showing the outer login/folder counter here would give two different 2/2s.
  if (
    !files ||
    view.relogin ||
    (provider.id === "microsoft" &&
      ["starting", "device_code", "completing"].includes(view.state) &&
      !view.address)
  )
    return null;
  const steps = [
    { id: "login", label: `Kirjaudu: ${providerCopy[provider.id].name}` },
    {
      id: "folders",
      label: `Valitse kansiot: ${serviceName(provider.id, files)}`,
    },
  ];
  const at =
    view.state === "completed"
      ? 2
      : view.state === "choose_folders" ||
          (view.state === "completing" && Boolean(view.address))
        ? 1
        : 0;
  // Each step has its own row (Jari, 2026-10-18).
  return (
    <ol
      data-testid="integration-steps"
      className="ig-steps"
      aria-label="Vaiheet"
    >
      {steps.map((s, i) => (
        <li
          key={s.id}
          className={i < at ? "done" : i === at ? "now" : ""}
          aria-current={i === at ? "step" : undefined}
        >
          {i < at ? <Icon name="check" /> : <span>{i + 1}</span>}
          <span>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <ControlButton
      size="row"
      variant="secondary"
      aria-label={`Kopioi ${label}`}
      onPress={() => {
        void navigator.clipboard?.writeText(value).then(
          () => setCopied(true),
          () => {},
        );
      }}
    >
      <Icon name={copied ? "check" : "copy"} />
      {copied ? "Kopioitu" : "Kopioi"}
    </ControlButton>
  );
}

/** Seconds until an ISO time, refreshed every second while shown. */
function useSecondsLeft(iso?: string): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [iso]);
  return iso ? Math.max(0, (Date.parse(iso) - now) / 1000) : 0;
}

function ExternalButton({
  href,
  children,
  onOpen,
}: {
  href: string;
  children: ReactNode;
  onOpen?: () => void;
}) {
  return (
    <a
      data-testid="integration-provider-link"
      className={`${controlClassName({ variant: "primary", size: "page", text: true })} ig-open`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      onClick={onOpen}
    >
      <Icon name="external" />
      {children}
    </a>
  );
}

function DeviceCodeStep({
  view,
  onCancel,
}: {
  view: LoginView;
  onCancel: () => void;
}) {
  const left = useSecondsLeft(view.expires_at);
  const uri = safeHttps(view.verification_uri);
  const code = view.user_code ?? "";
  const host = uri
    ? new URL(uri).host + new URL(uri).pathname.replace(/\/$/, "")
    : "";
  if (!uri)
    return (
      <p role="alert">
        Kirjautumisosoite ei kelpaa. Peruuta ja yritä uudelleen.
      </p>
    );
  return (
    <>
      <p
        className="ig-h"
        data-testid="integration-device-stage"
        data-login-phase={view.login_phase}
      >
        {`Kirjaudu ${providerCopy[view.provider ?? "microsoft"].ill} tällä koodilla`}
      </p>
      <p className="ig-p">
        {view.provider === "microsoft"
          ? "Yksi koodi yhdistää OneDriven, SharePointin ja Outlookin tämän palvelimen työkaluihin."
          : "Koodi kirjaa vain tämän palvelimen työkalun sinun tilillesi."}
      </p>
      <div className="ig-code">
        <span
          data-testid="integration-device-code"
          className="ig-code-v"
          aria-hidden="true"
        >
          {code}
        </span>
        <span className="ig-sr">Koodi {code.split("").join(" ")}</span>
        <CopyButton value={code} label="koodi" />
      </div>
      <div className="ig-row start">
        <ExternalButton href={uri}>Avaa {host}</ExternalButton>
      </div>
      <p className="ig-wait" role="status">
        <span className="ig-spin" aria-hidden="true" />
        <span>
          Odotetaan, että hyväksyt kirjautumisen. Koodi vanhenee{" "}
          <b>{minutesLeft(left)}</b>
        </span>
      </p>
      <p className="ig-fine">
        Syötä koodi vain tänne avaamallesi{" "}
        {providerCopy[view.provider ?? "microsoft"].gen} sivulle. Jos joku muu
        pyytää sinua syöttämään koodin, älä tee sitä.
      </p>
      <div className="ig-row">
        <ControlButton
          data-testid="cancel"
          size="page"
          variant="secondary"
          onPress={onCancel}
        >
          Peruuta
        </ControlButton>
      </div>
    </>
  );
}

function PasteStep({
  view,
  error,
  busy,
  onPaste,
  onCancel,
}: {
  view: LoginView;
  error?: string;
  busy?: boolean;
  onPaste: (url: string) => void;
  onCancel: () => void;
}) {
  const [opened, setOpened] = useState(false);
  const [value, setValue] = useState("");
  const [local, setLocal] = useState("");
  const left = useSecondsLeft(view.expires_at);
  const copy = providerCopy[view.provider ?? "google"];
  const href = safeHttps(view.authorization_url);
  const prefix = view.redirect_prefix ?? "";
  if (!href)
    return (
      <p role="alert">
        Kirjautumisosoite ei kelpaa. Peruuta ja yritä uudelleen.
      </p>
    );
  if (!opened)
    return (
      <>
        <p className="ig-h">Kirjaudu: {copy.site}</p>
        <p className="ig-p">
          {copy.site} kysyy, mille tilille ja mitkä luvat annat.
        </p>
        <div className="ig-row start">
          <ExternalButton href={href} onOpen={() => setOpened(true)}>
            Avaa {copy.site}
          </ExternalButton>
        </div>
        <div className="ig-row">
          <ControlButton
            data-testid="cancel"
            size="page"
            variant="secondary"
            onPress={onCancel}
          >
            Peruuta
          </ControlButton>
        </div>
      </>
    );
  const submit = () => {
    const v = value.trim();
    if (!v)
      return setLocal(
        "Liitä ensin osoite, johon päädyit hyväksymisen jälkeen.",
      );
    if (!redirectMatches(prefix, v))
      return setLocal(
        `Tämä ei ole se osoite. Liitä osoite, johon päädyit hyväksymisen jälkeen; se alkaa ${prefix}.`,
      );
    setLocal("");
    setValue("");
    onPaste(v);
  };
  const shown = local || error;
  return (
    <form
      className="ig-flow-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="ig-h">Liitä osoite, johon {copy.site} lopuksi ohjasi</p>
      <ol className="ig-how">
        <li>Hyväksy luvat avautuneessa välilehdessä.</li>
        <li>
          Lopuksi selain siirtyy sivulle, joka ei aukea. Se kuuluu asiaan:
          osoite alkaa <code>{prefix}</code> ja sisältää kirjautumisen.
        </li>
        <li>Kopioi osoiteriviltä koko osoite ja liitä se tähän.</li>
      </ol>
      <TextField
        data-testid="integration-redirect-input"
        label="Paluuosoite"
        value={value}
        onChange={(v) => {
          setValue(v);
          setLocal("");
        }}
        mono
      />
      {shown ? (
        <p className="ig-err" role="alert">
          <Icon name="warning" />
          <span>{shown}</span>
        </p>
      ) : null}
      <p className="ig-wait quiet">
        <Icon name="clock" />
        <span>
          Kirjautuminen on voimassa <b>{minutesLeft(left)}</b>.{" "}
          <a
            className="ig-link"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            Avaa {copy.site} uudelleen
          </a>
        </span>
      </p>
      <div className="ig-row">
        <ControlButton
          data-testid="cancel"
          size="page"
          variant="secondary"
          onPress={onCancel}
        >
          Peruuta
        </ControlButton>
        <ControlButton
          data-testid="integration-connect"
          size="page"
          variant="primary"
          type="submit"
          isPending={busy}
        >
          Yhdistä
        </ControlButton>
      </div>
    </form>
  );
}

function FolderStep({
  view,
  provider,
  busy,
  error,
  onChoose,
  onCancel,
}: {
  view: LoginView;
  provider: Provider;
  busy?: boolean;
  error?: string;
  onChoose: (ids: string[]) => void;
  onCancel: () => void;
}) {
  const folders: Folder[] = view.folders ?? [];
  const [selected, setSelected] = useState(() =>
    folders.filter((f) => f.suggested).map((f) => f.id),
  );
  const total = selectedBytes(folders, selected);
  const free = view.free_bytes ?? 0;
  const quota = view.quota_bytes;
  const unknown =
    view.free_bytes === undefined ||
    folders.some((f) => selected.includes(f.id) && f.bytes === undefined);
  const over = !unknown && total > free;
  const files = provider.services.find((s) => fileServices.includes(s));
  return (
    <>
      <p data-testid="integration-folder-choice" className="ig-h">
        Mitkä kansiot synkronoidaan kansioon <code>{view.directory}</code>?
      </p>
      <p className="ig-p">
        Kansiot pysyvät ajan tasalla jatkuvasti, myös kun selain on kiinni. Ne
        vievät tilaa kotihakemistosi kiintiöstä.
      </p>
      <fieldset className="ig-folders">
        <legend className="ig-sr">
          {files ? serviceName(provider.id, files) : "Kansiot"}
        </legend>
        {folders.map((f) => (
          <div className="ig-folder" key={f.id}>
            <Checkbox
              data-testid={`integration-folder-${f.id}`}
              label={f.name}
              checked={selected.includes(f.id)}
              onChange={(on) =>
                setSelected((s) =>
                  on ? [...s, f.id] : s.filter((x) => x !== f.id),
                )
              }
            />
            <span className="ig-meta">
              {f.bytes === undefined ? "Ei vielä laskettu" : gigabytes(f.bytes)}
            </span>
          </div>
        ))}
      </fieldset>
      <div
        data-testid="integration-capacity"
        data-known={!unknown}
        data-over={over}
        className={`ig-room${over ? " over" : ""}`}
      >
        {quota && !unknown ? (
          <span className="ig-quota" aria-hidden="true">
            <span
              className="u"
              style={{ width: `${(100 * (quota - free)) / quota}%` }}
            />
            <span
              className="n"
              style={{ width: `${(100 * Math.min(total, free)) / quota}%` }}
            />
          </span>
        ) : null}
        <span role="status">
          {unknown ? (
            <span>
              Valittujen tiedostojen koko ja tilan riittävyys tarkistetaan
              taustalla ennen kopiointia.{" "}
              {view.free_bytes !== undefined ? (
                <>Vapaana {gigabytes(free)}.</>
              ) : (
                <>Vapaa tila ei ole vielä tiedossa.</>
              )}
            </span>
          ) : over ? (
            <>
              <Icon name="warning" />
              <span>
                <b>Ei mahdu.</b> Valitut {gigabytes(total)}, vapaana{" "}
                {gigabytes(free)}. Jätä jokin kansio pois tai pyydä
                ylläpitäjältä lisää tilaa.
              </span>
            </>
          ) : (
            <span>
              Valittu {gigabytes(total)}. Kotihakemistossa on vapaana{" "}
              {gigabytes(free)}
              {quota ? ` / ${gigabytes(quota)}` : ""}.
            </span>
          )}
        </span>
      </div>
      {error ? (
        <p role="alert" className="ig-err">
          {error}
        </p>
      ) : null}
      <div className="ig-row">
        <ControlButton
          data-testid="cancel"
          size="page"
          variant="secondary"
          onPress={onCancel}
        >
          Peruuta
        </ControlButton>
        <ControlButton
          size="page"
          variant="primary"
          isDisabled={over || selected.length === 0}
          isPending={busy}
          data-testid="integration-sync-start"
          onPress={() => onChoose(selected)}
        >
          <Icon name="refresh" />
          Aloita synkronointi
        </ControlButton>
      </div>
    </>
  );
}

function FailedStep({
  view,
  onRestart,
  onClose,
}: {
  view: LoginView;
  onRestart: () => void;
  onClose: () => void;
}) {
  const copy = providerCopy[view.provider ?? "google"];
  const consent = safeHttps(view.consent_url);
  const restart = (
    <div className="ig-row">
      <ControlButton
        data-testid="dialog-close"
        size="page"
        variant="secondary"
        onPress={onClose}
      >
        Sulje
      </ControlButton>
      <ControlButton size="page" variant="primary" onPress={onRestart}>
        Aloita alusta
      </ControlButton>
    </div>
  );
  switch (view.failure) {
    case "quota_insufficient":
    case "quota_unavailable":
      return (
        <>
          <p
            className="ig-result bad"
            role="alert"
            data-testid="integration-quota-refusal"
          >
            <Icon name="warning" />
            <span>
              {view.failure === "quota_insufficient"
                ? "Valitut tiedostot eivät mahdu kotihakemistosi kiintiöön."
                : "Kotihakemiston vapaata tilaa ei voitu tarkistaa."}{" "}
              Mitään ei kopioitu. Kirjautuminen säilyy. Vapauta tilaa tai pyydä
              ylläpitäjältä lisää tilaa ja aloita uudelleen.
            </span>
          </p>
          {restart}
        </>
      );

    case "consent_required":
      return (
        <>
          <p className="ig-result bad" role="alert">
            <Icon name="warning" />
            <span>
              <b>Organisaatiosi vaatii ylläpitäjän luvan.</b> Käyttäjät eivät
              voi itse sallia sovelluksille pääsyä postiin, kalenteriin tai
              tiedostoihin. Ylläpitäjän pitää hyväksyä tämän palvelimen sovellus
              kerran koko organisaatiolle.
            </span>
          </p>
          {consent ? (
            <>
              <p className="ig-p">
                Lähetä tämä linkki organisaatiosi ylläpitäjälle. Hän näkee, mitä
                sovellus pyytää, ennen kuin hyväksyy.
              </p>
              <div className="ig-url">
                <code data-testid="integration-consent-link">{consent}</code>
                <CopyButton
                  value={consent}
                  label="ylläpitäjän hyväksyntälinkki"
                />
              </div>
            </>
          ) : null}
          <p className="ig-p">
            Kun lupa on annettu, kirjaudu uudelleen. Mitään ei tallennettu.
          </p>
          {restart}
        </>
      );
    case "device_code_blocked":
      return (
        <>
          <p className="ig-result bad" role="alert">
            <Icon name="stop" />
            <span>
              <b>Organisaatiosi estää kirjautumisen laitekoodilla.</b>{" "}
              {copy.site} pysäytti kirjautumisen organisaation pääsysäännön
              takia. Tältä palvelimelta ei ole toista reittiä.
            </span>
          </p>
          <p className="ig-p">
            Organisaatiosi ylläpitäjä voi sallia laitekoodikirjautumisen tälle
            sovellukselle.
          </p>
          <div className="ig-row">
            <ControlButton
              data-testid="dialog-close"
              size="page"
              variant="primary"
              onPress={onClose}
            >
              Sulje
            </ControlButton>
          </div>
        </>
      );
    case "expired":
      return (
        <>
          <p className="ig-result" role="alert">
            <Icon name="clock" />
            <span>
              Kirjautuminen vanheni ennen kuin se valmistui. Mitään ei
              yhdistetty.
            </span>
          </p>
          {restart}
        </>
      );
    case "redirect_rejected":
      return (
        <>
          <p className="ig-result bad" role="alert">
            <Icon name="warning" />
            <span>
              {copy.site} ei hyväksynyt liitettyä osoitetta. Se voi olla vanhan
              kirjautumisen osoite. Mitään ei yhdistetty.
            </span>
          </p>
          {restart}
        </>
      );
    case "account_mismatch":
      return (
        <>
          <p className="ig-result bad" role="alert">
            <Icon name="warning" />
            <span>
              Kirjauduit eri tilille kuin <b>{view.address}</b>. Tiliä ei
              muutettu. Valitse kirjautuessasi sama tili.
            </span>
          </p>
          {restart}
        </>
      );
    case "cancelled":
      return (
        <>
          <p className="ig-result">
            <Icon name="cross" />
            <span>Kirjautuminen peruttiin. Mitään ei yhdistetty.</span>
          </p>
          {restart}
        </>
      );
    default:
      return (
        <>
          <p className="ig-result bad" role="alert">
            <Icon name="warning" />
            <span>Kirjautuminen ei onnistunut. Mitään ei yhdistetty.</span>
          </p>
          {restart}
        </>
      );
  }
}

const emptyAccount = (address = ""): PasswordAccount => ({
  address,
  server: "",
  port: 993,
  security: "tls",
  username: "",
  password: "",
});

function PasswordForm({
  provider,
  relogin,
  error,
  busy,
  onSubmit,
  onCancel,
}: {
  provider: ProviderId;
  relogin?: string;
  error?: string;
  busy?: boolean;
  onSubmit: (account: PasswordAccount) => void;
  onCancel: () => void;
}) {
  const dav = provider === "caldav" || provider === "carddav";
  const [a, setA] = useState(() => emptyAccount(relogin));
  const [touchedServer, setTouchedServer] = useState(false);
  const [touchedUser, setTouchedUser] = useState(false);
  const set = (patch: Partial<PasswordAccount>) =>
    setA((x) => ({ ...x, ...patch }));
  const address = a.address.trim().toLowerCase();
  const validAddress =
    /^[a-z0-9._%+-]{1,64}@[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/.test(address);
  const server = a.server.trim().toLowerCase();
  const ready = relogin
    ? a.password.length > 0
    : validAddress &&
      (dav
        ? !!a.url && safeHttps(a.url) !== undefined
        : /^[a-z0-9.-]{1,253}$/.test(server) && a.port > 0 && a.port < 65536) &&
      (!a.smtp_server ||
        (a.smtp_port !== undefined &&
          a.smtp_port > 0 &&
          a.smtp_port < 65536)) &&
      a.username.trim() !== "" &&
      a.password !== "";
  return (
    <form
      className="ig-flow-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || busy) return;
        onSubmit({
          ...a,
          address,
          server,
          username: a.username.trim(),
          ...(dav ? { url: safeHttps(a.url) } : {}),
        });
        set({ password: "" });
      }}
    >
      {relogin ? (
        <p className="ig-p">
          Anna tilin <b>{relogin}</b> uusi sovellussalasana. Vanha jää voimaan,
          jos palvelin ei hyväksy uutta.
        </p>
      ) : (
        <p className="ig-p">
          Luo postipalvelusi asetuksissa sovellussalasana tätä palvelinta varten
          ja kirjoita se tähän palvelimen tietojen kanssa. Salasana tallentuu
          vain kotihakemistosi {dav ? "curl-asetuksiin" : "himalaya-asetuksiin"}
          .
          {dav
            ? " Anna palveluntarjoajan lopullinen CalDAV- tai CardDAV-osoite, ei selaimen kalenterinäkymää tai uudelleenohjaavaa .well-known-osoitetta. Liitä kalenteri ja yhteystiedot erikseen, jos niiden osoitteet eroavat."
            : " SMTP käyttää samaa käyttäjätunnusta ja sovellussalasanaa kuin IMAP. Jätä SMTP tyhjäksi, jos haluat vain luonnokset."}
        </p>
      )}
      {!relogin && (
        <>
          <TextField
            data-testid="integration-address"
            label="Sähköpostiosoite"
            autoComplete="email"
            value={a.address}
            onChange={(v) => {
              const lower = v.trim().toLowerCase();
              const domain = lower.includes("@") ? lower.split("@")[1] : "";
              set({
                address: v,
                ...(touchedServer
                  ? {}
                  : { server: domain ? `imap.${domain}` : "" }),
                ...(touchedUser ? {} : { username: lower }),
              });
            }}
          />
          {dav ? (
            <TextField
              data-testid="integration-dav-url"
              label="DAV-osoite (HTTPS)"
              value={a.url ?? ""}
              onChange={(v) => set({ url: v })}
            />
          ) : (
            <>
              <div className="ig-pair">
                <TextField
                  data-testid="integration-imap-host"
                  label="IMAP-palvelin"
                  mono
                  value={a.server}
                  onChange={(v) => {
                    setTouchedServer(true);
                    set({ server: v });
                  }}
                />
                <TextField
                  label="Portti"
                  mono
                  value={String(a.port || "")}
                  onChange={(v) =>
                    set({ port: Number(v.replace(/\D/g, "")) || 0 })
                  }
                />
              </div>
              <Segmented
                label="Suojaus"
                options={[
                  { id: "tls", label: "TLS" },
                  { id: "starttls", label: "STARTTLS" },
                ]}
                value={a.security}
                onChange={(v) =>
                  set({ security: v, port: v === "tls" ? 993 : 143 })
                }
              />
              <TextField
                data-testid="integration-smtp-host"
                label="SMTP-palvelin (valinnainen)"
                value={a.smtp_server ?? ""}
                onChange={(v) =>
                  set(
                    v
                      ? {
                          smtp_server: v.trim().toLowerCase(),
                          smtp_port: a.smtp_port ?? 465,
                          smtp_security: a.smtp_security ?? "tls",
                        }
                      : {
                          smtp_server: undefined,
                          smtp_port: undefined,
                          smtp_security: undefined,
                        },
                  )
                }
              />
              {a.smtp_server ? (
                <>
                  <TextField
                    data-testid="integration-smtp-port"
                    label="SMTP-portti"
                    value={String(a.smtp_port ?? "")}
                    onChange={(v) =>
                      set({ smtp_port: Number(v.replace(/\D/g, "")) || 0 })
                    }
                  />
                  <Segmented
                    label="SMTP-suojaus"
                    options={[
                      { id: "tls", label: "TLS" },
                      { id: "starttls", label: "STARTTLS" },
                    ]}
                    value={a.smtp_security ?? "tls"}
                    onChange={(v) =>
                      set({
                        smtp_security: v,
                        smtp_port: v === "tls" ? 465 : 587,
                      })
                    }
                  />
                </>
              ) : null}
            </>
          )}
          <TextField
            data-testid="integration-username"
            label="Käyttäjätunnus"
            value={a.username}
            onChange={(v) => {
              setTouchedUser(true);
              set({ username: v });
            }}
          />
        </>
      )}
      <PasswordField
        value={a.password}
        onChange={(v) => set({ password: v })}
      />
      {error ? (
        <p className="ig-err" role="alert">
          <Icon name="warning" />
          <span>{error}</span>
        </p>
      ) : null}
      <div className="ig-row">
        <ControlButton
          data-testid="cancel"
          size="page"
          variant="secondary"
          onPress={onCancel}
        >
          Peruuta
        </ControlButton>
        <ControlButton
          data-testid={
            relogin ? "integration-password-save" : "integration-connect"
          }
          size="page"
          variant="primary"
          type="submit"
          isDisabled={!ready}
          isPending={busy}
        >
          {relogin ? "Vaihda salasana" : "Yhdistä"}
        </ControlButton>
      </div>
    </form>
  );
}

function PasswordField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="s-field ig-password">
      <span>Sovellussalasana</span>
      <input
        type="password"
        data-testid="integration-password"
        autoComplete="new-password"
        value={value}
        maxLength={1024}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Intro({
  provider,
  onContinue,
  onCancel,
}: {
  provider: Provider;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const copy = providerCopy[provider.id];
  const how =
    provider.login === "device_code"
      ? `Kirjaudut ${copy.gen} sivulla lyhyellä koodilla. Työpaikan tilillä organisaation ylläpitäjän voi joutua hyväksymään sovelluksen ensin.`
      : provider.login === "pasted_redirect"
        ? `${copy.site} avautuu uuteen välilehteen. Hyväksymisen jälkeen kopioit sen osoitteen, johon päädyit, takaisin tänne.`
        : "Tarvitset postipalvelusi sovellussalasanan ja palvelimen nimen. Ne kirjoitetaan vain kotihakemistosi asetuksiin.";
  return (
    <>
      {(provider.id === "microsoft" || provider.id === "dropbox") && (
        <CloudFolderHint />
      )}
      <p className="ig-lead">Agentit saavat käyttöönsä</p>
      <ul className="ig-picks">
        {provider.services.map((s) => (
          <li className="ig-pick" key={s}>
            <span className="ig-ic sm">
              <Icon name={serviceIcons[s]} />
            </span>
            <span>
              <b>{serviceName(provider.id, s)}</b>
              <span className="ig-meta">
                {fileServices.includes(s)
                  ? "Lukeminen, muokkaus ja poistaminen; tiedostot synkronoidaan kotihakemistoosi."
                  : s === "mail"
                    ? "Postin lukeminen ja luonnokset."
                    : "Lukeminen ja muokkaus."}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="ig-p">{how}</p>
      <AgentWarning />
      <div className="ig-row">
        <ControlButton
          data-testid="cancel"
          size="page"
          variant="secondary"
          onPress={onCancel}
        >
          Peruuta
        </ControlButton>
        <ControlButton
          data-testid="integration-continue"
          size="page"
          variant="primary"
          onPress={onContinue}
        >
          {provider.login === "app_password" ? null : <Icon name="external" />}
          Jatka{provider.login === "app_password" ? "" : `: ${copy.site}`}
        </ControlButton>
      </div>
    </>
  );
}

/** The sign-in dialog. The app decides the stage from the host's replies. */
export function ConnectDialog({
  provider,
  stage,
  onContinue,
  onPassword,
  onPaste,
  onFolders,
  onRestart,
  onClose,
}: {
  provider?: Provider;
  stage: ConnectStage;
  onContinue: () => void;
  onPassword: (account: PasswordAccount) => void;
  onPaste: (url: string) => void;
  onFolders: (ids: string[]) => void;
  onRestart: () => void;
  /** Closing an initial sync leaves the daemon working in the background. */
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    void stage.stage;
    heading.current?.focus();
  }, [stage.stage]);
  if (!provider) return null;
  const copy = providerCopy[provider.id];
  const activeLogin =
    stage.stage === "login" &&
    !["none", "completed", "failed"].includes(stage.view.state) &&
    !(stage.view.state === "completing" && stage.view.address);
  const relogin =
    (stage.stage === "password" && stage.relogin) ||
    (stage.stage === "login" && stage.view.relogin) ||
    (stage.stage === "connected" && stage.relogin);
  const title = relogin
    ? `Kirjaudu uudelleen: ${copy.name}`
    : `Yhdistä ${provider.id === "imap" ? "sähköpostitili" : `${copy.name}-tili`}`;
  let body: ReactNode = null;
  switch (stage.stage) {
    case "intro":
      body = (
        <Intro provider={provider} onContinue={onContinue} onCancel={onClose} />
      );
      break;
    case "password":
      body = (
        <PasswordForm
          provider={provider.id}
          relogin={stage.relogin}
          error={stage.error}
          busy={stage.busy}
          onSubmit={onPassword}
          onCancel={onClose}
        />
      );
      break;
    case "uncertain":
      body = (
        <>
          <p className="ig-result bad" role="alert">
            <Icon name="warning" />
            <span>
              Yhteys palvelimeen katkesi, eikä tiedetä, tallentuiko muutos.
              Tarkista tilanne Integraatiot-sivulta ennen kuin yrität uudelleen.
            </span>
          </p>
          <div className="ig-row">
            <ControlButton
              data-testid="dialog-close"
              size="page"
              variant="primary"
              onPress={onClose}
            >
              Sulje
            </ControlButton>
          </div>
        </>
      );
      break;
    case "connected": {
      body = (
        <>
          <p
            data-testid="integration-connected"
            className="ig-result ok"
            role="status"
          >
            <Icon name="check" />
            <span>
              {stage.relogin ? (
                <>Kirjauduttu uudelleen. {stage.address} toimii taas.</>
              ) : (
                <>
                  <b>Yhdistetty: {stage.address}.</b> Uudet keskustelut näkevät
                  sen heti.
                </>
              )}
            </span>
          </p>
          <div className="ig-row">
            <ControlButton
              data-testid="integration-done"
              size="page"
              variant="primary"
              onPress={onClose}
            >
              Valmis
            </ControlButton>
          </div>
        </>
      );
      break;
    }
    case "login": {
      const v = stage.view;
      const steps = <Steps provider={provider} view={v} />;
      const unavailableSites = v.unavailable_sites?.length ? (
        <p
          className="ig-result bad"
          role="status"
          data-testid="integration-unavailable-sites"
        >
          <Icon name="warning" />
          <span>
            Seuraavia SharePoint-sivustoja ei voitu avata, joten ne jätettiin
            pois: {v.unavailable_sites.join(", ")}. Jos tarvitset niitä, pyydä
            käyttöoikeus organisaatiosi ylläpitäjältä.
          </span>
        </p>
      ) : null;
      if (
        v.state === "starting" ||
        v.state === "completing" ||
        v.state === "none"
      )
        body = (
          <>
            {steps}
            <p
              data-testid={
                v.state === "completing" && v.address
                  ? "integration-initial-sync"
                  : "integration-login-wait"
              }
              className="ig-wait"
              role="status"
            >
              <span className="ig-spin" aria-hidden="true" />
              {v.state === "completing" && v.address
                ? "Ensimmäinen synkronointi on käynnissä. Tämä voi kestää kauan, jos tiedostoja on paljon."
                : v.state === "completing"
                  ? v.login_phase === "files_discovery"
                    ? "Hyväksytty. Haetaan OneDrive- ja SharePoint-tietoja…"
                    : v.login_phase === "outlook_finishing"
                      ? "Outlookin kirjautuminen hyväksyttiin. Viimeistellään yhteyttä…"
                      : "Viimeistellään kirjautumista ja haetaan valittavat pilvikansiot…"
                  : "Käynnistetään kirjautumista…"}
            </p>
            {v.state === "completing" && v.address && (
              <>
                {v.progress && <SyncProgressStatus progress={v.progress} />}
                <p className="ig-p">
                  Voit sulkea tämän ikkunan ja jatkaa työskentelyä. Synkronointi
                  jatkuu taustalla. Näet etenemisen ja lopputuloksen asetusten
                  Integraatiot-sivulla.
                </p>
                <ControlButton
                  data-testid="integration-sync-background"
                  size="page"
                  variant="secondary"
                  onPress={onClose}
                >
                  Jatka taustalla
                </ControlButton>
              </>
            )}
          </>
        );
      else if (v.state === "device_code")
        body = (
          <>
            {steps}
            <DeviceCodeStep
              key={`${v.login_phase}:${v.user_code}`}
              view={v}
              onCancel={onClose}
            />
          </>
        );
      else if (v.state === "open_url")
        body = (
          <>
            {steps}
            <PasteStep
              view={v}
              error={stage.error}
              busy={stage.busy}
              onPaste={onPaste}
              onCancel={onClose}
            />
          </>
        );
      else if (v.state === "choose_folders")
        body = (
          <>
            {steps}
            <FolderStep
              view={v}
              provider={provider}
              busy={stage.busy}
              error={stage.error}
              onChoose={onFolders}
              onCancel={onClose}
            />
          </>
        );
      else if (v.state === "failed")
        body = <FailedStep view={v} onRestart={onRestart} onClose={onClose} />;
      else {
        const dir = v.relogin
          ? undefined
          : provider.services.some((s) => fileServices.includes(s));
        body = (
          <>
            <p
              data-testid="integration-connected"
              className="ig-result ok"
              role="status"
            >
              <Icon name="check" />
              <span>
                {v.relogin ? (
                  <>Kirjauduttu uudelleen. {v.address} toimii taas.</>
                ) : (
                  <>
                    <b>Yhdistetty: {v.address}.</b> Uudet keskustelut näkevät
                    sen heti.
                  </>
                )}
              </span>
            </p>
            {unavailableSites}
            {dir ? (
              <p className="ig-p">
                Jos valitsit pilvikansioita, niiden synkronointi jatkuu myös
                tämän sivun sulkemisen jälkeen.
              </p>
            ) : null}
            <div className="ig-row">
              <ControlButton
                data-testid="integration-done"
                size="page"
                variant="primary"
                onPress={onClose}
              >
                Valmis
              </ControlButton>
            </div>
          </>
        );
      }
      if (v.unavailable_sites?.length && v.state !== "completed")
        body = (
          <>
            {body}
            {unavailableSites}
          </>
        );
      break;
    }
  }
  return (
    <ModalOverlay
      className="ah-overlay"
      isOpen
      isDismissable={!activeLogin}
      isKeyboardDismissDisabled={activeLogin}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal className="ah-modal ig-dlg">
        <AriaDialog
          data-testid="integration-dialog"
          data-stage={stage.stage}
          className="ah-dialog"
          aria-label={title}
        >
          <div className="ig-dh">
            <ProviderMark provider={provider.id} small />
            <Heading
              slot="title"
              ref={heading}
              data-testid="integration-title"
              tabIndex={-1}
            >
              {title}
            </Heading>
            <ControlButton
              data-testid="dialog-close"
              size="row"
              variant="quiet"
              presentation="icon"
              aria-label="Sulje"
              onPress={onClose}
            >
              <Icon name="cross" />
            </ControlButton>
          </div>
          <div className="ig-flow">{body}</div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Removal: the tool's login goes; synced folders stay unless asked, and
 * then go to the Trash. The grant at the provider is not revoked. */
export function RemoveDialog({
  account,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  account?: Account;
  busy?: boolean;
  error?: string;
  onConfirm: (deleteDirectories: boolean) => void;
  onClose: () => void;
}) {
  const [trash, setTrash] = useState(false);
  if (!account) return null;
  const copy = providerCopy[account.provider];
  const dirs = account.services.filter((s) => s.directory);
  const tools = account.services.filter((s) => !s.directory);
  const lost = [
    tools.length
      ? `Agentit eivät enää pääse palveluihin ${tools.map((s) => serviceName(account.provider, s.id)).join(" ja ")}.`
      : "",
    dirs.length
      ? `Synkronointi pysähtyy, eivätkä muutokset enää kulje ${copy.ill}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <ModalOverlay
      className="ah-overlay"
      isOpen
      isDismissable
      onOpenChange={(open) => !open && onClose()}
    >
      <Modal className="ah-modal">
        <AriaDialog
          className="ah-dialog"
          role="alertdialog"
          aria-label={`Poistetaanko ${account.address}?`}
        >
          <Heading slot="title">
            Poistetaanko {copy.name}-tili {account.address}?
          </Heading>
          <p>
            {lost} Kirjautuminen poistetaan tältä palvelimelta.{" "}
            {["imap", "caldav", "carddav"].includes(account.provider)
              ? `Sovellussalasana pysyy voimassa ${account.provider === "imap" ? "postipalvelussasi" : "DAV-palvelussasi"}, kunnes poistat sen sieltä.`
              : `${copy.name} muistaa antamasi luvan, kunnes perut sen ${copy.name}-tilisi asetuksista.`}
          </p>
          {dirs.length ? (
            <Checkbox
              data-testid="integration-remove-files"
              label={`Siirrä myös ${dirs.length > 1 ? "kansiot" : "kansio"} ${dirs.map((d) => d.directory).join(", ")} roskakoriin.`}
              hint=" Voit palauttaa ne kohdasta Asetukset › Tallennustila. Muuten tiedostot jäävät kotihakemistoosi tavallisiksi tiedostoiksi."
              checked={trash}
              onChange={setTrash}
            />
          ) : null}
          {error ? <p role="alert">{error}</p> : null}
          <div className="ah-dialog-actions">
            <ControlButton
              data-testid="cancel"
              size="page"
              variant="secondary"
              autoFocus
              onPress={onClose}
            >
              Peruuta
            </ControlButton>
            <ControlButton
              data-testid="integration-remove-confirm"
              size="page"
              variant="danger"
              isPending={busy}
              onPress={() => onConfirm(trash)}
            >
              Poista
            </ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
