import { Fragment, type ReactNode, useState } from "react";
import type { Provider, ProviderId } from "../app/integrations";
import { adminOrganisations } from "../app/microsoftOrganisations";
import { providerOrder } from "../app/onboardingConfig";
import {
  type AnySection,
  type AppChange,
  type AppFields,
  type AppProvider,
  type AppSection,
  appErrors,
  appFields,
  appRefusal,
  googleProject,
  type IntegrationApp,
  type IntegrationApps,
  invalidApp,
  isAppProvider,
  levelSections,
  sectionProvider,
  shortClientID,
} from "../app/serverIntegrations";
import { ControlButton, ExternalLink } from "./ControlElements";
import {
  type Audience,
  AudienceChoice,
  afterSaveSteps,
  apisPersonal,
  audienceMenuLabel,
  audienceStepTitle,
  brandStep,
  GoogleAudienceDialog,
  googleAuth,
  ownProjectNote,
  publishStep,
  ReadSteps,
  restrictedNote,
} from "./GoogleGuide";
import {
  Copy,
  Modalish,
  Path,
  Progress,
  Role,
  type Step,
  Val,
} from "./GuideParts";
import { Icon } from "./Icon";
import { levelName, ProviderMark, providerCopy } from "./Integrations";
import {
  LevelsDisclosure,
  LevelTable,
  MicrosoftLevelsDialog,
  msLevels,
  type TableProvider,
} from "./MicrosoftLevels";
import {
  MicrosoftOrganisationsDialog,
  organisationName,
} from "./MicrosoftOrganisations";
import { Menu } from "./Overlays";
import { TextField } from "./Primitives";
import {
  PeopleList,
  PeopleRow,
  SectionCard,
  SectionLead,
} from "./ServerSection";
import { Badge, StatusMark } from "./Status";
import "./ServerIntegrations.css";
import { formatDate, liveText } from "../i18n";
import { microsoftLevelsText } from "../text/microsoftLevels";
import { microsoftOrganisationsText } from "../text/microsoftOrganisations";
import { serverIntegrationsText } from "../text/serverIntegrations";

const txt = liveText(serverIntegrationsText);
const levelsTxt = liveText(microsoftLevelsText);
const orgsTxt = liveText(microsoftOrganisationsText);

// Asetukset › Palvelimen ylläpito › Palvelinintegraatiot (proto-server-integrations-
// setup, round 2 direction 2 "Käytössä vai ei", Google's round 3 direction 2
// "Vaiheittain", Dropbox's round 5 direction 2 "Sivu kerrallaan"; Microsoft's
// four levels are one row and one guided setup, MicrosoftLevels.tsx).
// Whether a provider is in use is the administrator's own daemon's catalog;
// the app credentials and who set them are the broker's. A change shows as
// waiting until the broker's reply, and as uncertain when no definite reply
// came.

/** A change sent and not yet settled by the host. */
export type PendingApp = "set" | "clear" | "uncertain";

// What the daemon's Google entry needs (internal/daemon/integrations/
// google_linux.go): the APIs its tools call, its scopes and its redirect.
// The drive scope already reaches Sheets, Docs and Slides, but gog's sheets,
// docs and slides commands call their own APIs, which Google refuses until
// the project enables them.
const googleAPIs: [string, string][] = [
  ["Gmail API", "gmail.googleapis.com"],
  ["Google Calendar API", "calendar-json.googleapis.com"],
  ["Google Drive API", "drive.googleapis.com"],
  ["People API", "people.googleapis.com"],
  ["Google Sheets API", "sheets.googleapis.com"],
  ["Google Docs API", "docs.googleapis.com"],
  ["Google Slides API", "slides.googleapis.com"],
];
/** The enable flow for every API, in the given project when the client is
 * known (its id starts with the project number, as Google's own "not
 * enabled" errors link it), else in the project last selected. */
const googleEnable = (project?: string) =>
  `https://console.cloud.google.com/apis/enableflow?apiid=${googleAPIs.map((a) => a[1]).join(",")}${project ? `&project=${project}` : ""}`;
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
// Google Auth platform's pages (googleAuth, GoogleGuide.tsx). Each opens in the project last selected in
// the console, as the enable flow above does; the page names the project.
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
const dropboxLimit = () => txt.dropboxLimit;
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

