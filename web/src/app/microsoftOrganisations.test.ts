import { describe, expect, it } from "vitest";
import {
  adminOrganisations,
  hasShared,
  microsoftConsentURL,
} from "./microsoftOrganisations";
import type { IntegrationApps } from "./serverIntegrations";

const own = "6d1f0c2a-3b7e-4a51-9c8d-2e4f6a8b0c13";
const one = "9a4e7b21-5c3d-4f60-8e1a-7b2c9d0e4f35";
const two = "c3b8d5e0-1a2f-4b7c-a6d9-0e5f8a3b2c47";
const other = "0f8e6d4c-2b1a-4987-8654-3210fedcba98";
const app = (provider: string, client: string, tenant = own) => ({
  provider,
  client_id: client,
  tenant_id: tenant,
  usable: true,
  source: "operator" as const,
});
const tenant = (tenant_id: string, label: string) => ({
  tenant_id,
  label,
  source: "site_admin" as const,
});
const page = (
  apps: ReturnType<typeof app>[],
  tenants: ReturnType<typeof tenant>[] = [],
): IntegrationApps =>
  ({
    schema_version: 1,
    browser_setup: true,
    apps,
    tenants,
  }) as unknown as IntegrationApps;
const S = "11111111-1111-4111-8111-11111111";

describe("adminOrganisations", () => {
  it("is one own organisation with single-tenant sections alone", () => {
    const orgs = adminOrganisations(
      page([app("microsoft", `${S}0001`), app("microsoft_read", `${S}0004`)]),
    );
    expect(orgs).toHaveLength(1);
    expect(orgs[0]).toMatchObject({ tenant_id: own, own: true, listed: false });
    expect(orgs[0].label).toBeUndefined();
    // Narrowest level first, each with its own application.
    expect(orgs[0].links.map((l) => [l.level, l.client_id])).toEqual([
      ["read", `${S}0004`],
      ["full", `${S}0001`],
    ]);
    expect(hasShared(page([app("microsoft", `${S}0001`)]))).toBe(false);
  });

  it("puts the shared owner first whatever the list's order, then the list, then unlisted single tenants", () => {
    const orgs = adminOrganisations(
      page(
        [
          app("microsoft", `${S}0001`),
          app("microsoft_read", `${S}0004`, other),
          app("microsoft_shared", `${S}0011`),
          app("microsoft_shared_read", `${S}0014`),
        ],
        [
          tenant(two, "Client Two"),
          tenant(one, "Client One"),
          tenant(own, "Own Ltd"),
        ],
      ),
    );
    expect(orgs.map((o) => [o.tenant_id, o.own, o.listed])).toEqual([
      [own, true, true],
      [two, false, true],
      [one, false, true],
      [other, false, false],
    ]);
    // The own organisation keeps its single-tenant full level; the shared
    // read fills what its sections leave empty. A client has only shared.
    expect(orgs[0].links.map((l) => l.client_id)).toEqual([
      `${S}0014`,
      `${S}0001`,
    ]);
    expect(orgs[1].links.map((l) => l.client_id)).toEqual([
      `${S}0014`,
      `${S}0011`,
    ]);
    expect(orgs[3].links.map((l) => l.client_id)).toEqual([`${S}0004`]);
  });

  it("keeps a listed organisation without applications, and leaves out unusable sections", () => {
    const orgs = adminOrganisations(
      page(
        [
          app("microsoft", `${S}0001`),
          { ...app("microsoft_shared", `${S}0011`), usable: false },
        ],
        [tenant(one, "Client One")],
      ),
    );
    expect(orgs.map((o) => [o.tenant_id, o.own, o.links.length])).toEqual([
      [own, true, 1],
      [one, false, 0],
    ]);
  });
});

describe("microsoftConsentURL", () => {
  // As integrationapps.MicrosoftConsentURL printed them for root's CLI.
  it("matches root's consent link byte for byte", () => {
    expect(
      microsoftConsentURL(one, "a1c9e7f5-4d3b-4e2a-8f6c-2b0d9e7a5c96", "read"),
    ).toBe(
      "https://login.microsoftonline.com/9a4e7b21-5c3d-4f60-8e1a-7b2c9d0e4f35/v2.0/adminconsent?client_id=a1c9e7f5-4d3b-4e2a-8f6c-2b0d9e7a5c96&redirect_uri=https%3A%2F%2Flogin.microsoftonline.com%2Fcommon%2Foauth2%2Fnativeclient&scope=openid+profile+offline_access+User.Read+Files.Read.All+Sites.Read.All+Mail.Read+Calendars.Read+Contacts.Read+Team.ReadBasic.All+Channel.ReadBasic.All",
    );
    expect(
      microsoftConsentURL(one, "a1c9e7f5-4d3b-4e2a-8f6c-2b0d9e7a5c96", "full"),
    ).toBe(
      "https://login.microsoftonline.com/9a4e7b21-5c3d-4f60-8e1a-7b2c9d0e4f35/v2.0/adminconsent?client_id=a1c9e7f5-4d3b-4e2a-8f6c-2b0d9e7a5c96&redirect_uri=https%3A%2F%2Flogin.microsoftonline.com%2Fcommon%2Foauth2%2Fnativeclient&scope=openid+profile+offline_access+User.Read+Files.ReadWrite.All+Sites.ReadWrite.All+Mail.ReadWrite+Mail.Send+Calendars.ReadWrite+Contacts.ReadWrite+Team.ReadBasic.All+Channel.ReadBasic.All",
    );
  });
});
