import { type ReactNode, useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import type { Provider, ProviderId } from "../app/integrations";
import { providerOrder } from "../app/onboardingConfig";
import {
  type AppChange,
  type AppFields,
  type AppProvider,
  appErrors,
  appFields,
  appRefusal,
  type IntegrationApp,
  type IntegrationApps,
  isAppProvider,
  shortClientID,
} from "../app/serverIntegrations";
import { ControlButton, ExternalLink } from "./ControlElements";
import { Icon } from "./Icon";
import { ProviderMark, providerCopy } from "./Integrations";
import { Menu } from "./Overlays";
import { TextField } from "./Primitives";
import { Badge, StatusMark } from "./Status";
import "./ServerIntegrations.css";

// Asetukset › Palvelimen ylläpito › Integraatiot (proto-server-integrations-
// setup, round 2 direction 2 "Käytössä vai ei", Google's round 3 direction 2
// "Vaiheittain", Microsoft's round 4 direction 1 "Tunnukset lopussa").
// Whether a provider is in use is the administrator's own daemon's catalog;
// the app credentials and who set them are the broker's. A change shows as
// waiting until the broker's reply, and as uncertain when no definite reply
// came.

/** A change sent and not yet settled by the host. */
export type PendingApp = "set" | "clear" | "uncertain";

// What the daemon's Google entry needs (internal/daemon/integrations/
// google_linux.go): the APIs its tools call, its scopes and its redirect.
const googleAPIs: [string, string][] = [
  ["Gmail API", "gmail.googleapis.com"],
  ["Google Calendar API", "calendar-json.googleapis.com"],
  ["Google Drive API", "drive.googleapis.com"],
  ["People API", "people.googleapis.com"],
];
const googleEnable = `https://console.cloud.google.com/apis/enableflow?apiid=${googleAPIs.map((a) => a[1]).join(",")}`;
const googleScopes = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/contacts",
];
const googleRedirect = "http://localhost";
// What the daemon's Microsoft entry needs (internal/daemon/integrations/
// microsoft_linux.go): microsoftScopes and microsoftMCPScopes, deduplicated,
// all delegated Graph permissions, and the redirect microsoftConsent() names.
// The app is single tenant, so only the organisation's accounts sign in.
const microsoftPermissions = [
  "openid",
  "profile",
  "User.Read",
  "offline_access",
  "Files.ReadWrite.All",
  "Sites.ReadWrite.All",
  "Mail.ReadWrite",
  "Mail.Send",
  "Calendars.ReadWrite",
  "Contacts.ReadWrite",
];
const microsoftRedirect =
  "https://login.microsoftonline.com/common/oauth2/nativeclient";
// Entra admin center › App registrations, where New registration starts.
export const entraAppRegistrations =
  "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade";
// The values come in the last step, so the link for an administrator who
// can consent is shown as a template.
const microsoftConsent =
  "https://login.microsoftonline.com/{Directory (tenant) ID}/adminconsent?client_id={Application (client) ID}";
export const fixCommand =
  "sudo open-habitat host apply --site /etc/open-habitat/site.json";

const where: Record<AppProvider, string> = {
  google: "Google Cloud",
  microsoft: "Microsoft Entra",
  dropbox: "Dropbox App Console",
};
const labels: Record<AppProvider, [string, string]> = {
  google: ["Client ID", "Client secret"],
  microsoft: ["Application (client) ID", "Directory (tenant) ID"],
  dropbox: ["App key", "App secret"],
};
const name = (p: ProviderId) => providerCopy[p].name;

type Status =
  | { kind: "ready" | "needs_app" | "unknown" | "set" | "clear" | "uncertain" }
  | { kind: "tool_missing"; tools: string[] };

function statusOf(
  p: ProviderId,
  catalog?: Provider,
  pending?: PendingApp,
): Status {
  if (pending) return { kind: pending };
  if (!catalog) return { kind: "unknown" };
  if (catalog.available) return { kind: "ready" };
  if (
    catalog.unavailable_reason === "app_credentials_required" &&
    isAppProvider(p)
  )
    return { kind: "needs_app" };
  return { kind: "tool_missing", tools: catalog.missing_tools ?? [] };
}

