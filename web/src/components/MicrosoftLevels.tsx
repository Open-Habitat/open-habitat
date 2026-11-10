import {
  type Dispatch,
  Fragment,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useState,
} from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import type { Level } from "../app/integrations";
import {
  type AppChange,
  type AppFields,
  type AppSection,
  appErrors,
  appRefusal,
  type IntegrationApp,
} from "../app/serverIntegrations";
import authImg from "../assets/entra/auth.avif";
import { entraCrops } from "../assets/entra/crops";
import listImg from "../assets/entra/list.avif";
import overviewImg from "../assets/entra/overview.avif";
import permsImg from "../assets/entra/perms.avif";
import registerImg from "../assets/entra/register.avif";
import { liveText } from "../i18n";
import { microsoftLevelsText } from "../text/microsoftLevels";
import { ControlButton, ExternalLink } from "./ControlElements";
import { Icon, type IconName } from "./Icon";
import { levelName } from "./Integrations";
import { Checkbox, TextField } from "./Primitives";
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
/** The four levels, broadest first, with their sections of root's file. */
export const msLevels: { id: MsLevel; section: AppSection }[] = [
  { id: "full", section: "microsoft" },
  { id: "nosend", section: "microsoft_nosend" },
  { id: "drafts", section: "microsoft_drafts" },
  { id: "read", section: "microsoft_read" },
];
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

type Box = readonly [number, number, number, number];
type CropName = keyof typeof entraCrops;
const src: Record<CropName, string> = {
  register: registerImg,
  list: listImg,
  overview: overviewImg,
  auth: authImg,
  perms: permsImg,
};
const target = (crop: CropName, t: string): Box =>
  (entraCrops[crop].targets as Record<string, Box>)[t];

/** The slice of a crop the band shows: the full width on a desktop, the
 * target's neighbourhood on a phone, and the target's middle at mid
 * height, so every sub-item of a step has the same band height. */
function bandOf(
  crop: CropName,
  t: string,
  aspect: number,
  narrow: boolean,
): Box {
  const c = entraCrops[crop].box;
  const tg = target(crop, t);
  const cw = c[2] - c[0];
  const ch = c[3] - c[1];
  let wide = narrow
    ? Math.max(720, tg[2] - tg[0] + 120)
    : Math.max(1500, tg[2] + 120);
  wide = Math.max(wide, (tg[3] - tg[1] + 80) * aspect);
  wide = Math.min(cw, wide, ch * aspect);
  const tall = Math.round(wide / aspect);
  const left = narrow
    ? Math.max(c[0], Math.min(c[2] - wide, tg[0] - 60))
    : c[0];
  const mid = (tg[1] + tg[3]) / 2;
  const top = Math.max(c[1], Math.min(c[3] - tall, Math.round(mid - tall / 2)));
  return [left, top, left + wide, top + tall];
}

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
  const aspect = missing ? (narrow ? 3 : 4.4) : narrow ? 2.3 : 3.7;
  const v = bandOf(crop, t, aspect, narrow);
  const w = v[2] - v[0];
  const h = v[3] - v[1];
  const pct = (b: Box) => ({
    left: `${((b[0] - v[0]) / w) * 100}%`,
    top: `${((b[1] - v[1]) / h) * 100}%`,
    width: `${((b[2] - b[0]) / w) * 100}%`,
    height: `${((b[3] - b[1]) / h) * 100}%`,
  });
  return (
    <figure className="ml-shot" data-testid="ml-band" data-crop={crop}>
      <div className="ml-shot-frame" style={{ aspectRatio: `${aspect}` }}>
        <img
          src={src[crop]}
          alt={txt.alt[crop]}
          draggable={false}
          style={pct(entraCrops[crop].box)}
        />
        <span
          className="ml-mark"
          data-target={`${crop}.${t}`}
          style={pct(target(crop, t))}
        />
      </div>
      {missing && (
        <figcaption className="ml-nocap" data-testid="ml-nocap">
          <Icon name="image" />
          <span>
            {txt.missing(missing)}
            {!narrow && ` ${txt.missingFrom}`}
          </span>
        </figcaption>
      )}
    </figure>
  );
}

