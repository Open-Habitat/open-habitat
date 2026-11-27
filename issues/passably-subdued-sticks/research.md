# Microsoft 365 across several Entra tenants

## Tiivistelmä

**Suositus: tavoitellaan vaihtoehtoa B — operaattorin omia multi-tenant-sovelluksia ja erikseen hyväksyttyjä kohdeorganisaatioita. Nykyiset single-tenant-yhteydet säilytetään.** Tämä on ehdotus seuraavaa arkkitehtuuripäätöstä varten, ei toteutuspäätös. Molemmat vaihtoehdot tarvitsevat saman perustyön: yhteys pitää yksilöidä organisaation ja käyttäjän, ei pelkän sähköpostiosoitteen perusteella. B vähentää asiakkaiden sovellusrekisteröintityötä; A on perusteltu, jos asiakas vaatii oman sovelluksensa tai yhteisen sovelluksen luottamusmallia ei hyväksytä. [R1–R7, S1–S4]

- **A: sovellukset jokaisessa asiakasorganisaatiossa.** Asiakkaan ylläpitäjä rekisteröi tarvittavat käyttöoikeustasot ja hyväksyy oikeudet. Habitatin ylläpitäjä lisää organisaation palvelimelle. Vastuut ovat erilliset, mutta työ toistuu jokaiselle asiakkaalle. Neljä tasoa ja kolme organisaatiota tarkoittavat enintään 12 rekisteröintiä. [R1, R2; suunnitteluarvio]
- **B: sovellukset kerran operaattorin organisaatiossa.** Kukin asiakas hyväksyy ne omassa Entra-ympäristössään. Kirjautuminen suunnataan asiakkaan tenant-tunnukseen, ei operaattorin tenantiin eikä yleiseen `common`-osoitteeseen. Nykyisten tasojen säilyttäminen tarkoittaa **yhtä multi-tenant-rekisteröintiä per taso**, enintään neljää — ei yhtä kaikkivaltiaan sovelluksen käyttöliittymärajoitusta. [S2–S5, R2]
- **Vierastili toimii periaatteessa kummallakin tavalla.** Single-tenant ei tarkoita ”vain organisaation omat työntekijät”: myös sen hakemiston B2B-vieraat voivat kirjautua. Oikeus asiakkaan SharePointiin tulee vierastilin oikeuksista ja asiakkaan hyväksymästä sovellusluvasta. Kutsu ja sovelluksen hyväksyntä ovat eri asioita. [S1, S2, S6]
- **Tärkeä rajoitus:** erilliset token-tiedostot ehkäisevät sekaantumista, mutta multi-tenant-sovelluksen refresh token ei ole sidottu yhteen tenantiin. Saman Unix-käyttäjän agentti voi käyttää tämän tunnuksia myös suoraan. Habitatin tenant-lista ei siksi ole asiakkaalle lupaus kovasta tietoturvarajasta. A erottaa asiakkaat eri client id:illä; kumpikaan ei eristä saman henkilön eri asiakastietoja toisistaan hänen omassa kotihakemistossaan. [S7, R7]
- **Vieraan tiedostohaku on dokumentoidusti mahdollinen.** Graphin v1.0 Search tukee vieraalle jaettuja SharePoint- ja OneDrive-kohteita. Tämä ei lupaa asiakkaan postilaatikkoa, kalenteria tai Teams-viestihakua. Nykyisen tuotteen koko vieraskirjautumista ei ole tässä kokeiltu; erityisesti vieraan UPN:n ja MSAL:n käyttäjänimen yhteensopivuus on varmennettava. [S8, S9, R2, R4]

**Päätettävä ennen toteutusta:** hyväksytäänkö B:n yhteinen sovellusidentiteetti ja sen tokenien mahdollinen käyttö useassa hyväksyneessä tenantissa; ottaako operaattori vastuun sovellusten julkaisijaidentiteetistä; ja kelpaako ensimmäiseksi todistettavaksi käyttötapaukseksi saman henkilön kotiorganisaation yhteys sekä kahden asiakkaan SharePoint-vierasyhteydet? Suosittelen näitä, mutta en pidä niitä hyväksyttyinä. Jos ensimmäinen kohta ei kelpaa, valitaan A. Työ jää `preparation: pending` -tilaan.

