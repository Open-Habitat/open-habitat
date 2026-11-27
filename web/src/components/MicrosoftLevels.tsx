import {
  type Dispatch,
  Fragment,
  type ReactNode,
  type SetStateAction,
  useState,
} from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import type { Level } from "../app/integrations";
import { validLabel } from "../app/microsoftOrganisations";
import {
  type AnySection,
  type AppChange,
  type AppFields,
  type AppSection,
  appErrors,
  appRefusal,
  type IntegrationApp,
  type IntegrationTenant,
  type MicrosoftSharedSection,
} from "../app/serverIntegrations";
import authImg from "../assets/entra/auth.avif";
import { entraCrops } from "../assets/entra/crops";
import listImg from "../assets/entra/list.avif";
import overviewImg from "../assets/entra/overview.avif";
import permsImg from "../assets/entra/perms.avif";
import registerImg from "../assets/entra/register.avif";
import { liveText } from "../i18n";
import { microsoftLevelsText } from "../text/microsoftLevels";
import { ControlButton, ExternalLink, Segmented } from "./ControlElements";
import { Icon, type IconName } from "./Icon";
import { levelName } from "./Integrations";
import { Checkbox, RadioGroup, TextField } from "./Primitives";
import { ShotBand, useNarrow } from "./ShotBand";
import "./MicrosoftLevels.css";

const txt = liveText(microsoftLevelsText);

// Palvelinintegraatiot: what each account level allows, as one comparison
// table per provider (proto-integration-levels round 2, ✕ Ei in a cell
// without the right), and Microsoft 365's guided setup of its four Entra
// applications (rounds 4 and 5: every chosen level walked in full, the
// start page a table with a checkbox per missing level). A level counts as
// set when root's integrations file has a usable section for it, which the
// broker's list already says; the browser keeps nothing of its own, so an
// interrupted setup resumes from what the file holds. One forward button
// walks the sub-items (proto-m365-setup-flow A1b5); the sub-item row only
// shows the position.
//
// The start page's first choice is whose accounts the applications serve
// (design passably-subdued-sticks, section 4): Vain oma organisaatio is the
// single-tenant walk, Useita organisaatioita the same walk for the shared
// (multi-tenant) sections, differing in the account type, a name and
// publisher sub-item, and a save that also puts the own organisation on the
// allowed list. A level whose single-tenant application exists can instead
// be converted in Entra and saved with the same ids, so its connections go
// on without a sign-in; the guide cannot see Entra and says so.

/* ---------- what each level allows ---------- */

export type TableProvider = "microsoft" | "google" | "dropbox";
type Svc = "mail" | "calendar" | "contacts" | "files";
/** read; drafts = mail organised and drafted; edit = changed without
 * sending or sharing; full = changed and sent or shared; app = Dropbox's
 * app folder alone. */
type Ab = "read" | "drafts" | "edit" | "full" | "app";
type Combo = Partial<Record<Svc, Ab>>;

const svcs: Record<TableProvider, Svc[]> = {
  microsoft: ["mail", "calendar", "contacts", "files"],
  google: ["mail", "calendar", "contacts", "files"],
  dropbox: ["files"],
};
const svcIcon: Record<Svc, IconName> = {
  mail: "mail",
  calendar: "calendar",
  contacts: "contacts",
  files: "folder",
};
const full: Combo = {
  mail: "full",
  calendar: "full",
  contacts: "edit",
  files: "full",
};
const read: Combo = {
  mail: "read",
  calendar: "read",
  contacts: "read",
  files: "read",
};
/** Each provider's levels, broadest first, as the daemon offers them
 * (microsoftLevelScopes, googleLevelScopes, dropboxRules). */
export const tableLevels: Record<TableProvider, { id: Level; combo: Combo }[]> =
  {
    microsoft: [
      { id: "full", combo: full },
      { id: "nosend", combo: { ...full, mail: "drafts" } },
      {
        id: "drafts",
        combo: {
          mail: "drafts",
          calendar: "read",
          contacts: "read",
          files: "read",
        },
      },
      { id: "read", combo: read },
    ],
    google: [
      { id: "full", combo: full },
      { id: "read", combo: read },
    ],
    dropbox: [
      { id: "full", combo: { files: "full" } },
      { id: "app_folder", combo: { files: "app" } },
      { id: "read", combo: { files: "read" } },
    ],
  };

/** One row of the table: an ability, the level it needs, and what the
 * provider cannot prevent once it is granted. */
type Row = { ab: Ab; label: string; warn?: string };
function rows(p: TableProvider, s: Svc): Row[] {
  const r: Row = {
    ab: "read",
    label: s === "calendar" || s === "contacts" ? txt.sees : txt.reads,
  };
  if (s === "mail")
    return p === "microsoft"
      ? [
          r,
          { ab: "drafts", label: txt.organises },
          { ab: "full", label: txt.sends },
        ]
      : [r, { ab: "full", label: txt.changesAndSends, warn: txt.gmailWarn }];
  if (s === "calendar")
    return [
      r,
      {
        ab: "full",
        label: txt.editsEvents,
        warn: p === "microsoft" ? txt.inviteAlways : txt.inviteMay,
      },
    ];
  if (s === "contacts") return [r, { ab: "edit", label: txt.edits }];
  if (p === "dropbox")
    return [
      r,
      { ab: "edit", label: txt.edits },
      { ab: "full", label: txt.shares },
    ];
  return [
    r,
    {
      ab: "full",
      label: txt.editsShares,
      warn: p === "microsoft" ? txt.linkWarn : txt.shareWarn,
    },
  ];
}
const rank: Record<Ab, number> = {
  read: 0,
  drafts: 1,
  edit: 1,
  app: 1,
  full: 2,
};
const grants = (row: Row, a: Ab): "yes" | "no" | "part" =>
  // The App folder application has every scope the full one has, sharing
  // included, inside its own folder alone.
  a === "app" ? "part" : rank[a] >= rank[row.ab] ? "yes" : "no";

/** The provider's levels side by side, ✓ Kyllä or ✕ Ei in every cell.
 * `state` is a line under a level's name; `head` adds the level's own
 * control; `chosen` tints a level's column. */
