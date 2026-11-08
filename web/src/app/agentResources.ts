import accountSchema from "../../../contracts/v1/integration-account.schema.json";
import filesSchema from "../../../contracts/v1/integration-files.schema.json";
import listSchema from "../../../contracts/v1/integrations.schema.json";
import type { IconName } from "../components/Icon";
import {
  accountLevel,
  providerCopy,
  serviceName,
} from "../components/Integrations";
import { formatDate, liveText } from "../i18n";
import { agentResourcesText } from "../text/agentResources";
import type { GiteaConnection } from "./gitea";
import type { GitLabConnection } from "./gitlab";
import {
  type Access,
  type Account,
  bounded,
  type IntegrationList,
  type Level,
  type ProviderId,
  Refused,
  type Service,
  type ServiceId,
  syncedTime,
} from "./integrations";
import { LazyAjv } from "./lazyAjv";
import { machineState, type OwnMachines } from "./ownMachines";
import { settingsHref } from "./settingsRoute";

// Agentin käytössä (experimental): everything the person's agents use, by
// kind, built in the browser from reads the host already answers (the
// integrations list, Omat koneet, the snapshot's GitHub state) plus the one
// folder read of the synced folders. Nothing here is stored; every source
// says what is included, what is not and what the agent may do, and leads to
// its settings.

const txt = liveText(agentResourcesText);

const ajv = new LazyAjv({ strict: false, addFormats: true });
ajv.addSchema(listSchema);
ajv.addSchema(accountSchema);
const validFiles = ajv.compile(filesSchema);

export type Kind =
  | "files"
  | "mail"
  | "calendar"
  | "contacts"
  | "code"
  | "machines";
export const kinds: { id: Kind; icon: IconName }[] = [
  { id: "files", icon: "folder" },
  { id: "mail", icon: "mail" },
  { id: "calendar", icon: "calendar" },
  { id: "contacts", icon: "contacts" },
  { id: "code", icon: "repo" },
  { id: "machines", icon: "laptop" },
];

export type FileRoot = {
  provider: "google" | "microsoft" | "dropbox";
  address: string;
  service: "drive" | "onedrive" | "sharepoint" | "dropbox";
  directory: string;
};
export type FolderEntry = {
  name: string;
  kind: "file" | "folder";
  bytes?: number;
  modified_at: string;
};
export type Folder = {
  directory: string;
  folder?: string;
  entries: FolderEntry[];
  truncated: boolean;
  unlisted?: number;
};

const filesPath = "/api/v1/integrations/files";

async function readFiles<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (response.status >= 400 && response.status < 500) {
    let code = "";
    try {
      const body = (await bounded(response, 4096)) as {
        error?: { code?: unknown };
      };
      if (typeof body?.error?.code === "string") code = body.error.code;
    } catch {}
    throw new Refused(response.status, /^[a-z_]{1,64}$/.test(code) ? code : "");
  }
  if (!response.ok) throw Error("uncertain");
  const value = await bounded(response, 1024 * 1024);
  if (!validFiles(value)) throw Error("invalid");
  return value as T;
}

/** The synced folders the agent reaches that exist now. */
export async function readFileRoots(signal?: AbortSignal) {
  const reply = await readFiles<{ roots?: FileRoot[] }>(filesPath, signal);
  if (!reply.roots) throw Error("invalid");
  return reply.roots;
}

/** One folder of a synced folder, read by the daemon as the person. */
export async function readFolder(
  directory: string,
  folder: string,
  signal?: AbortSignal,
): Promise<Folder> {
  const query = new URLSearchParams({ directory });
  if (folder) query.set("folder", folder);
  const reply = await readFiles<Folder & { roots?: unknown }>(
    `${filesPath}?${query}`,
    signal,
  );
  if (reply.roots || reply.directory !== directory) throw Error("invalid");
  if ((reply.folder ?? "") !== folder) throw Error("invalid");
  return reply;
}

// ---------- The view ----------