## Scope and evidence

Research date: 2026-11-27. Repository baseline: `2f29073b5`. No product changes, deployment, consent, real-account sign-in or token operation was performed. Findings below distinguish inspected code, provider documentation, and proposed design. Document checks: `git diff --check` and `python3 scripts/validate-project-view.py` passed. No product tests were run for this documentation-only change.

### What exists today

The operator guide describes one single-tenant public client per permission level. Public client and tenant GUIDs live in root-owned `integrations.json` application sections; these are not OAuth client secrets and do not belong in `site.json`. The broker's existing application write authority remains separate from the person's daemon and tokens. The guided administrator flow reuses the tenant across its four level registrations. The person's flow chooses a level, obtains one device code, then publishes native credentials after identity checks. [R1–R3, R7]

The actual connection model is address-centric:

- `MicrosoftApp` contains `client_id` and `tenant_id`; `microsoftApps()` maps **level → app**, not tenant → level → app.
- `microsoftAccountApp()` matches the client ID and otherwise falls back to the broadest configured app. `Align` can redeem an existing grant at the newly configured tenant. Neither rule is suitable for selecting among several resource tenants of the same multi-tenant client.
- The daemon reads Graph `/me`'s `userPrincipalName`, falling back to `mail` if the UPN fails `ValidAddress`. That validator excludes `#`, so a typical guest `#EXT#` UPN takes the fallback. The adapter then requires MSAL `account.username` to equal this address. These are different identity representations; a mismatch is a credible compatibility risk, not a reproduced failure for every guest.
- Native MSAL cache paths, pending directories, rclone configurations, relay `--account`, refusal maps and fetched-file roots use the address. Merely adding another tenant dropdown can overwrite or misroute the same person's second connection.
- Current adapter import checks one native account and its `homeAccountId`, but the published identity pin is the username. Verification and tool startup use an explicit tenant authority. [R2–R5, S9–S11]

The pinned runtime is `@softeria/ms-365-mcp-server` **0.170.1**, not whatever upstream currently releases. Its published `dist/auth.js` and `dist/token-cache-storage.js` were inspected directly: authority comes from the configured tenant, native cache paths are configurable, and expected username/home-account pins exist. Its account lookup does not supply Habitat's missing resource-tenant connection key. One native child at a time per Unix user already switches between separate connection environments; sharing a giant upstream multi-account cache would abandon that design, not implement it. No runtime upgrade is established as necessary by this research. [R4, R5, R7, U1]

The operator guide has stale statements about no file writes and requiring a Full application. Current `microsoftAllowed()`/tool selection supports consented file writes, and level availability accepts configured alternatives. This report uses code for current behavior, not those statements. The older ADR 0026 also contains superseded sync/tool choices. [R1, R2, R6]

### Relevant decisions recovered from history

- Commit `af821fef2`: one single-tenant audience was a deliberate product restriction; GUID-only validation prevents accidentally using `common`/`organizations`.
- `issues/microsoft-account-tenant-rewrite/result.md` (history): the alignment mechanism was built to move existing credentials to the operator's one tenant, not to preserve several simultaneous target tenants.
- `issues/integration-account-level-microsoft-dropbox/result.md` (history), followed by `6d73ba3c6`: distinct applications carry the levels; the four-section layout reused the broker's existing write operation.
- ADR 0039, `docs/decisions/adr-0039-one-microsoft-process-per-person.md` (history): preserve separate native caches and pins while serializing account switching through one child. This is now an explicit rule in `internal/AGENTS.md`.

These records explain constraints; they do not settle the new multi-tenant choice. [R6, R7]

## A. Several single-tenant configurations

**Configuration proposal.** Replace the one-organisation shape with an explicit collection of enabled resource tenants, each with a display label and its configured level/client pairs. Preserve root/broker ownership. This needs contract, admin CLI and guided-setup changes, not a free-form tenant field that the browser can use as authority. Keep GUID authorities and the public-client flow. [R1–R3; proposal]