function Mark({ p, s }: { p: ProviderId | AnySection; s: Status }) {
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
          label={txt.offered}
        />
      );
    case "needs_app":
      return (
        <StatusMark data-testid={id} tone="warning" label={txt.notOffered} />
      );
    case "tool_missing":
      return (
        <StatusMark
          data-testid={id}
          kind="error"
          tone="danger"
          label={txt.toolMissing(s.tools.join(", "))}
        />
      );
    case "set":
    case "clear":
      return (
        <StatusMark
          data-testid={id}
          tone="info"
          animated="running"
          label={txt.waiting}
        />
      );
    case "uncertain":
      return (
        <StatusMark data-testid={id} tone="warning" label={txt.uncertain} />
      );
    default:
      return <StatusMark data-testid={id} kind="unknown" label={txt.unknown} />;
  }
}

/** What is wrong with root's existing section, in words that lead to
 * Aseta tunnukset…, which replaces it. */
function invalidText(app: IntegrationApp): string {
  switch (invalidApp(app)) {
    case "audience":
      return txt.invalidAudience(app.tenant_id ?? "");
    case "tenant":
      return txt.invalidTenant;
    case "client":
      return txt.invalidClient;
    default:
      return txt.invalidValues;
  }
}

const day = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : formatDate(d, { day: "numeric", month: "numeric", year: "numeric" });
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
      ? txt.setOnServer
      : app.actor === "root"
        ? txt.setOnServerOn(day(app.at))
        : `${day(app.at)} · ${names[app.actor ?? ""] ? `@${names[app.actor ?? ""]}` : txt.githubId(app.actor ?? "")}`;
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
          {dropboxLimit()}
        </span>
      )}
    </span>
  );
}

/** Google's console steps for the audience chosen on the first step
 * (GoogleGuide.tsx). Until a choice is made, the longer path's progress is
 * shown, so it does not shrink under the reader. */