export type Can = "change" | "read" | "none";
export type Verb = {
  label: string;
  yes: boolean;
  note?: string;
  /** Something the grant allows that no setting here can narrow. */
  cannotBlock?: boolean;
};
export type ScopeRow = {
  what: string;
  meta?: string;
  mono?: boolean;
  icon: IconName;
};
export type Hidden = {
  id: string;
  what: string;
  why: string;
  action?: { label: string; href: string };
};
/** A link out; place is the service as a sentence names it ("Outlookissa"). */
export type Link = { label: string; href: string; place?: string };
export type Source = {
  id: string;
  kind: Kind;
  mark: string;
  tone: 0 | 1 | 2 | 3;
  name: string;
  /** The account's name: "Microsoft 365", "GitHub", "Omat koneet". */
  account: string;
  who?: string;
  place?: string;
  pill?: { text: string; full: boolean };
  can: Can;
  settings: Link;
  web?: Link;
  scope: ScopeRow[];
  hidden: Hidden[];
  verbs: Verb[];
  /** Where the content itself is seen, for a source that is not browsed. */
  elsewhere?: { what: string; link?: Link };
  /** A browsable synced folder. */
  directory?: string;
  /** A file service whose folder cannot be read now, and why. */
  unavailable?: string;
  /** Omat koneet: the machine's facts. */
  facts?: { label: string; value: string; mono?: boolean }[];
};
export type Offer = {
  id: string;
  mark: string;
  tone: 0 | 1 | 2 | 3;
  name: string;
  /** What it would bring, by the kind it is listed under. */
  what: Partial<Record<Kind, string>>;
  kinds: Kind[];
  href: string;
  add?: boolean;
};
export type Resources = {
  sources: Source[];
  offers: Offer[];
  connections: number;
};

export type GitHubState = { state: string; login?: string } | undefined;

const fileServices: ServiceId[] = [
  "drive",
  "onedrive",
  "sharepoint",
  "dropbox",
];
const kindOf = (id: ServiceId): Kind | undefined =>
  fileServices.includes(id)
    ? "files"
    : id === "mail" || id === "calendar" || id === "contacts"
      ? id
      : undefined;

/** What the grant lets a service do. A level never claims less than the
 * token can do, so an unreadable grant counts as everything. */
function accessOf(account: Account, service: Service): Access {
  if (service.access) return service.access;
  const level: Level | undefined = account.level;
  if (!level || level === "full" || level === "app_folder") return "full";
  if ((level === "drafts" || level === "nosend") && service.id === "mail")
    return "drafts";
  if (level === "nosend") return "full";
  return "read";
}

const canOf = (access: Access): Can =>
  access === "none" ? "none" : access === "read" ? "read" : "change";

/** The settings row of an account, as the integrations page names it. */
function accountRow(account: Account): ProviderId {
  return account.apple_id ? "apple" : account.provider;
}

const enc = encodeURIComponent;

/** The provider's own page for a service, opened as this account where the
 * provider lets a link choose it. */
function webLink(account: Account, service: ServiceId): Link | undefined {
  const google = (url: string) => `${url}?authuser=${enc(account.address)}`;
  const at = (place: keyof typeof txt.places, href: string): Link => ({
    label: txt.open(txt.places[place]),
    href,
    place: txt.places[place],
  });
  if (account.provider === "google") {
    if (service === "mail")
      return at("gmail", google("https://mail.google.com/mail/"));
    if (service === "calendar")
      return at("calendar", google("https://calendar.google.com/calendar/"));
    if (service === "contacts")
      return at("contacts", google("https://contacts.google.com/"));
    if (service === "drive")
      return at("drive", google("https://drive.google.com/drive/my-drive"));
  }
  if (account.provider === "microsoft") {
    if (service === "mail")
      return at("outlook", "https://outlook.office.com/mail/");
    if (service === "calendar")
      return at("outlook", "https://outlook.office.com/calendar/");
    if (service === "contacts")
      return at("outlook", "https://outlook.office.com/people/");
    if (service === "onedrive")
      return at("onedrive", "https://www.microsoft365.com/onedrive");
  }
  if (account.provider === "dropbox")
    return at("dropbox", "https://www.dropbox.com/home");
  return undefined;
}