**Connect proposal.** Select target organisation first, then an available level, then show the device code. Reconnect and level change retain the selected tenant. Display both person and organisation on account cards, tool descriptions and confirmations. A target tenant accepts its members and B2B guests; no invitation into the operator's own directory is needed just to access a client's files. [S1, S2; proposal]

**Consent and maintenance.** The client administrator owns registrations, allowed delegated grants, enterprise-app assignments and relevant tenant policies. Register and consent each enabled level. Client registration changes and troubleshooting repeat per tenant. With N tenants and L offered levels the configuration/registration count is N×L. There is no client-secret rotation in this public-client design, but registrations, permission changes, guest lifecycle, policy failures and refresh failures still need an owner. [S3, S12, R1; cost model]

**Tokens and removal.** Separate native stores per resource-tenant/user/client binding; use that tenant on initial and silent acquisition. Distinct client IDs avoid sharing a client-bound refresh grant across customer registrations. Local disconnect removes this connection's native credentials and entries, not tenant consent. Customer administrators can revoke their own grants without changing another customer's app. Revocation caveats below apply. [S7, S13, R4, R5]

**Trade-off.** A has simpler ownership and a smaller registration-change blast radius. It does not avoid the identity/path migration or B2B testing, and requires each customer's help to create applications rather than merely approve them. [Assessment from preceding evidence]

## B. Operator-owned multi-tenant registrations

**Registration and site configuration proposal.** Use organisational multi-tenant registrations (`AzureADMultipleOrgs`) in the installation operator's tenant, one per enabled level. Keep public-client device flow; do not add client secrets or application permissions. Store the registration's owner tenant separately from each allowed **resource tenant**. They answer different questions. Preserve support for existing customer-owned single-tenant bindings rather than forcing their replacement. This is not a proposal for a product-vendor-wide application or central token service. [S1–S4, R7; proposal]

**Customer onboarding.** The customer administrator consents in the customer's tenant to the operator's client ID and reviewed delegated permissions. Consent establishes the local enterprise application/service principal; it does not copy the app registration into the customer's App registrations list. The customer can manage its local grants and assignments. Consent must be repeated for each level and revisited for permission changes; ”once” means per app and permission set, not forever. Use the target tenant's admin-consent endpoint and the registration's exact redirect URI. A consent return URL alone is not proof that a connection works; test the resulting tenant-specific grant. [S3, S4, S12, S14]

**B2B target authority.** A person who is a member of Tenant A and guest of Tenant B chooses B and authenticates against B's authority. Microsoft handles their home credentials; B supplies the resource-tenant context. `organizations` normally discovers the home tenant and is not a substitute for selecting B. Guest provisioning/redemption, SharePoint sharing and cross-tenant policies remain prerequisites. B2B collaboration is not the same as Teams shared-channel B2B direct connect. [S2, S6, S9]

**Allowlist proposal.** The operator explicitly enables resource tenant GUIDs. The daemon resolves a selected configuration from root-owned data and binds the whole pending login to tenant, client and level. It must reject an unknown/disabled tenant at connect, refresh/verification and tool dispatch; removal must not silently select a different app or tenant. Check the MSAL authentication result's tenant/account metadata against the pending binding, and the authenticated Graph identity against the intended account. Design and test those checks with the pinned MSAL/runtime; do not claim that today's adapter already performs them. [R2–R5; proposal]

The usual web-API advice to filter a validated token's `tid`/`iss` must be applied to the right token and boundary. Habitat is a native Graph client here, not a Graph resource server. **Do not implement the allowlist by decoding a Graph access token and trusting its claims**: Microsoft says Graph clients must treat access tokens as opaque. Use the explicit authority and authenticated token-response/account metadata; Graph validates its access token. This integration does not replace Habitat's browser authentication or authorize a Unix-user mapping. [S2, S10, S16, R7]

