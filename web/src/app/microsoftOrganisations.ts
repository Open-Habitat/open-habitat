import type {
  IntegrationApp,
  IntegrationApps,
  IntegrationTenant,
} from "./serverIntegrations";

// The organisations the administrator's Microsoft 365 dialog lists, read from
// the broker's page alone the way every daemon builds its table
// (internal/daemon/integrations/microsoft_orgs_linux.go): each usable
// single-tenant section serves its own tenant at its level, and each
// organisation on the allowed list gets the shared (multi-tenant)
// application of every level its own sections leave empty. The operator's
// own organisation is the shared applications' owner, or with none set, the
// single-tenant sections' tenants. Unlike the daemons' table, a listed
// organisation without any application is still listed: the administrator
// added it and may remove it.

export type MsLevelId = "full" | "nosend" | "drafts" | "read";
/** Broadest first, as the levels are shown everywhere else. */
export const msLevelOrder: MsLevelId[] = ["full", "nosend", "drafts", "read"];
const singleSection: Record<MsLevelId, string> = {
  full: "microsoft",
  nosend: "microsoft_nosend",
  drafts: "microsoft_drafts",
  read: "microsoft_read",
};
const sharedSection: Record<MsLevelId, string> = {
  full: "microsoft_shared",
  nosend: "microsoft_shared_nosend",
  drafts: "microsoft_shared_drafts",
  read: "microsoft_shared_read",
};

/** One level's application serving an organisation, with its consent link. */
export type OrganisationLink = {
  level: MsLevelId;
  client_id: string;
  url: string;
};

export type AdminOrganisation = {
  tenant_id: string;
  /** The allowed list's name; absent for an organisation only a
   * single-tenant section of its own serves. */
  label?: string;
  own: boolean;
  /** On the allowed list, so it can be removed from it. */
  listed: boolean;
  /** The applications serving it, narrowest level first: a client most
   * often approves the read level alone, so the message lists it first. */
  links: OrganisationLink[];
};

// Each level's Graph permissions as its administrator consents to them, in
// the order integrationapps.MicrosoftLevelScopes names them: the identity
// scopes lead, then the level's own, then the teams' names every level lists.
const identity = "openid profile offline_access";
const teams = "Team.ReadBasic.All Channel.ReadBasic.All";
const levelScopes: Record<MsLevelId, string> = {
  full: `User.Read Files.ReadWrite.All Sites.ReadWrite.All Mail.ReadWrite Mail.Send Calendars.ReadWrite Contacts.ReadWrite ${teams}`,
  nosend: `User.Read Files.ReadWrite.All Sites.ReadWrite.All Mail.ReadWrite Calendars.ReadWrite Contacts.ReadWrite ${teams}`,
  drafts: `User.Read Files.Read.All Sites.Read.All Mail.ReadWrite Calendars.Read Contacts.Read ${teams}`,
  read: `User.Read Files.Read.All Sites.Read.All Mail.Read Calendars.Read Contacts.Read ${teams}`,
};

/** The admin-consent link of a level's application in one organisation, as
 * integrationapps.MicrosoftConsentURL builds it for root's CLI: the
 * organisation's own authority, so it can be approved only there. */
export function microsoftConsentURL(
  tenant: string,
  client: string,
  level: MsLevelId,
): string {
  // url.Values.Encode sorts its keys; URLSearchParams keeps insertion order.
  const query = new URLSearchParams([
    ["client_id", client],
    [
      "redirect_uri",
      "https://login.microsoftonline.com/common/oauth2/nativeclient",
    ],
    ["scope", `${identity} ${levelScopes[level]}`],
  ]);
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/v2.0/adminconsent?${query}`;
}

/** The broker's label rule (integrationapps): 1 to 64 characters (code
 * points), none a control or line-separator character. Trimmed by the
 * caller. */
export const validLabel = (s: string) => {
  const chars = [...s];
  return (
    chars.length >= 1 &&
    chars.length <= 64 &&
    chars.every((c) => {
      const n = c.codePointAt(0) ?? 0;
      return !(
        n < 0x20 ||
        (n >= 0x7f && n <= 0x9f) ||
        n === 0x2028 ||
        n === 0x2029
      );
    })
  );
};

export const guid =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const usable = (apps: IntegrationApp[], section: string) => {
  const a = apps.find((x) => x.provider === section);
  return a?.usable && a.client_id && a.tenant_id && guid.test(a.tenant_id)
    ? a
    : undefined;
};

/** The organisations in the order people choose from: own first, then the
 * allowed list in its order, then those only a single-tenant section serves. */
export function adminOrganisations(page: IntegrationApps): AdminOrganisation[] {
  const cells = new Map<string, Map<MsLevelId, string>>();
  const put = (tenant: string, level: MsLevelId, client: string) => {
    const row = cells.get(tenant) ?? new Map<MsLevelId, string>();
    if (!row.has(level)) row.set(level, client);
    cells.set(tenant, row);
  };
  const singles: string[] = [];
  const owners = new Set<string>();
  for (const level of msLevelOrder) {
    const single = usable(page.apps, singleSection[level]);
    if (single?.client_id && single.tenant_id) {
      const tenant = single.tenant_id.toLowerCase();
      put(tenant, level, single.client_id);
      singles.push(tenant);
    }
    const shared = usable(page.apps, sharedSection[level]);
    if (shared?.tenant_id) owners.add(shared.tenant_id.toLowerCase());
  }
  const own = owners.size ? owners : new Set(singles);
  const listed = new Map<string, IntegrationTenant>(
    page.tenants.map((t) => [t.tenant_id.toLowerCase(), t]),
  );
  for (const tenant of listed.keys())
    for (const level of msLevelOrder) {
      const shared = usable(page.apps, sharedSection[level]);
      if (shared?.client_id) put(tenant, level, shared.client_id);
    }
  const order: string[] = [];
  const add = (tenant: string, listedToo = false) => {
    if (order.includes(tenant)) return;
    if (!listedToo && !cells.has(tenant)) return;
    order.push(tenant);
  };
  for (const t of listed.keys()) if (own.has(t)) add(t, true);
  for (const t of singles) if (own.has(t)) add(t);
  for (const t of listed.keys()) add(t, true);
  for (const t of singles) add(t);
  return order.map((tenant) => {
    const row = cells.get(tenant);
    return {
      tenant_id: tenant,
      label: listed.get(tenant)?.label,
      own: own.has(tenant),
      listed: listed.has(tenant),
      links: [...msLevelOrder].reverse().flatMap((level) => {
        const client = row?.get(level);
        return client
          ? [
              {
                level,
                client_id: client,
                url: microsoftConsentURL(tenant, client, level),
              },
            ]
          : [];
      }),
    };
  });
}

/** Whether any shared (multi-tenant) application is set, without which a
 * listed client organisation is served at no level. */
export const hasShared = (page: IntegrationApps) =>
  msLevelOrder.some((l) => usable(page.apps, sharedSection[l]));