export function LevelTable({
  provider,
  state,
  head,
  chosen,
  testId,
}: {
  provider: TableProvider;
  state?: (level: Level) => string;
  head?: (level: Level) => ReactNode;
  chosen?: (level: Level) => boolean;
  testId: string;
}) {
  const levels = tableLevels[provider];
  return (
    <div className="ml-cmp-wrap">
      <table className={`ml-cmp cols-${levels.length}`} data-testid={testId}>
        <thead>
          <tr>
            <th scope="col" className="ml-cmp-corner">
              <span className="ml-sr">{txt.ability}</span>
            </th>
            {levels.map((l) => (
              <th
                scope="col"
                key={l.id}
                data-testid={`ml-col-${l.id}`}
                data-chosen={chosen?.(l.id) || undefined}
              >
                <span className="ml-cmp-name">{levelName(provider, l.id)}</span>
                {state && (
                  <span
                    className="ml-cmp-state"
                    data-testid={`ml-col-state-${l.id}`}
                  >
                    {state(l.id)}
                  </span>
                )}
                {head?.(l.id)}
              </th>
            ))}
          </tr>
        </thead>
        {svcs[provider].map((s) => (
          <tbody key={s}>
            {svcs[provider].length > 1 && (
              <tr className="ml-cmp-svc">
                <th scope="colgroup" colSpan={levels.length + 1}>
                  <Icon name={svcIcon[s]} />
                  {txt.services[provider][s]}
                </th>
              </tr>
            )}
            {rows(provider, s).map((r) => (
              <tr key={r.ab}>
                <th scope="row">
                  <span>{r.label}</span>
                  {r.warn && (
                    <span className="ml-cmp-warn">
                      <Icon name="warning" />
                      {r.warn}
                    </span>
                  )}
                </th>
                {levels.map((l) => {
                  const g = grants(r, l.combo[s] ?? "read");
                  return (
                    <td
                      key={l.id}
                      className={
                        g === "yes" ? "on" : g === "part" ? "part" : "off"
                      }
                      data-on={g}
                      data-chosen={chosen?.(l.id) || undefined}
                    >
                      <span className="ml-cmp-val">
                        <Icon name={g === "no" ? "cross" : "check"} />
                        <span>
                          {g === "part"
                            ? txt.appFolderOnly
                            : g === "yes"
                              ? txt.yes
                              : txt.no}
                        </span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/** Mitä tasot sallivat: the table opens on demand on the page. */
export function LevelsDisclosure({
  open,
  onToggle,
  testId,
}: {
  open: boolean;
  onToggle: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      className="ml-disclose"
      aria-expanded={open}
      data-testid={testId}
      onClick={onToggle}
    >
      <Icon name={open ? "up" : "down"} />
      {open ? txt.hideLevels : txt.whatLevelsAllow}
    </button>
  );
}

/* ---------- Microsoft's four applications ---------- */

export type MsLevel = "full" | "nosend" | "drafts" | "read";
/** The four levels, broadest first, with their sections of root's file:
 * the own organisation's single-tenant application and the shared one. */
export const msLevels: {
  id: MsLevel;
  section: AppSection;
  shared: MicrosoftSharedSection;
}[] = [
  { id: "full", section: "microsoft", shared: "microsoft_shared" },
  {
    id: "nosend",
    section: "microsoft_nosend",
    shared: "microsoft_shared_nosend",
  },
  {
    id: "drafts",
    section: "microsoft_drafts",
    shared: "microsoft_shared_drafts",
  },
  { id: "read", section: "microsoft_read", shared: "microsoft_shared_read" },
];
/** Whose accounts the applications serve: the own organisation's alone, or
 * every organisation on the allowed list. */
export type MsKind = "own" | "shared";
const sectionFor = (kind: MsKind, l: MsLevel): AnySection => {
  const m = msLevels.find((x) => x.id === l) ?? msLevels[0];
  return kind === "shared" ? m.shared : m.section;
};
const appOf = (apps: IntegrationApp[], section: AnySection) =>
  apps.find((a) => a.provider === section);
const identity = ["openid", "profile", "User.Read", "offline_access"];
// Each level's delegated Graph permissions, the set its administrator
// consents to (microsoftLevelScopes in the daemon). The no-send level is the
// full one without Mail.Send.
const perms: Record<MsLevel, string[]> = {
  full: [
    "Files.ReadWrite.All",
    "Sites.ReadWrite.All",
    "Mail.ReadWrite",
    "Mail.Send",
    "Calendars.ReadWrite",
    "Contacts.ReadWrite",
  ],
  nosend: [
    "Files.ReadWrite.All",
    "Sites.ReadWrite.All",
    "Mail.ReadWrite",
    "Calendars.ReadWrite",
    "Contacts.ReadWrite",
  ],
  drafts: [
    "Files.Read.All",
    "Sites.Read.All",
    "Mail.ReadWrite",
    "Calendars.Read",
    "Contacts.Read",
  ],
  read: [
    "Files.Read.All",
    "Sites.Read.All",
    "Mail.Read",
    "Calendars.Read",
    "Contacts.Read",
  ],
};
// Every level lists the person's teams and channels by name, so their files
// can be found (microsoftTeamsScopes in the daemon).
const teams = ["Team.ReadBasic.All", "Channel.ReadBasic.All"];
const permsOf = (l: MsLevel) => [...identity, ...perms[l], ...teams];
// Entra's own descriptions, as its permission list shows them on hover.
const says: Record<string, string> = {
  openid: "Sign users in",
  profile: "View users' basic profile",
  offline_access: "Maintain access to data you have given it access to",
  "Files.ReadWrite.All": "Have full access to all files user can access",
  "Files.Read.All": "Read all files that user can access",
  "Sites.ReadWrite.All": "Edit or delete items in all site collections",
  "Sites.Read.All": "Read items in all site collections",
  "Mail.ReadWrite": "Read and write access to user mail",
  "Mail.Read": "Read user mail",
  "Mail.Send": "Send mail as a user",
  "Calendars.ReadWrite": "Have full access to user calendars",
  "Calendars.Read": "Read user calendars",
  "Contacts.ReadWrite": "Have full access to user contacts",
  "Contacts.Read": "Read user contacts",
  "Team.ReadBasic.All": "Read the names and descriptions of teams",
  "Channel.ReadBasic.All": "Read the names and descriptions of channels",
};
// The redirect the device-code sign-in names (microsoftConsent in the daemon).
const redirect = "https://login.microsoftonline.com/common/oauth2/nativeclient";
// Entra admin center › App registrations: a direct link to an app's own
// page needs its id, which the guide learns last, so every later step
// names the app's menu instead.
const entraList =
  "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade";
const authMenu = "Authentication (Preview)";
/** The admin-consent link, for someone who has the role. */
const consentURL = (tenant: string, client: string) =>
  `https://login.microsoftonline.com/${tenant}/adminconsent?client_id=${client}`;

/* ---------- the band: the masked Entra screenshots ---------- */

type CropName = keyof typeof entraCrops;
const src: Record<CropName, string> = {
  register: registerImg,
  list: listImg,
  overview: overviewImg,
  auth: authImg,
  perms: permsImg,
};

function Band({
  crop,
  t,
  narrow,
  missing,
}: {
  crop: CropName;
  t: string;
  narrow: boolean;
  /** The screen this sub-item happens on, when nobody has captured it: the
   * band shows the page it opens from, and the gap is said. */
  missing?: string;
}) {
  return (
    <ShotBand
      testId="ml-band"
      name={crop}
      src={src[crop]}
      alt={txt.alt[crop]}
      crop={entraCrops[crop]}
      t={t}
      aspect={missing ? (narrow ? 3 : 4.4) : narrow ? 2.3 : 3.7}
      narrow={narrow}
    >
      {missing && (
        <figcaption className="ml-nocap" data-testid="ml-nocap">
          <Icon name="image" />
          <span>
            {txt.missing(missing)}
            {!narrow && ` ${txt.missingFrom}`}
          </span>
        </figcaption>
      )}
    </ShotBand>
  );
}

/* ---------- the small pieces of a sub-item ---------- */

function useCopy(value: string) {
  const [done, setDone] = useState(false);
  return [
    done,
    () => {
      void navigator.clipboard?.writeText(value).catch(() => {});
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    },
  ] as const;
}
function Copy({ value, label }: { value: string; label: string }) {
  const [done, press] = useCopy(value);
  return (
    <ControlButton
      data-testid="ml-copy"
      size="row"
      variant="quiet"
      aria-label={txt.copy(label)}
      onPress={press}
    >
      <Icon name={done ? "check" : "copy"} />
    </ControlButton>
  );
}
/** Where in Entra, in Entra's own words; the path is the main instruction. */
function Where({ crumbs, link }: { crumbs: string[]; link?: boolean }) {
  return (
    <div className="ml-where">
      <p className="ml-path">
        {crumbs.map((c, i) => (
          <Fragment key={c}>
            {i > 0 && (
              <span className="ml-sep" aria-hidden="true">
                ›
              </span>
            )}
            <span>{c}</span>
          </Fragment>
        ))}
      </p>
      {link && (
        <p className="ml-open">
          <ExternalLink
            href={entraList}
            target="_blank"
            rel="noreferrer"
            data-testid="ml-console-link"
          >
            {txt.openList("App registrations")} <Icon name="external" />
          </ExternalLink>
        </p>
      )}
    </div>
  );
}
const Act = ({ children }: { children: ReactNode }) => (
  <p className="ml-act">{children}</p>
);
const Value = ({
  value,
  label,
  copy = true,
}: {
  value: string;
  label: string;
  copy?: boolean;
}) => (
  <p className="ml-value">
    <code>{value}</code>
    {copy && <Copy value={value} label={label} />}
  </p>
);
const Done = ({ children }: { children: ReactNode }) => (
  <p className="ml-done" data-testid="ml-done">
    <Icon name="check" />
    <span>{txt.doneWhen(children)}</span>
  </p>
);
const Note = ({ children, icon }: { children: ReactNode; icon?: IconName }) => (
  <p className="ml-quiet ml-note">
    {icon && <Icon name={icon} />}
    <span>{children}</span>
  </p>
);
function PermCopy({ name }: { name: string }) {
  const [done, press] = useCopy(name);
  return (
    <button
      type="button"
      className="ml-perm-btn"
      data-testid="ml-copy"
      data-done={done || undefined}
      aria-label={txt.copy(name)}
      onClick={press}
    >
      <code className="ml-perm-name">{name}</code>
      <Icon name={done ? "check" : "copy"} />
    </button>
  );
}
/** Entra's permission search finds one name at a time, so each has its
 * own copy; User.Read is in a new app's table already. */
function PermGrid({ level }: { level: MsLevel }) {
  const list = permsOf(level).filter((p) => p !== "User.Read");
  return (
    <>
      <ol className="ml-perms" data-testid="ml-perms">
        {list.map((p) => (
          <li key={p} className="ml-perm" title={says[p]}>
            <PermCopy name={p} />
          </li>
        ))}
      </ol>
      <p className="ml-count">{txt.permCount(list.length)}</p>
    </>
  );
}

/* ---------- the walk: sub-items grouped by step and application ---------- */

type Errors = Partial<Record<string, string>>;
type Ctx = {
  kind: MsKind;
  /** The first application of this walk: it carries the one-time notes. */
  first: MsLevel;
  client: Partial<Record<MsLevel, string>>;
  setClient: (l: MsLevel, v: string) => void;
  tenant: string;
  setTenant: (v: string) => void;
  /** The level whose saved section has the tenant; undefined asks it. */
  tenantFrom?: MsLevel;
  /** The operator's organisation's name for the shared applications' names
   * and the allowed list: the list's label of the own organisation, or
   * typed on the name and publisher sub-item. */
  org: string;
  /** Undefined when the allowed list already names the own organisation. */
  setOrg?: (v: string) => void;
  /** The level's existing single-tenant application, when this walk
   * converts it instead of creating a new one. */
  converts: (l: MsLevel) => IntegrationApp | undefined;
  errors: Errors;
};
type Part = {
  id: string;
  name: string;
  at: [CropName, string];
  missing?: string;
  fields?: string[];
  /** Field errors that keep the walk on this sub-item. */
  check?: () => Errors;
  body: ReactNode;
};
type Group = {
  /** The step's id, its title, and its place among the level's steps. */
  step: string;
  title: string;
  n: number;
  of: number;
  level: MsLevel;
  parts: Part[];
};

const em = (s: string) => <em>{s}</em>;

/** The name a level's application gets in Entra. A shared application says
 * who runs it: the client's administrator sees the name when approving. */
const appName = (ctx: Ctx, l: MsLevel) =>
  ctx.kind === "shared"
    ? txt.sharedApp(txt.app[l], ctx.org.trim() || txt.orgUnknown)
    : txt.app[l];

/** Design section 4, item 2: what a client's administrator sees, once per
 * walk, and where the organisation's name is asked when the list lacks it. */
function publisher(ctx: Ctx, l: MsLevel, rename: boolean): Part {
  return {
    id: "publisher",
    name: txt.publisherItem,
    at: rename ? ["overview", "menu"] : ["register", "name"],
    missing: rename ? txt.missingBranding : txt.missingPublisher,
    fields: ["org"],
    check: () =>
      ctx.setOrg && !validLabel(ctx.org.trim()) ? { org: txt.errOrg } : {},
    body: (
      <>
        <Act>{txt.publisherAct}</Act>
        {ctx.setOrg ? (
          <div className="ml-idfield">
            <TextField
              data-testid="ml-field-org"
              label={txt.orgField}
              value={ctx.org}
              onChange={ctx.setOrg}
              hint={txt.orgHint}
              error={ctx.errors.org}
            />
          </div>
        ) : (
          <p className="ml-value" data-testid="ml-org-known">
            <code>{ctx.org}</code>
          </p>
        )}
        {rename && (
          <>
            <Act>{txt.renameAct(em("Branding & properties"), em("Name"))}</Act>
            <Value value={appName(ctx, l)} label="Name" />
          </>
        )}
        <Note icon="info">{txt.unverified}</Note>
      </>
    ),
  };
}

function register(ctx: Ctx, l: MsLevel): Part[] {
  const first = ctx.first === l;
  const shared = ctx.kind === "shared";
  return [
    {
      id: "new",
      name: "New registration",
      at: ["list", "new"],
      body: (
        <>
          <Where
            crumbs={["App registrations", "All applications"]}
            link={first}
          />
          <Act>
            {first
              ? txt.pickFirst(em("New registration"))
              : txt.pickAgain(
                  "App registrations › All applications",
                  em("New registration"),
                )}
          </Act>
          {first && <Note icon="user">{txt.roleDeveloper}</Note>}
        </>
      ),
    },
    ...(shared && first ? [publisher(ctx, l, false)] : []),
    {
      id: "name",
      name: "Name",
      at: ["register", "name"],
      body: (
        <>
          <Act>{txt.typeName}</Act>
          <Value value={appName(ctx, l)} label="Name" />
          {first && <p className="ml-quiet">{txt.ownApp}</p>}
        </>
      ),
    },
    {
      id: "accounts",
      name: "Supported account types",
      at: ["register", "accounts"],
      missing: shared ? txt.missingMulti : undefined,
      body: shared ? (
        <>
          <Act>{txt.chooseMulti}</Act>
          <Value
            value={txt.multiTenant}
            label="Supported account types"
            copy={false}
          />
          {first && <Note>{txt.multiNote}</Note>}
        </>
      ) : (
        <>
          <Act>{txt.chooseIfNot}</Act>
          <Value
            value={txt.singleTenant}
            label="Supported account types"
            copy={false}
          />
          {first && <Note>{txt.orgMasked}</Note>}
        </>
      ),
    },
    {
      id: "redirect",
      name: "Redirect URI",
      at: ["register", "redirect"],
      body: <Act>{txt.leaveEmpty(em("Redirect URI (optional)"))}</Act>,
    },
    {
      id: "register",
      name: "Register",
      at: ["register", "register"],
      body: <Act>{txt.pickBottom(em("Register"))}</Act>,
    },
    {
      id: "done",
      name: txt.doneItem,
      at: ["overview", "menu"],
      body: <Done>{txt.appOpens(em(appName(ctx, l)))}</Done>,
    },
  ];
}

/** An existing single-tenant application switched to multi-tenant in
 * Entra: the guide shows where, and cannot see whether it was done. */
function convertInEntra(ctx: Ctx, l: MsLevel, app: IntegrationApp): Part[] {
  const first = ctx.first === l;
  return [
    {
      id: "find",
      name: "App registrations",
      at: ["list", "search"],
      body: (
        <>
          <Where
            crumbs={["App registrations", "All applications"]}
            link={first}
          />
          <Act>{txt.findApp}</Act>
          <Value value={app.client_id ?? ""} label="Application (client) ID" />
          {first && <Note icon="user">{txt.roleDeveloper}</Note>}
        </>
      ),
    },
    {
      id: "accounts",
      name: "Supported accounts",
      at: ["auth", "tabs"],
      missing: txt.missingSupported,
      body: (
        <>
          <Where crumbs={[authMenu, "Supported accounts"]} />
          <Act>
            {txt.convertAccounts(
              em(authMenu),
              em("Supported accounts"),
              em(txt.multiTenant),
              em("Save"),
            )}
          </Act>
          <Note icon="info">{txt.cannotSee}</Note>
          {first && <Note>{txt.uriConflict}</Note>}
        </>
      ),
    },
    ...(first ? [publisher(ctx, l, true)] : []),
    {
      id: "done",
      name: txt.doneItem,
      at: ["auth", "tabs"],
      body: (
        <Done>
          {txt.convertDone(em("Supported accounts"), em(txt.multiTenant))}
        </Done>
      ),
    },
  ];
}
function convertSave(app: IntegrationApp): Part[] {
  return [
    {
      id: "ids",
      name: txt.idsItem,
      at: ["overview", "essentials"],
      body: (
        <>
          <Act>{txt.sameIds}</Act>
          <p className="ml-value" data-testid="ml-convert-client">
            <code>{app.client_id}</code>
          </p>
          <p className="ml-value" data-testid="ml-convert-tenant">
            <code>{app.tenant_id}</code>
          </p>
          <Note icon="warning">{txt.widens}</Note>
        </>
      ),
    },
  ];
}
function publicClient(): Part[] {
  return [
    {
      id: "auth",
      name: authMenu,
      at: ["auth", "menu"],
      body: (
        <>
          <Where crumbs={[authMenu, "Redirect URI configuration"]} />
          <Act>{txt.fromMenu(em(authMenu))}</Act>
        </>
      ),
    },
    {
      id: "add",
      name: "Add Redirect URI",
      at: ["auth", "add"],
      missing: txt.missingPlatform,
      body: (
        <>
          <Act>
            {txt.addRedirect(
              em("Add Redirect URI"),
              em("Mobile and desktop applications"),
              em("Configure"),
            )}
          </Act>
          <Value value={redirect} label="Redirect URI" />
        </>
      ),
    },
    {
      id: "settings",
      name: "Settings",
      at: ["auth", "settings"],
      body: (
        <>
          <Where crumbs={[authMenu, "Settings"]} />
          <Act>
            {txt.publicFlows(
              em("Settings"),
              em("Allow public client flows"),
              em("Enabled"),
              em("Save"),
            )}
          </Act>
        </>
      ),
    },
    {
      id: "done",
      name: txt.doneItem,
      at: ["auth", "tabs"],
      body: (
        <Done>
          {txt.publicDone(
            em("Redirect URI configuration"),
            em("Settings"),
            em("Allow public client flows: Enabled"),
          )}
        </Done>
      ),
    },
  ];
}
function permissions(l: MsLevel): Part[] {
  const n = permsOf(l).length;
  return [
    {
      id: "menu",
      name: "API permissions",
      at: ["perms", "menu"],
      body: <Act>{txt.fromMenu(em("API permissions"))}</Act>,
    },
    {
      id: "add",
      name: "Add a permission",
      at: ["perms", "add"],
      missing: txt.missingRequest,
      body: (
        <Act>
          {txt.addPermission(
            em("Add a permission"),
            em("Microsoft Graph"),
            em("Delegated permissions"),
          )}
        </Act>
      ),
    },
    {
      id: "perms",
      name: txt.permissionsName(n - 1),
      at: ["perms", "configured"],
      missing: txt.missingSelect,
      body: (
        <>
          <Act>
            {txt.oneByOne(em("Select permissions"), em("Add permissions"))}
          </Act>
          <PermGrid level={l} />
        </>
      ),
    },
    {
      id: "done",
      name: txt.doneItem,
      at: ["perms", "graph"],
      body: <Done>{txt.groupRow(em(`Microsoft Graph (${n})`))}</Done>,
    },
  ];
}
/** The consent link filled from the ids, for someone who has the role. */
function ConsentLink({ ctx, l }: { ctx: Ctx; l: MsLevel }) {
  const client = (ctx.client[l] ?? "").trim();
  const tenant = ctx.tenant.trim();
  const ok =
    Object.keys(
      appErrors("microsoft", { client_id: client, tenant_id: tenant }),
    ).length === 0;
  return (
    <div
      className="ml-handoff"
      data-testid="ml-consent-link"
      data-filled={ok || undefined}
    >
      <span className="ml-quiet">
        {txt.ifNoRole} {!ok && txt.linkFills}
      </span>
      {ok && (
        <Value value={consentURL(tenant, client)} label={txt.consentLink} />
      )}
    </div>
  );
}
function consent(ctx: Ctx, l: MsLevel): Part[] {
  const client: Part = {
    id: "client",
    name: "Application (client) ID",
    at: ["overview", "client"],
    fields: [`client-${l}`],
    body: (
      <>
        <Act>
          {txt.copyClient(em("Overview"), em("Application (client) ID"))}
        </Act>
        <div className="ml-idfield">
          <TextField
            data-testid={`ml-field-client-${l}`}
            label="Application (client) ID"
            mono
            value={ctx.client[l] ?? ""}
            onChange={(v) => ctx.setClient(l, v)}
            error={ctx.errors[`client-${l}`]}
          />
        </div>
        {ctx.tenantFrom && <ConsentLink ctx={ctx} l={l} />}
      </>
    ),
  };
  const tenant: Part = ctx.tenantFrom
    ? {
        id: "tenant",
        name: "Directory (tenant) ID",
        at: ["overview", "tenant"],
        body: (
          <>
            <Act>
              {txt.knownTenant(
                em("Directory (tenant) ID"),
                em(txt.short[ctx.tenantFrom]),
              )}
            </Act>
            <p className="ml-value" data-testid="ml-tenant-known">
              <code>{ctx.tenant}</code>
            </p>
          </>
        ),
      }
    : {
        id: "tenant",
        name: "Directory (tenant) ID",
        at: ["overview", "tenant"],
        fields: ["tenant"],
        body: (
          <>
            <Act>{txt.copyTenant(em("Directory (tenant) ID"))}</Act>
            <div className="ml-idfield">
              <TextField
                data-testid="ml-field-tenant"
                label="Directory (tenant) ID"
                mono
                value={ctx.tenant}
                onChange={ctx.setTenant}
                error={ctx.errors.tenant}
              />
            </div>
            <Note>{txt.noSecret}</Note>
            <ConsentLink ctx={ctx} l={l} />
          </>
        ),
      };
  return [
    {
      id: "grant",
      name: "Grant admin consent",
      at: ["perms", "grant"],
      missing: txt.missingConsent,
      body: (
        <>
          <Act>{txt.grant(em(txt.grantFor), em("Yes"))}</Act>
          <Done>{txt.granted(em(txt.grantedFor))}</Done>
          <Note icon="user">{txt.roleAdmin}</Note>
        </>
      ),
    },
    client,
    tenant,
  ];
}

const stepIds = ["register", "public", "permissions", "consent"];
const convertIds = ["convert", "save"];
/** The chosen levels, broadest first, each in full: created in four steps,
 * or an existing application converted in two. */
function groups(ctx: Ctx, order: MsLevel[]): Group[] {
  return order.flatMap((l) => {
    const app = ctx.converts(l);
    const parts = app
      ? [convertInEntra(ctx, l, app), convertSave(app)]
      : [register(ctx, l), publicClient(), permissions(l), consent(ctx, l)];
    const ids = app ? convertIds : stepIds;
    const titles = app ? txt.convertSteps : txt.steps;
    return parts.map((p, n) => ({
      step: ids[n],
      title: titles[n],
      n,
      of: parts.length,
      level: l,
      parts: p,
    }));
  });
}

const guid =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
// Two well-formed GUIDs that are neither of the typed ones: appErrors
// judges a section's pair, and the walk asks each id on its own sub-item.
const otherA = "00000000-0000-4000-8000-00000000000a";
const otherB = "00000000-0000-4000-8000-00000000000b";

/** The broker's checks for one application, each field on its own, and
 * the same client id as another application's, saved or typed, refused:
 * every level and kind is its own application with its own id, and the
 * same one pasted twice is the likeliest slip. */
function idErrors(
  l: MsLevel,
  section: AnySection,
  client: string,
  tenant: string,
  asksTenant: boolean,
  others: { section: AnySection; name: string; id: string }[],
): Errors {
  const e: Errors = {};
  if (asksTenant) {
    const t = appErrors(section, {
      client_id: otherA,
      tenant_id: tenant,
    }).tenant_id;
    if (t) e.tenant = t;
  }
  const c =
    appErrors(section, { client_id: client, tenant_id: otherB }).client_id ??
    (!e.tenant
      ? appErrors(section, { client_id: client, tenant_id: tenant }).tenant_id
      : undefined);
  if (c) e[`client-${l}`] = c;
  else {
    const same = others.find(
      (o) =>
        o.section !== section &&
        guid.test(o.id) &&
        o.id.toLowerCase() === client.toLowerCase(),
    );
    if (same) e[`client-${l}`] = txt.sameClient(same.name);
  }
  return e;
}

/** The applications of this walk in a row: which is under way, which are
 * saved. A level that was set before is not in it. */
function AppRail({
  order,
  current,
  saved,
  counts,
  name,
  onPick,
}: {
  order: MsLevel[];
  current: MsLevel;
  saved: (l: MsLevel) => boolean;
  counts: string[];
  name: (l: MsLevel) => string;
  onPick: (l: MsLevel) => void;
}) {
  return (
    <ol className="ml-rail" aria-label={txt.rail} data-testid="ml-rail">
      {order.map((l, i) => (
        <li
          key={l}
          aria-current={l === current ? "step" : undefined}
          data-done={saved(l) || undefined}
          data-testid={`ml-rail-${l}`}
        >
          <button
            type="button"
            className="ml-rail-btn"
            onClick={() => onPick(l)}
            aria-label={txt.railItem(i + 1, name(l), saved(l))}
          >
            <span className="ml-rail-n">
              {saved(l) ? <Icon name="check" /> : i + 1}
            </span>
            <span className="ml-rail-name">{txt.short[l]}</span>
            <span className="ml-rail-count">{counts[i]}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/** A1b5: the sub-items only show the position; the footer button walks them. */
function Stepper({
  parts,
  sub,
  label,
}: {
  parts: Part[];
  sub: number;
  label: string;
}) {
  return (
    <ol className="ml-stepper" aria-label={label} data-testid="ml-stepper">
      {parts.map((p, j) => (
        <li
          key={p.id}
          data-passed={j < sub || undefined}
          aria-current={j === sub ? "step" : undefined}
        >
          <span className="ml-dot-item">
            <span className="ml-dot">
              {j < sub ? <Icon name="check" /> : j + 1}
            </span>
            <span className="ml-dot-name">{p.name}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Walk({
  kind,
  convert,
  order,
  apps,
  tenants,
  saving,
  onSave,
  onTenant,
  onStart,
  onDone,
  onClose,
  client,
  setClientState,
  typedTenant,
  setTypedTenant,
  typedOrg,
  setTypedOrg,
}: {
  kind: MsKind;
  /** Levels whose single-tenant application exists are converted. */
  convert: boolean;
  order: MsLevel[];
  apps: IntegrationApp[];
  tenants: IntegrationTenant[];
  saving: boolean;
  /** Typed ids live in the dialog, so stepping back to the start page and
   * beginning again keeps what was typed for an unsaved application. */
  client: Partial<Record<MsLevel, string>>;
  setClientState: Dispatch<SetStateAction<Partial<Record<MsLevel, string>>>>;
  typedTenant: string;
  setTypedTenant: (v: string) => void;
  typedOrg: string;
  setTypedOrg: (v: string) => void;
  /** Saves one level's section; resolves false when the walk must stop. */
  onSave: (
    section: AnySection,
    l: MsLevel,
    fields: AppFields,
  ) => Promise<"saved" | string | false>;
  /** Puts the own organisation on the allowed list. */
  onTenant: (tenant: string, label: string) => Promise<"saved" | string>;
  onStart: () => void;
  onDone: () => void;
  onClose: () => void;
}) {
  const narrow = useNarrow();
  const [errors, setErrors] = useState<Errors>({});
  const [refusal, setRefusal] = useState("");
  const [saved, setSaved] = useState<MsLevel[]>([]);
  const app = (l: MsLevel) => appOf(apps, sectionFor(kind, l));
  const isSaved = (l: MsLevel) => saved.includes(l) || Boolean(app(l)?.usable);
  // Every application lives in the operator's one tenant: a saved
  // section's is reused, and only a walk with nothing saved asks it, in its
  // first application.
  const known = msLevels
    .flatMap((m) => [
      { level: m.id, a: appOf(apps, m.section) },
      { level: m.id, a: appOf(apps, m.shared) },
    ])
    .find(({ a }) => a?.usable && guid.test(a.tenant_id ?? ""));
  const tenantFrom = known?.level;
  const tenant = known?.a?.tenant_id ?? typedTenant;
  const single = (l: MsLevel) => {
    const a = appOf(apps, sectionFor("own", l));
    return a?.usable && guid.test(a.tenant_id ?? "") ? a : undefined;
  };
  const converts = (l: MsLevel) =>
    kind === "shared" && convert ? single(l) : undefined;
  // The own organisation's place on the allowed list: its label names the
  // shared applications, and the save adds it when it is missing.
  const listed = (t: string) =>
    tenants.find((x) => x.tenant_id.toLowerCase() === t.trim().toLowerCase());
  const ownLabel = guid.test(tenant) ? listed(tenant)?.label : undefined;
  const org = ownLabel ?? typedOrg;
  const ctx: Ctx = {
    kind,
    first: order[0],
    client,
    setClient: (l, v) => {
      setClientState((c) => ({ ...c, [l]: v }));
      setErrors((e) => ({ ...e, [`client-${l}`]: undefined }));
      setRefusal("");
    },
    tenant,
    setTenant: (v) => {
      setTypedTenant(v);
      setErrors((e) => ({ ...e, tenant: undefined }));
      setRefusal("");
    },
    tenantFrom,
    org,
    setOrg:
      ownLabel === undefined
        ? (v) => {
            setTypedOrg(v);
            setErrors((e) => ({ ...e, org: undefined }));
          }
        : undefined,
    converts,
    errors,
  };
  const list = groups(ctx, order);
  const [at, setAt] = useState(0);
  const [sub, setSub] = useState(0);
  const g = list[Math.min(at, list.length - 1)];
  const s = Math.min(sub, g.parts.length - 1);
  const part = g.parts[s];
  const lastPart = s === g.parts.length - 1;
  const appEnd = g.n === g.of - 1 && lastPart;
  const go = (n: number, toSub = 0) => {
    setAt(n);
    setSub(toSub);
    setRefusal("");
  };
  const pick = (l: MsLevel) => go(list.findIndex((x) => x.level === l));
  const nextApp = order.find((l) => l !== g.level && !isSaved(l));
  /** Opens the sub-item of the first field with an error, the current
   * application's first: the shared walk asks the organisation's name in
   * its first application only. */
  const reveal = (e: Errors) => {
    const has = (p: Part) => p.fields?.some((f) => e[f]);
    const j = g.parts.findIndex(has);
    if (j >= 0) return setSub(j);
    const i = list.findIndex((x) => x.parts.some(has));
    if (i >= 0) go(i, list[i].parts.findIndex(has));
  };
  const save = async () => {
    const l = g.level;
    const section = sectionFor(kind, l);
    const conv = converts(l);
    const value = conv?.client_id ?? (client[l] ?? "").trim();
    const owner = conv?.tenant_id ?? tenant.trim();
    const needsList = kind === "shared" && !listed(owner);
    const e: Errors = conv
      ? {}
      : idErrors(
          l,
          section,
          value,
          tenant.trim(),
          !tenantFrom,
          msLevels.flatMap((m) =>
            (["own", "shared"] as const).flatMap((k) => {
              const sec = sectionFor(k, m.id);
              const id =
                appOf(apps, sec)?.client_id ??
                (k === kind ? client[m.id]?.trim() : undefined);
              return id
                ? [
                    {
                      section: sec,
                      name: k === "shared" ? appName(ctx, m.id) : txt.app[m.id],
                      id,
                    },
                  ]
                : [];
            }),
          ),
        );
    if (needsList && !validLabel(org.trim())) e.org = txt.errOrg;
    setErrors(e);
    if (Object.keys(e).length) return reveal(e);
    // A retry after the list refused finds the section saved already.
    if (!isSaved(l)) {
      const result = await onSave(section, l, {
        client_id: value,
        tenant_id: owner,
      });
      if (result === false) return;
      if (result !== "saved") return setRefusal(result);
      setSaved((x) => [...x, l]);
    }
    if (needsList) {
      const listedNow = await onTenant(owner.toLowerCase(), org.trim());
      if (listedNow !== "saved") return setRefusal(txt.notListed(listedNow));
    }
    if (nextApp) pick(nextApp);
    else onDone();
  };
  const next = () => {
    const e = part.check?.() ?? {};
    if (Object.keys(e).length) return setErrors((x) => ({ ...x, ...e }));
    appEnd ? void save() : lastPart ? go(at + 1) : setSub(s + 1);
  };
  // Back from the very first sub-item is back to the start page.
  const back = () =>
    s > 0
      ? setSub(s - 1)
      : at > 0
        ? go(at - 1, list[at - 1].parts.length - 1)
        : onStart();
  const nextLabel = saving
    ? txt.saving
    : appEnd
      ? !nextApp
        ? txt.save
        : narrow
          ? txt.saveNext
          : txt.saveNextTo(txt.short[nextApp])
      : lastPart
        ? narrow
          ? txt.nextStep
          : txt.nextStepTo(list[at + 1].title)
        : // A phone has the stepper's next number right above.
          narrow
          ? txt.next
          : txt.nextTo(g.parts[s + 1].name);
  const counts = order.map((l) =>
    list.filter((x) => x.level === l).reduce((a, x) => a + x.parts.length, 0),
  );
  const skipped = msLevels
    .filter((m) => !order.includes(m.id))
    .map((m) => txt.short[m.id]);
  const fill = (s + 1) / g.parts.length;
  return (
    <>
      <div className="ml-stephead">
        <div className="ml-railrow">
          <AppRail
            order={order}
            current={g.level}
            saved={isSaved}
            counts={counts.map((c) => (narrow ? `${c}` : txt.items(c)))}
            name={(l) => appName(ctx, l)}
            onPick={pick}
          />
          {skipped.length > 0 && (
            <p className="ml-skipped" data-testid="ml-skipped">
              {narrow ? (
                // A phone keeps the rail on one line: the count shows, the
                // names are read out.
                <>
                  <span aria-hidden="true">
                    {txt.skippedShort(skipped.length)}
                  </span>
                  <span className="ml-sr">
                    {txt.skipped(skipped.join(", "))}
                  </span>
                </>
              ) : (
                txt.skipped(skipped.join(", "))
              )}
            </p>
          )}
        </div>
        <div
          className="si-progress ml-progress"
          data-testid="ml-progress"
          role="img"
          aria-label={txt.stepOf(g.n + 1, g.of)}
        >
          {list
            .filter((x) => x.level === g.level)
            .map((x, j) => (
              <span key={x.step} data-done={j < g.n || undefined}>
                {j === g.n && (
                  <i
                    className="ml-progress-fill"
                    style={{ width: `${fill * 100}%` }}
                  />
                )}
              </span>
            ))}
        </div>
        <p
          className="si-stepname"
          data-testid="ml-stepname"
          data-step={g.step}
          data-level={g.level}
          data-kind={kind}
        >
          <span className="si-muted">
            {g.n + 1}/{g.of}
          </span>{" "}
          {g.title}
        </p>
      </div>
      <div className="ml-stepbody" data-testid={`ml-step-${g.step}`}>
        <Band
          crop={part.at[0]}
          t={part.at[1]}
          narrow={narrow}
          missing={part.missing}
        />
        <Stepper parts={g.parts} sub={s} label={txt.stepperLabel(g.title)} />
        <fieldset
          className="ml-panel"
          data-testid="ml-panel"
          data-part={`${g.step}.${g.level}.${part.id}`}
          aria-label={part.name}
        >
          {part.body}
        </fieldset>
        {refusal && (
          <p className="ml-bad" role="alert" data-testid="ml-refusal">
            <Icon name="warning" />
            {refusal}
          </p>
        )}
      </div>
      <div className="si-foot">
        <ControlButton
          data-testid="ml-close"
          size="row"
          variant="quiet"
          isDisabled={saving}
          onPress={onClose}
        >
          {txt.close}
        </ControlButton>
        {g.step === "register" && s === 0 && (
          // An application made earlier, in Entra or by hand: straight to
          // its ids.
          <ControlButton
            data-testid="ml-have-app"
            size="row"
            variant="quiet"
            onPress={() => go(at + 3, 1)}
          >
            {txt.haveApp}
          </ControlButton>
        )}
        <span className="si-grow" />
        <ControlButton
          data-testid="ml-back"
          size="row"
          variant="secondary"
          isDisabled={saving}
          onPress={back}
        >
          {txt.back}
        </ControlButton>
        <ControlButton
          data-testid={appEnd ? "ml-save" : "ml-next"}
          size="page"
          variant="primary"
          isDisabled={saving}
          onPress={next}
        >
          {nextLabel}
        </ControlButton>
      </div>
    </>
  );
}

/* ---------- the start page: the table with a checkbox per missing level ---------- */

function Start({
  kind,
  setKind,
  convert,
  setConvert,
  apps,
  locked,
  justSaved,
  chosen,
  setChosen,
  line,
  invalid,
  onBegin,
  onRemove,
  onClose,
}: {
  kind: MsKind;
  setKind: (k: MsKind) => void;
  convert: boolean;
  setConvert: (on: boolean) => void;
  apps: IntegrationApp[];
  locked: boolean;
  justSaved: MsLevel[];
  chosen: Set<MsLevel>;
  setChosen: (s: Set<MsLevel>) => void;
  line: (app: IntegrationApp) => ReactNode;
  invalid: (app: IntegrationApp) => string;
  onBegin: (order: MsLevel[]) => void;
  onRemove: (section: AnySection) => void;
  onClose: () => void;
}) {
  const app = (l: MsLevel) => appOf(apps, sectionFor(kind, l));
  const isSet = (l: MsLevel) => Boolean(app(l)?.usable);
  const order = msLevels
    .map((m) => m.id)
    .filter((l) => chosen.has(l) && !isSet(l));
  const left = msLevels.filter((m) => !isSet(m.id)).length;
  // Levels whose own-organisation application could serve every
  // organisation once switched in Entra.
  const convertible =
    kind === "shared"
      ? msLevels.filter((m) => !isSet(m.id) && appOf(apps, m.section)?.usable)
      : [];
  const toggle = (l: MsLevel, on: boolean) => {
    const n = new Set(chosen);
    if (on) n.add(l);
    else n.delete(l);
    setChosen(n);
  };
  const lines = msLevels.flatMap((m) => {
    const section = sectionFor(kind, m.id);
    const a = appOf(apps, section);
    return a ? [{ level: m.id, section, app: a }] : [];
  });
  return (
    <>
      <div className="ml-start" data-testid="ml-start">
        <div className="ml-lead">
          {justSaved.length > 0 && (
            <p className="ml-done" data-testid="ml-just">
              <Icon name="check" />
              <span>
                <strong>{txt.saved}</strong>{" "}
                {justSaved.map((l) => txt.short[l]).join(", ")}.
              </span>
            </p>
          )}
          <div className="ml-kind">
            <Segmented
              data-testid="ml-kind"
              label={txt.kindLabel}
              options={[
                { id: "own", label: txt.kindOwn },
                { id: "shared", label: txt.kindShared },
              ]}
              value={kind}
              onChange={setKind}
            />
            <p className="ml-quiet" data-testid="ml-kind-note">
              {kind === "shared" ? txt.kindSharedNote : txt.kindOwnNote}
            </p>
          </div>
          <p className="ml-act">{left ? txt.tick : txt.allSet}</p>
          <p className="ml-quiet ml-how">
            <Icon name="server" />
            <span>{txt.how}</span>
          </p>
          {locked && (
            <p className="ml-quiet ml-how" data-testid="ml-locked">
              <Icon name="info" />
              <span>{txt.locked}</span>
            </p>
          )}
        </div>
        {convertible.length > 0 && (
          <div className="ml-convert" data-testid="ml-convert">
            <RadioGroup
              label={txt.convertLabel(
                convertible.map((m) => txt.short[m.id]).join(", "),
              )}
              value={convert ? "convert" : "new"}
              onChange={(v) => setConvert(v === "convert")}
              options={[
                {
                  value: "convert",
                  label: txt.convertYes,
                  description: txt.convertYesNote,
                },
                {
                  value: "new",
                  label: txt.convertNo,
                  description: txt.convertNoNote,
                },
              ]}
            />
          </div>
        )}
        {lines.length > 0 && (
          <ul className="ml-known" data-testid="ml-known">
            {lines.map(({ level, section, app: a }) => (
              <li
                key={level}
                data-testid={`ml-known-${level}`}
                data-usable={a.usable || undefined}
              >
                <Icon name={a.usable ? "check" : "warning"} />
                <span>
                  <strong>{txt.short[level]}</strong>{" "}
                  {a.usable ? (
                    line(a)
                  ) : (
                    <span className="ml-bad-text">
                      {txt.unusable} {invalid(a)}
                    </span>
                  )}
                </span>
                {!locked && (
                  <ControlButton
                    data-testid={`ml-remove-${level}`}
                    size="row"
                    variant="quiet"
                    aria-label={txt.removeOf(levelName("microsoft", level))}
                    onPress={() => onRemove(section)}
                  >
                    <Icon name="trash" />
                    <span className="ml-remove-label">{txt.remove}</span>
                  </ControlButton>
                )}
              </li>
            ))}
          </ul>
        )}
        <LevelTable
          provider="microsoft"
          testId="ml-table"
          chosen={(l) => chosen.has(l as MsLevel) && !isSet(l as MsLevel)}
          head={(l) =>
            isSet(l as MsLevel) ? (
              <span className="ml-colset" data-testid={`ml-set-${l}`}>
                <Icon name="check" />
                {txt.setMark}
              </span>
            ) : (
              <span className="ml-colpick">
                <Checkbox
                  data-testid={`ml-pick-${l}`}
                  label={txt.setNow}
                  checked={chosen.has(l as MsLevel)}
                  onChange={(on) => toggle(l as MsLevel, on)}
                  availability={
                    locked
                      ? { state: "disabled", reason: txt.locked }
                      : undefined
                  }
                />
              </span>
            )
          }
        />
      </div>
      <div className="si-foot">
        <span className="si-grow" />
        {left ? (
          <>
            <ControlButton size="row" variant="secondary" onPress={onClose}>
              {txt.cancel}
            </ControlButton>
            <ControlButton
              data-testid="ml-begin"
              size="page"
              variant="primary"
              isDisabled={locked || !order.length}
              onPress={() => onBegin(order)}
            >
              {order.length ? txt.begin(order.length) : txt.chooseLevel}
            </ControlButton>
          </>
        ) : (
          <ControlButton
            data-testid="ml-finish"
            size="page"
            variant="secondary"
            onPress={onClose}
          >
            {txt.done}
          </ControlButton>
        )}
      </div>
    </>
  );
}

const missingLevels = (apps: IntegrationApp[], kind: MsKind) =>
  new Set(
    msLevels
      .filter((m) => !appOf(apps, sectionFor(kind, m.id))?.usable)
      .map((m) => m.id),
  );

/** Microsoft 365: tasojen sovellukset. The start page, then the chosen
 * levels walked in full; each application is saved at its end, so an
 * interruption loses nothing that was saved. The dialog stays open while
 * the broker answers, so a refusal keeps what was typed. */
export function MicrosoftLevelsDialog({
  apps,
  tenants,
  locked,
  line,
  invalid,
  onSave,
  onTenantSet,
  onRemove,
  onClose,
}: {
  /** Root's sections, as the broker lists them. */
  apps: IntegrationApp[];
  /** Root's allowed organisations, as the broker lists them. */
  tenants: IntegrationTenant[];
  /** Root's browser setup is off, or the session cannot write. */
  locked: boolean;
  /** Who set a section and when. */
  line: (app: IntegrationApp) => ReactNode;
  /** Why a section in root's file is not used. */
  invalid: (app: IntegrationApp) => string;
  onSave: (section: AnySection, fields: AppFields) => Promise<AppChange>;
  /** Adds an organisation to the allowed list. */
  onTenantSet: (tenant: string, label: string) => Promise<AppChange>;
  onRemove: (section: AnySection) => void;
  onClose: () => void;
}) {
  // An installation with a shared application opens on its kind; one
  // without opens exactly as before.
  const [kind, setKind] = useState<MsKind>(() =>
    msLevels.some((m) => appOf(apps, m.shared)) ? "shared" : "own",
  );
  const [convert, setConvert] = useState(true);
  const [order, setOrder] = useState<MsLevel[] | null>(null);
  const [run, setRun] = useState(0);
  const [saving, setSaving] = useState(false);
  // Typed client ids, each kind its own: they are different applications.
  const [clients, setClients] = useState<
    Record<MsKind, Partial<Record<MsLevel, string>>>
  >({ own: {}, shared: {} });
  const setClientState: Dispatch<
    SetStateAction<Partial<Record<MsLevel, string>>>
  > = (u) =>
    setClients((x) => ({
      ...x,
      [kind]: typeof u === "function" ? u(x[kind]) : u,
    }));
  const [typedTenant, setTypedTenant] = useState("");
  const [typedOrg, setTypedOrg] = useState("");
  const [justSaved, setJustSaved] = useState<MsLevel[]>([]);
  // Every missing level is ticked at first; the administrator unticks what
  // waits. Each kind keeps its own ticks.
  const [chosen, setChosen] = useState<Record<MsKind, Set<MsLevel>>>(() => ({
    own: missingLevels(apps, "own"),
    shared: missingLevels(apps, "shared"),
  }));
  const save = async (section: AnySection, l: MsLevel, fields: AppFields) => {
    setSaving(true);
    const result = await onSave(section, fields);
    setSaving(false);
    if (result.kind === "changed") {
      setJustSaved((j) => [...j, l]);
      return "saved" as const;
    }
    if (result.kind === "refused") return appRefusal(result.code);
    // Uncertain: the page's row says so and offers a refresh.
    onClose();
    return false as const;
  };
  const list = async (tenant: string, label: string) => {
    setSaving(true);
    const result = await onTenantSet(tenant, label);
    setSaving(false);
    if (result.kind === "changed") return "saved" as const;
    if (result.kind === "refused") return appRefusal(result.code);
    // The section is saved; the walk stays so the list can be tried again.
    return result.kind === "login" ? appRefusal("login") : txt.listUncertain;
  };
  return (
    <ModalOverlay
      className="ah-overlay"
      isOpen
      isDismissable={false}
      onOpenChange={(open) => !open && onClose()}
    >
      <Modal className="ah-modal si-modal ml-modal">
        <Dialog
          className="ah-dialog si-dialog ml-dialog"
          data-testid="ml-dialog"
          data-page={order ? "walk" : "start"}
          data-kind={kind}
          aria-label={txt.title}
        >
          <Heading slot="title">{txt.title}</Heading>
          {order ? (
            <Walk
              key={run}
              kind={kind}
              convert={convert}
              order={order}
              apps={apps}
              tenants={tenants}
              saving={saving}
              onSave={save}
              onTenant={list}
              onStart={() => {
                setJustSaved([]);
                setOrder(null);
              }}
              onDone={() => setOrder(null)}
              onClose={onClose}
              client={clients[kind]}
              setClientState={setClientState}
              typedTenant={typedTenant}
              setTypedTenant={setTypedTenant}
              typedOrg={typedOrg}
              setTypedOrg={setTypedOrg}
            />
          ) : (
            <Start
              kind={kind}
              setKind={(k) => {
                setJustSaved([]);
                setKind(k);
              }}
              convert={convert}
              setConvert={setConvert}
              apps={apps}
              locked={locked}
              justSaved={justSaved}
              chosen={chosen[kind]}
              setChosen={(c) => setChosen((x) => ({ ...x, [kind]: c }))}
              line={line}
              invalid={invalid}
              onBegin={(o) => {
                setJustSaved([]);
                setOrder(o);
                setRun((r) => r + 1);
              }}
              onRemove={onRemove}
              onClose={onClose}
            />
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