**Publisher verification.** It is not an OAuth prerequisite that universally prevents an administrator approving an unverified app. It is important for customer trust and user-consent policy: risk-based step-up can block ordinary user consent to newer unverified multi-tenant apps asking beyond basic profile access. Verification requires a verified partner-global account, tenant association, appropriate publisher/custom domain and authorized administrative roles with MFA. A self-hosting operator may not already satisfy these. A verified badge authenticates the publisher organisation, not the safety of its code. Budget owner time and onboarding lead time, not merely four registrations; Microsoft lists no charge for the verification prerequisites. [S17]

## Permissions and the meaning of approval

All entries below refer to **delegated**, not application, permissions. In Microsoft's current permission reference, **none of Habitat's existing requested scopes intrinsically requires administrator consent**. The `.All` suffix alone does not answer that question. [S18]

| Existing scope group | Delegated `AdminConsentRequired` |
| --- | --- |
| `openid`, `profile`, `offline_access`, `User.Read` | No |
| `Files.Read.All`, `Files.ReadWrite.All` | No |
| `Sites.Read.All`, `Sites.ReadWrite.All` | No |
| `Mail.Read`, `Mail.ReadWrite`, `Mail.Send` | No |
| `Calendars.Read`, `Calendars.ReadWrite` | No |
| `Contacts.Read`, `Contacts.ReadWrite` | No |
| `Team.ReadBasic.All`, `Channel.ReadBasic.All` | No |

Nevertheless, **continue administrator-led customer onboarding**. A tenant's consent policy can block user consent, restrict it to verified publishers/low-impact permissions, or require approval. Tenant-wide delegated consent permits use on behalf of signing-in users; it does not give Habitat unattended app-only access to every mailbox or site. Authorized Cloud Application/Application Administrators can approve these delegated grants; Graph application permissions have different role requirements. The customer can require user assignment to restrict who signs in. [S12, S19]

Levels retain their existing scope sets: Full has file/site writes, mail writes/send, calendar writes and contact writes; NoSend omits `Mail.Send`; Drafts has read-only files/calendar/contacts and writable mail; Read uses read scopes throughout. Identity and basic Teams-name scopes remain as currently configured. The unused Teams-name scopes could be removed separately, but are not needed to solve tenancy and should not be quietly changed here. [R2]

Separate level registrations still matter in B. Existing code asks for Graph `.default`, which returns granted scopes. Microsoft's MSAL guidance also describes accumulated resource consent: requesting a narrow scope later is not a dependable way to undo earlier broader consent. Tool filters are useful guardrails, not a substitute for distinct grants when the person can run native commands. Never consolidate four levels into one client merely because the app becomes multi-tenant. Removing permissions from the registration alone does not revoke existing customer grants. [S5, S14, S20, R7]

## Security boundaries, token isolation and revocation

**Shared baseline.** Keep native token state in the person's home, with existing private permissions/encryption and one daemon-owned MCP child. Root configuration holds only application/tenant settings, not personal credentials. Neither the gateway nor broker should obtain Microsoft data or token-management authority. Host root can still act as the Unix user; a browser site administrator is not thereby authorized to read homes. [R7]

**Connection identity proposal.** Use resource tenant plus immutable tenant-local user identity, with the selected application/level bound to that connection. MSAL `homeAccountId` identifies the home account across tenants; it alone is insufficient. Prefer authenticated tenant-local object identity (`oid`/Graph user `id`) with tenant, retain native MSAL account metadata and treat email/UPN as display/login hints. Include tenant and client in cache partitioning and process-binding identity. Keep this in native settings/cache metadata and derived in-memory views, not a host connection registry. [S9–S11, R7; proposal]

Separate caches prevent accidental account selection and independent refresh writers from colliding. They do **not** cryptographically confine a multi-tenant refresh token: Microsoft binds it to user/client, not resource/tenant. With B, a token may obtain access in another tenant where that client/user already has permission, subject to policy. The allowlist controls Habitat's supported path, not arbitrary same-UID programs. With A, different client IDs reduce this particular cross-customer credential reach. [S7; security consequence]

**Data boundary.** Both designs put multiple client credentials and downloaded documents in one person's Unix account. A model or shell operating as that person can combine them. Tenant-labelled tool namespaces and fetch directories reduce mistakes but are not client-to-client sandboxing. If customer contracts require such isolation, separate Unix identities/hosts or a different execution model is an architectural requirement beyond either option. [R5, R7; assessment]

