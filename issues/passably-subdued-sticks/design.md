# Microsoft 365 usealle Entra-organisaatiolle: suunnitelma (suunta B)

## Tiivistelmä (Jarille)

Tämä on suunnitelma hyväksyttäväksi. Tuotekoodia ei ole muutettu.

**Mitä ihminen näkee.** Kun palvelimella on useampi kuin yksi sallittu
organisaatio, Microsoft 365:n yhdistäminen kysyy ensin *Minkä organisaation
tiedot?* (oma ensin, sitten asiakkaat ylläpitäjän antamilla nimillä), sitten
tason ja näyttää laitekoodin kuten nyt. Vieraana kirjaudutaan omalla
työtilillä; Microsoft ohjaa oman organisaation kirjautumiseen ja takaisin.
Sama ihminen voi yhdistää oman organisaationsa ja kaksi asiakasta, ja jokainen
näkyy omana korttinaan, jossa on osoite ja organisaation nimi. Jos
organisaatioita on vain yksi, mikään ei muutu.

**Mitä ylläpitäjä tekee.** Luo multi-tenant-sovellukset kerran omaan
Entraansa (sama ohjattu kulku kuin nyt, yksi kohta eri), lisää asiakkaan
tenant-tunnuksen ja nimen sallittujen listaan ja saa jokaista tasoa kohti
hyväksymislinkin sekä valmiin viestin asiakkaan pääkäyttäjälle. Asiakas voi
hyväksyä vain osan tasoista, esimerkiksi pelkän lukutason.

**Mikä muuttuu konepellin alla.** Yhteys ei enää ole "osoite", vaan
organisaatio ja käyttäjä. Yhteyden nimi levyllä on `osoite~tenant-GUID`, ja
henkilöllisyys lukitaan Microsoftin muuttumattomiin tunnisteisiin, ei
käyttäjänimeen. Tämä poistaa tutkimuksessa löydetyn riskin, jossa vieraan
`#EXT#`-UPN, sähköposti ja MSAL:n käyttäjänimi eivät täsmää. Nykyiset
yhteydet nimetään uudelleen palvelimen päivityksessä ilman uutta
kirjautumista; tiedostot ja synkronoinnit pysyvät paikoillaan.

**Mitä on sanottava suoraan.** Sallittujen organisaatioiden lista ohjaa
Habitatin omaa polkua, mutta ei ole kova tietoturvaraja: yhteisen sovelluksen
refresh token ei ole sidottu yhteen tenanttiin, ja ihmisen oma agentti tai
komentorivi voi käyttää sitä suoraan. Asiakkaan oikea rajoitin on asiakkaan
omassa Entrassa (hyväksynnän poisto, *Assignment required*, vierastilin
poisto). Tämä kerrotaan ylläpitäjän näkymässä, asiakkaalle lähtevässä
viestissä ja käyttöohjeessa.

**Suurin avoin riski** ei ole koodissa: laitekoodikirjautuminen on monessa
organisaatiossa estetty ehdollisella käyttöoikeudella. Jos asiakas estää
sen, yhteys ei synny kummallakaan suunnalla ennen kuin asiakas sallii sen tai
Microsoftille tehdään toinen kirjautumistapa. Tämä selviää vasta oikeilla
tileillä.

**Kysymykset sinulle** (suositus ja oletus kunkin kohdalla, luku
"Questions for Jari"):

1. Saako selaimen ylläpitäjä listan siitä, kuka on yhdistänyt minkä
   organisaation? Suositus: ei ensimmäisessä versiossa.
2. Kun ylläpitäjä poistaa organisaation listalta, pysäytetäänkö yhteydet vai
   poistetaanko myös ihmisten tallennetut kirjautumiset? Suositus: vain
   pysäytetään.
3. Haetut tiedostot: pysyykö juuri `~/cloud/microsoft-fetched/<osoite>/`
   yhteisenä saman osoitteen yhteyksille? Suositus: pysyy.

**Prototyyppi.** Ylläpitäjän organisaatiolista ja hyväksymislinkit sekä
ihmisen organisaatiovalinta ja kieltäytymistekstit tarvitsevat yhden
prototyyppikierroksen ennen toteutusta. Yhteyden tunnisteen muutos ja
migraatio eivät riipu siitä, ja ne voi toteuttaa ensin.

