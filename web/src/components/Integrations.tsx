import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Dialog as AriaDialog,
  RadioGroup as AriaRadioGroup,
  Heading,
  Modal,
  ModalOverlay,
  Radio,
} from "react-aria-components";
import "./Integrations.css";
import type { GiteaCheck, GiteaConnection } from "../app/gitea";
import type { GitLabAPI, GitLabConnection } from "../app/gitlab";
import {
  type Access,
  type Account,
  type AppleService,
  appleGroups,
  appleServiceOf,
  appleServices,
  clockTime,
  type Folder,
  type Grant,
  gigabytes,
  type IntegrationList,
  type Level,
  type LoginView,
  listedProvider,
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
import { liveText } from "../i18n";
import { atlassianText } from "../text/atlassian";
import { integrationsText } from "../text/integrations";
import { trelloText } from "../text/trello";
import { ControlButton, controlClassName, Segmented } from "./ControlElements";
import { GiteaCard } from "./GiteaConnection";
import { GitLabCard, type GitLabTokenView } from "./GitLabConnection";
import { Icon, type IconName } from "./Icon";
import { Checkbox, TextField } from "./Primitives";

const txt = liveText(integrationsText);

// Asetukset › Tiedot agenteille (formerly Integraatiot) in the accepted "Tili" direction (ADR 0026,
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

const providerMarks: Record<ProviderId, Pick<Copy, "mark" | "tone">> = {
  google: { mark: "G", tone: 1 },
  microsoft: { mark: "M", tone: 2 },
  imap: { mark: "@", tone: 3 },
  caldav: { mark: "C", tone: 3 },
  carddav: { mark: "C", tone: 3 },
  dropbox: { mark: "D", tone: 3 },
  apple: { mark: "iC", tone: 3 },
  gitea: { mark: "Gt", tone: 3 },
  gitlab: { mark: "GL", tone: 2 },
  atlassian: { mark: "A", tone: 2 },
  trello: { mark: "T", tone: 1 },
};

/** Each provider's names in the current language, with its letter tile. */
export const providerCopy = new Proxy({} as Record<ProviderId, Copy>, {
  get: (_target, id: ProviderId) =>
    providerMarks[id] && { ...providerMarks[id], ...txt.providers[id] },
});

const serviceIcons: Record<ServiceId, IconName> = {
  mail: "mail",
  calendar: "calendar",
  contacts: "contacts",
  drive: "folder",
  onedrive: "folder",
  sharepoint: "folder",
  dropbox: "folder",
  git: "branch",
  jira: "branch",
  confluence: "folder",
  trello: "grid",
};

const fileServices: ServiceId[] = [
  "drive",
  "onedrive",
  "sharepoint",
  "dropbox",
];

export function serviceName(provider: ProviderId, id: ServiceId): string {
  return txt.services[provider]?.[id] ?? id;
}

function CloudFolderHint() {
  return <p className="ig-meta">{txt.cloudFolder}</p>;
}

/** What a narrower grant lets agents do with a service, in the person's
 * terms; the full level is described by what the agent gets. */
function narrower(service: Service): string | null {
  const file = fileServices.includes(service.id);
  switch (service.access) {
    case "none":
      return txt.notGranted;
    case "drafts":
      return txt.drafts;
    case "read":
      return file
        ? txt.readFiles
        : service.id === "mail"
          ? txt.readMail
          : service.id === "calendar"
            ? txt.readCalendar
            : txt.readOnly;
  }
  return null;
}

// ---------- Account levels ----------

type LevelCopy = { name: string; sum: string };

/** The levels of the providers that offer a choice, as the person reads
 * them: each is a boundary the provider itself enforces. */
const levelCopy = new Proxy(
  {} as Partial<Record<ProviderId, Partial<Record<Level, LevelCopy>>>>,
  {
    get: (_target, provider: string) => txt.levels[provider],
    ownKeys: () => Object.keys(txt.levels),
    getOwnPropertyDescriptor: (_target, provider: string) =>
      provider in txt.levels
        ? { enumerable: true, configurable: true, value: txt.levels[provider] }
        : undefined,
  },
);

export const levelName = (provider: ProviderId, level: Level) =>
  levelCopy[provider]?.[level]?.name ?? level;

/** What a level promises a service: nosend is full but for sending mail,
 * and drafts sends nothing, so everything but mail is read only. */
function levelAccess(level: Level, service: ServiceId): Access {
  if (level === "full" || level === "app_folder") return "full";
  if ((level === "drafts" || level === "nosend") && service === "mail")
    return "drafts";
  if (level === "nosend") return "full";
  return "read";
}

/** What agents may do with a service at a level, before signing in. */
function levelAbility(level: Level, service: ServiceId): string {
  const access = levelAccess(level, service);
  if (fileServices.includes(service)) {
    if (level === "app_folder") return txt.appFolder;
    return access === "full" ? txt.syncBoth : txt.mirror;
  }
  if (access === "full")
    return service === "mail"
      ? txt.mailFull
      : service === "calendar"
        ? txt.calendarFull
        : txt.full;
  return narrower({ id: service, state: "ok", access }) ?? txt.readOnly;
}

/** The account card's level: the level the grant amounts to, or the one it
 * would be without the services left out, or a custom grant. Null when the
 * grant cannot be read. */
export function accountLevel(
  account: Account,
): { text: string; full: boolean } | null {
  if (!levelCopy[account.provider]) return null;
  if (account.level)
    return {
      text: levelName(account.provider, account.level),
      full: account.level === "full",
    };
  const shown = account.services.filter((s) => s.access);
  if (!shown.length) return null;
  const without = shown.filter((s) => s.access === "none");
  const rest = shown.filter((s) => s.access !== "none");
  const levels = Object.keys(levelCopy[account.provider] ?? {}) as Level[];
  const match = levels.find(
    (l) =>
      l !== "app_folder" &&
      rest.length > 0 &&
      rest.every((s) => s.access === levelAccess(l, s.id)),
  );
  if (!match) return { text: txt.custom, full: false };
  if (!without.length)
    return { text: levelName(account.provider, match), full: match === "full" };
  return {
    text: txt.without(
      levelName(account.provider, match),
      without.map((s) => serviceName(account.provider, s.id)).join(", "),
    ),
    full: false,
  };
}

/** The account's level as a pill: a full grant in the warning tone, a
 * narrower one in the accent. */
function LevelPill({ account }: { account: Account }) {
  const level = accountLevel(account);
  if (!level) return null;
  return (
    <span
      className={`ig-lv ${level.full ? "full" : "narrow"}`}
      data-testid="integration-account-level"
      data-level={account.level ?? "custom"}
    >
      <Icon className="ig-lv-icon" name={level.full ? "key" : "lock"} />
      {level.text}
    </span>
  );
}

/** What a narrower grant leaves out of a service, as a phrase. */
function missingOf(provider: ProviderId, service: Service): string | null {
  const name = serviceName(provider, service.id);
  switch (service.access) {
    case "none":
      return name;
    case "drafts":
      return txt.missingSend(name);
    case "read":
      return txt.missingEdit(name);
  }
  return null;
}

/** A scope as the provider's documentation names it: Google's without its
 * common address prefix. */
const scopeName = (scope: string) =>
  scope.replace(/^https:\/\/www\.googleapis\.com\/auth\//, "");

/** What the agent gets from a service, in a sentence. */
function gets(provider: ProviderId, service: Service): ReactNode {
  if (service.access === "read" && service.directory)
    return txt.readFolder(<code>{service.directory}</code>);
  const limited = narrower(service);
  if (limited) return limited;
  if (service.directory) return txt.folder(<code>{service.directory}</code>);
  if (provider === "imap" || (provider === "apple" && service.id === "mail"))
    return txt.himalaya(<code>himalaya</code>);
  return txt.skill;
}

export function ProviderMark({
  provider,
  small,
}: {
  provider: ProviderId;
  small?: boolean;
}) {
  const copy = providerCopy[provider];
  return <LetterMark mark={copy.mark} tone={copy.tone} small={small} />;
}

/** The settings page a provider's accounts are on, as a person reads it
 * (Asetukset › …). */
export const settingsPlace = (provider: ProviderId) =>
  provider === "gitea" || provider === "gitlab"
    ? txt.codeHosts
    : txt.dataForAgents;

/** A service's letter tile, shared by every settings page that lists
 * outside accounts (GitHub, AI subscriptions and keys, data sources). Tone 0
 * is the neutral tile. */
export function LetterMark({
  mark,
  tone,
  small,
}: {
  mark: string;
  tone: 0 | 1 | 2 | 3;
  small?: boolean;
}) {
  return (
    <span
      className={`ig-mark ig-tone-${tone}${small ? " sm" : ""}`}
      aria-hidden="true"
    >
      {mark}
    </span>
  );
}

/** The page's warning: what agents can do with what the services granted,
 * and what the grant, the only real limit, does not prevent. */
export function GrantLimits() {
  return (
    <div className="ig-warn" role="note" data-testid="integration-limits">
      <Icon name="shield" />
      <div>
        <strong>{txt.limitsLead}</strong> {txt.limitsBody}
        <ul>
          <li>{txt.limitHome}</li>
          <li>{txt.limitTell}</li>
          <li>{txt.limitModes}</li>
        </ul>
      </div>
    </div>
  );
}

/** Why an account's grant is narrower than the catalog asked, and where it
 * is changed. Only the grant is read; who narrowed it is known by provider. */
function GrantNotice({ account }: { account: Account }) {
  const missing = account.services
    .map((s) => missingOf(account.provider, s))
    .filter((m): m is string => !!m);
  if (!account.grant?.not_granted.length || missing.length === 0) return null;
  return (
    <p
      className="ig-notice"
      role="status"
      data-testid="integration-account-narrowed"
    >
      <Icon name="info" />
      <span>
        {account.provider === "microsoft"
          ? txt.narrowedOrg(missing.join(", "))
          : txt.narrowedSelf(missing.join(", "))}
      </span>
    </p>
  );
}

/** The grant in the provider's own names, for IT and for checking. */
function GrantList({ grant }: { grant: Grant }) {
  return (
    <details className="ig-grant" data-testid="integration-grant">
      <summary>{txt.granted(grant.granted.length)}</summary>
      <ul>
        {grant.granted.map((s) => (
          <li key={s}>
            <Icon name="check" />
            <code title={s}>{scopeName(s)}</code>
          </li>
        ))}
        {grant.not_granted.map((s) => (
          <li key={s} className="miss" data-testid="integration-not-granted">
            <span aria-hidden="true">–</span>
            <code title={s}>{scopeName(s)}</code>
            <span>{txt.askedNotGranted}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** The agent-exposure warning: it informs, it is not a permission system. */
export function AgentWarning() {
  return (
    <div className="ig-warn" role="note">
      <Icon name="shield" />
      <div>
        <strong>{txt.warnLead}</strong> {txt.warnBody}
      </div>
    </div>
  );
}

const stateText = new Proxy({} as Record<ServiceState, string>, {
  get: (_target, state: string) => txt.state[state],
});

const failureText = new Proxy({} as Record<SyncFailure, string>, {
  get: (_target, failure: string) => txt.failure[failure],
});

// Why an account could not follow the server's current application. Every
// service carries the same reason; the card says it once.
const alignmentHelp: Partial<Record<SyncFailure, (name: string) => string>> = {
  app_changed: (name) => txt.appChanged(name),
  tenant_changed: (name) => txt.tenantChanged(name),
  outside_tenant: (name) => txt.outsideTenant(name),
};

// What a failed ordinary pass asks of the person. Retried failures need
// nothing; the two native safeguards wait for someone to look.
const failureHelp = new Proxy({} as Partial<Record<SyncFailure, string>>, {
  get: (_target, failure: string) =>
    ({
      not_chosen: txt.notChosenHelp,
      delete_limit: txt.deleteLimitHelp,
      needs_resync: txt.resyncHelp,
    })[failure],
});

function SyncProgressStatus({ progress: p }: { progress: SyncProgress }) {
  return (
    <span
      data-testid="integration-sync-progress"
      className="ig-sync-progress"
      role="status"
    >
      {txt.batch}{" "}
      {p.phase === "inventory"
        ? txt.inventory
        : p.phase === "preparing"
          ? txt.preparing
          : txt.copying}
      {" · "}
      {txt.elapsed(minutesLeft(p.elapsed_seconds))}
      {p.total_bytes > 0 && (
        <>
          {" "}
          · {gigabytes(p.bytes)} / {gigabytes(p.total_bytes)}
        </>
      )}
      {p.total_files > 0 && <> · {txt.files(p.files, p.total_files)}</>}
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
        {txt.checking}
      </span>
    );
  if (service.access === "none")
    return (
      <span
        data-testid="integration-service-state"
        data-state={service.state}
        data-access="none"
        className="ig-st"
      >
        <Icon name="cross" />
        {txt.notInUse}
      </span>
    );
  // Files the person left out are a choice, not a fault.
  const bad =
    [
      "credentials_rejected",
      "login_expired",
      "quota_full",
      "sync_failed",
    ].includes(service.state) && service.failure !== "not_chosen";
  const warn = ["unreachable", "sync_restarting", "unknown"].includes(
    service.state,
  );
  // An ok file service with a pass running is syncing right now.
  const passing = service.state === "ok" && !!service.progress;
  const text =
    service.failure === "quota_insufficient" &&
    service.needed_bytes !== undefined &&
    service.free_bytes !== undefined
      ? txt.quotaNeeded(
          gigabytes(service.needed_bytes),
          gigabytes(service.free_bytes),
        )
      : service.failure
        ? failureText[service.failure]
        : passing
          ? txt.syncingNow
          : service.state === "ok" && service.directory
            ? txt.syncingAlways
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
            : service.failure === "not_chosen"
              ? "info"
              : service.state === "pending_first_sync"
                ? "clock"
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
  onChangeLevel,
  onStopSync,
  onRemove,
  unavailable,
}: {
  account: Account;
  /** Signs the account in again at another level. */
  onChangeLevel?: () => void;
  /** Why the provider is out of use on this server; the account's own
   * native login is kept, but nothing reaches or refreshes it meanwhile. */
  unavailable?: Provider["unavailable_reason"];
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
        <LevelPill account={account} />
        {(needsSignIn(account) ||
          // Google lets the person grant what was left out by signing in again.
          (account.provider === "google" &&
            !!account.grant?.not_granted.length)) &&
        onSignInAgain ? (
          <ControlButton
            data-testid="integration-reauth"
            size="row"
            variant="primary"
            onPress={onSignInAgain}
          >
            {txt.signInAgain}
          </ControlButton>
        ) : null}
        {onChangeLevel ? (
          <ControlButton
            data-testid="integration-change-level"
            size="row"
            variant="secondary"
            onPress={onChangeLevel}
          >
            {txt.changeLevel}
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
          {txt.check}
        </ControlButton>
        <ControlButton
          data-testid="integration-remove-open"
          size="row"
          variant="quiet"
          onPress={onRemove}
        >
          {txt.remove}
        </ControlButton>
      </div>
      {unavailable ? (
        <p
          className="ig-notice"
          role="status"
          data-testid="integration-account-unavailable"
        >
          <Icon name="warning" />
          <span>
            {unavailable === "app_credentials_required"
              ? txt.appCredentialsMissing(copy.name)
              : txt.toolMissing(copy.name)}
          </span>
        </p>
      ) : null}
      {(() => {
        const reason = account.services.find(
          (s) =>
            s.state === "login_expired" &&
            s.failure &&
            alignmentHelp[s.failure],
        )?.failure;
        return reason ? (
          <p
            className="ig-notice"
            role="status"
            data-testid="integration-account-alignment"
            data-reason={reason}
          >
            <Icon name="warning" />
            <span>{alignmentHelp[reason]?.(copy.name)}</span>
          </p>
        ) : null;
      })()}
      <GrantNotice account={account} />
      {account.services.map((s) => (
        <div
          data-testid={`integration-service-${s.id}`}
          data-access={s.access}
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
                {txt.stopSync}
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
                    ? txt.initialHelp
                    : s.failure
                      ? txt.quotaHelp
                      : txt.retryHelp}
                </span>
              )}
          </div>
          <div className="ig-sv">
            <ServiceStatus service={s} checking={checking} />
            {checking || s.access === "none" ? null : s.directory ? (
              // A file service's moving clock is its last successful pass,
              // not the status check: only that says the files sync.
              <span data-testid="integration-last-synced" className="ig-meta">
                {s.last_synced_at && syncedTime(s.last_synced_at) ? (
                  <>
                    {txt.synced}{" "}
                    <time dateTime={s.last_synced_at}>
                      {syncedTime(s.last_synced_at)}
                    </time>
                  </>
                ) : (
                  txt.notSynced
                )}
              </span>
            ) : // Not checked now: a check time would say it was.
            s.state !== "pending_first_sync" &&
              clockTime(account.checked_at) ? (
              <span data-testid="integration-checked-at" className="ig-meta">
                {txt.checkedAt(clockTime(account.checked_at) ?? "")}
              </span>
            ) : null}
          </div>
        </div>
      ))}
      {account.grant ? <GrantList grant={account.grant} /> : null}
    </article>
  );
}

/** One Apple ID's card: the iCloud services its ordinary imap, caldav and
 * carddav accounts give, one renewal for the one app-specific password,
 * and the services not yet connected. */
export function AppleCard({
  appleId,
  accounts,
  checking,
  onCheck,
  onRenew,
  onAdd,
  onRemove,
}: {
  appleId: string;
  accounts: Account[];
  checking: boolean;
  onCheck: () => void;
  onRenew?: () => void;
  onAdd?: (missing: AppleService[]) => void;
  onRemove: () => void;
}) {
  const missing = appleServices.filter(
    (s) => !accounts.some((a) => appleServiceOf(a) === s),
  );
  const rejected = accounts.some(needsSignIn);
  return (
    <article
      data-testid="integration-apple-card"
      className="ig-card"
      aria-label={`${providerCopy.apple.name} · ${appleId}`}
    >
      <div className="ig-acc">
        <ProviderMark provider="apple" />
        <div>
          <span className="ig-rn">{providerCopy.apple.name}</span>
          <span className="ig-meta">{appleId}</span>
        </div>
        {rejected && onRenew ? (
          <ControlButton
            data-testid="integration-apple-renew"
            size="row"
            variant="primary"
            onPress={onRenew}
          >
            {txt.newPassword}
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
          {txt.check}
        </ControlButton>
        <ControlButton
          data-testid="integration-remove-open"
          size="row"
          variant="quiet"
          onPress={onRemove}
        >
          {txt.remove}
        </ControlButton>
      </div>
      {rejected && !checking ? (
        <p className="ig-why" data-testid="integration-apple-why">
          {txt.appleWhy}
        </p>
      ) : null}
      {accounts.map((a) => {
        const service = appleServiceOf(a);
        const s = a.services[0];
        if (!service || !s) return null;
        return (
          <div
            data-testid={`integration-service-${service}`}
            className="ig-svc"
            key={`${a.provider}:${a.address}`}
          >
            <span className="ig-ic sm">
              <Icon name={serviceIcons[s.id]} />
            </span>
            <div>
              <span className="ig-rn">{serviceName("apple", service)}</span>
              <span className="ig-meta">
                {service === "mail" && a.address !== appleId ? (
                  <>{a.address} · </>
                ) : null}
                {gets("apple", s)}
              </span>
            </div>
            <div className="ig-sv">
              <ServiceStatus service={s} checking={checking} />
              {!checking && clockTime(a.checked_at) ? (
                <span data-testid="integration-checked-at" className="ig-meta">
                  {txt.checkedAt(clockTime(a.checked_at) ?? "")}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
      {missing.length && onAdd ? (
        <div
          className="ig-svc ig-missing"
          data-testid="integration-apple-missing"
        >
          <span className="ig-ic sm">
            <Icon name="plus" />
          </span>
          <div>
            <span className="ig-meta">
              {txt.notConnected(
                missing.map((m) => serviceName("apple", m)).join(", "),
              )}
            </span>
          </div>
          <ControlButton
            data-testid="integration-apple-add"
            size="row"
            variant="secondary"
            onPress={() => onAdd(missing)}
          >
            {txt.addService}
          </ControlButton>
        </div>
      ) : null}
    </article>
  );
}

/** Where each tool keeps the files the daemon lists its accounts from. */
const unreadableDirectory: Partial<Record<ProviderId, string>> = {
  google: "~/.config/rclone",
  microsoft: "~/.config/rclone",
  dropbox: "~/.config/rclone",
  imap: "~/.config/himalaya",
  caldav: "~/.config/curl",
  carddav: "~/.config/curl",
};

const skillNotice = new Proxy(
  {} as Partial<Record<IntegrationList["skill"], string>>,
  {
    get: (_target, skill: string) =>
      skill === "blocked"
        ? txt.skillBlocked
        : skill === "failed"
          ? txt.skillFailed
          : undefined,
  },
);

/** What the Apple card asks of the page: a guide for one Apple ID. */
export type AppleIntent =
  | { kind: "add"; appleId: string; missing: AppleService[] }
  | { kind: "renew"; appleId: string; services: AppleService[] }
  | { kind: "remove"; appleId: string; services: AppleService[] };

/** What a Gitea card asks of the page. */
export type GiteaIntent = {
  kind: "check" | "replace" | "repair" | "disconnect";
  connection: GiteaConnection;
};

/** What a GitLab card asks of the page. */
export type GitLabIntent = {
  kind: "check" | "replace" | "repair" | "disconnect";
  connection: GitLabConnection;
};

/** The generic app-password forms, for providers other than Apple. */
const genericProviders: ProviderId[] = ["imap", "caldav", "carddav"];

/** The section's body: the accounts the tools hold and the providers. */
export function IntegrationsOverview({
  list,
  checking,
  onCheck,
  onConnect,
  onSignInAgain,
  onChangeLevel,
  onStopSync,
  onRemove,
  onApple,
  onGitea,
  giteaChecks = {},
  giteaBusy,
  onGitLab,
  gitlabChecks = {},
  gitlabTokens = {},
  gitlabBusy,
  now = Date.now(),
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
  /** Opens the level choice for an account of a provider with levels. */
  onChangeLevel?: (account: Account) => void;
  onStopSync?: (account: Account) => void;
  onRemove: (account: Account) => void;
  onApple?: (intent: AppleIntent) => void;
  onGitea?: (intent: GiteaIntent) => void;
  /** Each Gitea connection's latest explicit check. */
  giteaChecks?: Record<string, GiteaCheck>;
  /** A Gitea write is on its way. */
  giteaBusy?: boolean;
  onGitLab?: (intent: GitLabIntent) => void;
  /** Each GitLab connection's latest explicit check. */
  gitlabChecks?: Record<string, GitLabAPI>;
  /** What GitLab says about each connection's token now. */
  gitlabTokens?: Record<string, GitLabTokenView>;
  /** A GitLab write is on its way. */
  gitlabBusy?: boolean;
  /** The clock a token's expiry is counted from. */
  now?: number;
}) {
  const key = (a: Account) => `${a.provider}:${a.address}`;
  const isChecking = (a: Account) => checking === "all" || checking.has(key(a));
  const giteaConnections = list.gitea?.connections ?? [];
  const gitlabConnections = list.gitlab?.connections ?? [];
  const shown = (p: Provider) =>
    p.accounts_unreadable ||
    (p.id === "gitea"
      ? giteaConnections.length > 0 || list.gitea?.state === "unavailable"
      : p.id === "gitlab"
        ? gitlabConnections.length > 0 || list.gitlab?.state === "unavailable"
        : list.accounts.some((a) => listedProvider(a) === p.id));
  const unreadable = list.providers.some((p) => p.accounts_unreadable);
  const connected = list.providers.filter(shown);
  // Gitea and GitLab are offered only where the installation ships the
  // qualified tea and glab; until then their tiles are not shown at all.
  const rest = list.providers.filter(
    (p) =>
      !shown(p) && ((p.id !== "gitea" && p.id !== "gitlab") || p.available),
  );
  const primary = rest.filter((p) => !genericProviders.includes(p.id));
  const others = rest.filter((p) => genericProviders.includes(p.id));
  const servicesOf = (accounts: Account[]) =>
    appleServices.filter((s) => accounts.some((a) => appleServiceOf(a) === s));
  const tile = (p: Provider) => (
    <div
      data-testid={`integration-tile-${p.id}`}
      className="ig-tile"
      data-settings-row={p.id}
      tabIndex={-1}
      key={p.id}
    >
      <ProviderMark provider={p.id} />
      <div>
        <span className="ig-rn">{providerCopy[p.id].name}</span>
        <span className="ig-meta">
          {p.available
            ? p.services.map((s) => serviceName(p.id, s)).join(" · ")
            : p.unavailable_reason === "app_credentials_required"
              ? txt.waitingAdmin
              : txt.unavailableHere}
        </span>
      </div>
      <ControlButton
        data-testid="integration-connect-open"
        size="row"
        variant="secondary"
        isDisabled={!p.available}
        onPress={() => onConnect(p)}
      >
        {txt.connect}
      </ControlButton>
    </div>
  );
  return (
    <div className="ig-main">
      {compact ? null : (
        <>
          <p className="ig-intro">{txt.intro}</p>
          <CloudFolderHint />
          <GrantLimits />
        </>
      )}
      {/* The personal-data skill maps mail, calendars and files, not Gitea. */}
      {skillNotice[list.skill] &&
      list.providers.some((p) => p.id !== "gitea") ? (
        <p className="ig-notice" role="status">
          <Icon name="warning" />
          <span>{unreadable ? txt.skillWaits : skillNotice[list.skill]}</span>
        </p>
      ) : null}
      {connected.length > 0 && (
        <>
          {compact ? null : <h3 className="ig-h3">{txt.connected}</h3>}
          {connected.map((p) => (
            <section
              className="ig-provider"
              key={p.id}
              data-settings-row={p.id}
              tabIndex={-1}
              aria-label={providerCopy[p.id].name}
            >
              {p.id === "apple"
                ? appleGroups(list.accounts).map((g) => (
                    <AppleCard
                      key={g.appleId}
                      appleId={g.appleId}
                      accounts={g.accounts}
                      checking={g.accounts.some(isChecking)}
                      onCheck={() => onCheck(g.accounts[0])}
                      // A partial inventory cannot say which services are
                      // missing, and the daemon refuses Apple writes then.
                      onRenew={
                        p.available && !p.accounts_unreadable && onApple
                          ? () =>
                              onApple({
                                kind: "renew",
                                appleId: g.appleId,
                                services: servicesOf(g.accounts),
                              })
                          : undefined
                      }
                      onAdd={
                        p.available && !p.accounts_unreadable && onApple
                          ? (missing) =>
                              onApple({
                                kind: "add",
                                appleId: g.appleId,
                                missing,
                              })
                          : undefined
                      }
                      onRemove={() =>
                        onApple?.({
                          kind: "remove",
                          appleId: g.appleId,
                          services: servicesOf(g.accounts),
                        })
                      }
                    />
                  ))
                : null}
              {p.accounts_unreadable ? (
                <p
                  className="ig-notice"
                  role="status"
                  data-testid={`integration-unreadable-${p.id}`}
                >
                  <Icon name="warning" />
                  <span>
                    {txt.unreadable(
                      providerCopy[p.id].gen,
                      unreadableDirectory[p.id],
                    )}
                  </span>
                </p>
              ) : null}
              {p.id === "gitea" ? (
                <>
                  {list.gitea?.state === "unavailable" ? (
                    <p
                      className="ig-notice"
                      role="status"
                      data-testid="gitea-unavailable"
                    >
                      <Icon name="warning" />
                      <span>{txt.teaUnreadable}</span>
                    </p>
                  ) : null}
                  {giteaConnections.map((c) => (
                    <GiteaCard
                      key={c.id}
                      connection={c}
                      check={giteaChecks[c.id]}
                      busy={giteaBusy || !p.available}
                      onCheck={() =>
                        onGitea?.({ kind: "check", connection: c })
                      }
                      onReplace={() =>
                        onGitea?.({ kind: "replace", connection: c })
                      }
                      onRepair={() =>
                        onGitea?.({ kind: "repair", connection: c })
                      }
                      onDisconnect={() =>
                        onGitea?.({ kind: "disconnect", connection: c })
                      }
                    />
                  ))}
                </>
              ) : null}
              {p.id === "gitlab" ? (
                <>
                  {list.gitlab?.state === "unavailable" ? (
                    <p
                      className="ig-notice"
                      role="status"
                      data-testid="gitlab-unavailable"
                    >
                      <Icon name="warning" />
                      <span>{txt.glabUnreadable}</span>
                    </p>
                  ) : null}
                  {gitlabConnections.map((c) => (
                    <GitLabCard
                      key={c.id}
                      connection={c}
                      token={gitlabTokens[c.id]}
                      check={gitlabChecks[c.id]}
                      busy={gitlabBusy || !p.available}
                      now={now}
                      onCheck={() =>
                        onGitLab?.({ kind: "check", connection: c })
                      }
                      onReplace={() =>
                        onGitLab?.({ kind: "replace", connection: c })
                      }
                      onRepair={() =>
                        onGitLab?.({ kind: "repair", connection: c })
                      }
                      onDisconnect={() =>
                        onGitLab?.({ kind: "disconnect", connection: c })
                      }
                    />
                  ))}
                </>
              ) : null}
              {list.accounts
                .filter((a) => p.id !== "apple" && listedProvider(a) === p.id)
                .map((a) => (
                  <AccountCard
                    key={key(a)}
                    account={a}
                    unavailable={
                      p.available
                        ? undefined
                        : (p.unavailable_reason ?? "tool_unavailable")
                    }
                    checking={isChecking(a)}
                    onCheck={() => onCheck(a)}
                    onSignInAgain={
                      p.available ? () => onSignInAgain(a) : undefined
                    }
                    onChangeLevel={
                      p.available && p.levels && onChangeLevel
                        ? () => onChangeLevel(a)
                        : undefined
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
                    {txt.addAnother(p.id, providerCopy[p.id].name)}
                  </ControlButton>
                </div>
              ) : null}
            </section>
          ))}
        </>
      )}
      {rest.length > 0 && (
        <>
          {compact ? null : <h3 className="ig-h3">{txt.addAccount}</h3>}
          {primary.length ? (
            <div className="ig-tiles">{primary.map(tile)}</div>
          ) : null}
          {others.length ? (
            <>
              {compact || !primary.length ? null : (
                <>
                  <h4 className="ig-h4">{txt.otherServices}</h4>
                  <p className="ig-meta ig-others">{txt.othersNote}</p>
                </>
              )}
              <div className="ig-tiles">{others.map(tile)}</div>
            </>
          ) : null}
        </>
      )}
      {compact ? null : <p className="ig-foot">{txt.foot}</p>}
    </div>
  );
}

// ---------- The connect dialog ----------

export type ConnectStage =
  /** account is set when the person changes an existing account's level. */
  | { stage: "intro"; account?: Account }
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
    { id: "login", label: txt.stepLogin(providerCopy[provider.id].name) },
    {
      id: "folders",
      label: txt.stepFolders(serviceName(provider.id, files)),
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
      aria-label={txt.steps}
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
      aria-label={txt.copyNamed(label)}
      onPress={() => {
        void navigator.clipboard?.writeText(value).then(
          () => setCopied(true),
          () => {},
        );
      }}
    >
      <Icon name={copied ? "check" : "copy"} />
      {copied ? txt.copied : txt.copy}
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
  if (!uri) return <p role="alert">{txt.badLoginAddress}</p>;
  return (
    <>
      <p
        className="ig-h"
        data-testid="integration-device-stage"
        data-login-phase={view.login_phase}
      >
        {txt.signInWithCode(providerCopy[view.provider ?? "microsoft"].ill)}
      </p>
      <p className="ig-p">
        {view.provider === "microsoft" ? txt.oneCode : txt.codeTool}
      </p>
      <div className="ig-code">
        <span
          data-testid="integration-device-code"
          className="ig-code-v"
          aria-hidden="true"
        >
          {code}
        </span>
        <span className="ig-sr">
          {txt.codeSpelled(code.split("").join(" "))}
        </span>
        <CopyButton value={code} label={txt.codeLabel} />
      </div>
      <div className="ig-row start">
        <ExternalButton href={uri}>{txt.open(host)}</ExternalButton>
      </div>
      <p className="ig-wait" role="status">
        <span className="ig-spin" aria-hidden="true" />
        <span>
          {txt.waitingCode} <b>{minutesLeft(left)}</b>
        </span>
      </p>
      <p className="ig-fine">
        {txt.onlyHere(providerCopy[view.provider ?? "microsoft"].gen)}
      </p>
      <div className="ig-row">
        <ControlButton
          data-testid="cancel"
          size="page"
          variant="secondary"
          onPress={onCancel}
        >
          {txt.cancel}
        </ControlButton>
      </div>
    </>
  );
}

/** The providers Pi signs in through its own remote MCP OAuth. Their
 * administrator request, refusal and re-consent copy is their own. */
const mcpText = { atlassian: atlassianText, trello: trelloText } as const;
type MCPProvider = keyof typeof mcpText;
const isMCP = (p?: ProviderId): p is MCPProvider =>
  p === "atlassian" || p === "trello";

function ApprovalRequest({ provider }: { provider: MCPProvider }) {
  const text = liveText(mcpText[provider]);
  return (
    <section data-testid={`${provider}-approval-request`}>
      <p className="ig-h">{text.waiting}</p>
      <p className="ig-p">{text.help}</p>
      <p className="ig-p" data-testid={`${provider}-approval-text`}>
        {text.request}
      </p>
      <CopyButton value={text.request} label={text.copy} />
    </section>
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
  if (!href) return <p role="alert">{txt.badLoginAddress}</p>;
  if (!opened)
    return (
      <>
        <p className="ig-h">{txt.signInAt(copy.site)}</p>
        <p className="ig-p">{txt.siteAsks(copy.site)}</p>
        {isMCP(view.provider) && <ApprovalRequest provider={view.provider} />}
        <RedirectExpected site={copy.site} prefix={prefix} />
        <div className="ig-row start">
          <ExternalButton href={href} onOpen={() => setOpened(true)}>
            {txt.open(copy.site)}
          </ExternalButton>
        </div>
        <div className="ig-row">
          <ControlButton
            data-testid="cancel"
            size="page"
            variant="secondary"
            onPress={onCancel}
          >
            {txt.cancel}
          </ControlButton>
        </div>
      </>
    );
  const submit = () => {
    const v = value.trim();
    if (!v) return setLocal(txt.pasteFirst);
    if (!redirectMatches(prefix, v))
      return setLocal(txt.notThatAddress(prefix));
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
      <p className="ig-h">{txt.pasteWhere(copy.site)}</p>
      {isMCP(view.provider) && <ApprovalRequest provider={view.provider} />}
      <RedirectExpected site={copy.site} prefix={prefix} />
      <ol className="ig-how">
        <li>{txt.approveTab}</li>
        <li>{txt.copyAddress}</li>
      </ol>
      <TextField
        data-testid="integration-redirect-input"
        label={txt.returnAddress}
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
          {txt.validFor} <b>{minutesLeft(left)}</b>.{" "}
          <a
            className="ig-link"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            {txt.openAgain(copy.site)}
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
          {txt.cancel}
        </ControlButton>
        <ControlButton
          data-testid="integration-connect"
          size="page"
          variant="primary"
          type="submit"
          isPending={busy}
        >
          {txt.connectSubmit}
        </ControlButton>
      </div>
    </form>
  );
}

/** The pasted-redirect sign-in ends on a page that does not load. Said
 * before the person leaves for the provider and again on return, so that
 * the error page reads as the expected last step, not as a failure. */
function RedirectExpected({ site, prefix }: { site: string; prefix: string }) {
  return (
    <div
      className="ig-expect"
      role="note"
      data-testid="integration-redirect-expected"
    >
      <Icon name="info" />
      <div>
        <strong>{txt.errorPageLead}</strong>{" "}
        {txt.errorPageBody(site, <code>{prefix}</code>)}
      </div>
    </div>
  );
}

/** A folder's size as the person reads it before choosing. */
function folderSize(f: Folder): string {
  if (f.bytes !== undefined)
    return f.estimated ? txt.about(gigabytes(f.bytes)) : gigabytes(f.bytes);
  return f.measuring ? txt.measuring : txt.sizeLater;
}

function FolderStep({
  view,
  provider,
  busy,
  error,
  onChoose,
  onSkip,
  onCancel,
}: {
  view: LoginView;
  provider: Provider;
  busy?: boolean;
  error?: string;
  onChoose: (ids: string[]) => void;
  /** Present when the login serves other services than files. */
  onSkip?: () => void;
  onCancel: () => void;
}) {
  const folders: Folder[] = view.folders ?? [];
  const [selected, setSelected] = useState(() =>
    folders.filter((f) => f.suggested).map((f) => f.id),
  );
  const total = selectedBytes(folders, selected);
  const free = view.free_bytes ?? 0;
  const quota = view.quota_bytes;
  const chosen = folders.filter((f) => selected.includes(f.id));
  const unknown =
    view.free_bytes === undefined || chosen.some((f) => f.bytes === undefined);
  const estimated = chosen.some((f) => f.estimated);
  const over = !unknown && total > free;
  const files = provider.services.find((s) => fileServices.includes(s));
  // The whole drive does not fit: say so before the list, so the choice of
  // folders (or none) is the obvious next step.
  const whole = folders.find((f) => f.whole);
  const wholeOver =
    whole?.bytes !== undefined &&
    view.free_bytes !== undefined &&
    whole.bytes > free;
  const toggle = (f: Folder, on: boolean) =>
    setSelected((s) => {
      if (!on) return s.filter((x) => x !== f.id);
      // The whole drive holds every folder; it is chosen alone.
      if (f.whole) return [f.id];
      return [
        ...s.filter((x) => !folders.find((g) => g.id === x)?.whole),
        f.id,
      ];
    });
  return (
    <>
      <p data-testid="integration-folder-choice" className="ig-h">
        {txt.whichFolders(<code>{view.directory}</code>)}
      </p>
      <p className="ig-p">{txt.foldersStay}</p>
      {wholeOver && whole?.bytes !== undefined ? (
        <p
          className="ig-notice"
          role="status"
          data-testid="integration-folders-too-big"
        >
          <Icon name="warning" />
          <span>
            {txt.wholeOver(
              whole.name,
              !!whole.estimated,
              gigabytes(whole.bytes),
              gigabytes(free),
              folders.length > 1,
              !!onSkip,
            )}
          </span>
        </p>
      ) : null}
      <fieldset className="ig-folders">
        <legend className="ig-sr">
          {files ? serviceName(provider.id, files) : txt.folders}
        </legend>
        {folders.map((f) => (
          <div
            className={`ig-folder${f.whole ? " whole" : ""}`}
            key={f.id}
            data-testid={`integration-folder-row-${f.id}`}
            data-measuring={f.measuring === true}
            data-known={f.bytes !== undefined}
          >
            <Checkbox
              data-testid={`integration-folder-${f.id}`}
              label={f.name}
              checked={selected.includes(f.id)}
              onChange={(on) => toggle(f, on)}
            />
            <span className="ig-meta">{folderSize(f)}</span>
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
          {selected.length === 0 ? (
            <span>
              {txt.nothingChosen}{" "}
              {view.free_bytes !== undefined ? txt.free(gigabytes(free)) : null}
            </span>
          ) : unknown ? (
            <span>
              {txt.measuringChosen}{" "}
              {view.free_bytes !== undefined
                ? txt.free(gigabytes(free))
                : txt.freeUnknown}
            </span>
          ) : over ? (
            <>
              <Icon name="warning" />
              <span>
                {txt.over(estimated, gigabytes(total), gigabytes(free))}
              </span>
            </>
          ) : (
            <span>
              {txt.chosen(
                estimated,
                gigabytes(total),
                gigabytes(free),
                quota ? gigabytes(quota) : undefined,
              )}
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
          {txt.cancel}
        </ControlButton>
        {onSkip ? (
          <ControlButton
            data-testid="integration-sync-skip"
            size="page"
            variant="secondary"
            isDisabled={busy}
            onPress={onSkip}
          >
            {txt.skipFiles}
          </ControlButton>
        ) : null}
        <ControlButton
          size="page"
          variant="primary"
          isDisabled={(over && !estimated) || selected.length === 0}
          isPending={busy}
          data-testid="integration-sync-start"
          onPress={() => onChoose(selected)}
        >
          <Icon name="refresh" />
          {txt.startSync}
        </ControlButton>
      </div>
    </>
  );
}

function FailedStep({
  view,
  error,
  others,
  onRestart,
  onClose,
}: {
  view: LoginView;
  /** Why the host refused to start the sign-in; replaces the generic text. */
  error?: string;
  /** The login also serves other services than files. */
  others: boolean;
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
        {txt.close}
      </ControlButton>
      <ControlButton size="page" variant="primary" onPress={onRestart}>
        {txt.restart}
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
                ? txt.quotaInsufficient
                : txt.quotaUnknown}{" "}
              {txt.nothingCopied}
            </span>
          </p>
          <p className="ig-p">
            {others ? txt.keptOthers : txt.kept} {txt.moreSpace}
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
              <b>{txt.consentLead}</b> {txt.consentBody}
            </span>
          </p>
          {consent ? (
            <>
              <p className="ig-p">{txt.sendLink}</p>
              <div className="ig-url">
                <code data-testid="integration-consent-link">{consent}</code>
                <CopyButton value={consent} label={txt.consentLink} />
              </div>
            </>
          ) : null}
          <p className="ig-p">{txt.afterConsent}</p>
          {restart}
        </>
      );
    case "nothing_granted":
      return (
        <>
          <p
            className="ig-result bad"
            role="alert"
            data-testid="integration-nothing-granted"
          >
            <Icon name="stop" />
            <span>
              <b>{txt.nothingGrantedLead}</b>{" "}
              {txt.nothingGrantedBody(copy.site)}
            </span>
          </p>
          <p className="ig-p">{txt.grantOne}</p>
          {restart}
        </>
      );
    case "final_sync_failed":
      return (
        <>
          <p
            className="ig-result bad"
            role="alert"
            data-testid="integration-final-sync-failed"
          >
            <Icon name="warning" />
            <span>
              <b>{txt.levelNotChanged}</b>{" "}
              {txt.finalSyncFailed(view.provider === "google")}
            </span>
          </p>
          <p className="ig-p">{txt.checkFiles}</p>
          {restart}
        </>
      );
    case "permission_refused":
      return (
        <p className="ig-err" role="alert">
          {
            liveText(
              mcpText[isMCP(view.provider) ? view.provider : "atlassian"],
            ).refused
          }
        </p>
      );
    case "already_connected":
      return (
        <>
          <p
            className="ig-result bad"
            role="alert"
            data-testid="integration-already-connected"
          >
            <Icon name="warning" />
            <span>{txt.alreadyConnected()}</span>
          </p>
          {restart}
        </>
      );
    case "revoke_failed":
      return (
        <>
          <p
            className="ig-result bad"
            role="alert"
            data-testid="integration-revoke-failed"
          >
            <Icon name="warning" />
            <span>{txt.revokeFailed(copy.gen)}</span>
          </p>
          <p className="ig-p">{txt.tryLater}</p>
          {restart}
        </>
      );
    case "device_code_blocked":
      return (
        <>
          <p className="ig-result bad" role="alert">
            <Icon name="stop" />
            <span>{txt.deviceBlocked(copy.site)}</span>
          </p>
          <p className="ig-p">{txt.allowDevice}</p>
          <div className="ig-row">
            <ControlButton
              data-testid="dialog-close"
              size="page"
              variant="primary"
              onPress={onClose}
            >
              {txt.close}
            </ControlButton>
          </div>
        </>
      );
    case "expired":
      return (
        <>
          <p className="ig-result" role="alert">
            <Icon name="clock" />
            <span>{txt.expired}</span>
          </p>
          {restart}
        </>
      );
    case "redirect_rejected":
      return (
        <>
          <p className="ig-result bad" role="alert">
            <Icon name="warning" />
            <span>{txt.redirectRejected(copy.site)}</span>
          </p>
          {restart}
        </>
      );
    case "account_mismatch":
      return (
        <>
          <p className="ig-result bad" role="alert">
            <Icon name="warning" />
            <span>{txt.accountMismatch(view.address ?? "")}</span>
          </p>
          {restart}
        </>
      );
    case "cancelled":
      return (
        <>
          <p className="ig-result">
            <Icon name="cross" />
            <span>{txt.cancelled}</span>
          </p>
          {restart}
        </>
      );
    default:
      return (
        <>
          <p
            className="ig-result bad"
            role="alert"
            data-testid="integration-login-failed"
          >
            <Icon name="warning" />
            <span>{error ?? txt.failed}</span>
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
        <p className="ig-p">{txt.newAppPassword(relogin)}</p>
      ) : (
        <p className="ig-p">{txt.passwordIntro(dav)}</p>
      )}
      {!relogin && (
        <>
          <TextField
            data-testid="integration-address"
            label={txt.email}
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
              label={txt.davAddress}
              value={a.url ?? ""}
              onChange={(v) => set({ url: v })}
            />
          ) : (
            <>
              <div className="ig-pair">
                <TextField
                  data-testid="integration-imap-host"
                  label={txt.imapServer}
                  mono
                  value={a.server}
                  onChange={(v) => {
                    setTouchedServer(true);
                    set({ server: v });
                  }}
                />
                <TextField
                  label={txt.port}
                  mono
                  value={String(a.port || "")}
                  onChange={(v) =>
                    set({ port: Number(v.replace(/\D/g, "")) || 0 })
                  }
                />
              </div>
              <Segmented
                label={txt.security}
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
                label={txt.smtpServer}
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
                    label={txt.smtpPort}
                    value={String(a.smtp_port ?? "")}
                    onChange={(v) =>
                      set({ smtp_port: Number(v.replace(/\D/g, "")) || 0 })
                    }
                  />
                  <Segmented
                    label={txt.smtpSecurity}
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
            label={txt.username}
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
          {txt.cancel}
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
          {relogin ? txt.changePassword : txt.connectSubmit}
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
      <span>{txt.appPassword}</span>
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

/** Why the provider has no boundary for a level, honestly. */
function notOffered(provider: ProviderId, level: Level): string {
  const copy = providerCopy[provider];
  if (provider === "google" && level === "drafts") return txt.googleNoDrafts;
  return txt.notOffered(copy.site);
}

/** The level cards: each level the provider offers, one chosen. A level
 * the server lacks the application for is shown and says who adds it; the
 * chosen card lists what agents get in each service. */
function LevelChoice({
  provider,
  level,
  onChange,
}: {
  provider: Provider;
  level?: Level;
  onChange: (level: Level) => void;
}) {
  const copy = providerCopy[provider.id];
  return (
    <AriaRadioGroup
      className="ig-levels"
      aria-label={txt.level}
      value={level ?? null}
      onChange={(v) => onChange(v as Level)}
    >
      {(provider.levels ?? []).map((l) => {
        const text = levelCopy[provider.id]?.[l.id];
        return (
          <Radio
            key={l.id}
            value={l.id}
            isDisabled={!l.available}
            className="ig-level"
            data-testid={`integration-level-${l.id}`}
          >
            <span className="ig-level-dot" aria-hidden="true" />
            <span className="ig-level-body">
              <b className="ig-level-name">{text?.name ?? l.id}</b>
              <span className="ig-meta">
                {l.available
                  ? text?.sum
                  : l.reason === "not_offered"
                    ? notOffered(provider.id, l.id)
                    : txt.levelNeedsApp(copy.name)}
              </span>
              {l.available && level === l.id ? (
                <ul className="ig-level-svc">
                  {provider.services
                    .filter((s) => s !== "sharepoint")
                    .map((s) => (
                      <li key={s}>
                        <b className="ig-level-svc-name">
                          {serviceName(provider.id, s)}
                        </b>
                        <span className="ig-level-svc-text">
                          {levelAbility(l.id, s)}
                        </span>
                      </li>
                    ))}
                </ul>
              ) : null}
            </span>
          </Radio>
        );
      })}
    </AriaRadioGroup>
  );
}

/** What changing an account's level does, before the person signs in. */
function LevelChange({
  provider,
  account,
  level,
}: {
  provider: Provider;
  account: Account;
  level: Level;
}) {
  const copy = providerCopy[provider.id];
  const current = accountLevel(account);
  const file = provider.services.find((s) => fileServices.includes(s));
  const before = account.services.find((s) => s.id === file)?.access;
  const appFolder = (l?: Level) => l === "app_folder";
  const items: [IconName, string][] = [
    ["external", txt.signInAgainAt(copy.gen)],
    [
      "lock",
      isMCP(provider.id)
        ? liveText(mcpText[provider.id]).reauthorize
        : provider.id === "dropbox"
          ? txt.dropboxRevokes
          : provider.id === "google"
            ? txt.googleRevokes
            : txt.oldRemoved(copy.site, copy.gen),
    ],
  ];
  if (file) {
    const name = serviceName(provider.id, file);
    const after = levelAccess(level, file);
    const rootChanges = appFolder(account.level) !== appFolder(level);
    if (before === "full" && (after !== "full" || rootChanges))
      items.push(["refresh", txt.finalSync(name)]);
    if (rootChanges)
      items.push([
        "folder",
        appFolder(level) ? txt.toAppFolder : txt.fromAppFolder,
      ]);
    if (after === "read" && before !== "read")
      items.push(["folder", txt.becomesMirror(name)]);
    if (after === "full" && before === "read" && !rootChanges)
      items.push(["folder", txt.syncsAgain(name)]);
  }
  return (
    <>
      <p className="ig-fromto" data-testid="integration-level-change">
        {current ? (
          <span className={`ig-lv ${current.full ? "full" : "narrow"}`}>
            {current.text}
          </span>
        ) : null}
        <span aria-hidden="true">→</span>
        <span className={`ig-lv ${level === "full" ? "full" : "narrow"}`}>
          {levelName(provider.id, level)}
        </span>
      </p>
      <ul className="ig-change">
        {items.map(([icon, text]) => (
          <li key={text}>
            <Icon className="ig-change-icon" name={icon} />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The dialog's warning follows the chosen level: what agents can do with
 * it, or that a narrower level still lets them pass on what they read. */
function LevelWarning({
  provider,
  level,
}: {
  provider: Provider;
  level: Level;
}) {
  if (isMCP(provider.id))
    return (
      <div
        className="ig-warn"
        role="note"
        data-testid="integration-level-warning"
      >
        {levelCopy[provider.id]?.[level]?.sum}
      </div>
    );
  const can: string[] = [];
  const services = provider.services;
  if (services.includes("mail") && levelAccess(level, "mail") === "full")
    can.push(txt.canSendMail);
  if (
    services.includes("calendar") &&
    levelAccess(level, "calendar") === "full"
  )
    can.push(txt.canCalendar);
  const file = services.find((s) => fileServices.includes(s));
  if (file && level === "app_folder") can.push(txt.canAppFolder);
  else if (file && levelAccess(level, file) === "full") can.push(txt.canFiles);
  const first = can.length
    ? txt.agentsCan(can)
    : level === "drafts"
      ? txt.draftsWarning
      : txt.readWarning;
  return (
    <div
      className="ig-warn"
      role="note"
      data-testid="integration-level-warning"
    >
      <Icon name="shield" />
      <div>
        <strong>{first}</strong>{" "}
        {txt.levelWarningRest(providerCopy[provider.id].site)}
      </div>
    </div>
  );
}

function Intro({
  provider,
  account,
  onContinue,
  onCancel,
}: {
  provider: Provider;
  /** The account whose level changes; absent when connecting a new one. */
  account?: Account;
  onContinue: (level?: Level) => void;
  onCancel: () => void;
}) {
  const copy = providerCopy[provider.id];
  const offered = provider.levels?.filter((l) => l.available) ?? [];
  const current = account?.level;
  const [level, setLevel] = useState<Level | undefined>(() =>
    current && offered.some((l) => l.id === current) ? current : offered[0]?.id,
  );
  const how =
    provider.login === "device_code"
      ? txt.howDevice(copy.gen)
      : provider.login === "pasted_redirect"
        ? txt.howPaste(copy.site)
        : txt.howPassword;
  const continueButton = (
    <ControlButton
      data-testid="integration-continue"
      size="page"
      variant="primary"
      isDisabled={
        provider.levels !== undefined &&
        (!level || (account !== undefined && level === current))
      }
      onPress={() => onContinue(level)}
    >
      {provider.login === "app_password" ? null : <Icon name="external" />}
      {txt.continueTo(
        provider.login === "app_password" ? undefined : copy.site,
      )}
    </ControlButton>
  );
  const buttons = (
    <div className="ig-row">
      <ControlButton
        data-testid="cancel"
        size="page"
        variant="secondary"
        onPress={onCancel}
      >
        {txt.cancel}
      </ControlButton>
      {continueButton}
    </div>
  );
  if (provider.levels)
    return (
      <>
        {account || provider.id === "google" || isMCP(provider.id) ? null : (
          <CloudFolderHint />
        )}
        <p className="ig-lead">{txt.whatMay}</p>
        <LevelChoice provider={provider} level={level} onChange={setLevel} />
        {account && level ? (
          <LevelChange provider={provider} account={account} level={level} />
        ) : (
          <p className="ig-p">
            {how}
            {/* Pi asks for the level but cannot hold the provider to it. */}
            {isMCP(provider.id) ? null : (
              <> {txt.levelAsked(copy.gen, copy.site)}</>
            )}
          </p>
        )}
        {level ? <LevelWarning provider={provider} level={level} /> : null}
        {provider.id === "trello" && (
          <p className="ig-p" data-testid="trello-workspaces">
            {liveText(trelloText).workspaces}
          </p>
        )}
        {isMCP(provider.id) && <ApprovalRequest provider={provider.id} />}
        {buttons}
      </>
    );
  return (
    <>
      {(provider.id === "microsoft" || provider.id === "dropbox") && (
        <CloudFolderHint />
      )}
      <p className="ig-lead">{txt.agentsGet}</p>
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
                  ? txt.pickFiles
                  : s === "mail"
                    ? txt.pickMail
                    : txt.pickOther}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="ig-p">{how}</p>
      <AgentWarning />
      {buttons}
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
  onSkipFolders,
  onRestart,
  onClose,
}: {
  provider?: Provider;
  stage: ConnectStage;
  /** Starts the sign-in, at the chosen level for a provider with levels. */
  onContinue: (level?: Level) => void;
  onPassword: (account: PasswordAccount) => void;
  onPaste: (url: string) => void;
  onFolders: (ids: string[]) => void;
  /** Completes the sign-in without files, for a provider with other services. */
  onSkipFolders?: () => void;
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
  const title =
    stage.stage === "intro" && stage.account
      ? txt.titleLevel(copy.name)
      : relogin
        ? txt.titleRelogin(copy.name)
        : txt.titleConnect(provider.id, copy.name);
  let body: ReactNode = null;
  switch (stage.stage) {
    case "intro":
      body = (
        <Intro
          provider={provider}
          account={stage.account}
          onContinue={onContinue}
          onCancel={onClose}
        />
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
            <span>{txt.uncertain}</span>
          </p>
          <div className="ig-row">
            <ControlButton
              data-testid="dialog-close"
              size="page"
              variant="primary"
              onPress={onClose}
            >
              {txt.close}
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
              {stage.relogin
                ? txt.reloggedIn(stage.address)
                : txt.connectedTo(stage.address)}
            </span>
          </p>
          <div className="ig-row">
            <ControlButton
              data-testid="integration-done"
              size="page"
              variant="primary"
              onPress={onClose}
            >
              {txt.done}
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
          <span>{txt.sitesUnavailable(v.unavailable_sites.join(", "))}</span>
        </p>
      ) : null;
      const teamsLeftOut = v.teams_left_out ? (
        <p
          className="ig-result bad"
          role="status"
          data-testid="integration-teams-left-out"
        >
          <Icon name="warning" />
          <span>
            {v.teams_left_out === "too_many" && v.teams_not_offered?.length
              ? txt.teamsNotOffered(v.teams_not_offered.join(", "))
              : txt.teamsLeftOut[v.teams_left_out]}
          </span>
        </p>
      ) : null;
      const leftOut =
        unavailableSites || teamsLeftOut ? (
          <>
            {unavailableSites}
            {teamsLeftOut}
          </>
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
                ? txt.initialSync
                : v.state === "completing"
                  ? v.login_phase === "files_discovery"
                    ? txt.filesDiscovery
                    : v.login_phase === "outlook_finishing"
                      ? txt.outlookFinishing
                      : txt.finishing
                  : txt.starting}
            </p>
            {v.state === "completing" && v.address && (
              <>
                {v.progress && <SyncProgressStatus progress={v.progress} />}
                <p className="ig-p">{txt.closeAnytime}</p>
                <ControlButton
                  data-testid="integration-sync-background"
                  size="page"
                  variant="secondary"
                  onPress={onClose}
                >
                  {txt.background}
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
              onSkip={
                // A renewal's folder step chooses again among files that may
                // already sync; leaving them out is not offered there.
                onSkipFolders &&
                !v.relogin &&
                provider.services.some((s) => !fileServices.includes(s))
                  ? onSkipFolders
                  : undefined
              }
              onCancel={onClose}
            />
          </>
        );
      else if (v.state === "failed")
        body = (
          <FailedStep
            view={v}
            error={stage.error}
            others={provider.services.some((s) => !fileServices.includes(s))}
            onRestart={onRestart}
            onClose={onClose}
          />
        );
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
                {v.relogin
                  ? txt.reloggedIn(v.address ?? "")
                  : txt.connectedTo(v.address ?? "")}
              </span>
            </p>
            {leftOut}
            {dir ? <p className="ig-p">{txt.foldersContinue}</p> : null}
            <div className="ig-row">
              <ControlButton
                data-testid="integration-done"
                size="page"
                variant="primary"
                onPress={onClose}
              >
                {txt.done}
              </ControlButton>
            </div>
          </>
        );
      }
      if (leftOut && v.state !== "completed")
        body = (
          <>
            {body}
            {leftOut}
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
          data-provider={provider.id}
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
              aria-label={txt.close}
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
      ? txt.lostTools(
          tools.map((s) => serviceName(account.provider, s.id)).join(txt.and),
        )
      : "",
    dirs.length ? txt.lostSync(copy.ill) : "",
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
          data-provider={account.provider}
          aria-label={txt.removeQuestion(account.address)}
        >
          <Heading slot="title">
            {txt.removeTitle(copy.name, account.address)}
          </Heading>
          <p>
            {lost} {txt.signInRemoved}{" "}
            {["imap", "caldav", "carddav"].includes(account.provider)
              ? txt.appPasswordStays(account.provider === "imap")
              : txt.grantStays(copy.name)}
          </p>
          {dirs.length ? (
            <Checkbox
              data-testid="integration-remove-files"
              label={txt.trashFolders(dirs.map((d) => d.directory ?? ""))}
              hint={txt.trashHint}
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
              {txt.cancel}
            </ControlButton>
            <ControlButton
              data-testid="integration-remove-confirm"
              size="page"
              variant="danger"
              isPending={busy}
              onPress={() => onConfirm(trash)}
            >
              {txt.removeConfirm}
            </ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