function Mark({ p, s }: { p: ProviderId; s: Status }) {
  const id = `si-status-${p}`;
  switch (s.kind) {
    case "ready":
      return (
        <StatusMark
          data-testid={id}
          kind="success"
          tone="success"
          label="Käytössä"
        />
      );
    case "needs_app":
      return <StatusMark data-testid={id} tone="warning" label="Ei käytössä" />;
    case "tool_missing":
      return (
        <StatusMark
          data-testid={id}
          kind="error"
          tone="danger"
          label={
            s.tools.length
              ? `Ei käytössä · ${s.tools.join(", ")} puuttuu`
              : "Ei käytössä · työkalu puuttuu"
          }
        />
      );
    case "set":
    case "clear":
      return (
        <StatusMark
          data-testid={id}
          tone="info"
          animated="running"
          label="Odottaa palvelinta"
        />
      );
    case "uncertain":
      return (
        <StatusMark data-testid={id} tone="warning" label="Tila epävarma" />
      );
    default:
      return (
        <StatusMark data-testid={id} kind="unknown" label="Tila ei tiedossa" />
      );
  }
}

const day = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
};

/** Who set the credentials and when, as the broker recorded it. */
function AppLine({
  app,
  names,
}: {
  app: IntegrationApp;
  names: Record<string, string>;
}) {
  const by =
    app.source === "operator"
      ? "asetettu palvelimella"
      : app.actor === "root"
        ? `asetettu palvelimella ${day(app.at)}`
        : `${day(app.at)} · ${names[app.actor ?? ""] ? `@${names[app.actor ?? ""]}` : `GitHub-id ${app.actor}`}`;
  return (
    <span className="si-app" data-testid={`si-app-${app.provider}`}>
      {where[app.provider]}
      {app.client_id && (
        <>
          {" · client id "}
          <code>{shortClientID(app.provider, app.client_id)}</code>
        </>
      )}
      {" · "}
      {by}
    </span>
  );
}