function useNarrow() {
  const q = "(max-width: 640px)";
  const [narrow, setNarrow] = useState(
    () => window.matchMedia?.(q).matches ?? false,
  );
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return;
    const on = () => setNarrow(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return narrow;
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
  /** The first application of this walk: it carries the one-time notes. */
  first: MsLevel;
  client: Partial<Record<MsLevel, string>>;
  setClient: (l: MsLevel, v: string) => void;
  tenant: string;
  setTenant: (v: string) => void;
  /** The level whose saved section has the tenant; undefined asks it. */
  tenantFrom?: MsLevel;
  errors: Errors;
};
type Part = {
  id: string;
  name: string;
  at: [CropName, string];
  missing?: string;
  fields?: string[];
  body: ReactNode;
};
type Group = { step: number; level: MsLevel; parts: Part[] };

const em = (s: string) => <em>{s}</em>;

function register(ctx: Ctx, l: MsLevel): Part[] {
  const first = ctx.first === l;
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
    {
      id: "name",
      name: "Name",
      at: ["register", "name"],
      body: (
        <>
          <Act>{txt.typeName}</Act>
          <Value value={txt.app[l]} label="Name" />
          {first && <p className="ml-quiet">{txt.ownApp}</p>}
        </>
      ),
    },
    {
      id: "accounts",
      name: "Supported account types",
      at: ["register", "accounts"],
      body: (
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
      body: <Done>{txt.appOpens(em(txt.app[l]))}</Done>,
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
/** The chosen levels, broadest first, each in full. */
function groups(ctx: Ctx, order: MsLevel[]): Group[] {
  return order.flatMap((l) => [
    { step: 0, level: l, parts: register(ctx, l) },
    { step: 1, level: l, parts: publicClient() },
    { step: 2, level: l, parts: permissions(l) },
    { step: 3, level: l, parts: consent(ctx, l) },
  ]);
}

const guid =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
// Two well-formed GUIDs that are neither of the typed ones: appErrors
// judges a section's pair, and the walk asks each id on its own sub-item.
const otherA = "00000000-0000-4000-8000-00000000000a";
const otherB = "00000000-0000-4000-8000-00000000000b";

/** The broker's checks for one application, each field on its own, and
 * the same client id as another level's, saved or typed, refused: four
 * applications, four ids, and the same one pasted twice is the likeliest
 * slip. */
function idErrors(
  l: MsLevel,
  client: string,
  tenant: string,
  asksTenant: boolean,
  others: { level: MsLevel; id: string }[],
): Errors {
  const e: Errors = {};
  const section = msLevels.find((m) => m.id === l)?.section ?? "microsoft";
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
        o.level !== l &&
        guid.test(o.id) &&
        o.id.toLowerCase() === client.toLowerCase(),
    );
    if (same) e[`client-${l}`] = txt.sameClient(txt.app[same.level]);
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
  onPick,
}: {
  order: MsLevel[];
  current: MsLevel;
  saved: (l: MsLevel) => boolean;
  counts: string[];
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
            aria-label={txt.railItem(i + 1, txt.app[l], saved(l))}
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
  order,
  apps,
  saving,
  onSave,
  onStart,
  onDone,
  onClose,
  client,
  setClientState,
  typedTenant,
  setTypedTenant,
}: {
  order: MsLevel[];
  apps: IntegrationApp[];
  saving: boolean;
  /** Typed ids live in the dialog, so stepping back to the start page and
   * beginning again keeps what was typed for an unsaved application. */
  client: Partial<Record<MsLevel, string>>;
  setClientState: Dispatch<SetStateAction<Partial<Record<MsLevel, string>>>>;
  typedTenant: string;
  setTypedTenant: (v: string) => void;
  /** Saves one level's section; resolves false when the walk must stop. */
  onSave: (l: MsLevel, fields: AppFields) => Promise<"saved" | string | false>;
  onStart: () => void;
  onDone: () => void;
  onClose: () => void;
}) {
  const narrow = useNarrow();
  const [errors, setErrors] = useState<Errors>({});
  const [refusal, setRefusal] = useState("");
  const [saved, setSaved] = useState<MsLevel[]>([]);
  const sectionOf = (l: MsLevel) => msLevels.find((m) => m.id === l)?.section;
  const app = (l: MsLevel) => apps.find((a) => a.provider === sectionOf(l));
  const isSaved = (l: MsLevel) => saved.includes(l) || Boolean(app(l)?.usable);
  // All four live in one tenant: a saved section's is reused, and only a
  // walk with nothing saved asks it, in its first application.
  const known = msLevels.find(
    (m) =>
      app(m.id)?.usable &&
      app(m.id)?.tenant_id &&
      guid.test(app(m.id)?.tenant_id ?? ""),
  );
  const tenantFrom = known?.id;
  const tenant = known ? (app(known.id)?.tenant_id ?? "") : typedTenant;
  const ctx: Ctx = {
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
    errors,
  };
  const list = groups(ctx, order);
  const [at, setAt] = useState(0);
  const [sub, setSub] = useState(0);
  const g = list[at];
  const s = Math.min(sub, g.parts.length - 1);
  const part = g.parts[s];
  const lastPart = s === g.parts.length - 1;
  const appEnd = g.step === 3 && lastPart;
  const go = (n: number, toSub = 0) => {
    setAt(n);
    setSub(toSub);
    setRefusal("");
  };
  const pick = (l: MsLevel) => go(list.findIndex((x) => x.level === l));
  const nextApp = order.find((l) => l !== g.level && !isSaved(l));
  const save = async () => {
    const value = (client[g.level] ?? "").trim();
    const others = msLevels.flatMap((m) => {
      const id = app(m.id)?.client_id ?? client[m.id]?.trim();
      return id ? [{ level: m.id, id }] : [];
    });
    const e = idErrors(g.level, value, tenant.trim(), !tenantFrom, others);
    setErrors(e);
    if (Object.keys(e).length) {
      // The field with the error may be on another sub-item: open it.
      const j = g.parts.findIndex((p) => p.fields?.some((f) => e[f]));
      if (j >= 0) setSub(j);
      return;
    }
    const result = await onSave(g.level, {
      client_id: value,
      tenant_id: tenant.trim(),
    });
    if (result === false) return;
    if (result !== "saved") {
      setRefusal(result);
      return;
    }
    setSaved((x) => [...x, g.level]);
    if (nextApp) pick(nextApp);
    else onDone();
  };
  const next = () =>
    appEnd ? void save() : lastPart ? go(at + 1) : setSub(s + 1);
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
          : txt.nextStepTo(txt.steps[list[at + 1].step])
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
  const title = txt.steps[g.step];
  return (
    <>
      <div className="ml-stephead">
        <div className="ml-railrow">
          <AppRail
            order={order}
            current={g.level}
            saved={isSaved}
            counts={counts.map((c) => (narrow ? `${c}` : txt.items(c)))}
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
          aria-label={txt.stepOf(g.step + 1)}
        >
          {[0, 1, 2, 3].map((j) => (
            <span key={j} data-done={j < g.step || undefined}>
              {j === g.step && (
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
          data-step={stepIds[g.step]}
          data-level={g.level}
        >
          <span className="si-muted">{g.step + 1}/4</span> {title}
        </p>
      </div>
      <div className="ml-stepbody" data-testid={`ml-step-${stepIds[g.step]}`}>
        <Band
          crop={part.at[0]}
          t={part.at[1]}
          narrow={narrow}
          missing={part.missing}
        />
        <Stepper parts={g.parts} sub={s} label={txt.stepperLabel(title)} />
        <fieldset
          className="ml-panel"
          data-testid="ml-panel"
          data-part={`${stepIds[g.step]}.${g.level}.${part.id}`}
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
        {g.step === 0 && s === 0 && (
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
  apps: IntegrationApp[];
  locked: boolean;
  justSaved: MsLevel[];
  chosen: Set<MsLevel>;
  setChosen: (s: Set<MsLevel>) => void;
  line: (app: IntegrationApp) => ReactNode;
  invalid: (app: IntegrationApp) => string;
  onBegin: (order: MsLevel[]) => void;
  onRemove: (section: AppSection) => void;
  onClose: () => void;
}) {
  const app = (l: MsLevel) =>
    apps.find((a) => a.provider === msLevels.find((m) => m.id === l)?.section);
  const isSet = (l: MsLevel) => Boolean(app(l)?.usable);
  const order = msLevels
    .map((m) => m.id)
    .filter((l) => chosen.has(l) && !isSet(l));
  const left = msLevels.filter((m) => !isSet(m.id)).length;
  const toggle = (l: MsLevel, on: boolean) => {
    const n = new Set(chosen);
    if (on) n.add(l);
    else n.delete(l);
    setChosen(n);
  };
  const lines = msLevels.flatMap((m) => {
    const a = app(m.id);
    return a ? [{ level: m.id, section: m.section, app: a }] : [];
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

/** Microsoft 365: tasojen sovellukset. The start page, then the chosen
 * levels walked in full; each application is saved at its end, so an
 * interruption loses nothing that was saved. The dialog stays open while
 * the broker answers, so a refusal keeps what was typed. */
export function MicrosoftLevelsDialog({
  apps,
  locked,
  line,
  invalid,
  onSave,
  onRemove,
  onClose,
}: {
  /** Root's sections, as the broker lists them. */
  apps: IntegrationApp[];
  /** Root's browser setup is off, or the session cannot write. */
  locked: boolean;
  /** Who set a section and when. */
  line: (app: IntegrationApp) => ReactNode;
  /** Why a section in root's file is not used. */
  invalid: (app: IntegrationApp) => string;
  onSave: (section: AppSection, fields: AppFields) => Promise<AppChange>;
  onRemove: (section: AppSection) => void;
  onClose: () => void;
}) {
  const [order, setOrder] = useState<MsLevel[] | null>(null);
  const [run, setRun] = useState(0);
  const [saving, setSaving] = useState(false);
  const [client, setClientState] = useState<Partial<Record<MsLevel, string>>>(
    {},
  );
  const [typedTenant, setTypedTenant] = useState("");
  const [justSaved, setJustSaved] = useState<MsLevel[]>([]);
  // Every missing level is ticked at first; the administrator unticks what waits.
  const [chosen, setChosen] = useState<Set<MsLevel>>(
    () =>
      new Set(
        msLevels
          .filter((m) => !apps.find((a) => a.provider === m.section)?.usable)
          .map((m) => m.id),
      ),
  );
  const save = async (l: MsLevel, fields: AppFields) => {
    const section = msLevels.find((m) => m.id === l)?.section ?? "microsoft";
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
          aria-label={txt.title}
        >
          <Heading slot="title">{txt.title}</Heading>
          {order ? (
            <Walk
              key={run}
              order={order}
              apps={apps}
              saving={saving}
              onSave={save}
              onStart={() => {
                setJustSaved([]);
                setOrder(null);
              }}
              onDone={() => setOrder(null)}
              onClose={onClose}
              client={client}
              setClientState={setClientState}
              typedTenant={typedTenant}
              setTypedTenant={setTypedTenant}
            />
          ) : (
            <Start
              apps={apps}
              locked={locked}
              justSaved={justSaved}
              chosen={chosen}
              setChosen={setChosen}
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