function pillOf(account: Account, access: Access) {
  if (access === "none") return { text: txt.pill.none, full: false };
  const level = accountLevel(account);
  if (level) return level;
  return access === "read"
    ? { text: txt.pill.read, full: false }
    : { text: txt.pill.full, full: true };
}

function fileVerbs(account: Account, access: Access): Verb[] {
  const v = txt.verbs;
  if (access === "none")
    return [
      { label: v.read, yes: false },
      { label: v.change, yes: false },
      { label: v.delete, yes: false },
    ];
  if (account.level === "app_folder")
    return [
      { label: v.read, yes: true, note: v.appFolderNote },
      { label: v.change, yes: true, note: v.changeNote },
      { label: v.delete, yes: true, note: v.deleteNote },
      { label: v.share, yes: false },
    ];
  const full = access === "full";
  return [
    { label: v.read, yes: true },
    {
      label: v.change,
      yes: full,
      note: full ? v.changeNote : v.mirrorNote,
    },
    { label: v.delete, yes: full, note: full ? v.deleteNote : undefined },
    // A full grant to the files is also the right to share them; the level
    // is the only boundary, so it cannot be narrowed here.
    { label: v.share, yes: full, cannotBlock: full },
  ];
}

function serviceVerbs(service: ServiceId, access: Access): Verb[] {
  const v = txt.verbs;
  const writes = access === "full" || access === "drafts";
  const none = access === "none";
  if (service === "mail")
    return [
      { label: v.read, yes: !none },
      {
        label: v.organise,
        yes: writes,
        note: writes ? v.organiseNote : undefined,
      },
      { label: v.drafts, yes: writes },
      { label: v.send, yes: access === "full" },
    ];
  if (service === "calendar")
    return [
      { label: v.read, yes: !none },
      { label: v.events, yes: access === "full" },
      {
        label: v.invite,
        yes: access === "full",
        note: access === "full" ? v.inviteNote : undefined,
        cannotBlock: access === "full",
      },
    ];
  return [
    { label: v.read, yes: !none },
    { label: v.editContacts, yes: access === "full" },
  ];
}

/** Why a file service's folder cannot be shown now, from its state. */
function fileTrouble(service: Service): string | undefined {
  if (
    service.state === "credentials_rejected" ||
    service.state === "login_expired"
  )
    return txt.scope.signIn;
  if (service.failure === "not_chosen") return txt.scope.notChosen;
  if (service.state === "syncing") return txt.scope.firstSync;
  if (service.state === "sync_failed") return txt.scope.stopped;
  return undefined;
}