**Disconnect is not revocation.** Distinguish: (1) remove local connection credentials and stop its tool binding; (2) disable a tenant in Habitat's managed path; (3) revoke customer enterprise-app consent/assignment or disable its access in Entra. Existing downloaded files are not recalled. Existing access tokens may remain usable until expiry or provider enforcement, so do not promise immediate global revocation. For B2B, Microsoft's refresh-token guidance specifically says resource-tenant revocation does not revoke the guest's refresh tokens; that requires the home tenant. The resource tenant must withdraw its own resource/app access. Broad home-account session revocation can affect other work and is not a routine disconnect action. [R2, S7, S13, S16]

The operator cannot grant customer SharePoint rights, override customer consent or Conditional Access, or make all refresh-token use obey a UI allowlist. Customer admins must also prevent unwanted re-consent if withdrawing a grant is intended to be durable. Device-code policy can block **either** option, including later refresh through protocol tracking; do not prescribe a policy bypass as migration. [S6, S13, S21]

## Migration and pilot work

### Existing single-tenant installation

Proposed migration preserves the existing tenant/client/level bindings as the first configured organisation. Keep current native caches and grants where the binding is unambiguous; no Entra registration change should be required merely to add multi-tenant-capable product support. Native path/relay migration must be atomic and recoverable, preserve existing local files and legacy rclone sync state, and stop the active child before changing its binding. Ambiguous identity requires reconnect, not an email-based guess. [R2–R7; proposal]

Do not reuse today's ”follow the server's tenant” alignment semantics. Removing a tenant must not make its accounts fall back to another tenant, even if the client ID is identical. A permission-level change affects only the chosen resource-tenant connection. Schema migration and broker update granularity need a separate implementation design, especially because the broker currently edits one known top-level application section. [R2, R3, R6; proposal]

Moving to **new** operator-owned client IDs requires customer consent and a new personal sign-in: do not copy or relabel old client-bound refresh tokens. An operator could convert an existing registration it owns to multi-tenant, but that changes its trust scope and is not an automatic migration step. Leave customer-owned single-tenant registrations alone. [S3, S7; proposal]

### What a consenting pilot must do

| Actor | A | B |
| --- | --- | --- |
| Installation operator | Add each target and its level/client IDs | Own/register level apps, establish publisher identity, add allowed target GUIDs |
| Customer administrator | Register and consent the selected level apps | Review operator publisher and consent its selected level apps |
| Customer administrator, both | Ensure guest invitation is redeemed, file access exists, user assignment and cross-tenant/device-flow policies permit the scenario | Same |
| Person, both | Choose target and level; sign in separately for each target; verify a known permitted file | Same |

This is future pilot work, not a record of a performed test. No real installation details are needed in the project report. [Proposed acceptance work based on S1–S4, S6, S12, S17, S21]

Before calling either implementation ready, prove:

1. The same home account connects to its home tenant and two resource tenants without cache, selected-account, relay, refresh or fetched-file collisions; deny a fourth, unconfigured tenant.
2. B2B UPN/mail/MSAL username differences do not reject a legitimate guest or admit a different identity. Verify tenant-local immutable identity through first login, reconnect, restart and level change.
3. A real shared SharePoint item can be searched, listed and fetched through the **pinned** MCP tools. Also test direct site/drive addressing and a forbidden item. Microsoft's v1.0 guest search support is good evidence of feasibility, not a full product qualification. [S8]
4. A guest with no resource-tenant mailbox still has useful file access; permission labels and health checks must not advertise mailbox availability just because a mail scope exists. Mail-enabled external users are not proof of a provisioned local mailbox. Guest Search explicitly excludes message/event/chatMessage/person entities. [S8, S15, R4]
5. Missing consent, blocked device flow, expired access requiring refresh, withdrawn guest access, disabled enterprise app, and removed Habitat tenant fail with the right explanation; no silent home-tenant fallback.
6. Downgrade and removal affect only that tenant's binding. Switching targets retains the one-child limit and never replays an uncertain write. Upgrades preserve legacy single-tenant connections and file copies. [R7]