const googleSteps = (
  audience: Audience | null,
  onAudience: (a: Audience) => void,
): Step[] => {
  const personal = audience !== "org";
  return [
    {
      id: "audience",
      title: audienceStepTitle(),
      body: <AudienceChoice value={audience} onChange={onAudience} />,
    },
    {
      id: "apis",
      title: txt.apis,
      body: (
        <>
          <p>{personal ? apisPersonal() : txt.chooseProject}</p>
          <ul className="si-list">
            {googleAPIs.map(([n]) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <ExternalLink
            href={googleEnable()}
            target="_blank"
            rel="noreferrer"
            data-testid="si-console-link"
          >
            {txt.enableInGoogle} <Icon name="external" />
          </ExternalLink>
          {personal && ownProjectNote()}
        </>
      ),
    },
    brandStep(audience),
    {
      id: "scopes",
      title: txt.scopes,
      body: (
        <>
          <Path
            p="Google Auth platform › Data Access › Add or Remove Scopes"
            href={`${googleAuth}/scopes`}
          />
          <div className="si-block" data-testid="si-scopes">
            <pre className="si-cmd">{googleScopes.join("\n")}</pre>
            <Copy value={googleScopes.join(",")} label={txt.scopesLabel} />
          </div>
          {personal && restrictedNote()}
        </>
      ),
    },
    ...(personal ? [publishStep()] : []),
    {
      id: "client",
      title: txt.client,
      console: txt.inGoogle,
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
            v={txt.selected}
            copy={false}
          />
          <p className="si-effect" data-testid="si-agent-client">
            {txt.agentClient}
          </p>
          <p className="si-quiet">
            {txt.noRedirect(<code>{googleRedirect}</code>)}
          </p>
          <p className="si-quiet">{txt.chooseFinally("Create")}</p>
        </>
      ),
      values: (
        <p className="si-quiet">{txt.googleShows("OAuth client created")}</p>
      ),
    },
  ];
};

/** A page of the app created on the first step. */
const dropboxPath = (p: string, tab: string) => (
  <Path p={p} href={dropboxApps} pick={txt.chooseAppTab(tab)} />
);

// One App Console page per step. Käyttöoikeudet comes before Asetukset so
// the guide ends on the Settings page, which shows the App key and secret;
// Enable additional users sits there beside the redirect.
const dropboxSteps = (appFolder: boolean): Step[] => [
  {
    id: "create",
    title: txt.create,
    body: (
      <>
        <ExternalLink
          href={dropboxCreate}
          target="_blank"
          rel="noreferrer"
          data-testid="si-console-link"
        >
          {txt.openDropbox} <Icon name="external" />
        </ExternalLink>
        <Val k="Choose an API" v="Scoped access" copy={false} />
        <Val
          k="Choose the type of access you need"
          v={appFolder ? "App folder" : "Full Dropbox"}
          copy={false}
        />
        {appFolder ? (
          <p className="si-effect" data-testid="si-app-folder">
            {txt.appFolder}
          </p>
        ) : (
          <p className="si-effect" data-testid="si-full-dropbox">
            {txt.fullDropbox}
          </p>
        )}
        <Val
          k="Name your app"
          v={appFolder ? txt.dropboxNameFolder : txt.dropboxName}
          copy={false}
        />
        <p className="si-quiet">{txt.uniqueName("Create app")}</p>
        <Role>{txt.dropboxOwner}</Role>
      </>
    ),
  },
  {
    id: "permissions",
    title: txt.scopes,
    body: (
      <>
        {dropboxPath("Permissions", "Permissions")}
        <div className="si-block" data-testid="si-permissions">
          <pre className="si-cmd">{dropboxScopes.join("\n")}</pre>
          <Copy value={dropboxScopes.join(" ")} label={txt.scopesLabel} />
        </div>
        <p className="si-quiet">{txt.dropboxScopes("Submit")}</p>
        <p className="si-quiet">{txt.laterChange}</p>
      </>
    ),
  },
  {
    id: "settings",
    title: txt.settingsStep,
    console: txt.inDropbox,
    body: (
      <>
        {dropboxPath("Settings › OAuth 2 › Redirect URIs", "Settings")}
        <Val k="Redirect URI" v={dropboxRedirect} />
        <p className="si-quiet">{txt.exactAddress("Add")}</p>
        <Path p="Settings › Development users › Enable additional users" />
        <p className="si-effect" data-testid="si-additional-users">
          {txt.additionalUsers}
        </p>
      </>
    ),
    values: (
      <>
        <p className="si-quiet">{txt.sameSettings}</p>
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
            pick={txt.chooseClient("Open Habitat")}
          />
          <p className="si-quiet" data-testid="si-new-secret">
            {txt.newSecret}
          </p>
        </>
      );
    default:
      return dropboxPath("Settings › App key, App secret (Show)", "Settings");
  }
}

/** Each section's console steps, the last one beside its values.
 * Microsoft's four levels have their own guide (MicrosoftLevels.tsx). */
function guide(
  section: AppSection,
  audience: Audience | null,
  onAudience: (a: Audience) => void,
): Step[] {
  return section === "google"
    ? googleSteps(audience, onAudience)
    : dropboxSteps(section === "dropbox_app_folder");
}
/** The section's name as the administrator reads it. */
const sectionName = (section: AnySection) => {
  const provider = sectionProvider(section);
  const shared = msLevels.find((m) => m.shared === section);
  if (shared)
    return txt.sharedLevelOf(name(provider), levelName(provider, shared.id));
  const level = levelSections[provider]?.find(
    (l) => l.section === section,
  )?.level;
  return level
    ? txt.levelOf(name(provider), levelName(provider, level))
    : name(provider);
};
const skipLabel = new Proxy({} as Record<AppProvider, string>, {
  get: (_target, provider: string) =>
    provider === "google" ? txt.haveClient : txt.haveApp,
});

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

/** Aseta tunnukset… and Vaihda tunnukset…: one console step at a time, the
 * last beside its values (proto-google-wizard-secrets-step, direction
 * "Rinnakkain"). Minulla on jo … opens only the values. The dialog stays
 * open until the broker answers, so a refusal keeps what was typed. A new
 * Google setup first asks whose accounts may connect and, once saved,
 * goes on to what is still to do and try (GoogleGuide.tsx). */
export function AppSetupDialog({
  provider: section,
  replace,
  step: initial = 0,
  skip: initialSkip = false,
  audience: initialAudience = null,
  onSave,
  onClose,
}: {
  provider: AppSection;
  replace?: IntegrationApp;
  /** The step it opens at; stories show each one. */
  step?: number;
  /** Opens at Minulla on jo …; stories show it. */
  skip?: boolean;
  /** Google's audience already chosen; stories show each path. */
  audience?: Audience | null;
  onSave: (fields: AppFields) => Promise<AppChange>;
  onClose: () => void;
}) {
  const [audience, setAudience] = useState<Audience | null>(initialAudience);
  const [saved, setSaved] = useState<string>();
  const [after, setAfter] = useState(0);
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
    title: replace ? txt.newSecretTitle : txt.credentials,
    body: null,
    values: replace ? (
      <>
        <Path
          p="Google Auth platform › Clients › Open Habitat › Add secret"
          href={`${googleAuth}/clients/${encodeURIComponent(replace.client_id ?? "")}`}
        />
        <p className="si-quiet" data-testid="si-replace-effect">
          {txt.replaceEffect}
        </p>
      </>
    ) : (
      existing(section)
    ),
  };
  // Only a new Google setup asks the audience; a new secret keeps it.
  const google = provider === "google" && !replace;
  const steps =
    replace || skip ? [enter] : guide(section, audience, setAudience);
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
    // Only a definite save goes on to what is left to do; an uncertain
    // one closes, and the row says it is uncertain.
    else if (result.kind === "changed" && google && audience)
      setSaved(fields.client_id);
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
          <span>{txt.secretOnce}</span>
        </p>
      )}
      {refusal && (
        <p className="si-bad" role="alert" data-testid="si-refusal">
          <Icon name="warning" />
          {refusal}
        </p>
      )}
    </>
  );
  const title = txt.setupTitle(sectionName(section), !!replace);
  if (saved !== undefined && audience)
    return (
      <Modalish
        testId="si-setup-dialog"
        title={title}
        size="wide"
        onClose={onClose}
      >
        <ReadSteps
          steps={afterSaveSteps(audience, saved)}
          at={after}
          onAt={setAfter}
          onDone={onClose}
        />
      </Modalish>
    );
  return (
    <Modalish
      testId="si-setup-dialog"
      title={title}
      size={split ? "split" : steps.length > 1 || skip ? "wide" : undefined}
      dismissable={!saving}
      onClose={onClose}
    >
      {steps.length > 1 && (
        <Progress ids={steps.map((s) => s.id)} at={i} title={step.title} />
      )}
      <div className="si-stepbody" data-testid={`si-step-${step.id}`}>
        {split ? (
          <div className="si-cols" data-testid="si-split">
            <div className="si-col">
              <p className="si-side">{step.console}</p>
              {step.body}
            </div>
            <div className="si-col si-get" data-testid="si-get">
              <p className="si-side">{txt.here}</p>
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
        {i === 0 && !last && (!google || audience) && (
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
            {txt.back}
          </ControlButton>
        ) : (
          <ControlButton
            size="row"
            variant="secondary"
            isDisabled={saving}
            onPress={onClose}
          >
            {txt.cancel}
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
            {saving ? txt.savingWait : txt.save}
          </ControlButton>
        ) : (
          <ControlButton
            data-testid="si-next"
            size="page"
            variant="primary"
            isDisabled={google && step.id === "audience" && !audience}
            onPress={() => setAt(i + 1)}
          >
            {txt.next}
          </ControlButton>
        )}
      </div>
    </Modalish>
  );
}

function RemoveDialog({
  provider: section,
  step,
  others,
  onConfirm,
  onClose,
}: {
  provider: AnySection;
  step: boolean;
  /** Another of the provider's levels stays usable, so removing this one
   * removes a level, not the provider. */
  others: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const provider = sectionProvider(section);
  if (section !== provider || others)
    return (
      <Modalish
        testId="si-remove-dialog"
        title={txt.removeLevelTitle(sectionName(section))}
        onClose={onClose}
      >
        <ul className="si-consequences">
          <li>{txt.levelGone}</li>
          <li>{txt.levelRelogin}</li>
          {msLevels.some((m) => m.shared === section) && (
            <li data-testid="si-remove-shared">{txt.sharedGone}</li>
          )}
        </ul>
        <div className="si-foot">
          <span className="si-grow" />
          <ControlButton size="row" variant="secondary" onPress={onClose}>
            {txt.cancel}
          </ControlButton>
          <ControlButton
            data-testid="si-remove-confirm"
            className="si-destructive"
            size="page"
            variant="danger"
            onPress={() => {
              onConfirm();
              onClose();
            }}
          >
            {txt.removeCredentials}
          </ControlButton>
        </div>
      </Modalish>
    );
  return (
    <Modalish
      testId="si-remove-dialog"
      title={txt.removeTitle(name(provider))}
      onClose={onClose}
    >
      <ul className="si-consequences">
        <li>{txt.noNew}</li>
        <li>{txt.noRelogin}</li>
        {/* The daemon supervises sync only while the integration is usable. */}
        {provider === "dropbox" && (
          <li data-testid="si-sync-stops">{txt.syncStops}</li>
        )}
        {step && <li>{txt.stepHidden}</li>}
      </ul>
      {provider !== "google" && (
        <p className="si-quiet" data-testid="si-remove-other">
          {txt.otherLater}
        </p>
      )}
      <div className="si-foot">
        <span className="si-grow" />
        <ControlButton size="row" variant="secondary" onPress={onClose}>
          {txt.cancel}
        </ControlButton>
        <ControlButton
          data-testid="si-remove-confirm"
          className="si-destructive"
          size="page"
          variant="danger"
          onPress={() => {
            onConfirm();
            onClose();
          }}
        >
          {txt.removeCredentials}
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
      title={txt.fixTitle(name(provider), tools.join(", "))}
      onClose={onClose}
    >
      <p>{txt.runOnServer}</p>
      <div className="si-block" data-testid="si-fix-command">
        <pre className="si-cmd">{fixCommand}</pre>
        <Copy value={fixCommand} label={txt.command} />
      </div>
      <div className="si-foot">
        <span className="si-grow" />
        <ControlButton size="page" variant="primary" onPress={onClose}>
          {txt.close}
        </ControlButton>
      </div>
    </Modalish>
  );
}

/** A row button whose count is a pill; the names behind the count are in
 * its accessible name and tooltip (prototype round 4). */
function CountButton({
  testId,
  label,
  count,
  name,
  variant,
  isDisabled,
  onPress,
}: {
  testId: string;
  label: string;
  count: string;
  name: string;
  variant: "quiet" | "secondary";
  isDisabled?: boolean;
  onPress: () => void;
}) {
  return (
    <ControlButton
      data-testid={testId}
      data-count={count}
      size="row"
      variant={variant}
      aria-label={name}
      tooltip={name}
      isDisabled={isDisabled}
      onPress={onPress}
    >
      {label}{" "}
      <span className="si-count" aria-hidden="true">
        {count}
      </span>
    </ControlButton>
  );
}

/** Microsoft's row: Organisaatiot n and Tasot n/4, nothing else. A missing
 * level makes Tasot ask for attention, as the state column does. */
function MicrosoftRowButtons({
  apps,
  set,
  locked,
  onOrganisations,
  onLevels,
}: {
  apps: IntegrationApps;
  set: string[];
  locked: boolean;
  onOrganisations: () => void;
  onLevels: () => void;
}) {
  const orgs = adminOrganisations(apps);
  const missing = set.length < msLevels.length;
  const names = msLevels
    .filter((m) => set.includes(m.id))
    .map((m) => levelsTxt.short[m.id])
    .join(", ");
  return (
    <>
      <CountButton
        testId="si-orgs-microsoft"
        label={orgsTxt.orgsButton}
        count={String(orgs.length)}
        variant="quiet"
        name={orgsTxt.orgsName(
          orgs.length,
          orgs.map((o) => organisationName(o)).join(", "),
        )}
        onPress={onOrganisations}
      />
      <CountButton
        testId="si-setup-microsoft"
        label={levelsTxt.levels}
        count={`${set.length}/${msLevels.length}`}
        variant={missing ? "secondary" : "quiet"}
        name={orgsTxt.levelsName(
          levelsTxt.levelsSet(set.length, names),
          missing,
        )}
        isDisabled={locked}
        onPress={onLevels}
      />
    </>
  );
}

type Open =
  | { kind: "levels" }
  | { kind: "organisations" }
  | { kind: "setup"; provider: AppSection; replace?: IntegrationApp }
  | { kind: "audience"; clientID: string }
  | { kind: "remove"; provider: AnySection }
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
  onTenantSet,
  onTenantRemove,
  onRefresh,
  children,
  searchRows,
}: {
  /** The administrator's own catalog; undefined when it could not be read. */
  providers?: Provider[];
  apps: IntegrationApps;
  /** Providers the site's onboarding has an integration step for. */
  steps?: ProviderId[];
  pending?: Partial<Record<ProviderId | AnySection, PendingApp>>;
  /** A definite refusal of the last removal, shown on its row. */
  problem?: { provider: ProviderId | AnySection; text: string };
  /** GitHub logins of known actors, by id. */
  names?: Record<string, string>;
  canWrite?: boolean;
  onboardingHref: string;
  onOpenOnboarding?: () => void;
  onSave: (provider: AnySection, fields: AppFields) => Promise<AppChange>;
  onRemove: (provider: AnySection) => void;
  /** Adds an organisation to Microsoft's allowed list or takes it off;
   * without them the organisations can only be read. */
  onTenantSet?: (tenant: string, label: string) => Promise<AppChange>;
  onTenantRemove?: (tenant: string) => Promise<AppChange>;
  onRefresh: () => void;
  /** Rows above the services, such as a failed refresh. */
  children?: ReactNode;
  /** The web search services' rows, drawn by the app, after the others as
   * a new service would be. */
  searchRows?: ReactNode;
}) {
  const [open, setOpen] = useState<Open>();
  const [tables, setTables] = useState<TableProvider[]>([]);
  const toggleTable = (p: TableProvider) =>
    setTables((t) => (t.includes(p) ? t.filter((x) => x !== p) : [...t, p]));
  const locked = !canWrite || !apps.browser_setup;
  return (
    <div
      className="si s-stack"
      data-testid="server-integrations"
      data-browser-setup={apps.browser_setup}
    >
      <SectionLead testId="si-connect-note">{txt.connectNote}</SectionLead>
      <SectionCard>
        {children}
        {!apps.browser_setup && (
          <p className="s-row si-note" data-testid="si-setup-off">
            <Icon name="info" />
            {txt.setupOff}
          </p>
        )}
        <PeopleList testId="si-rows" actions columns={[txt.service, txt.state]}>
          {providerOrder.map((p) => {
            const catalog = providers?.find((x) => x.id === p);
            // Microsoft's four levels are one row with one guided setup;
            // a change to any of them is the row's.
            const ms = p === "microsoft";
            // A level is offered when its own-organisation or its shared
            // (multi-tenant) application is set; each section's own
            // problem is shown under its level.
            const msApps = ms
              ? msLevels.flatMap((m) =>
                  [m.section, m.shared].flatMap((section) => {
                    const a = apps.apps.find((x) => x.provider === section);
                    return a ? [{ level: m.id, app: a }] : [];
                  }),
                )
              : [];
            const msSet = msLevels
              .filter((m) =>
                msApps.some((x) => x.level === m.id && x.app.usable),
              )
              .map((m) => ({ level: m.id }));
            const msPending = ms
              ? (["uncertain", "set", "clear"] as const).find((k) =>
                  msLevels.some(
                    (m) => pending[m.section] === k || pending[m.shared] === k,
                  ),
                )
              : undefined;
            const s = statusOf(p, catalog, ms ? msPending : pending[p]);
            const app = isAppProvider(p)
              ? apps.apps.find((a) => a.provider === p)
              : undefined;
            const step = steps.includes(p);
            const hidden = s.kind !== "ready";
            // A provider's narrower levels are separate applications, offered
            // once the provider's tools are installed.
            const levels =
              !ms &&
              isAppProvider(p) &&
              (s.kind === "ready" || s.kind === "needs_app")
                ? (levelSections[p] ?? [])
                : [];
            const table = isAppProvider(p) ? (p as TableProvider) : undefined;
            const tableOpen = table !== undefined && tables.includes(table);
            return (
              <Fragment key={p}>
                <PeopleRow
                  className="si-row"
                  testId={`si-row-${p}`}
                  row={`server-${p}`}
                  data-status={s.kind}
                  mark={<ProviderMark provider={p} small />}
                  name={
                    <span className="si-main">
                      <span className="si-name">{name(p)}</span>
                      {step && (
                        <a
                          className="si-step"
                          data-testid={`si-step-${p}`}
                          data-hidden={hidden || undefined}
                          href={onboardingHref}
                          aria-label={txt.onboardingStep(name(p), hidden)}
                          title={txt.onboardingStep(name(p), hidden)}
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
                              hidden ? txt.inOnboardingHidden : txt.inOnboarding
                            }
                            tone={hidden ? "warning" : "neutral"}
                          />
                        </a>
                      )}
                    </span>
                  }
                  detail={
                    ms ? (
                      <>
                        {/* The levels set are named in the Levels button
                            and its dialog; with none, the row says what the
                            levels are (prototype round 4). */}
                        {msSet.length ? null : (
                          <span
                            className="ml-provnote"
                            data-testid="si-levels-note"
                          >
                            {levelsTxt.fourLevels}
                          </span>
                        )}
                        {msApps.map(
                          ({ level, app: a }) =>
                            !pending[a.provider] &&
                            invalidApp(a) && (
                              <span
                                key={a.provider}
                                className="si-bad"
                                data-testid={`si-invalid-${a.provider}`}
                              >
                                <Icon name="warning" />
                                {txt.level(levelName("microsoft", level))}:{" "}
                                {txt.invalid} {invalidText(a)}
                              </span>
                            ),
                        )}
                        {problem &&
                          sectionProvider(problem.provider as AnySection) ===
                            "microsoft" &&
                          !msPending && (
                            <span className="si-bad" role="alert">
                              <Icon name="warning" />
                              {problem.text}
                            </span>
                          )}
                      </>
                    ) : (
                      <>
                        {table && (
                          <LevelsDisclosure
                            open={tableOpen}
                            onToggle={() => toggleTable(table)}
                            testId={`si-levels-${p}`}
                          />
                        )}
                        {app && !pending[p] && invalidApp(app) && (
                          <span
                            className="si-bad"
                            data-testid={`si-invalid-${p}`}
                          >
                            <Icon name="warning" />
                            {txt.invalid} {invalidText(app)}
                          </span>
                        )}
                        {problem?.provider === p && !pending[p] && (
                          <span className="si-bad" role="alert">
                            <Icon name="warning" />
                            {problem.text}
                          </span>
                        )}
                      </>
                    )
                  }
                  cells={[
                    ms &&
                    s.kind === "ready" &&
                    msSet.length > 0 &&
                    msSet.length < msLevels.length ? (
                      <StatusMark
                        key="state"
                        data-testid="si-status-microsoft"
                        tone="warning"
                        label={levelsTxt.partlyOffered(msSet.length)}
                      />
                    ) : (
                      <Mark key="state" p={p} s={s} />
                    ),
                  ]}
                  end={
                    ms && (s.kind === "ready" || s.kind === "needs_app") ? (
                      msSet.length ? (
                        <MicrosoftRowButtons
                          apps={apps}
                          set={msSet.map((x) => x.level)}
                          locked={locked}
                          onOrganisations={() =>
                            setOpen({ kind: "organisations" })
                          }
                          onLevels={() => setOpen({ kind: "levels" })}
                        />
                      ) : (
                        <ControlButton
                          data-testid="si-setup-microsoft"
                          size="row"
                          variant="secondary"
                          isDisabled={locked}
                          onPress={() => setOpen({ kind: "levels" })}
                        >
                          {levelsTxt.createApps}
                        </ControlButton>
                      )
                    ) : s.kind === "uncertain" ? (
                      <ControlButton
                        data-testid={`si-refresh-${p}`}
                        size="row"
                        variant="secondary"
                        onPress={onRefresh}
                      >
                        <Icon name="refresh" />
                        {txt.refresh}
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
                        {txt.fix}
                      </ControlButton>
                    ) : s.kind === "needs_app" && isAppProvider(p) ? (
                      <ControlButton
                        data-testid={`si-setup-${p}`}
                        size="row"
                        variant="secondary"
                        isDisabled={locked}
                        onPress={() => setOpen({ kind: "setup", provider: p })}
                      >
                        {txt.setCredentials}
                      </ControlButton>
                    ) : s.kind === "ready" && app && isAppProvider(p) ? (
                      <span data-testid={`si-menu-${p}`}>
                        <Menu
                          label={txt.credentialsOf(name(p))}
                          trigger={<span>{txt.credentialsMenu}</span>}
                          placement="bottom end"
                          heading={<AppLine app={app} names={names} />}
                          items={[
                            ...(p === "google" && googleProject(app.client_id)
                              ? [
                                  {
                                    id: "apis",
                                    label: txt.enableApis,
                                  },
                                ]
                              : []),
                            ...(p === "google" && app.client_id
                              ? [
                                  // Changes nothing in Habitat, so a
                                  // locked setup leaves it available.
                                  {
                                    id: "audience",
                                    label: audienceMenuLabel(),
                                  },
                                  {
                                    id: "replace",
                                    label: txt.replaceCredentials,
                                    availability: locked
                                      ? {
                                          state: "disabled" as const,
                                          reason: txt.setupDisabled,
                                        }
                                      : undefined,
                                  },
                                ]
                              : []),
                            {
                              id: "remove",
                              label: txt.removeCredentialsMenu,
                              danger: true,
                              availability: locked
                                ? {
                                    state: "disabled" as const,
                                    reason: txt.setupDisabled,
                                  }
                                : undefined,
                            },
                          ]}
                          onAction={(k) =>
                            k === "apis"
                              ? window.open(
                                  googleEnable(googleProject(app.client_id)),
                                  "_blank",
                                  "noopener,noreferrer",
                                )
                              : setOpen(
                                  k === "audience"
                                    ? {
                                        kind: "audience",
                                        clientID: app.client_id ?? "",
                                      }
                                    : k === "replace"
                                      ? {
                                          kind: "setup",
                                          provider: p,
                                          replace: app,
                                        }
                                      : { kind: "remove", provider: p },
                                )
                          }
                        />
                      </span>
                    ) : null
                  }
                />
                {tableOpen && table && (
                  <li
                    className="ml-cmprow"
                    data-testid={`si-levels-table-${p}`}
                  >
                    <LevelTable
                      provider={table}
                      testId={`si-table-${p}`}
                      state={
                        ms
                          ? (l) =>
                              msSet.some((x) => x.level === l)
                                ? levelsTxt.offered
                                : levelsTxt.noCredentials
                          : undefined
                      }
                    />
                  </li>
                )}
                {levels.map(({ section, level }) => {
                  const levelApp = apps.apps.find(
                    (a) => a.provider === section,
                  );
                  const ls: Status = pending[section]
                    ? { kind: pending[section] }
                    : levelApp?.usable
                      ? { kind: "ready" }
                      : { kind: "needs_app" };
                  return (
                    <PeopleRow
                      key={section}
                      className="si-row si-level"
                      testId={`si-row-${section}`}
                      data-status={ls.kind}
                      indent
                      name={
                        <span className="si-name">
                          {txt.level(levelName(p, level))}
                        </span>
                      }
                      detail={
                        <>
                          {levelApp &&
                            !pending[section] &&
                            invalidApp(levelApp) && (
                              <span
                                className="si-bad"
                                data-testid={`si-invalid-${section}`}
                              >
                                <Icon name="warning" />
                                {txt.invalid} {invalidText(levelApp)}
                              </span>
                            )}
                          {problem?.provider === section &&
                            !pending[section] && (
                              <span className="si-bad" role="alert">
                                <Icon name="warning" />
                                {problem.text}
                              </span>
                            )}
                        </>
                      }
                      cells={[
                        ls.kind === "needs_app" ? (
                          // A level is optional: without its application
                          // people see it greyed out, not the provider gone.
                          <StatusMark
                            key="state"
                            data-testid={`si-status-${section}`}
                            label={txt.notInUse}
                          />
                        ) : (
                          <Mark key="state" p={section} s={ls} />
                        ),
                      ]}
                      end={
                        ls.kind === "uncertain" ? (
                          <ControlButton
                            data-testid={`si-refresh-${section}`}
                            size="row"
                            variant="secondary"
                            onPress={onRefresh}
                          >
                            <Icon name="refresh" />
                            {txt.refresh}
                          </ControlButton>
                        ) : levelApp ? (
                          <span data-testid={`si-menu-${section}`}>
                            <Menu
                              label={txt.credentialsOf(sectionName(section))}
                              trigger={<span>{txt.credentials}</span>}
                              placement="bottom end"
                              heading={<AppLine app={levelApp} names={names} />}
                              items={[
                                {
                                  id: "remove",
                                  label: txt.removeCredentialsMenu,
                                  danger: true,
                                  availability: locked
                                    ? {
                                        state: "disabled" as const,
                                        reason: txt.setupDisabled,
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
                            {txt.setCredentials}
                          </ControlButton>
                        ) : null
                      }
                    />
                  );
                })}
              </Fragment>
            );
          })}
          {searchRows}
        </PeopleList>
      </SectionCard>
      {open?.kind === "levels" && (
        <MicrosoftLevelsDialog
          apps={apps.apps}
          tenants={apps.tenants}
          locked={locked}
          line={(a) => <AppLine app={a} names={names} />}
          invalid={invalidText}
          onSave={(section, fields) => onSave(section, fields)}
          onTenantSet={(tenant, label) =>
            onTenantSet
              ? onTenantSet(tenant, label)
              : Promise.resolve({ kind: "refused", code: "admin_required" })
          }
          onRemove={(section) => setOpen({ kind: "remove", provider: section })}
          onClose={() => setOpen(undefined)}
        />
      )}
      {open?.kind === "organisations" && (
        <MicrosoftOrganisationsDialog
          apps={apps}
          locked={locked || !onTenantSet || !onTenantRemove}
          onSet={(tenant, label) =>
            onTenantSet
              ? onTenantSet(tenant, label)
              : Promise.resolve({ kind: "refused", code: "admin_required" })
          }
          onRemove={(tenant) =>
            onTenantRemove
              ? onTenantRemove(tenant)
              : Promise.resolve({ kind: "refused", code: "admin_required" })
          }
          onReread={onRefresh}
          onClose={() => setOpen(undefined)}
        />
      )}
      {open?.kind === "setup" && (
        <AppSetupDialog
          provider={open.provider}
          replace={open.replace}
          onSave={(fields) => onSave(open.provider, fields)}
          onClose={() => setOpen(undefined)}
        />
      )}
      {open?.kind === "audience" && (
        <GoogleAudienceDialog
          clientID={open.clientID}
          onClose={() => setOpen(undefined)}
        />
      )}
      {open?.kind === "remove" && (
        <RemoveDialog
          provider={open.provider}
          step={(steps as string[]).includes(open.provider)}
          others={
            sectionProvider(open.provider) === "microsoft" &&
            msLevels.some((m) =>
              [m.section, m.shared].some(
                (section) =>
                  section !== open.provider &&
                  apps.apps.find((a) => a.provider === section)?.usable,
              ),
            )
          }
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
