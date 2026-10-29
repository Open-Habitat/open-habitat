import { Fragment, type ReactNode, useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import type { Provider, ProviderId } from "../app/integrations";
import { providerOrder } from "../app/onboardingConfig";
import {
  type AppChange,
  type AppFields,
  type AppProvider,
  type AppSection,
  appErrors,
  appFields,
  appRefusal,
  type IntegrationApp,
  type IntegrationApps,
  invalidApp,
  isAppProvider,
  levelSections,
  sectionProvider,
  shortClientID,
} from "../app/serverIntegrations";
import { ControlButton, ExternalLink } from "./ControlElements";
import { Icon } from "./Icon";
import { levelName, ProviderMark, providerCopy } from "./Integrations";
import { Menu } from "./Overlays";
import { TextField } from "./Primitives";
import { Badge, StatusMark } from "./Status";
import "./ServerIntegrations.css";

// Asetukset › Palvelimen ylläpito › Palvelinintegraatiot (proto-server-integrations-
// setup, round 2 direction 2 "Käytössä vai ei", Google's round 3 direction 2
// "Vaiheittain", Microsoft's round 4 direction 1 "Tunnukset lopussa",
// Dropbox's round 5 direction 2 "Sivu kerrallaan").
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
// Scopes as the Cloud Console's scope list names them: the daemon requests
// the short `email`, which Google grants as userinfo.email. The read-only
// ones are the Vain luku level's (googleReadScopes in the daemon).
const googleScopes = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/contacts",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/contacts.readonly",
];
const googleRedirect = "http://localhost";
// Google Auth platform's pages. Each opens in the project last selected in
// the console, as the enable flow above does; the page names the project.
const googleAuth = "https://console.cloud.google.com/auth";
// What the daemon's Microsoft entry needs (internal/daemon/integrations/
// microsoft_linux.go): microsoftScopes and microsoftMCPScopes, deduplicated,
// all delegated Graph permissions, and the redirect microsoftConsent() names.
// The app is single tenant, so only the organisation's accounts sign in.
// A narrower level is its own application with the level's permissions
// (microsoftLevelScopes): the drafts level sends nothing, so everything but
// mail is read only.
const microsoftIdentity = ["openid", "profile", "User.Read", "offline_access"];
const microsoftPermissions: Record<
  "microsoft" | "microsoft_drafts" | "microsoft_read",
  string[]
> = {
  microsoft: [
    ...microsoftIdentity,
    "Files.ReadWrite.All",
    "Sites.ReadWrite.All",
    "Mail.ReadWrite",
    "Mail.Send",
    "Calendars.ReadWrite",
    "Contacts.ReadWrite",
  ],
  microsoft_drafts: [
    ...microsoftIdentity,
    "Files.Read.All",
    "Sites.Read.All",
    "Mail.ReadWrite",
    "Calendars.Read",
    "Contacts.Read",
  ],
  microsoft_read: [
    ...microsoftIdentity,
    "Files.Read.All",
    "Sites.Read.All",
    "Mail.Read",
    "Calendars.Read",
    "Contacts.Read",
  ],
};
const microsoftRedirect =
  "https://login.microsoftonline.com/common/oauth2/nativeclient";
// Entra admin center › App registrations. An app's own pages need its
// Application ID, which the guide only learns on its last step, so the
// steps after New registration open the list.
const entraAppRegistrations =
  "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade";
const entraNewRegistration =
  "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/CreateApplicationBlade/quickStartType~/null/isMSAApp~/false";
/** The admin-consent link for someone who has the role: filled from the
 * typed ids once both are well formed, a template until then. */
const microsoftConsent = (tenant?: string, client?: string) =>
  `https://login.microsoftonline.com/${tenant ?? "{Directory (tenant) ID}"}/adminconsent?client_id=${client ?? "{Application (client) ID}"}`;