## Cost and recommendation

| Dimension | A: per-customer single-tenant | B: operator multi-tenant |
| --- | --- | --- |
| Common engineering | Tenant-aware identity, config/admin/person UI, native paths, migration, refresh and dispatch tests | Same |
| Registrations for N tenants, L levels | N×L customer-owned apps | L operator-owned apps, plus customer-local service principals/grants |
| Customer onboarding | Create apps, configure flows/permissions and consent | Review publisher/app and consent; still policy/guest work |
| Ongoing changes | Distributed app maintenance; more customer coordination | Central app maintenance; customer re-consent/revocation still required |
| Credential/registration blast radius | Different client IDs per customer | Shared client identity; cross-tenant refresh use where authorized |
| Additional uncertainty | Will each customer create the apps? | Operator verification readiness and customer acceptance of shared app ownership |
| Host resources | Existing single native process; more connection state and account-switch churn | Same; fewer registrations do not remove switching cost |

These are structural estimates, not measured delivery time or a licensing quote. No extra hosted token service is necessary in either design. Engineering effort is not ”add an array”: the connection identity change is the main work. B adds publisher/onboarding work but avoids making every customer's administrator an application maintainer. [S3, S7, S12, S17, R2–R7; assessment]

**Recommend B as the normal new-tenant route, with existing/customer-owned A bindings retained.** The reason is repeatable consultant onboarding, not broader permissions. Keep explicit tenant choice and per-level applications; do not invent a credential broker. If customer requirements demand different client identities, A is the correct route rather than claiming cache partitions enforce that requirement. [Assessment]

### Questions for the maintainer

1. Is B's shared-client trust boundary acceptable, including the absence of same-UID client-data isolation? Recommendation: yes for the personal native-agent model, with clear disclosure; use A when a customer requires a distinct client.
2. Will each installation operator own its publisher/app identity, rather than the product operating one universal application? Recommendation: yes; permit administrator-approved unverified pilot apps, but plan publisher verification for repeat customer onboarding.
3. Is the first acceptance slice home-tenant access plus guest SharePoint in two resource tenants, without claiming guest Outlook or Teams-message support? Recommendation: yes.

No new architecture choice was approved, no parent answer or timeout default was taken, and no follow-up issue was filed. These questions are the intended next decision, not missing evidence disguised as implementation readiness.

## Sources

### Repository evidence

- **R1:** `docs/operations.md`, Microsoft app registration/account levels; compared against code where stale.
- **R2:** `internal/daemon/integrations/microsoft_linux.go` (`MicrosoftApp`, `microsoftApps`, `microsoftAccountApp`, `microsoftLevelScopes`, `WaitWithPrompt`, `Remove`); `microsoft_tenant_linux.go`; `catalog_linux.go` (`ValidAddress`).
- **R3:** `internal/integrationapps/apps.go`; `internal/provision/integrations_linux.go`; `contracts/v1/{integrations,server-integrations}.schema.json`; `web/src/components/{MicrosoftLevels,ServerIntegrations,Integrations}.tsx`.
- **R4:** `runtime/profiles/integrations/{package.json,microsoft-native.mjs,ms-365-mcp-server-scopes.json}`.
- **R5:** `internal/daemon/integrations/microsoft_server_linux.go`, especially `microsoftOwnsServer`, `microsoftAreaEntry`, `microsoftBinding`; fetched-path instructions in `microsoft_linux.go`.
- **R6:** `docs/decisions/adr-0026-integrations-catalog.md`; history paths and commits listed above, read with `scripts/from-history.sh`/`git show`. Historical documents are not current contracts.
- **R7:** `internal/AGENTS.md`, authority/native-state/Microsoft process rules; ADR 0039 recovered from history.

### External primary sources (retrieved 2026-11-27)

URLs are recorded as code for durable copying. Source numbers beside the analysis refer to these documents, not to third-party commentary.