function accountSources(
  account: Account,
  roots: FileRoot[] | undefined,
): Source[] {
  // Unknown roots (their read failed) are not the same as none.
  const known = roots ?? [];
  const copy = providerCopy[account.provider];
  const settings: Link = {
    label: txt.settingsOf(copy.name),
    href: settingsHref("tiedot", accountRow(account)),
  };
  const out: Source[] = [];
  const sharepoint = known.filter(
    (r) =>
      r.provider === account.provider &&
      r.address === account.address &&
      r.service === "sharepoint",
  ).length;
  let library = 0;
  for (const service of account.services) {
    const kind = kindOf(service.id);
    if (!kind) continue;
    const access = accessOf(account, service);
    const base = {
      kind,
      mark: copy.mark,
      tone: copy.tone,
      account: copy.name,
      who: account.address,
      pill: pillOf(account, access),
      can: canOf(access),
      settings,
    };
    const changeLevel = {
      label: txt.hidden.changeLevel,
      href: settings.href,
    };
    const notGranted: Hidden = {
      id: "service",
      what: txt.hidden.service,
      why: txt.scope.notGranted,
      action: changeLevel,
    };
    if (kind !== "files") {
      const id = service.id as "mail" | "calendar" | "contacts";
      const web = webLink(account, service.id);
      out.push({
        ...base,
        id: `${service.id}:${account.provider}:${account.address}`,
        name: serviceName(account.provider, service.id),
        web,
        scope:
          access === "none"
            ? []
            : [
                {
                  what: account.address,
                  meta:
                    id === "mail"
                      ? txt.scope.mailbox
                      : id === "calendar"
                        ? txt.scope.calendars
                        : txt.scope.contacts,
                  mono: true,
                  icon:
                    id === "mail"
                      ? "mail"
                      : id === "calendar"
                        ? "calendar"
                        : "contacts",
                },
              ],
        hidden: access === "none" ? [notGranted] : [],
        verbs: serviceVerbs(service.id, access),
        elsewhere: {
          what: txt.contentOf[id],
          link: web && { label: web.place ?? web.label, href: web.href },
        },
      });
      continue;
    }
    // Files: one source per synced folder; a service without one still
    // shows, with why its folder is missing.
    const mine = known.filter(
      (r) =>
        r.provider === account.provider &&
        r.address === account.address &&
        r.service === service.id,
    );
    const hidden: Hidden[] = [];
    let what = txt.scope.chosenFolders;
    if (service.id === "onedrive") what = txt.scope.wholeOneDrive;
    if (service.id === "sharepoint") {
      what = txt.scope.library;
      hidden.push({
        id: "libraries",
        what: txt.hidden.otherLibraries,
        why: txt.hidden.otherLibrariesWhy,
        action: { label: txt.hidden.chooseLibraries, href: settings.href },
      });
    }
    if (service.id === "drive") {
      hidden.push(
        {
          id: "drive",
          what: txt.hidden.otherDrive,
          why: txt.hidden.otherDriveWhy,
          action: { label: txt.hidden.chooseFolders, href: settings.href },
        },
        {
          id: "google-docs",
          what: txt.hidden.googleDocs,
          why: txt.hidden.googleDocsWhy,
        },
      );
    }
    if (service.id === "dropbox") {
      if (account.level === "app_folder") {
        what = txt.scope.appFolder;
        hidden.push({
          id: "dropbox",
          what: txt.hidden.otherDropbox,
          why: txt.hidden.otherDropboxWhy,
          action: changeLevel,
        });
      } else what = txt.scope.wholeDropbox;
    }
    if (access === "none") hidden.unshift(notGranted);
    const synced = service.last_synced_at
      ? txt.scope.synced(syncedTime(service.last_synced_at))
      : txt.scope.notSynced;
    const scope = (place?: string): ScopeRow[] =>
      access === "none"
        ? []
        : [
            {
              what: place ? `${what} · ${place}` : what,
              meta: synced,
              icon: "folder",
            },
          ];
    const name = serviceName(account.provider, service.id);
    if (!mine.length) {
      // SharePoint without any library reads as the account's choice only.
      if (service.id === "sharepoint" && access !== "none" && roots) continue;
      out.push({
        ...base,
        id: `files:${account.provider}:${account.address}:${service.id}`,
        name: service.id === "onedrive" ? "OneDrive" : name,
        web: webLink(account, service.id),
        scope: scope(),
        hidden,
        verbs: fileVerbs(account, access),
        unavailable: roots
          ? (fileTrouble(service) ?? txt.files.unavailable)
          : txt.files.failed,
      });
      continue;
    }
    for (const root of mine) {
      if (service.id === "sharepoint") library++;
      const place =
        service.id === "sharepoint" && sharepoint > 1
          ? txt.sharepoint(library)
          : undefined;
      out.push({
        ...base,
        id: `files:${root.directory}`,
        name: service.id === "onedrive" ? "OneDrive" : (place ?? name),
        web: webLink(account, service.id),
        scope: scope(),
        hidden,
        verbs: fileVerbs(account, access),
        directory: root.directory,
        unavailable: fileTrouble(service),
      });
    }
  }
  return out;
}