---

## What this design covers

Direction B as decided: the operator registers multi-tenant applications
once in their own tenant, each client organisation's administrator approves
them, and the operator allows those tenants on the server. Existing
single-tenant connections keep working. `research.md` beside this file holds
the evidence and sources; this document refers to it instead of repeating it.

Examples use synthetic names: *Own Ltd* (the operator's tenant), *Client
One* and *Client Two*, and the person `person@own.example`.

Facts about the pinned runtime below were read from the published code of
the versions in `runtime/profiles/integrations/package.json`
(`@softeria/ms-365-mcp-server` 0.170.1, `@azure/msal-node` 5.6.0 with
`@azure/msal-common` 16.13.0). Nothing was run against a real tenant.

## 1. Connection identity

### What identifies a connection

A Microsoft connection is identified by the **resource tenant** and the
**user in it**. Three values take part, each with one job:

| Value | Source | Job |
| --- | --- | --- |
| Tenant GUID | the organisation the person chose, from root's file | part of the connection's name; the only sign-in authority |
| Address | Graph `/me`, as today | the readable part of the name and the label people see; never compared to decide who signed in |
| Immutable ids | MSAL's account for that tenant: `homeAccountId` and the tenant-local `localAccountId` | the identity pin |

The **connection name** is `<address>~<tenant-guid>`, lowercase, for example
`person@own.example~7d2f…`. `~` is outside the address alphabet
(`ValidAddress`), so a name can never be read as an address or the reverse,
and an address containing a GUID cannot imitate one. The name is one path
segment, so every place that today builds a path or a key from the address
builds it from the name with no change of shape.

The address is chosen as today (the UPN when it is address-shaped, otherwise
`mail`), with MSAL's username as a third choice. It is a label. When Microsoft
later renames the user, the connection keeps working under its first label,
because the pin is immutable; removing and connecting again gives the new
label.

Why the name carries the address and the pin carries the immutable id, and
not the reverse: a name built from object ids would leave an interrupted
sign-in's native cache without a readable label, and it would make the
migration depend on reading an id out of every existing cache before
anything could be renamed. With the address in the name, the migration is a
pure rename and the interrupted states stay labelled, as they are today.

### The username pinning risk and how it goes away

Today the daemon derives an address from Graph, and the adapter requires
MSAL's `account.username` to equal it. For a guest these are different
representations: the UPN is `person_own.example#EXT#@clientone.example`
(rejected by `ValidAddress`), `mail` may be the home mailbox address or
empty, and MSAL's username is the id token's `preferred_username`, typically
the home UPN. Where an organisation's UPN differs from its mail address, a
legitimate guest is refused with `account_mismatch`.

The design stops comparing names:

- **At sign-in** the adapter returns what MSAL recorded for the redeemed
  grant: `tenantId`, `localAccountId`, `homeAccountId` and `username`. The
  daemon requires `tenantId` to equal the chosen tenant and
  `localAccountId` to equal the `id` Graph `/me` returned for the same token.
  Both are immutable and both come from the tenant's own answers over TLS.
  Nothing decodes a Graph access token (research, "Allowlist proposal").
- **The stored pin** is the tool's own `MS365_MCP_EXPECTED_HOME_ACCOUNT_ID`,
  which the pinned server already supports, written into the connection's Pi
  entries beside the tenant. New registrations do not set
  `MS365_MCP_EXPECTED_USERNAME`. The adapter's `verify` finds the account by
  `homeAccountId` and tenant instead of by username.
- **At renewal or level change** the new sign-in's `homeAccountId` must equal
  the pinned one. An existing connection that has only the username pin
  (signed in before this change) is compared by address as today and gains
  the immutable pin at that sign-in.
- **One account per cache stays the rule.** MSAL lists one account per tenant
  profile, so a cache that somehow holds two is refused at import and at
  verify, as now.

A sign-in that produces an existing name with a different `homeAccountId` is
refused (`already_connected`) and changes nothing. In one tenant two users
with the same address should not exist; if they do, the second cannot
silently take the first one's stores.

### Where the name replaces the address

| Place | Today | With this design |
| --- | --- | --- |
| MSAL cache | `~/.config/ms-365-mcp-server/open-habitat/<address>/` | `…/<name>/` |
| Pending and rollback stores | `…/.pending/<address>/`, `…/.previous/<address>/` | `…/.pending/<name>/`, `…/.previous/<name>/` |
| rclone config (accounts with synced libraries) | `~/.config/rclone/open-habitat-microsoft/<address>.conf` | `…/<name>.conf` |
| bisync listings | `…/bisync/<address>/<remote>/` | `…/bisync/<name>/<remote>/` |
| First-sync backups | `~/.local/share/rclone/microsoft-backups/<address>/` | `…/<name>/` |
| Pi area entries | env names the address's cache; `--account <address>` | env names the name's cache, the tenant and the pin; `--account <name>` |
| Daemon endpoint (`msmcp`) | `Binding.Account` and `Release` by address | by name |
| Refusal map (`microsoft.refused`) | by address | by name |
| Catalog and browser contract | `(provider, address)` | `(provider, address, tenant_id)` |
| Synced directories | `~/cloud/onedrive/<address>/`, `~/cloud/sharepoint/<host>--<address>/…` | unchanged, see below |
| Fetched files | `~/cloud/microsoft-fetched/<address>/` | unchanged, see below |

Pi's entry names (`ms-files`, `ms2-files`, …) are already independent of the
address; a third connection takes `ms3-…`. Each entry's description names
the address **and the organisation's label**, so an agent choosing between
`ms-files` and `ms2-files` reads which organisation each one is. The
generated skill does the same.

**Synced directories do not move.** Only connections an earlier release left
syncing have them, bisync's listings are tied to their paths, and a new
connection never syncs. The root parser keeps validating them against the
address part of the name. Two connections cannot claim the same directory,
because only one migrated connection per address can have roots.

**Fetched files keep `~/cloud/microsoft-fetched/<address>/`.** The path below
it already starts with the item's SharePoint or OneDrive host
(`clientone.sharepoint.com/sites/…`), and that host belongs to exactly one
tenant, so the three connections of the proof case write into three separate
subtrees without any new segment. The fallback path (drive id and file name)
is unique across tenants as well. This root is an instruction to the agent
in the skill, not a boundary the code enforces, so it buys nothing to put a
GUID into a path that people read. Question 3 asks Jari to confirm.

### The application table

Today `microsoftApps()` maps level to application. It becomes a table by
tenant and level, built from root's file only:

1. Each existing single-tenant section (`microsoft`, `microsoft_nosend`,
   `microsoft_drafts`, `microsoft_read`) fills one cell: its own
   `tenant_id`, its level, its `client_id`.
2. Each allowed tenant then gets, for every level whose cell is still
   empty, the multi-tenant application of that level.

So a tenant that has its own single-tenant application keeps it for that
level, and the multi-tenant application fills the rest. A connection
resolves its application by its name's tenant and the client id its Pi
entries name:

- found: that cell's application and level;
- the tenant has cells but none with that client id: `app_changed`, sign in
  again, as today;
- the tenant has no cells: `tenant_removed` (section 4). Nothing falls back
  to another tenant or to "the broadest configured application".

**The tenant-following alignment is removed.** `Align` today redeems an
existing grant at whatever tenant the operator's section now names
(`redeemAtTenant`). With several tenants that is exactly the silent move the
research warns about. After this change the tenant is part of the name;
changing a section's tenant makes that tenant's connections report
`tenant_removed` and offers the new tenant for new connections. `Align`
keeps its other duties: rewriting entries of an earlier form and
rediscovering the grant of an outdated registration. The `tenant_changed`
failure goes away.

### Checks at each boundary

- **Connect:** the daemon accepts only a tenant that has a cell for the
  requested level, read from root's file at that moment. The pending login
  is bound to tenant, client and level from then on.
- **Verification and refresh:** the adapter is given the name's tenant as its
  authority and the pin; the daemon first confirms the tenant still has the
  connection's cell.
- **Tool dispatch:** `microsoftBinding` is asked for every listing and call.
  It additionally requires the entries' tenant to equal the name's tenant and
  the cell to exist. Removing a tenant therefore stops that tenant's tools at
  the next call, without a restart.

## 2. Migration of existing connections

No person does anything. At the first check after the upgrade, for each
connection under a bare address, with the native lock held, the Microsoft
child paused and that account's sync stopped:

1. Read the tenant from the connection's own native files: the Pi entries'
   `MS365_MCP_TENANT_ID` and the rclone remotes' `tenant`. Where both exist
   they must agree.
2. Compute the name `<address>~<tenant>`.
3. Rename each store that exists (cache directory, pending and rollback
   directories, rclone config, bisync listings, backups).
4. Rewrite the Pi entries in one write: cache paths, `--account`, and the
   description with the organisation.

The target name is a function of the old name and the tenant the files
name, so an interrupted migration is recognised from the files alone and
finished at the next check: an entry pointing at `<address>/` whose
directory is gone while `<name>/` exists is the same connection half moved.
Each step is a rename or one whole-file write; none copies a credential.

The refresh tokens, the rclone token, the grant, the level, the Pi entry
names, the synced directories and the fetched files are untouched, so
running conversations keep their `ms-…` namespaces. The username pin of a
migrated connection stays until its next sign-in; it works for it today and
there is no reason to touch it.

A bare-address store whose tenant cannot be read, or whose two sources
disagree, is **not** guessed. It stays listed under its address, asks for a
new sign-in, and can be removed; the sign-in asks for the organisation and
replaces it. This should only be an interrupted first sign-in's leftover.

The project is in pre-release, so the migration code is removed once the
installations that have such connections have passed it.

Operators change nothing either: the four existing sections keep their
bytes and their meaning.

## 3. Configuration

Everything stays in root's `/opt/open-habitat/integrations.json`, written by
root or by the broker on an administrator's request, never by a daemon or
the gateway. Nothing here is a secret: the applications are public clients.

```json
"microsoft":               {"client_id": "…", "tenant_id": "<Own Ltd>"},
"microsoft_shared":        {"client_id": "…", "tenant_id": "<Own Ltd>"},
"microsoft_shared_nosend": {"client_id": "…", "tenant_id": "<Own Ltd>"},
"microsoft_shared_drafts": {"client_id": "…", "tenant_id": "<Own Ltd>"},
"microsoft_shared_read":   {"client_id": "…", "tenant_id": "<Own Ltd>"},
"microsoft_tenants": {
  "<Own Ltd GUID>":    "Own Ltd",
  "<Client One GUID>": "Client One",
  "<Client Two GUID>": "Client Two"
}
```

- **`microsoft_shared*`** are the multi-tenant applications, one per level,
  with the two fields the single-tenant sections have. Here `tenant_id` is
  the tenant that owns the registration. It is never a sign-in authority on
  its own account; it identifies the operator's organisation in lists and
  keeps the existing check that the two pasted GUIDs differ. Same field
  shape means the existing validation, canonical bytes and broker write are
  reused as they are (`integrationapps`).
- **`microsoft_tenants`** is the allowed list: tenant GUID to the label
  people see. At most 32 entries; a label is 1 to 64 printable characters.
  The owning tenant is allowed only if it is listed, like any other; the
  guided flow lists it by default.
- **GUID-only stays.** Every authority the daemon, the adapter and the
  consent link use is `login.microsoftonline.com/<GUID>`. `common`,
  `organizations` and `consumers` remain unrepresentable in every section
  and in the list's keys, and a domain name is not accepted as a tenant.
  With a multi-tenant application this matters more than before:
  `organizations` would sign a guest in to their home tenant instead of the
  client's.
- **Levels are still separate applications.** One multi-tenant application
  with tool filters would let the person's own shell use the broadest grant
  (research, "Permissions and the meaning of approval").
- **Coexistence.** An installation with only the old sections behaves
  exactly as today. An installation can have both: a client that registered
  its own single-tenant application keeps it (its section fills that
  tenant's cell), while other tenants use the shared applications.
- **Shortcut for an operator whose existing applications are its own.** The
  operator may switch those registrations to multi-tenant in Entra and enter
  the same client ids in the `microsoft_shared*` sections. Existing
  connections keep their client id and continue without a sign-in. The
  guided flow offers this with a plain statement that it widens who can
  approve and use those applications.

The labels are in a file every mapped user can read. On a consultancy's
server that means every person on it sees the list of client organisations.
The administrator's page says so where the label is entered.

**Broker.** Setting a `microsoft_shared*` section is the existing operation
with four more section names. The allowed list needs one addition to what
the broker accepts: add or relabel one tenant, and remove one tenant, as a
read-modify-write of the `microsoft_tenants` member under the same two locks,
with the same administrator check, `browser_setup` switch and actor record.
The broker's authority does not grow (one member of the same file, same
gate), but its accepted input does, so this is named here for Jari's
approval and the rule in `internal/AGENTS.md` is extended in the same change.

**CLI** (root, same broker path, AI-first canon applies):
`admin integrations set --provider microsoft_shared[_nosend|_drafts|_read]`,
`admin integrations tenants list|add --tenant-id <GUID> --label <text>|remove --tenant-id <GUID>`
with `--dry-run`, and `admin integrations consent-link --tenant-id <GUID>`,
which only computes the links.

**Contract.** The changes start in `contracts/v1/`:

- `integrations.schema.json`: the Microsoft provider gains `organisations`
  (tenant id, label, whether it is the operator's own, and its level
  options); an account gains `tenant_id` and `organisation`; the service
  failure enum gains `tenant_removed` and loses `tenant_changed`.
- `integration-login-control`, `integration-account`, `integration-files`,
  `integration-change`: a Microsoft account is addressed by address and
  `tenant_id`. A start request for a tenant without a cell at that level is
  refused with 409 `organisation_unavailable`.
- `integration-login`: failures gain `not_in_organisation`; `consent_url`
  keeps its meaning.
- `server-integrations`: the four section names, the allowed list with each
  entry's source, actor and time, and the add and remove requests.

## 4. Administrator flow

### Creating the multi-tenant applications

The existing guided setup (Palvelinintegraatiot › Microsoft 365) gains a
first choice: *Vain oma organisaatio* (today's flow, unchanged) or *Useita
organisaatioita*. The second walks the same steps per level and differs in
three places:

1. *Supported account types*: accounts in any organisational directory
   (multi-tenant), not personal accounts.
2. A step that says what the application's name and publisher will look
   like to a client's administrator, and that publisher verification is
   optional: without it the client's consent page shows the publisher as
   unverified. The application name should say who runs it.
3. At the end, the flow saves the level's `microsoft_shared*` section and
   adds the operator's own tenant to the allowed list.

Admin consent in the operator's own tenant, the public client setting and
the redirect URI are as today. The step needs one new synthetic screenshot
for the account-type choice; Entra's wording there has changed more than
once, so the text is checked against the portal when the screenshots are
made.

### The organisations list

Under Microsoft 365 the administrator sees *Sallitut organisaatiot*: label,
tenant GUID, who added it and when, and whether it is the operator's own.

**Add an organisation.** Two fields: the label and the client's *Tenant ID*
(GUID), with one line on where the client's administrator finds it (Entra
admin center, Overview). After saving, the row opens the consent panel.

**Consent panel.** For each configured level: the admin-consent link for
this tenant and this level's application
(`https://login.microsoftonline.com/<client GUID>/v2.0/adminconsent?client_id=…&scope=…&redirect_uri=…`,
built as `microsoftConsent` builds it today), a copy button, and one
ready-made message to send to the client's administrator. The message says:

- who publishes the application and that it may show as unverified;
- which level each link is and what it permits, in the words of the level
  table, and that approving only some levels is a valid choice;
- that the permissions are delegated: the application acts only as a person
  who signed in, with that person's own rights in the client's tenant;
- that approving creates an enterprise application in their Entra which
  they can restrict (*Assignment required*, then assign the named guests)
  and remove at any time;
- that after approving, Microsoft shows a blank page; that is the end.

The server cannot see whether a client has approved: it holds no token for
that tenant. The panel says so instead of showing a status; the first
person's sign-in is the test, and its refusal names the missing approval.

**Remove an organisation.** A confirmation states what removal does and does
not do: that organisation's Microsoft tools stop on this server at the next
call, each person's card shows why, nothing is revoked at Microsoft, and the
client's own approval remains until their administrator removes it. Adding
the tenant again resumes the connections without a sign-in.

### Who connected where

The host keeps no list of connections, and this design does not add one
(`internal/AGENTS.md`). The honest picture for the administrator's page:

- each person sees their own connections with the organisation;
- the client's administrator sees every sign-in to the enterprise
  application in their own tenant's sign-in logs, which is the authoritative
  record for their data;
- the server's administrator sees the allowed list and who changed it, not
  who uses it. Root can inspect a home, as root always can; no tool is built
  for it.

A list for the browser administrator would be a new flow of information from
each person's daemon to administrators. Question 1.

## 5. Person flow

1. **Organisation.** *Minkä organisaation tiedot yhdistetään?* The
   operator's own organisation first, then the others by label. One line
   under the client entries: *Jos olet organisaatiossa vieraana, kirjaudu
   omalla työtililläsi.* With a single organisation the step is not shown.
2. **Level.** The levels that have an application for that organisation;
   the rest greyed out as today. The server does not know which levels a
   client approved, so an unapproved level is found out at sign-in.
3. **Device code**, requested from the chosen tenant's authority. The person
   opens Microsoft's page, enters the code and signs in with their own work
   account. For a guest, Microsoft authenticates them at home and the client
   tenant issues the grant.
4. **Result.** A card with the address and the organisation, and its
   services read from the grant as today.

Renewal and *Vaihda taso…* start from a card and keep its organisation; the
organisation step is not shown.

### A guest without a mailbox

A guest usually has no mailbox in the client's tenant, whatever mail scopes
the application was granted. After sign-in, when the grant includes mail,
the daemon asks Graph for the inbox once. If the tenant answers that there
is no mailbox, the connection registers **only its files area**
(`ms2-files`), the card shows mail, calendar and contacts as *ei käytössä
vierastilillä*, and the skill describes a files connection. Offering an
agent a hundred mail tools that can only fail would be worse than offering
none. A connection with a mailbox gets its five areas as today.

### Refusals

Each is a fixed code; the text names the organisation by its label.

| Situation | Code | What the person reads |
| --- | --- | --- |
| The organisation has not approved the application, or not this level (AADSTS65001, 65004, 90094, and the code an unapproved tenant returns for an unknown application) | `consent_required` | "*Client One* ei ole hyväksynyt tätä sovellusta tälle tasolle. Lähetä tämä linkki heidän pääkäyttäjälleen." with the link |
| The person has no account in that organisation, or has not accepted the invitation (50020, 50034, 90072) | `not_in_organisation` | "Sinulla ei ole tiliä organisaatiossa *Client One*. Pyydä kutsu vieraaksi ja hyväksy se ensin." |
| The organisation's policy blocks device code sign-in (53003, 530032) | `device_code_blocked` | "*Client One* estää tämän kirjautumistavan. Asiasta päättää heidän pääkäyttäjänsä." |
| The organisation is not, or no longer, allowed here | `organisation_unavailable` at connect, `tenant_removed` on a card | "*Client One* ei ole sallittu tällä palvelimella. Kysy palvelimen ylläpitäjältä." |
| The person was removed from the organisation after connecting | `outside_tenant` (exists) | as today, with the label |
| Signed in as someone else at renewal | `account_mismatch` | as today |

One case cannot be told apart by the server. When the tenant requires
administrator approval, Microsoft tells the person so on its own page and
the device code then simply expires or is declined. For a client
organisation the expiry and decline texts therefore add: "Jos Microsoft
ilmoitti, että sovellus tarvitsee pääkäyttäjän hyväksynnän, lähetä tämä
linkki heidän pääkäyttäjälleen."

## 6. Security and authority

**Authorities do not move.** The gateway still only authenticates the
browser and relays requests; the daemon holds the tokens in the person's
home and resolves every binding from root's file and its own entries; the
broker writes application settings and holds no credential. The Microsoft
sign-in authorises nothing about the Unix user. One native child per person
remains, with the three connections taking turns (ADR 0039's rule), and no
cache is merged.

**The shared-application limitation, stated where it is decided.** The text
below, in substance, goes into the administrator's page beside the allowed
list, into the message for the client's administrator, and into
`docs/operations.md`:

- A sign-in made with a multi-tenant application yields a refresh token
  bound to the person and the application, not to one organisation. A
  program running as that person can use it against any organisation that
  approved the same application and where the person has an account,
  including one this server does not list or has removed.
- The allowed list therefore governs what Habitat's own connect, refresh and
  tool paths do. It is not a promise to a client that its data cannot be
  reached from this server.
- All of one person's connections and fetched files live in that person's
  one Unix account. Their agent can read and combine them. A client that
  needs its data kept apart from the person's other clients needs a separate
  account or server; neither direction A nor B provides that.
- The application is a public client. Its client id is not a secret, and
  once a client's administrator has approved it, anyone can start a sign-in
  for it against that client's users, without a further consent prompt. The
  client's own controls are what limit this: *Assignment required* on the
  enterprise application, and Conditional Access.
- A client that cannot accept a shared application registers its own
  single-tenant one (direction A), which this design keeps supporting.

**What the operator can restrict:** which tenants are allowed; which levels
exist as multi-tenant applications at all (offering only the read level to
every client is a valid configuration); whether administrators may change
any of this from the browser (`integrations.browser_setup`); and, as the
last resort, deleting a multi-tenant registration, which ends every
connection made with it in every tenant.

**What the operator cannot do:** grant rights in a client's SharePoint,
override a client's consent or Conditional Access, see a client's sign-in
logs, or revoke a person's tokens at Microsoft.

**Revocation, by who acts:**

| Actor | Action | Effect |
| --- | --- | --- |
| Person | Removes the connection | Its native credentials and entries are deleted from the home. The grant stays valid at Microsoft until it expires or is revoked; fetched files remain. |
| Operator | Removes the organisation | Habitat's paths refuse it from the next call. Credentials stay in homes (question 2). Nothing changes at Microsoft. |
| Client's administrator | Removes the approval or the enterprise application, requires assignment, or removes the guest | New tokens for their tenant are refused; the connection shows `login_expired` or `outside_tenant` at its next check. An access token already issued can live until it expires. A guest's refresh token itself is only revocable in the guest's home tenant (research, "Disconnect is not revocation"). |

## 7. First proof and tests

### The proof case

One person on one server connects: their own organisation (*Own Ltd*, as a
member, full level) and *Client One* and *Client Two* as a guest, at whatever
level each client approved. Done means: three cards; `ms-files`, `ms2-files`
and `ms3-files` each find and fetch a known file of their own organisation
and none finds another's; a restart, a renewal and a level change of one
leave the other two untouched; a fourth organisation that is not listed
cannot be chosen and is refused when requested directly; removing *Client
Two* from the list stops `ms3-…` at the next call and adding it back resumes
it.

No guest mail, calendar or Teams messages are claimed.

### Tests to write

Per `TESTING.md`, synthetic tenants and accounts only.

- **Names and table:** name parsing and validation; an address that looks
  like a name is not one; the table from old sections, shared sections and
  the list, including a tenant with both and a shared level missing.
- **Sign-in:** the device code goes to the chosen tenant's authority; a
  tenant mismatch or a `localAccountId` that differs from Graph's `id` is
  `account_mismatch`; a guest-shaped account (`#EXT#` UPN, `mail` different
  from MSAL's username, and `mail` empty) connects; renewal with another
  `homeAccountId` is refused; the same address in three tenants gives three
  stores and three entry prefixes and overwrites nothing; each refusal code
  from its AADSTS numbers.
- **Adapter** (`microsoft-native.test.mjs` with `synthetic-entra.mjs`
  extended to several tenants and a guest): import reports the ids; verify
  selects by `homeAccountId` and tenant; a cache with two tenant profiles
  fails closed.
- **Dispatch:** three connections share the one child and switch without a
  second process; a removed tenant is refused at listing and at call, and
  resumes when added back; removing one connection leaves the others' files
  and entries.
- **No tenant-following:** changing an old section's tenant redeems nothing
  elsewhere and reports `tenant_removed`.
- **Migration:** each combination of existing stores is renamed; an
  interruption after every step is finished at the next check; disagreeing
  tenants are left alone and ask for a sign-in; a synced library keeps its
  directory and listings and does not resync; a running child is stopped
  first.
- **Guest without a mailbox:** only the files area is registered and the
  services say why.
- **Root side:** `integrationapps` accepts the new sections and the list and
  refuses non-GUID keys, long or control-character labels and a 33rd entry;
  the broker adds and removes one tenant under both locks, keeps every other
  byte and records the actor; CLI help, JSON output and `--dry-run`.
- **Contract and browser:** schema examples and `scripts/check-generated.sh`;
  the organisation step and its absence with one organisation; each refusal
  text; the administrator's list, consent panel and removal confirmation.

### What only real accounts can show

Synthetic tests cannot establish any of these, and the design depends on
each:

1. Device code sign-in works for a **B2B guest** at the client tenant's
   authority, and the client's Conditional Access does not block it. This is
   the largest risk to the whole direction; if a client blocks it, the
   options are the client allowing it or a second sign-in method for
   Microsoft, which would be a follow-up decision.
2. For a guest, MSAL's `localAccountId` equals Graph `/me`'s `id`, the cache
   holds exactly one account, and the pinned server starts and refreshes
   with the home-account pin and the client tenant as authority.
3. Which AADSTS code an organisation that never approved the application
   returns, at the device code request and at approval, and what the person
   sees on Microsoft's page.
4. A file shared with the guest is found by `search-query`, listed and
   fetched through the pinned tools; a site addressed directly works; an
   item the guest may not open is refused.
5. The mailbox probe's answer for a guest, and that a guest connection with
   only the files area is usable.
6. The admin-consent link with an unverified publisher: what the client's
   administrator sees and that approval of one level leaves the others
   unapproved.
7. Refresh after an hour and after a daemon restart for all three
   connections; removal of the guest and of the approval on the client's
   side.
8. Migration on an installation with existing connections, including one
   with synced libraries.

This needs the operator to create or convert the applications in their own
Entra, two client administrators to approve at least the read level, and a
guest invitation accepted in each. No detail of those organisations goes
into the repository.

### Order of work

1. Connection name, immutable pin, migration and the removal of
   tenant-following, on single-tenant configuration. Useful and verifiable
   with today's connections, and needs no UI.
2. Shared sections, the allowed list, broker, CLI, table, dispatch refusal
   and contracts.
3. Person and administrator UI, after the prototype round.
4. The proof with real accounts; then `docs/operations.md` and the rules in
   `internal/AGENTS.md` (GUID-only authorities, the list is not a security
   boundary, no tenant-following, the name's form) in the same commits as
   the code they describe.

## Questions for Jari

1. **Does the browser administrator get a list of who connected which
   organisation?** Recommendation and default: no. The host keeps no
   connection list today, the client's own sign-in logs are the
   authoritative record, and such a list would be a new flow of information
   about people's connections to administrators. If you want it, the
   smallest form is a count per organisation that each daemon reports on
   request, and that is an authority decision of its own.
2. **When an organisation is removed from the list, are people's stored
   sign-ins for it deleted?** Recommendation and default: no, only stopped.
   Deleting does not revoke anything at Microsoft, a mistaken removal would
   force every person to sign in again, and the card lets each person remove
   their own. The alternative is that each daemon deletes them at its next
   check.
3. **Do fetched files keep the root `~/cloud/microsoft-fetched/<address>/`,
   shared by one person's connections that have the same address?**
   Recommendation and default: yes; the host segment below it already
   separates organisations and no existing file moves. The alternative is a
   root per connection, which puts a GUID in a path people and agents read.

## Prototype round

The UI parts need one `/prototype` round before they are built: the
administrator's organisations list with the add dialog, the consent panel
and its message, the wording of the limitation, the removal confirmation;
and the person's organisation step, the card with its organisation, the
files-only guest card and the refusal texts. The Finnish wording of the
limitation and of the message to a client's administrator is the part most
worth Jari's eye. Steps 1 and 2 of the order of work do not wait for it.