- **S1:** Microsoft, Single- and multitenant apps — directory members **and guests**. `https://learn.microsoft.com/en-us/entra/identity-platform/single-and-multi-tenant-apps`
- **S2:** Microsoft, Authenticate applications and users — B2B target-tenant endpoint and tenant filtering. `https://learn.microsoft.com/en-us/entra/architecture/authenticate-applications-and-users`
- **S3:** Microsoft, Convert single-tenant app to multitenant — registration and service-principal/consent model. Its general `common` discovery example does not supersede S2 for an explicitly chosen guest tenant. `https://learn.microsoft.com/en-us/entra/identity-platform/howto-convert-app-to-be-multi-tenant`
- **S4:** Microsoft, Admin consent protocol — target tenant, scope and redirect semantics. `https://learn.microsoft.com/en-us/entra/identity-platform/v2-admin-consent`
- **S5:** Microsoft MSAL, Resources and scopes — incremental consent and consent lifetime. `https://learn.microsoft.com/en-us/entra/msal/javascript/browser/resources-and-scopes`
- **S6:** Microsoft, Cross-tenant access overview — inbound/outbound B2B collaboration and policy. `https://learn.microsoft.com/en-us/entra/external-id/cross-tenant-access-overview`
- **S7:** Microsoft, Refresh tokens — user/client binding, cross-resource/tenant use, B2B revocation caveat. `https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens`
- **S8:** Microsoft Graph **v1.0**, Search API overview — Guest search and Known limitations. `https://learn.microsoft.com/en-us/graph/api/resources/search-api-overview?view=graph-rest-1.0`
- **S9:** Microsoft, B2B guest user properties — guest UPN/identity, permissions and shared-channel distinction. `https://learn.microsoft.com/en-us/entra/external-id/user-properties`
- **S10:** Microsoft MSAL Node, AccountInfo — home/local account and tenant metadata. `https://learn.microsoft.com/en-us/javascript/api/@azure/msal-node/accountinfo?view=msal-js-latest`
- **S11:** Microsoft MSAL Node, Accounts — native account lookup and silent acquisition. `https://learn.microsoft.com/en-us/entra/msal/javascript/node/accounts`
- **S12:** Microsoft, Grant tenant-wide admin consent — roles and assignment restrictions. `https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/grant-admin-consent`
- **S13:** Microsoft, Review permissions granted to enterprise applications — revocation and possible re-consent. `https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/manage-application-permissions`
- **S14:** Microsoft, Update an app's requested permissions — removal from registration does not revoke grants. `https://learn.microsoft.com/en-us/entra/identity-platform/howto-update-permissions`
- **S15:** Microsoft, Common considerations for multitenant user management — Exchange MailUser/external-user behavior. `https://learn.microsoft.com/en-us/entra/architecture/multi-tenant-common-considerations`
- **S16:** Microsoft, Access tokens — client treats Graph tokens as opaque; expiry/validation boundaries. `https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens`
- **S17:** Microsoft, Publisher verification overview — requirements, policy effects and stated prerequisite cost. `https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview`
- **S18:** Microsoft Graph permissions reference, delegated column for each named scope; checked also against the Microsoft-owned Markdown source. `https://learn.microsoft.com/en-us/graph/permissions-reference` and `https://raw.githubusercontent.com/microsoftgraph/microsoft-graph-docs-contrib/main/concepts/permissions-reference.md`
- **S19:** Microsoft, Configure how users consent to applications — tenant policy can be stricter than a scope's default consent requirement. `https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/configure-user-consent`
- **S20:** Microsoft, Scopes and permissions — `.default` with already-granted delegated permissions. `https://learn.microsoft.com/en-us/entra/identity-platform/scopes-oidc`
- **S21:** Microsoft, Authentication flows in Conditional Access — device-code restrictions and protocol tracking. `https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-authentication-flows`
- **U1:** Softeria's published npm **0.170.1** manifest and tarball; inspected `dist/auth.js` and `dist/token-cache-storage.js` in memory, without installation or executing package code. `https://registry.npmjs.org/@softeria/ms-365-mcp-server/0.170.1` and `https://registry.npmjs.org/@softeria/ms-365-mcp-server/-/ms-365-mcp-server-0.170.1.tgz`