// What the daemon's Dropbox entry needs (internal/daemon/integrations/
// dropbox_linux.go): dropboxScopes, all requested by name at sign-in, and
// dropboxRedirect, matched exactly. The full and read levels sync the root
// dropbox:, so their app needs Full Dropbox; the app folder level is a
// second app of the App folder type with the same scopes.
const dropboxScopes = [
  "account_info.read",
  "files.metadata.read",
  "files.metadata.write",
  "files.content.read",
  "files.content.write",
  "sharing.read",
  "sharing.write",
];
const dropboxRedirect = "http://localhost:53682/";
const dropboxCreate = "https://www.dropbox.com/developers/apps/create";
// My apps. An app's own page needs its App key, which the guide only learns
// on its last step.
const dropboxApps = "https://www.dropbox.com/developers/apps";
// The server cannot see how many people have connected nor the app's status,
// so the rule stays where an administrator returns to: the row's menu.
const dropboxLimit =
  "Kehitystila: kun 50 henkilöä on yhdistänyt, hae tuotantotilaa kahden viikon kuluessa.";
export const fixCommand =
  "sudo open-habitat host apply --site /etc/open-habitat/site.json";

const where: Record<AppProvider, string> = {
  google: "Google Cloud",
  microsoft: "Microsoft Entra",
  dropbox: "Dropbox App Console",
};
/** How the console names the first value, in the row's menu. */
const idName: Record<AppProvider, string> = {
  google: "client id",
  microsoft: "client id",
  dropbox: "app key",
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

function Mark({ p, s }: { p: ProviderId | AppSection; s: Status }) {
  const id = `si-status-${p}`;
  switch (s.kind) {
    case "ready":
      return (
        <StatusMark
          data-testid={id}
          kind="success"
          tone="success"
          // Offered to people, not the administrator's own account
          // (Jari 24.10.2026).
          label="Tarjolla"
        />
      );
    case "needs_app":
      return <StatusMark data-testid={id} tone="warning" label="Ei tarjolla" />;
    case "tool_missing":
      return (
        <StatusMark
          data-testid={id}
          kind="error"
          tone="danger"
          label={
            s.tools.length
              ? `Ei tarjolla · ${s.tools.join(", ")} puuttuu`
              : "Ei tarjolla · työkalu puuttuu"
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

/** What is wrong with root's existing section, in words that lead to
 * Aseta tunnukset…, which replaces it. */
function invalidText(app: IntegrationApp): string {
  switch (invalidApp(app)) {
    case "audience":
      return `kirjautujiksi on asetettu ${app.tenant_id}, mutta sovellus on nyt yhden organisaation. Anna organisaation Directory (tenant) ID.`;
    case "tenant":
      return "Directory (tenant) ID puuttuu tai on väärän muotoinen.";
    case "client":
      return "client id puuttuu tai on väärän muotoinen.";
    default:
      return "palvelimelle kirjoitetut arvot ovat väärän muotoiset.";
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
      {where[sectionProvider(app.provider)]}
      {app.client_id && (
        <>
          {` · ${idName[sectionProvider(app.provider)]} `}
          <code>{shortClientID(app.provider, app.client_id)}</code>
        </>
      )}
      {" · "}
      {by}
      {app.provider === "dropbox" && (
        <span className="si-menunote" data-testid="si-limit-note">
          {dropboxLimit}
        </span>
      )}
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
/** Where in the console, in the console's own (English) words, and a
 * direct link to that page. `pick` says what to choose when the link can
 * only open the list the page is under. */
const Path = ({
  p,
  href,
  pick,
}: {
  p: string;
  href?: string;
  pick?: ReactNode;
}) => (
  <div className="si-where">
    <p className="si-path">
      <Icon name="forward" />
      <span>{p}</span>
    </p>
    {href && (
      <p className="si-open">
        <ExternalLink
          href={href}
          target="_blank"
          rel="noreferrer"
          data-testid="si-console-link"
        >
          Avaa sivu <Icon name="external" />
        </ExternalLink>
        {pick && <span className="si-quiet">{pick}</span>}
      </p>
    )}
  </div>
);

function Modalish({
  testId,
  title,
  size,
  dismissable = true,
  onClose,
  children,
}: {
  testId: string;
  title: string;
  /** wide: a guide; split: a guide step beside its values. */
  size?: "wide" | "split";
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
      <Modal className={`ah-modal si-modal${size ? ` si-${size}` : ""}`}>
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

/** Who can do a step: the Entra role it needs, or whose account owns it. */
const Role = ({ children }: { children: ReactNode }) => (
  <p className="si-quiet si-role" data-testid="si-role">
    <Icon name="user" />
    <span>{children}</span>
  </p>
);

/** A guide step. The last one is also where the console's values are
 * typed: `console` names the side done there, `values` says where the
 * console shows them. */
type Step = {
  id: string;
  title: string;
  body: ReactNode;
  console?: string;
  values?: ReactNode;
};

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
          data-testid="si-console-link"
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
        <Path
          p="Google Auth platform › Branding › Get started"
          href={`${googleAuth}/branding`}
        />
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
        <Path
          p="Google Auth platform › Data Access › Add or Remove Scopes"
          href={`${googleAuth}/scopes`}
        />
        <div className="si-block" data-testid="si-scopes">
          <pre className="si-cmd">{googleScopes.join("\n")}</pre>
          <Copy value={googleScopes.join(",")} label="käyttöoikeudet" />
        </div>
      </>
    ),
  },
  {
    id: "client",
    title: "Asiakas ja tunnukset",
    console: "Google Cloudissa",
    body: (
      <>
        <Path
          p="Google Auth platform › Clients › Create Client"
          href={`${googleAuth}/clients/create`}
        />
        <Val k="Application type" v="Desktop app" copy={false} />
        <Val k="Name" v="Open Habitat" />
        <Val
          k="Use this client for an AI-powered agent"
          v="valittu"
          copy={false}
        />
        <p className="si-effect" data-testid="si-agent-client">
          Tätä asiakasta käyttävät vain agentit. Valinta ei anna lisäoikeuksia,
          mutta osa Googlen MCP-palveluista hyväksyy vain agentiksi merkityn
          asiakkaan.
        </p>
        <p className="si-quiet">
          Ei uudelleenohjausosoitetta. Palvelin käyttää osoitetta{" "}
          <code>{googleRedirect}</code>.
        </p>
        <p className="si-quiet">
          Valitse lopuksi <em>Create</em>.
        </p>
      </>
    ),
    values: (
      <p className="si-quiet">
        Google näyttää ikkunan <em>OAuth client created</em>:
      </p>
    ),
  },
];

const microsoftAppName: Record<keyof typeof microsoftPermissions, string> = {
  microsoft: "Open Habitat",
  microsoft_drafts: "Open Habitat – luonnokset",
  microsoft_read: "Open Habitat – vain luku",
};

/** An Entra page of the app registered on the first step. */
const EntraPath = ({ p, app }: { p: string; app: string }) => (
  <Path
    p={p}
    href={entraAppRegistrations}
    pick={
      <>
        Valitse sovellus <em>{app}</em>.
      </>
    }
  />
);

const microsoftSteps = (section: keyof typeof microsoftPermissions): Step[] => [
  {
    id: "register",
    title: "Rekisteröi sovellus",
    body: (
      <>
        <Path
          p="Entra ID › App registrations › New registration"
          href={entraNewRegistration}
        />
        <p className="si-quiet" data-testid="si-entra-search">
          Entran yläreunan hakukenttä vie oikealle sivulle: hae{" "}
          <em>App registrations</em> ja myöhemmin sovelluksen nimellä.
        </p>
        <Val k="Name" v={microsoftAppName[section]} />
        {section !== "microsoft" && (
          <p className="si-effect" data-testid="si-level-app">
            Oma sovellus tälle tasolle: Microsoft antaa jokaiselle sovelluksen
            tunnukselle kaikki sovellukselle hyväksytyt oikeudet, joten taso on
            raja vain omana sovelluksenaan.
          </p>
        )}
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
        <EntraPath
          p="Authentication › Settings"
          app={microsoftAppName[section]}
        />
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
        <EntraPath
          p="API permissions › Add a permission › Microsoft Graph › Delegated permissions"
          app={microsoftAppName[section]}
        />
        <div className="si-block" data-testid="si-permissions">
          <pre className="si-cmd">
            {microsoftPermissions[section].join("\n")}
          </pre>
          <Copy
            value={microsoftPermissions[section].join(" ")}
            label="käyttöoikeudet"
          />
        </div>
        <p className="si-quiet">
          User.Read on valmiina. Valitse lopuksi <em>Add permissions</em>.
        </p>
      </>
    ),
  },
  {
    id: "consent",
    title: "Hyväksyntä ja tunnukset",
    console: "Microsoft Entrassa",
    body: (
      <>
        <EntraPath
          p="API permissions › Grant admin consent for <organisaatio> › Yes"
          app={microsoftAppName[section]}
        />
        <p className="si-effect" data-testid="si-consent">
          Henkilöiltä ei kysytä hyväksyntää. Status-sarakkeessa lukee{" "}
          <em>Granted for &lt;organisaatio&gt;</em>.
        </p>
        <Role>
          Vaatii roolin Cloud Application Administrator, Application
          Administrator tai Privileged Role Administrator.
        </Role>
      </>
    ),
    values: (
      <>
        <p className="si-quiet">Sovelluksen Overview-sivulla:</p>
        <Path p="Overview" />
      </>
    ),
  },
];

/** A page of the app created on the first step. */
const dropboxPath = (p: string, tab: string) => (
  <Path
    p={p}
    href={dropboxApps}
    pick={
      <>
        Valitse sovellus ja välilehti <em>{tab}</em>.
      </>
    }
  />
);

// One App Console page per step. Käyttöoikeudet comes before Asetukset so
// the guide ends on the Settings page, which shows the App key and secret;
// Enable additional users sits there beside the redirect.
const dropboxSteps = (appFolder: boolean): Step[] => [
  {
    id: "create",
    title: "Luo sovellus",
    body: (
      <>
        <ExternalLink
          href={dropboxCreate}
          target="_blank"
          rel="noreferrer"
          data-testid="si-console-link"
        >
          Avaa Dropbox App Console <Icon name="external" />
        </ExternalLink>
        <Val k="Choose an API" v="Scoped access" copy={false} />
        <Val
          k="Choose the type of access you need"
          v={appFolder ? "App folder" : "Full Dropbox"}
          copy={false}
        />
        {appFolder ? (
          <p className="si-effect" data-testid="si-app-folder">
            Tällä tasolla henkilöt synkronoivat vain sovelluksen oman kansion
            (Apps/&lt;sovelluksen nimi&gt;). Muu Dropbox ei näy agenteille.
          </p>
        ) : (
          <p className="si-effect" data-testid="si-full-dropbox">
            Henkilöt synkronoivat koko Dropboxinsa, joten App folder ei riitä.
          </p>
        )}
        <Val
          k="Name your app"
          v={
            appFolder
              ? "Open Habitat <organisaatio> sovelluskansio"
              : "Open Habitat <organisaatio>"
          }
          copy={false}
        />
        <p className="si-quiet">
          Nimen on oltava yksilöllinen, eikä siinä saa olla sanaa Dropbox.
          Valitse <em>Create app</em>.
        </p>
        <Role>
          Sovellus kuuluu tilille, jolla luot sen. Käytä organisaation yhteistä
          Dropbox-tiliä.
        </Role>
      </>
    ),
  },
  {
    id: "permissions",
    title: "Käyttöoikeudet",
    body: (
      <>
        {dropboxPath("Permissions", "Permissions")}
        <div className="si-block" data-testid="si-permissions">
          <pre className="si-cmd">{dropboxScopes.join("\n")}</pre>
          <Copy value={dropboxScopes.join(" ")} label="käyttöoikeudet" />
        </div>
        <p className="si-quiet">
          account_info.read on valmiina. Löydät muut selaimen haulla (Ctrl+F tai
          ⌘F). Valitse lopuksi <em>Submit</em>.
        </p>
        <p className="si-quiet">
          Myöhempi muutos ei koske jo yhdistettyjä tilejä.
        </p>
      </>
    ),
  },
  {
    id: "settings",
    title: "Asetukset ja tunnukset",
    console: "Dropbox App Consolessa",
    body: (
      <>
        {dropboxPath("Settings › OAuth 2 › Redirect URIs", "Settings")}
        <Val k="Redirect URI" v={dropboxRedirect} />
        <p className="si-quiet">
          Valitse <em>Add</em>. Osoitteen on oltava täsmälleen tämä, kauttaviiva
          mukaan.
        </p>
        <Path p="Settings › Development users › Enable additional users" />
        <p className="si-effect" data-testid="si-additional-users">
          Uusi sovellus on kehitystilassa (Development), ja ilman tätä vain
          sovelluksen omistaja voi yhdistää.
        </p>
      </>
    ),
    values: (
      <>
        <p className="si-quiet">Samalla Settings-sivulla ylempänä:</p>
        <Path p="Settings › App key, App secret (Show)" />
      </>
    ),
  },
];

/** Where an existing app's values are, for Minulla on jo …. Google shows
 * an existing secret no more, so an existing client needs a new one. */
function existing(section: AppSection): ReactNode {
  switch (sectionProvider(section)) {
    case "google":
      return (
        <>
          <Path
            p="Google Auth platform › Clients › Open Habitat › Add secret"
            href={`${googleAuth}/clients`}
            pick={
              <>
                Valitse asiakas <em>Open Habitat</em>.
              </>
            }
          />
          <p className="si-quiet" data-testid="si-new-secret">
            Google ei näytä vanhaa salaisuutta uudelleen. Lisää asiakkaalle uusi
            ja kopioi se ikkunasta.
          </p>
        </>
      );
    case "dropbox":
      return dropboxPath("Settings › App key, App secret (Show)", "Settings");
    default:
      return (
        <EntraPath
          p="Overview"
          app={
            microsoftAppName[section as keyof typeof microsoftPermissions] ??
            microsoftAppName.microsoft
          }
        />
      );
  }
}

/** Each section's console steps, the last one beside its values. */
function guide(section: AppSection): Step[] {
  switch (section) {
    case "google":
      return googleSteps;
    case "dropbox":
    case "dropbox_app_folder":
      return dropboxSteps(section === "dropbox_app_folder");
    default:
      return microsoftSteps(section);
  }
}
/** The section's name as the administrator reads it. */
const sectionName = (section: AppSection) => {
  const provider = sectionProvider(section);
  const level = levelSections[provider]?.find(
    (l) => l.section === section,
  )?.level;
  return level
    ? `${name(provider)}, taso ${levelName(provider, level)}`
    : name(provider);
};
const skipLabel: Record<AppProvider, string> = {
  google: "Minulla on jo asiakas",
  microsoft: "Minulla on jo sovellus",
  dropbox: "Minulla on jo sovellus",
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

/** The consent link filled from the typed ids, to send to someone who has
 * the role; a template until both are well formed. */
function ConsentLink({
  section,
  values,
}: {
  section: AppSection;
  values: AppFields;
}) {
  const client = (values.client_id ?? "").trim();
  const tenant = (values.tenant_id ?? "").trim();
  const ok =
    Object.keys(appErrors(section, { client_id: client, tenant_id: tenant }))
      .length === 0;
  const url = ok ? microsoftConsent(tenant, client) : microsoftConsent();
  return (
    <div
      className="si-handoff"
      data-testid="si-consent-link"
      data-filled={ok || undefined}
    >
      <span className="si-quiet">
        Jos rooli puuttuu, lähetä linkki sille, jolla se on.
        {!ok && " Linkki täyttyy, kun arvot on liitetty."}
      </span>
      <div className="si-block">
        <pre className="si-cmd" data-template={!ok || undefined}>
          {url}
        </pre>
        {ok && <Copy value={url} label="hyväksyntälinkki" />}
      </div>
    </div>
  );
}

/** Aseta tunnukset… and Vaihda tunnukset…: one console step at a time, the
 * last beside its values (proto-google-wizard-secrets-step, direction
 * "Rinnakkain"). Minulla on jo … opens only the values. The dialog stays
 * open until the broker answers, so a refusal keeps what was typed. */
export function AppSetupDialog({
  provider: section,
  replace,
  step: initial = 0,
  skip: initialSkip = false,
  onSave,
  onClose,
}: {
  provider: AppSection;
  replace?: IntegrationApp;
  /** The step it opens at; stories show each one. */
  step?: number;
  /** Opens at Minulla on jo …; stories show it. */
  skip?: boolean;
  onSave: (fields: AppFields) => Promise<AppChange>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<AppFields>({});
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [refusal, setRefusal] = useState("");
  const [at, setAt] = useState(initial);
  const [skip, setSkip] = useState(initialSkip);
  const fixedID = replace?.client_id;
  const provider = sectionProvider(section);
  const enter: Step = {
    id: "enter",
    title: replace ? "Uusi salaisuus" : "Tunnukset",
    body: null,
    values: replace ? (
      <>
        <Path
          p="Google Auth platform › Clients › Open Habitat › Add secret"
          href={`${googleAuth}/clients/${encodeURIComponent(replace.client_id ?? "")}`}
        />
        <p className="si-quiet" data-testid="si-replace-effect">
          Yhdistetyt tilit käyttävät vanhaa salaisuutta, kunnes poistat sen
          Googlessa. Sen jälkeen niiden täytyy kirjautua uudelleen.
        </p>
      </>
    ) : (
      existing(section)
    ),
  };
  const steps = replace || skip ? [enter] : guide(section);
  const i = Math.min(at, steps.length - 1);
  const last = i === steps.length - 1;
  const step = steps[i];
  const split = last && step.body !== null;
  const submit = async () => {
    const [first, second] = appFields[provider];
    const fields = {
      [first]: (fixedID ?? values[first] ?? "").trim(),
      [second]: (values[second] ?? "").trim(),
    };
    const e = appErrors(section, fields);
    setErrors(e);
    setRefusal("");
    if (Object.keys(e).length) return;
    setSaving(true);
    const result = await onSave(fields);
    setSaving(false);
    if (result.kind === "refused") setRefusal(appRefusal(result.code));
    else onClose();
  };
  const entry = (
    <>
      {step.values}
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
      {provider === "google" && (
        <p className="si-warn" data-testid="si-secret-once">
          <Icon name="warning" />
          <span>
            Google näyttää salaisuuden vain tässä ikkunassa. Liitä se ennen kuin
            suljet ikkunan.
          </span>
        </p>
      )}
      {provider === "microsoft" && (
        <p className="si-quiet" data-testid="si-no-secret">
          Salaisuutta ei tarvita.
        </p>
      )}
      {split && provider === "microsoft" && (
        <ConsentLink section={section} values={values} />
      )}
      {refusal && (
        <p className="si-bad" role="alert" data-testid="si-refusal">
          <Icon name="warning" />
          {refusal}
        </p>
      )}
    </>
  );
  const title = `${sectionName(section)}: ${replace ? "vaihda tunnukset" : "aseta tunnukset"}`;
  return (
    <Modalish
      testId="si-setup-dialog"
      title={title}
      size={split ? "split" : steps.length > 1 || skip ? "wide" : undefined}
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
        {split ? (
          <div className="si-cols" data-testid="si-split">
            <div className="si-col">
              <p className="si-side">{step.console}</p>
              {step.body}
            </div>
            <div className="si-col si-get" data-testid="si-get">
              <p className="si-side">Tähän</p>
              {entry}
            </div>
          </div>
        ) : last ? (
          entry
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
            onPress={() => {
              setSkip(true);
              setErrors({});
            }}
          >
            {skipLabel[provider]}
          </ControlButton>
        )}
        <span className="si-grow" />
        {i > 0 || skip ? (
          <ControlButton
            data-testid="si-back"
            size="row"
            variant="secondary"
            isDisabled={saving}
            onPress={() => {
              setErrors({});
              setRefusal("");
              if (skip) {
                setSkip(false);
                setAt(0);
              } else setAt(i - 1);
            }}
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
  provider: section,
  step,
  onConfirm,
  onClose,
}: {
  provider: AppSection;
  step: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const provider = sectionProvider(section);
  if (section !== provider)
    return (
      <Modalish
        testId="si-remove-dialog"
        title={`Poistetaanko tason tunnukset (${sectionName(section)})?`}
        onClose={onClose}
      >
        <ul className="si-consequences">
          <li>Tasoa ei voi enää valita yhdistettäessä.</li>
          <li>Tällä tasolla yhdistetyt tilit eivät voi kirjautua uudelleen.</li>
        </ul>
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
  return (
    <Modalish
      testId="si-remove-dialog"
      title={`Poistetaanko ${name(provider)}-tunnukset?`}
      onClose={onClose}
    >
      <ul className="si-consequences">
        <li>Uusia tilejä ei voi yhdistää.</li>
        <li>Yhdistetyt tilit eivät voi kirjautua uudelleen.</li>
        {/* The daemon supervises sync only while the integration is usable. */}
        {provider === "dropbox" && (
          <li data-testid="si-sync-stops">
            Yhdistettyjen tilien synkronointi pysähtyy.
          </li>
        )}
        {step && <li>Käyttöönoton vaihe piilotetaan.</li>}
      </ul>
      {provider !== "google" && (
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
  | { kind: "setup"; provider: AppSection; replace?: IntegrationApp }
  | { kind: "remove"; provider: AppSection }
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
  pending?: Partial<Record<ProviderId | AppSection, PendingApp>>;
  /** A definite refusal of the last removal, shown on its row. */
  problem?: { provider: ProviderId | AppSection; text: string };
  /** GitHub logins of known actors, by id. */
  names?: Record<string, string>;
  canWrite?: boolean;
  onboardingHref: string;
  onOpenOnboarding?: () => void;
  onSave: (provider: AppSection, fields: AppFields) => Promise<AppChange>;
  onRemove: (provider: AppSection) => void;
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
      <p className="s-row s-desc" data-testid="si-connect-note">
        Tarjolla olevat palvelut jokainen yhdistää itse kohdassa Asetukset ›
        Tiedot agenteille.
      </p>
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
          // A provider's narrower levels are separate applications, offered
          // once the provider's tools are installed.
          const levels =
            isAppProvider(p) && (s.kind === "ready" || s.kind === "needs_app")
              ? (levelSections[p] ?? [])
              : [];
          return (
            <Fragment key={p}>
              <li
                className="si-row"
                data-testid={`si-row-${p}`}
                data-settings-row={`server-${p}`}
                tabIndex={-1}
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
                          hidden
                            ? "Käyttöönotossa · piilossa"
                            : "Käyttöönotossa"
                        }
                        tone={hidden ? "warning" : "neutral"}
                      />
                    </a>
                  )}
                  {app && !pending[p] && invalidApp(app) && (
                    <span className="si-bad" data-testid={`si-invalid-${p}`}>
                      <Icon name="warning" />
                      Tunnukset eivät kelpaa: {invalidText(app)}
                    </span>
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
                                        reason:
                                          "Asetus selaimesta pois käytöstä",
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
              {levels.map(({ section, level }) => {
                const levelApp = apps.apps.find((a) => a.provider === section);
                const ls: Status = pending[section]
                  ? { kind: pending[section] }
                  : levelApp?.usable
                    ? { kind: "ready" }
                    : { kind: "needs_app" };
                return (
                  <li
                    key={section}
                    className="si-row si-level"
                    data-testid={`si-row-${section}`}
                    data-status={ls.kind}
                  >
                    <span className="si-level-indent" aria-hidden="true" />
                    <span className="si-main">
                      <span className="si-name">
                        Taso: {levelName(p, level)}
                      </span>
                      {levelApp &&
                        !pending[section] &&
                        invalidApp(levelApp) && (
                          <span
                            className="si-bad"
                            data-testid={`si-invalid-${section}`}
                          >
                            <Icon name="warning" />
                            Tunnukset eivät kelpaa: {invalidText(levelApp)}
                          </span>
                        )}
                      {problem?.provider === section && !pending[section] && (
                        <span className="si-bad" role="alert">
                          <Icon name="warning" />
                          {problem.text}
                        </span>
                      )}
                    </span>
                    <span className="si-state">
                      {ls.kind === "needs_app" ? (
                        // A level is optional: without its application
                        // people see it greyed out, not the provider gone.
                        <StatusMark
                          data-testid={`si-status-${section}`}
                          label="Ei käytössä"
                        />
                      ) : (
                        <Mark p={section} s={ls} />
                      )}
                    </span>
                    <span className="si-act">
                      {ls.kind === "uncertain" ? (
                        <ControlButton
                          data-testid={`si-refresh-${section}`}
                          size="row"
                          variant="secondary"
                          onPress={onRefresh}
                        >
                          <Icon name="refresh" />
                          Päivitä
                        </ControlButton>
                      ) : levelApp ? (
                        <span data-testid={`si-menu-${section}`}>
                          <Menu
                            label={`${sectionName(section)}: tunnukset`}
                            trigger={<span>Tunnukset</span>}
                            placement="bottom end"
                            heading={<AppLine app={levelApp} names={names} />}
                            items={[
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
                            onAction={() =>
                              setOpen({ kind: "remove", provider: section })
                            }
                          />
                        </span>
                      ) : ls.kind === "needs_app" ? (
                        <ControlButton
                          data-testid={`si-setup-${section}`}
                          size="row"
                          variant="secondary"
                          isDisabled={locked}
                          onPress={() =>
                            setOpen({ kind: "setup", provider: section })
                          }
                        >
                          Aseta tunnukset…
                        </ControlButton>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </Fragment>
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
          step={(steps as string[]).includes(open.provider)}
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