function codeVerbs(github: boolean): Verb[] {
  const v = txt.verbs;
  const verbs: Verb[] = [
    { label: v.clone, yes: true },
    { label: v.push, yes: true, note: v.pushNote },
    { label: v.issues, yes: true, note: v.issuesNote },
  ];
  if (github)
    verbs.push({
      label: v.narrow,
      yes: false,
      note: v.narrowNote,
      cannotBlock: true,
    });
  return verbs;
}

function forgeSource(
  provider: "gitea" | "gitlab",
  c: GiteaConnection | GitLabConnection,
): Source | undefined {
  if (!c.base_url || !c.user) return undefined;
  const copy = providerCopy[provider];
  const host = c.base_url.replace(/^https:\/\//, "");
  return {
    id: `${provider}:${c.id}`,
    kind: "code",
    mark: copy.mark,
    tone: copy.tone,
    name: copy.name,
    account: copy.name,
    who: `${c.user} · ${host}`,
    pill: { text: txt.pill.push, full: true },
    can: "change",
    settings: {
      label: txt.settingsOf(copy.name),
      href: settingsHref("koodipalvelut", provider),
    },
    web: { label: txt.open(txt.places[provider]), href: c.base_url },
    scope: [
      {
        what: host,
        meta: txt.scope.giteaUser(c.user),
        mono: true,
        icon: "users",
      },
    ],
    hidden: [],
    verbs: codeVerbs(false),
    elsewhere: {
      what: txt.contentOf.code,
      link: { label: txt.places[provider], href: c.base_url },
    },
  };
}

function dateOf(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : formatDate(d, { day: "numeric", month: "numeric", year: "numeric" });
}

function machineSources(machines: OwnMachines): Source[] {
  return machines.machines.map((m) => {
    const state = machineState(m);
    const ended = state === "expired" || m.expired;
    const ends = m.expires ? dateOf(m.expires) : "";
    const mac = /mac/i.test(m.os ?? "");
    const v = txt.verbs;
    return {
      id: `machine:${m.name}`,
      kind: "machines" as const,
      mark: m.name.slice(0, 1).toUpperCase(),
      tone: 0 as const,
      name: m.name,
      account: txt.kinds.machines,
      who: m.user,
      place: m.os,
      pill: {
        text: ended
          ? txt.pill.ended(ends)
          : ends
            ? txt.pill.ends(ends)
            : txt.pill.noEnd,
        full: !ended,
      },
      can: ended ? ("none" as const) : ("change" as const),
      settings: {
        label: txt.machineSettings,
        href: settingsHref("omatkoneet", "own-machines"),
      },
      scope: [],
      hidden:
        mac && !ended
          ? [
              {
                id: "mac",
                what: txt.hidden.macFolders,
                why: txt.hidden.macFoldersWhy,
              },
            ]
          : [],
      verbs: ended
        ? [{ label: v.machineEnded, yes: false, note: v.machineEndedNote }]
        : [
            { label: v.machine(m.user), yes: true, note: v.machineNote },
            { label: v.admin, yes: true, cannotBlock: true },
          ],
      facts: [
        {
          label: txt.machine.state,
          value: ended
            ? txt.machine.expired
            : m.online
              ? txt.machine.active
              : txt.machine.asleep,
        },
        { label: txt.machine.user, value: m.user, mono: true },
        ...(m.os ? [{ label: txt.machine.os, value: m.os }] : []),
        {
          label: ended ? txt.machine.ended : txt.machine.ends,
          value: ends || txt.machine.noEnd,
        },
      ],
    };
  });
}

const offerKinds: Partial<Record<ProviderId, Kind[]>> = {
  google: ["files", "mail", "calendar", "contacts"],
  microsoft: ["files", "mail", "calendar", "contacts"],
  dropbox: ["files"],
  imap: ["mail"],
  caldav: ["calendar"],
  carddav: ["contacts"],
  apple: ["mail", "calendar", "contacts"],
  gitea: ["code"],
  gitlab: ["code"],
};

/** Every source the agent uses and every service still to connect. */
export function buildResources(
  list: IntegrationList,
  /** Undefined when the synced folders could not be read. */
  roots: FileRoot[] | undefined,
  machines: OwnMachines | undefined,
  github: GitHubState,
): Resources {
  const sources: Source[] = [];
  let connections = 0;
  for (const account of list.accounts) {
    const made = accountSources(account, roots);
    if (made.length) connections++;
    sources.push(...made);
  }
  const githubOn = github?.state === "connected" && !!github.login;
  if (githubOn && github?.login) {
    connections++;
    sources.push({
      id: "github",
      kind: "code",
      mark: "GH",
      tone: 0,
      name: "GitHub",
      account: "GitHub",
      who: github.login,
      pill: { text: txt.pill.allRepos, full: true },
      can: "change",
      settings: {
        label: txt.settingsOf("GitHub"),
        href: settingsHref("koodipalvelut", "github"),
      },
      web: {
        label: txt.open(txt.places.github),
        href: `https://github.com/${enc(github.login)}`,
      },
      scope: [
        {
          what: github.login,
          meta: txt.scope.allRepos,
          mono: true,
          icon: "users",
        },
      ],
      hidden: [],
      verbs: codeVerbs(true),
      elsewhere: {
        what: txt.contentOf.code,
        link: {
          label: txt.places.github,
          href: `https://github.com/${enc(github.login)}`,
        },
      },
    });
  }
  for (const [provider, connectionsOf] of [
    ["gitea", list.gitea?.connections ?? []],
    ["gitlab", list.gitlab?.connections ?? []],
  ] as const) {
    for (const c of connectionsOf) {
      const s = forgeSource(provider, c);
      if (s) {
        connections++;
        sources.push(s);
      }
    }
  }
  if (machines) {
    const made = machineSources(machines);
    connections += made.length;
    sources.push(...made);
  }

  const connected = new Set<ProviderId>(
    list.accounts.map((a) => (a.apple_id ? "apple" : a.provider)),
  );
  if (list.gitea?.connections.length) connected.add("gitea");
  if (list.gitlab?.connections.length) connected.add("gitlab");
  const offers: Offer[] = [];
  for (const p of list.providers) {
    const k = offerKinds[p.id];
    if (!k || !p.available || connected.has(p.id)) continue;
    const copy = providerCopy[p.id];
    const what: Partial<Record<Kind, string>> = {};
    for (const kind of k) {
      const names = p.services
        .filter((id) => (kindOf(id) ?? "code") === kind)
        .map((id) => serviceName(p.id, id));
      // "OneDrive ja SharePoint" already names SharePoint.
      what[kind] = names
        .filter((n, i) => !names.some((m, j) => j !== i && m.includes(n)))
        .join(", ");
    }
    offers.push({
      id: p.id,
      mark: copy.mark,
      tone: copy.tone,
      name: copy.name,
      what,
      kinds: k,
      href: settingsHref(
        p.id === "gitea" || p.id === "gitlab" ? "koodipalvelut" : "tiedot",
        p.id,
      ),
    });
  }
  if (!githubOn)
    offers.push({
      id: "github",
      mark: "GH",
      tone: 0,
      name: "GitHub",
      what: { code: txt.offers.githubWhat },
      kinds: ["code"],
      href: settingsHref("koodipalvelut", "github"),
    });
  offers.push({
    id: "machine",
    mark: "+",
    tone: 0,
    name: txt.offers.machineName,
    what: { machines: txt.offers.machineWhat },
    kinds: ["machines"],
    href: settingsHref("omatkoneet", "own-machines"),
    add: true,
  });
  // By kind in the list's order, each kind's sources in the accounts' order.
  const order = (k: Kind) => kinds.findIndex((x) => x.id === k);
  sources.sort((a, b) => order(a.kind) - order(b.kind));
  return { sources, offers, connections };
}

/** A file's size as the person reads it. */
export { bytes as fileSize } from "./trashText";