function Copy({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <ControlButton
      data-testid="si-copy"
      size="row"
      variant="quiet"
      aria-label={`Kopioi ${label}`}
      onPress={() => {
        void navigator.clipboard?.writeText(value).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
    >
      <Icon name={done ? "check" : "copy"} />
    </ControlButton>
  );
}

/** A value the administrator types into the provider's console. */
const Val = ({
  k,
  v,
  copy = true,
}: {
  k: string;
  v: string;
  copy?: boolean;
}) => (
  <div className="si-val">
    <span className="si-k">{k}</span>
    <code>{v}</code>
    {copy && <Copy value={v} label={k} />}
  </div>
);
/** Where in the console, in the console's own (English) words. */
const Path = ({ p }: { p: string }) => (
  <p className="si-path">
    <Icon name="forward" />
    <span>{p}</span>
  </p>
);

function Modalish({
  testId,
  title,
  wide,
  dismissable = true,
  onClose,
  children,
}: {
  testId: string;
  title: string;
  wide?: boolean;
  dismissable?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <ModalOverlay
      className="ah-overlay"
      isOpen
      isDismissable={dismissable}
      onOpenChange={(open) => !open && onClose()}
    >
      <Modal className={`ah-modal si-modal${wide ? " si-wide" : ""}`}>
        <Dialog
          className="ah-dialog si-dialog"
          data-testid={testId}
          aria-label={title}
        >
          <Heading slot="title">{title}</Heading>
          {children}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** The Entra role a step needs. */
const Role = ({ children }: { children: ReactNode }) => (
  <p className="si-quiet si-role" data-testid="si-role">
    <Icon name="user" />
    <span>{children}</span>
  </p>
);

type Step = { id: string; title: string; body: ReactNode };

const googleSteps: Step[] = [
  {
    id: "apis",
    title: "API:t",
    body: (
      <>
        <p>Valitse organisaation Google Cloud -projekti ja ota käyttöön:</p>
        <ul className="si-list">
          {googleAPIs.map(([n]) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <ExternalLink
          href={googleEnable}
          target="_blank"
          rel="noreferrer"
          data-testid="si-enable-link"
        >
          Ota käyttöön Google Cloudissa <Icon name="external" />
        </ExternalLink>
      </>
    ),
  },
  {
    id: "audience",
    title: "Kohdeyleisö",
    body: (
      <>
        <Path p="Google Auth platform › Branding › Get started" />
        <Val k="App name" v="Open Habitat" />
        <Val k="Audience" v="Internal" copy={false} />
        <p className="si-effect" data-testid="si-audience">
          Internal edellyttää Google Workspacea. Vain organisaation tilit voivat
          yhdistää, eikä Googlen vahvistusta tarvita.
        </p>
      </>
    ),
  },
  {
    id: "scopes",
    title: "Käyttöoikeudet",
    body: (
      <>
        <Path p="Google Auth platform › Data Access › Add or Remove Scopes" />
        <div className="si-block" data-testid="si-scopes">
          <pre className="si-cmd">{googleScopes.join("\n")}</pre>
          <Copy value={googleScopes.join(",")} label="käyttöoikeudet" />
        </div>
      </>
    ),
  },
  {
    id: "client",
    title: "OAuth-asiakas",
    body: (
      <>
        <Path p="Google Auth platform › Clients › Create Client" />
        <Val k="Application type" v="Desktop app" copy={false} />
        <Val k="Name" v="Open Habitat" />
        <p className="si-quiet">
          Ei uudelleenohjausosoitetta. Palvelin käyttää osoitetta{" "}
          <code>{googleRedirect}</code>.
        </p>
        <p className="si-warn">
          <Icon name="warning" />
          <span>
            Kopioi Client secret heti: Google näyttää sen vain kerran.
          </span>
        </p>
      </>
    ),
  },
];

const microsoftSteps: Step[] = [
  {
    id: "register",
    title: "Rekisteröi sovellus",
    body: (
      <>
        <ExternalLink
          href={entraAppRegistrations}
          target="_blank"
          rel="noreferrer"
          data-testid="si-entra-link"
        >
          Avaa Microsoft Entra <Icon name="external" />
        </ExternalLink>
        <p className="si-quiet" data-testid="si-entra-search">
          Entran yläreunan hakukenttä vie oikealle sivulle: hae{" "}
          <em>App registrations</em> ja myöhemmin sovelluksen nimellä.
        </p>
        <Path p="Entra ID › App registrations › New registration" />
        <Val k="Name" v="Open Habitat" />
        <Val
          k="Supported account types"
          v="Single tenant only - <organisaatio>"
          copy={false}
        />
        <p className="si-effect" data-testid="si-single-tenant">
          Vain organisaation työtilit. Henkilökohtaiset Microsoft-tilit eivät
          voi yhdistää.
        </p>
        <p className="si-quiet">
          Jätä Redirect URI tyhjäksi ja valitse <em>Register</em>.
        </p>
        <Role>Vaatii vähintään roolin Application Developer.</Role>
      </>
    ),
  },
  {
    id: "public",
    title: "Julkinen asiakas",
    body: (
      <>
        <Path p="Authentication › Settings" />
        <Val k="Allow public client flows" v="Enabled" copy={false} />
        <p className="si-quiet">
          Valitse <em>Save</em>. Henkilöt kirjautuvat laitekoodilla, joten
          client secretiä ei luoda.
        </p>
        <Path p="Authentication › Redirect URI configuration › Add Redirect URI › Mobile and desktop applications" />
        <Val k="Redirect URI" v={microsoftRedirect} />
      </>
    ),
  },
  {
    id: "permissions",
    title: "Käyttöoikeudet",
    body: (
      <>
        <Path p="API permissions › Add a permission › Microsoft Graph › Delegated permissions" />
        <div className="si-block" data-testid="si-permissions">
          <pre className="si-cmd">{microsoftPermissions.join("\n")}</pre>
          <Copy value={microsoftPermissions.join(" ")} label="käyttöoikeudet" />
        </div>
        <p className="si-quiet">
          User.Read on valmiina. Valitse lopuksi <em>Add permissions</em>.
        </p>
      </>
    ),
  },
  {
    id: "consent",
    title: "Hyväksyntä",
    body: (
      <>
        <Path p="API permissions › Grant admin consent for <organisaatio> › Yes" />
        <p className="si-effect" data-testid="si-consent">
          Henkilöiltä ei kysytä hyväksyntää. Status-sarakkeessa lukee{" "}
          <em>Granted for &lt;organisaatio&gt;</em>.
        </p>
        <Role>
          Vaatii roolin Cloud Application Administrator, Application
          Administrator tai Privileged Role Administrator.
        </Role>
        <div className="si-handoff" data-testid="si-consent-link">
          <span className="si-quiet">
            Jos rooli puuttuu, lähetä linkki sille, jolla se on. Arvot ovat
            sovelluksen Overview-sivulla.
          </span>
          <pre className="si-cmd">{microsoftConsent}</pre>
        </div>
      </>
    ),
  },
];

/** Each guided provider's console steps before its values. */
const guides: Partial<Record<AppProvider, Step[]>> = {
  google: googleSteps,
  microsoft: microsoftSteps,
};
const skipLabel: Partial<Record<AppProvider, string>> = {
  google: "Minulla on jo asiakas",
  microsoft: "Minulla on jo sovellus",
};

/** The provider's two fields; a replace keeps the client id and asks only
 * for the new secret. */
function Fields({
  provider,
  values,
  errors,
  fixedID,
  onChange,
}: {
  provider: AppProvider;
  values: AppFields;
  errors: Partial<Record<string, string>>;
  fixedID?: string;
  onChange: (field: string, value: string) => void;
}) {
  const [first, second] = appFields[provider];
  const [firstLabel, secondLabel] = labels[provider];
  const secret = second === "client_secret";
  return (
    <div className="si-fields">
      {fixedID ? (
        <Val k={firstLabel} v={fixedID} copy={false} />
      ) : (
        <TextField
          data-testid={`si-field-${first}`}
          label={firstLabel}
          mono
          value={values[first] ?? ""}
          onChange={(v) => onChange(first, v)}
          error={errors[first]}
          hint={
            provider === "google" ? "…apps.googleusercontent.com" : undefined
          }
        />
      )}
      {secret ? (
        <label className="s-field si-secret">
          <span>{secondLabel}</span>
          <input
            type="password"
            data-testid={`si-field-${second}`}
            name={`${provider}-${second}`}
            autoComplete="new-password"
            value={values[second] ?? ""}
            maxLength={256}
            aria-invalid={errors[second] ? true : undefined}
            onChange={(e) => onChange(second, e.target.value)}
          />
          {errors[second] && (
            <span className="si-err" role="alert">
              {errors[second]}
            </span>
          )}
        </label>
      ) : (
        <TextField
          data-testid={`si-field-${second}`}
          label={secondLabel}
          mono
          value={values[second] ?? ""}
          onChange={(v) => onChange(second, v)}
          error={errors[second]}
        />
      )}
    </div>
  );
}

/** Aseta tunnukset… and Vaihda tunnukset…: one step at a time for Google
 * and Microsoft, the values last; Dropbox takes its two values without a
 * guide until its own setup lands. The dialog stays open until the broker answers, so a
 * refusal keeps what was typed. */
export function AppSetupDialog({
  provider,
  replace,
  step: initial = 0,
  onSave,
  onClose,
}: {
  provider: AppProvider;
  replace?: IntegrationApp;
  /** The step it opens at; stories show each one. */
  step?: number;
  onSave: (fields: AppFields) => Promise<AppChange>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<AppFields>({});
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [refusal, setRefusal] = useState("");
  const [at, setAt] = useState(initial);
  const fixedID = replace?.client_id;
  const enter: Step = {
    id: "enter",
    title: replace ? "Uusi salaisuus" : "Tunnukset",
    body: null,
  };
  const guide = replace ? undefined : guides[provider];
  const steps = guide ? [...guide, enter] : [enter];
  const i = Math.min(at, steps.length - 1);
  const last = i === steps.length - 1;
  const step = steps[i];
  const submit = async () => {
    const [first, second] = appFields[provider];
    const fields = {
      [first]: (fixedID ?? values[first] ?? "").trim(),
      [second]: (values[second] ?? "").trim(),
    };
    const e = appErrors(provider, fields);
    setErrors(e);
    setRefusal("");
    if (Object.keys(e).length) return;
    setSaving(true);
    const result = await onSave(fields);
    setSaving(false);
    if (result.kind === "refused") setRefusal(appRefusal(result.code));
    else onClose();
  };
  const title = `${name(provider)}: ${replace ? "vaihda tunnukset" : "aseta tunnukset"}`;
  return (
    <Modalish
      testId="si-setup-dialog"
      title={title}
      wide={steps.length > 1}
      dismissable={!saving}
      onClose={onClose}
    >
      {steps.length > 1 && (
        <>
          <div
            className="si-progress"
            data-testid="si-progress"
            role="img"
            aria-label={`Vaihe ${i + 1}/${steps.length}`}
          >
            {steps.map((s, j) => (
              <span
                key={s.id}
                data-done={j < i || undefined}
                data-current={j === i || undefined}
              />
            ))}
          </div>
          <p
            className="si-stepname"
            data-testid="si-stepname"
            data-step={step.id}
          >
            <span className="si-muted">
              {i + 1}/{steps.length}
            </span>{" "}
            {step.title}
          </p>
        </>
      )}
      <div className="si-stepbody" data-testid={`si-step-${step.id}`}>
        {last ? (
          <>
            {replace ? (
              <>
                <Path p="Google Auth platform › Clients › Open Habitat › Add secret" />
                <p className="si-quiet" data-testid="si-replace-effect">
                  Yhdistetyt tilit käyttävät vanhaa salaisuutta, kunnes poistat
                  sen Googlessa. Sen jälkeen niiden täytyy kirjautua uudelleen.
                </p>
              </>
            ) : provider === "microsoft" ? (
              <Path p="Overview" />
            ) : provider !== "google" ? (
              <p className="si-quiet">
                Arvot löytyvät palvelusta {where[provider]}.
              </p>
            ) : null}
            <Fields
              provider={provider}
              values={values}
              errors={errors}
              fixedID={fixedID}
              onChange={(f, v) => {
                setValues((x) => ({ ...x, [f]: v }));
                setErrors((x) => ({ ...x, [f]: undefined }));
              }}
            />
            {provider === "microsoft" && (
              <p className="si-quiet" data-testid="si-no-secret">
                Salaisuutta ei tarvita.
              </p>
            )}
            {refusal && (
              <p className="si-bad" role="alert" data-testid="si-refusal">
                <Icon name="warning" />
                {refusal}
              </p>
            )}
          </>
        ) : (
          step.body
        )}
      </div>
      <div className="si-foot">
        {i === 0 && !last && (
          <ControlButton
            data-testid="si-skip"
            size="row"
            variant="quiet"
            onPress={() => setAt(steps.length - 1)}
          >
            {skipLabel[provider]}
          </ControlButton>
        )}
        <span className="si-grow" />
        {i > 0 ? (
          <ControlButton
            data-testid="si-back"
            size="row"
            variant="secondary"
            isDisabled={saving}
            onPress={() => setAt(i - 1)}
          >
            Takaisin
          </ControlButton>
        ) : (
          <ControlButton
            size="row"
            variant="secondary"
            isDisabled={saving}
            onPress={onClose}
          >
            Peruuta
          </ControlButton>
        )}
        {last ? (
          <ControlButton
            data-testid="si-save"
            size="page"
            variant="primary"
            isDisabled={saving}
            onPress={() => void submit()}
          >
            {saving ? "Odottaa palvelinta…" : "Tallenna"}
          </ControlButton>
        ) : (
          <ControlButton
            data-testid="si-next"
            size="page"
            variant="primary"
            onPress={() => setAt(i + 1)}
          >
            Seuraava
          </ControlButton>
        )}
      </div>
    </Modalish>
  );
}

function RemoveDialog({
  provider,
  step,
  onConfirm,
  onClose,
}: {
  provider: AppProvider;
  step: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modalish
      testId="si-remove-dialog"
      title={`Poistetaanko ${name(provider)}-tunnukset?`}
      onClose={onClose}
    >
      <ul className="si-consequences">
        <li>Uusia tilejä ei voi yhdistää.</li>
        <li>Yhdistetyt tilit eivät voi kirjautua uudelleen.</li>
        {step && <li>Käyttöönoton vaihe piilotetaan.</li>}
      </ul>
      {provider === "microsoft" && (
        <p className="si-quiet" data-testid="si-remove-other">
          Toisen sovelluksen voi asettaa poiston jälkeen.
        </p>
      )}
      <div className="si-foot">
        <span className="si-grow" />
        <ControlButton size="row" variant="secondary" onPress={onClose}>
          Peruuta
        </ControlButton>
        <ControlButton
          data-testid="si-remove-confirm"
          size="page"
          variant="danger"
          onPress={() => {
            onConfirm();
            onClose();
          }}
        >
          Poista tunnukset
        </ControlButton>
      </div>
    </Modalish>
  );
}

function FixDialog({
  provider,
  tools,
  onClose,
}: {
  provider: ProviderId;
  tools: string[];
  onClose: () => void;
}) {
  return (
    <Modalish
      testId="si-fix-dialog"
      title={`${name(provider)}: ${tools.length ? tools.join(", ") : "työkalu"} puuttuu`}
      onClose={onClose}
    >
      <p>Aja palvelimella:</p>
      <div className="si-block" data-testid="si-fix-command">
        <pre className="si-cmd">{fixCommand}</pre>
        <Copy value={fixCommand} label="komento" />
      </div>
      <div className="si-foot">
        <span className="si-grow" />
        <ControlButton size="page" variant="primary" onPress={onClose}>
          Sulje
        </ControlButton>
      </div>
    </Modalish>
  );
}

type Open =
  | { kind: "setup"; provider: AppProvider; replace?: IntegrationApp }
  | { kind: "remove"; provider: AppProvider }
  | { kind: "fix"; provider: ProviderId; tools: string[] };

export function ServerIntegrations({
  providers,
  apps,
  steps = [],
  pending = {},
  problem,
  names = {},
  canWrite = true,
  onboardingHref,
  onOpenOnboarding,
  onSave,
  onRemove,
  onRefresh,
}: {
  /** The administrator's own catalog; undefined when it could not be read. */
  providers?: Provider[];
  apps: IntegrationApps;
  /** Providers the site's onboarding has an integration step for. */
  steps?: ProviderId[];
  pending?: Partial<Record<ProviderId, PendingApp>>;
  /** A definite refusal of the last removal, shown on its row. */
  problem?: { provider: ProviderId; text: string };
  /** GitHub logins of known actors, by id. */
  names?: Record<string, string>;
  canWrite?: boolean;
  onboardingHref: string;
  onOpenOnboarding?: () => void;
  onSave: (provider: AppProvider, fields: AppFields) => Promise<AppChange>;
  onRemove: (provider: AppProvider) => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState<Open>();
  const locked = !canWrite || !apps.browser_setup;
  return (
    <div
      className="si"
      data-testid="server-integrations"
      data-browser-setup={apps.browser_setup}
    >
      {!apps.browser_setup && (
        <p className="s-row si-note" data-testid="si-setup-off">
          <Icon name="info" />
          Tunnusten asetus selaimesta on poissa käytöstä palvelimen asetuksissa.
        </p>
      )}
      <ul className="si-rows" data-testid="si-rows">
        {providerOrder.map((p) => {
          const catalog = providers?.find((x) => x.id === p);
          const s = statusOf(p, catalog, pending[p]);
          const app = isAppProvider(p)
            ? apps.apps.find((a) => a.provider === p)
            : undefined;
          const step = steps.includes(p);
          const hidden = s.kind !== "ready";
          return (
            <li
              key={p}
              className="si-row"
              data-testid={`si-row-${p}`}
              data-status={s.kind}
            >
              <ProviderMark provider={p} small />
              <span className="si-main">
                <span className="si-name">{name(p)}</span>
                {step && (
                  <a
                    className="si-step"
                    data-testid={`si-step-${p}`}
                    data-hidden={hidden || undefined}
                    href={onboardingHref}
                    aria-label={`Käyttöönotto: ${name(p)}-vaihe${hidden ? ", piilossa" : ""}`}
                    onClick={(e) => {
                      if (
                        !onOpenOnboarding ||
                        e.button ||
                        e.metaKey ||
                        e.ctrlKey ||
                        e.shiftKey ||
                        e.altKey
                      )
                        return;
                      e.preventDefault();
                      onOpenOnboarding();
                    }}
                  >
                    <Badge
                      label={
                        hidden ? "Käyttöönotossa · piilossa" : "Käyttöönotossa"
                      }
                      tone={hidden ? "warning" : "neutral"}
                    />
                  </a>
                )}
                {problem?.provider === p && !pending[p] && (
                  <span className="si-bad" role="alert">
                    <Icon name="warning" />
                    {problem.text}
                  </span>
                )}
              </span>
              <span className="si-state">
                <Mark p={p} s={s} />
              </span>
              <span className="si-act">
                {s.kind === "uncertain" ? (
                  <ControlButton
                    data-testid={`si-refresh-${p}`}
                    size="row"
                    variant="secondary"
                    onPress={onRefresh}
                  >
                    <Icon name="refresh" />
                    Päivitä
                  </ControlButton>
                ) : s.kind === "tool_missing" ? (
                  <ControlButton
                    data-testid={`si-fix-${p}`}
                    size="row"
                    variant="secondary"
                    onPress={() =>
                      setOpen({ kind: "fix", provider: p, tools: s.tools })
                    }
                  >
                    Korjaa…
                  </ControlButton>
                ) : s.kind === "needs_app" && isAppProvider(p) ? (
                  <ControlButton
                    data-testid={`si-setup-${p}`}
                    size="row"
                    variant="secondary"
                    isDisabled={locked}
                    onPress={() => setOpen({ kind: "setup", provider: p })}
                  >
                    Aseta tunnukset…
                  </ControlButton>
                ) : s.kind === "ready" && app && isAppProvider(p) ? (
                  <span data-testid={`si-menu-${p}`}>
                    <Menu
                      label={`${name(p)}: tunnukset`}
                      trigger={<span>Tunnukset</span>}
                      placement="bottom end"
                      heading={<AppLine app={app} names={names} />}
                      items={[
                        ...(p === "google" && app.client_id
                          ? [
                              {
                                id: "replace",
                                label: "Vaihda tunnukset…",
                                availability: locked
                                  ? {
                                      state: "disabled" as const,
                                      reason: "Asetus selaimesta pois käytöstä",
                                    }
                                  : undefined,
                              },
                            ]
                          : []),
                        {
                          id: "remove",
                          label: "Poista tunnukset…",
                          danger: true,
                          availability: locked
                            ? {
                                state: "disabled" as const,
                                reason: "Asetus selaimesta pois käytöstä",
                              }
                            : undefined,
                        },
                      ]}
                      onAction={(k) =>
                        setOpen(
                          k === "replace"
                            ? { kind: "setup", provider: p, replace: app }
                            : { kind: "remove", provider: p },
                        )
                      }
                    />
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      {open?.kind === "setup" && (
        <AppSetupDialog
          provider={open.provider}
          replace={open.replace}
          onSave={(fields) => onSave(open.provider, fields)}
          onClose={() => setOpen(undefined)}
        />
      )}
      {open?.kind === "remove" && (
        <RemoveDialog
          provider={open.provider}
          step={steps.includes(open.provider)}
          onConfirm={() => onRemove(open.provider)}
          onClose={() => setOpen(undefined)}
        />
      )}
      {open?.kind === "fix" && (
        <FixDialog
          provider={open.provider}
          tools={open.tools}
          onClose={() => setOpen(undefined)}
        />
      )}
    </div>
  );
}
