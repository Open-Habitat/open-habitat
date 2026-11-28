# Generic OpenID Connect sign-in: what it takes and what it means

Research for discussion, 28 November 2026, at repository base `5455d0627`.
No product code was changed. The decisions below are recommendations that
need Jari's approval and an ADR before any code is built on them, because
they move sign-in authority (root `AGENTS.md`, `internal/AGENTS.md`).

## Yhteenveto Jarille

**Se on tehtävissä, ja yksi toteutus kattaa Entra ID:n, Google Workspacen,
Keycloakin, Authentikin sekä Casdoorin ja Authingin. Kiinan alustoja se ei
kata suoraan, eikä työ ole pieni.** Kirjautumisen hoitava osa (`auth.go`) on
selkeä ja melko helppo yleistää. Työ on siinä, että "henkilö = GitHubin
numeerinen tunniste" on kirjoitettu koodiin kymmeniin paikkoihin: brokerin
tietomuotoon, gatewayn ja daemonin väliseen kättelyyn, daemonin
käynnistysasetuksiin, `gh`-sovittimeen, moninpelin jäsenlistoihin,
sopimusskeemoihin, CLI:n `--github-id`-lippuihin ja hallintanäkymään.

Suositukseni:

1. **Henkilön avain on (lähde, tunniste).** GitHub-käyttäjät pysyvät
   ennallaan (`github:<numero>`), joten nykyisiä käyttäjiä ei tarvitse
   siirtää. OIDC-käyttäjän avain on tiiviste issuerista ja `sub`-väitteestä
   (`oidc:<tiiviste>`). **Sähköposti ei ole koskaan avain**, eikä sen
   perusteella koskaan yhdistetä tilejä. Entra ID:n sähköpostiväite on
   muutettavissa eikä varmennettu (nOAuth-hyökkäys).
2. **Ylläpitäjä määrittelee OIDC-lähteen `site.json`issa:** issuerin osoite
   (asetukset haetaan discoveryllä), client id, salaisuus tiedostossa ja
   pääsysäännöt. PKCE ja nonce ovat aina käytössä eikä niitä voi kytkeä
   pois. GitHub-sovelluksesta tulee valinnainen, joten asennus voi olla
   pelkästään OIDC:n varassa (tämä on Kiinan tapaus).
3. **Pääsy annetaan issuerin, ryhmä- tai roolivästeen tai yksittäisen
   henkilön perusteella.** Ryhmä- ja roolivästeet korvaavat GitHub-tiimit.
   Sähköpostikutsu sidotaan `sub`iin ensimmäisellä kirjautumisella, samaan
   tapaan kuin GitHub-tiimi sidotaan nyt numeeriseen tunnisteeseensa.
4. **GitHubista tulee OIDC-käyttäjälle koodipalveluyhteys**, ei
   kirjautumistapa. Yhteys muodostetaan `gh`:n omalla laitekoodikirjautumisella
   asetuksista, kuten Gitea- ja GitLab-yhteydet. Sen jälkeen repot, kloonaus
   ja push toimivat kuten nyt. Ennen yhteyttä ylläpitäjän oletusrepot eivät
   tuo mitään, eikä GitHub-tiimeillä anneta pääsyä.
5. **Kiina:** Feishu/Lark, DingTalk ja WeCom eivät puhu standardia OIDC:tä
   (niissä ei ole ID-tokenia, discoveryä eikä PKCE:tä). Ne liitetään
   Casdoorin tai Authingin kautta, ja dokumentoimme tämän reitin. Emme
   kirjoita niille omia sovittimia.
6. **Useamman kirjautumistavan liittäminen samaan henkilöön** tehdään
   erikseen myöhemmässä vaiheessa. Liitos tehdään aina henkilön omasta
   istunnosta käsin, ei koskaan automaattisesti.

**Koko:** arvioin noin 15–20 issueta neljässä vaiheessa. Ensimmäinen
käyttökelpoinen vaihe (OIDC-kirjautuminen, pääsy issuerin, ryhmän tai
tunnisteen perusteella, GitHub valinnaiseksi) on noin puolet työstä, karkeasti
6–9 issueta. Arkkitehtuurimuutoksia on kolme: uusi tunnistemuoto brokerille,
uusi riippuvuus (`go-oidc`) ja oletusrepojen siirtyminen GitHub-yhteyden
syntyhetkeen. Nämä kolme tarvitsevat päätöksesi (kohta 11).

Kolme kysymystä:

- Hyväksytkö, että OIDC-tunniste on tiiviste (issuer, sub), joka vaihtuu,
  jos issuerin osoite vaihtuu? Vaihdos vaatisi silloin ylläpitäjän tekemän
  uudelleensidonnan.
- Riittääkö ensimmäiseen vaiheeseen yksi OIDC-lähde asennusta kohden, vai
  tarvitaanko heti monta?
- Lyhennetäänkö OIDC-istuntojen ikää? Nyt istunto vanhenee 90 päivän
  käyttämättömyyden jälkeen ja on voimassa enintään 365 päivää. Yrityksessä
  lähtijän IdP-tilin sulkeminen ei katkaise Habitat-istuntoa ennen sitä.

---

## 1. What exists today

Read: `internal/gateway/auth.go`, `github.go`, `github_teams.go`,
`session.go`, `session_store.go`, `link.go`, `members_linux.go`,
`shares_linux.go`, `profile.go`, `access.go`; `internal/provision/protocol*.go`,
`state_linux.go`, `writer_linux.go`, `executor_linux.go`;
`internal/transport/transport_linux.go`; `internal/nativegh/native.go`;
`internal/daemon/membership_linux.go`, `git_identity_linux.go`;
`internal/host/site.go`, `site/schema.json`, `site/example.json`;
`contracts/v1/account-session.schema.json`, `conversation-members.schema.json`;
`web/src/components/LoginCard.tsx`; ADR 0030 and ADR 0031; `docs/operations.md`.

The flow, from the code:

1. `GET /auth/github/start` creates `state`, a PKCE verifier and a
   browser-binding cookie. The pending flow is kept server-side for five
   minutes, with the return path held only there.
2. `GET /auth/github/callback` consumes the flow, checks the cookie, and
   exchanges the code. It then reads `GET /user` with the token. The pinned
   `iss` parameter (`https://github.com/login/oauth`) is accepted as RFC 9207
   mix-up evidence.
3. The **numeric GitHub id** is the person. Before `ensure`, the gateway
   tells the broker which GitHub teams the person belongs to, asking GitHub
   with the person's token. The broker then decides admission and creates or
   finds the **binding** `{id, uid, username}`. The username comes from the
   GitHub login, with `gh<id>` as the fallback.
4. The **token is handed to the person's daemon exactly once** over the UDS
   transport (`Deliver` / `DeliverFirst`). The daemon installs it into the
   person's own `gh`. The binding-creating login also carries the site's
   repository plan and the site AI key (ADR 0030).
5. A broker `authorize` recheck runs, then the gateway issues its own session
   cookie: 90 days idle, 365 days absolute, kept in
   `/var/lib/open-habitat-gateway/sessions.json`. The session records
   `method: github|link` and `githubAt`, the last proven GitHub sign-in.

Where "GitHub numeric id" is assumed (counted outside tests):

| Place | What assumes GitHub |
| --- | --- |
| Broker wire (`provision/protocol*.go`) | `Provider` must be `"github"`, `ID` must be numeric, `Candidate` must be a GitHub login. About 38 numeric checks and 23 `"github"` literals. The field `Provider` already exists, so the wire was meant to grow. |
| Broker state | Binding, admission, runtime, team, revoked and removal entries are keyed by the numeric id. |
| Transport and daemon config (`transport_linux.go`, `executor_linux.go`) | `Provider == "github"`, `validSubject` numeric, a token is required in every handoff. |
| `nativegh` adapter | `New(home, subject)` uses the sign-in subject as the GitHub account that counts as "own". A `gh` login of any other account is "foreign". |
| Multiplayer and sharing | `^github:[0-9]{1,20}$` in daemon membership files (inside people's homes), gateway members and shares, and `conversation-members.schema.json`. Avatars come from `githubAvatar(id)`. |
| Profile and contracts | `account-session.schema.json` has `provider: const "github"`. `avatar_url` is limited to `avatars.githubusercontent.com`. |
| Site file | `admission` and `administrators` are numeric strings. `gateway.oauth_*` is required. The callback path is fixed to `/auth/github/callback`. |
| CLI | `admin access … --github-id`, `admin ai-key seed --github-id` and similar (18 places). Runtime admission resolves a GitHub login to an id through GitHub's public users API. |
| Web | The login card's single button goes to `/auth/github/start`. The onboarding step is called `github`. The admin access page admits by GitHub login. |
| Session | `githubAt` guards GitHub disconnect, which requires a recent GitHub sign-in. |
| Git identity | The daemon suggests `<id>+<login>@users.noreply.github.com`. |

`identityID` (`wid_…`) and the editor and view host labels are already
derived from `Provider + ":" + Subject`, so they generalize without change.

## 2. Identity: what the person is keyed by

### Standards and provider facts

- In OIDC, `sub` is unique and never reassigned **only within its issuer**.
  It is at most 255 ASCII characters and case-sensitive. `iss` and `sub`
  together are the only claims a relying party can rely on as a stable
  identifier. [S1 §2, §5.7]
- **Entra ID:** `sub` is *pairwise*, unique per application (client id).
  The same person under another app registration gets a different `sub`.
  `oid` is stable across apps within one tenant. Both are immutable, and
  Microsoft says to key on `sub` or `oid`, never on email, UPN or
  `preferred_username`. A guest in another tenant is a different person by
  design. [P1]
- **Google:** "Always use the `sub` field", because it stays the same when
  the email changes. [P2]
- **Authentik:** `sub` depends on the provider's *Subject mode*. The default
  is a hashed user id. Username and email modes exist but are not unique or
  stable. Changing the mode changes every `sub`. [P5]
- **Keycloak:** `sub` is the user's UUID in the realm.

### Recommendation

**Key = (sign-in source, subject), with two kinds of source.**

- `github`: unchanged. The ID is the numeric GitHub id. Existing bindings,
  membership files in homes (`github:<id>`), sessions and administrator
  designations stay valid with no migration of the key.
- `oidc`: the ID is `base32(SHA-256(iss ‖ 0x00 ‖ sub))`, truncated to
  32 characters (160 bits). It is shown as `oidc:<id>`.

Why a hash and not the raw `sub`:

- The broker, transport and membership validators need a bounded, closed
  character set. A raw `sub` can be any 255 ASCII characters, including `:`
  and `/`.
- Some IdPs put an email or username in `sub` (Authentik's email mode,
  Casdoor and Authing setups). The broker journal logs the subject on
  removal (`broker_removal … subject`), and personal data should not enter
  root's logs.
- Binding the issuer into the key makes "same `sub`, different issuer" a
  different person by construction. This is exactly OIDC's rule, so a second
  configured issuer can never collide with the first.

The cost: if the issuer URL changes (a Keycloak hostname move, or a switch
from Entra's v1 to v2 endpoint), every person becomes new. The same happens
in Entra if the app registration is replaced, because `sub` is pairwise per
client id. Both are rare deliberate operator acts. They are handled by an
explicit broker *rebind* operation, a root-only CLI that moves a committed
binding from one ID to another (stage 4), not by keying on something weaker.
I considered offering Entra's `oid` as the key, which survives a new app
registration, and decided against it. It is Microsoft-specific, needs
per-provider code, and a configurable "subject claim" would let an
administrator choose `email` by mistake.

**Email is presentation and an invitation hint, never identity.** Profile
`name` and `email` from the ID token go into `AccountProfile`, which is
already documented as presentation only. Linking or admitting by email
without a pin is the nOAuth class of account takeover. In Entra, the email
claim was mutable and unverified, and apps that merged accounts or admitted
by email were taken over. Semperis still found about 9% of tested gallery
apps vulnerable in 2025. [P3, P4]

**Username.** Use `preferred_username`, or else the local part of `email`,
lowercased and checked by the broker's existing `username()` rule. Otherwise
fall back to `u` plus 8 characters of the ID. The broker already treats the
candidate as a hint and the ID as authority (`writer_linux.go`), and it
refuses collisions. Only the validator (`githubLogin`) needs a per-provider
sibling.

### Existing GitHub users and linking several sign-ins

- **Default: two sign-ins are two people.** Someone who signs in with
  GitHub today and with company OIDC tomorrow gets a second account, unless
  the administrator admits only one of them. This is safe and predictable.
- **Linking (stage 4).** The broker gains *aliases*: extra (provider, ID)
  pairs that resolve to an existing binding. An alias is added only from an
  authenticated session. The person, signed in with A, starts B's flow with a
  `link` intent, guarded the way the current reconnect is: same-origin
  `Sec-Fetch-Site`, a pending flow bound to the session, and the alias not
  already bound. The gateway then sends the broker `link{binding id, alias}`.
  The session identity stays the binding's primary subject, so shares,
  memberships, roles and quotas keep working without rewriting files in
  homes. The person and an administrator can remove an alias. **No
  automatic link by email, ever.**
- **A company that drops GitHub sign-in.** Each existing person links OIDC
  once from Settings, or root runs the rebind. The administrator's access
  page shows who has not linked.

Authority note: linking lets whoever controls identity B act as the person.
That is the point of linking. It also means a compromised gateway could
attach an alias it controls. A compromised gateway can already act as every
bound person through their daemons, so the new gain is persistence beyond
the compromise. This is the same trade ADR 0030 accepted for runtime
admission. The bounds are an alias cap per binding, aliases shown with actor
and time in `admin access list` and `host plan`, and a root switch in
`site.json` (`identities.linking`), off by default.

## 3. The administrator's configuration

Proposed `site.json` shape. The names are illustrative and the schema is to
be designed in the ADR.

```json
"sign_in": {
  "github": {
    "client_id": "…",
    "secret_file": "/etc/open-habitat/secrets/github"
  },
  "oidc": [{
    "name": "company",
    "label": "Company account",
    "issuer": "https://login.microsoftonline.com/<tenant-id>/v2.0",
    "client_id": "…",
    "secret_file": "/etc/open-habitat/secrets/oidc-company",
    "scopes": ["openid", "profile", "email"],
    "admit": {
      "issuer_wide": false,
      "claims": [{"name": "groups", "values": ["<group-object-id>"]}],
      "email_domains": ["example.com"]
    }
  }]
},
"identities": {
  "admission": ["123456", "oidc:company:email:alice@example.com"],
  "administrators": ["oidc:company:email:alice@example.com"]
}
```

What each part does and why:

- **`issuer` and discovery.** The gateway fetches
  `<issuer>/.well-known/openid-configuration` at startup and on a bounded
  refresh. It requires the document's `issuer` to equal the configured string
  exactly, as OIDC Discovery requires. It takes the authorization, token,
  JWKS and (optionally) userinfo endpoints from it. `host check` performs the
  same fetch and reports a mismatch, an unreachable issuer or a missing
  `S256`. Entra's `/common` metadata advertises the issuer template
  `https://login.microsoftonline.com/{tenantid}/v2.0` (checked 28.11.2026).
  An exact-match check therefore refuses `/common` and `/organizations`, and
  that is intended: a tenant-specific issuer is the only safe Entra
  configuration.
- **Client secret** lives in a protected file, as the GitHub secret does
  today. `private_key_jwt` client authentication can be a later addition.
- **Callback** is `https://<origin>/auth/oidc/<name>/callback`, one path per
  source. Distinct redirect URIs per authorization server are RFC 9700's
  mix-up defence when the AS does not return `iss`. If it does return `iss`
  (RFC 9207), the gateway requires it to equal the issuer, as it already does
  for GitHub. [S2 §4.4, S3]
- **PKCE (S256) and `nonce` are always sent and never configurable.** Entra
  supports PKCE but does not list `code_challenge_methods_supported` in its
  discovery document (checked 28.11.2026). The gateway therefore sends PKCE
  regardless of what discovery advertises, and refuses only an explicit
  `plain`-only list.
- **Admission rules** (section 5) decide who gets an account.
  `identities.admission` grows typed entries: a bare number stays GitHub;
  `oidc:<name>:sub:<sub>` names a person exactly; `oidc:<name>:email:<addr>`
  is an invitation that pins at first sign-in.
- **`github` becomes optional.** With no `github` block the login card shows
  only the OIDC button(s), and the operator registers no GitHub OAuth app.
  This is the configuration for mainland China. With both, the card shows
  both.

The browser contract gains a public `GET /api/v1/site/sign-in` listing the
sources' `name` and `label`, nothing else, like the existing
`/api/v1/site/language`. The login card renders one button per source.

## 4. Provider specifics

| Provider | Discovery and issuer | Stable key | Admission signal | Notes |
| --- | --- | --- | --- | --- |
| **Microsoft Entra ID** | `https://login.microsoftonline.com/<tid>/v2.0`, single-tenant app | `sub` (pairwise per app) | `groups` (object GUIDs) or `roles` (app roles). Simplest: the enterprise app's *Assignment required*, plus issuer-wide. | `groups` is dropped above 200 groups and replaced by an overage pointer to Graph. Use "groups assigned to the application" or app roles. Treat overage as "membership could not be checked", not as "no groups". Email is not verified by default; trust it only with the `xms_edov` optional claim, or with `removeUnverifiedEmailClaim` set on the app. [P1, P4, P6] |
| **Google Workspace** | `https://accounts.google.com` | `sub` | `hd` (Workspace domain). Google's ID token carries no groups. | Check the `hd` *claim*. The `hd` request parameter is only a UI hint. An "Internal" OAuth consent screen keeps the client within the organisation. `email_verified` is reliable. [P2] |
| **Keycloak** | `https://<host>/realms/<realm>` | `sub` (user UUID) | `groups` only with a *Group Membership* mapper. Full path (`/eng/platform`) is the safe form. | A child group's member is not listed under its parent. [P7] |
| **Authentik** | `https://<host>/application/o/<slug>/` | `sub` (hashed id by default) | `groups` (names) from the default `profile` scope, once *Include claims in id_token* is on. | Do not change Subject mode after people have signed in. [P5] |
| **Casdoor, Authing** | their own issuers | their `sub` | groups or roles | Brokers for China (below). |
| **Feishu / Lark** | no OIDC discovery; the `.well-known` path answers with an HTML page (checked 28.11.2026) | `open_id` (per app) / `union_id` | Contacts API | The "OIDC" token endpoint returns a `user_access_token`, not an ID token. Enterprise accounts only. [C1, C2] |
| **DingTalk** | no discovery | `unionId`, `openId` | Contacts API | `authCode` instead of `code`, JSON token request, custom `x-acs-dingtalk-access-token` header. [C3] |
| **WeCom** | no discovery | corp `userid` (case-insensitive) | directory | Code redeemed with the *app's* token at `auth/getuserinfo`. No PKCE, nonce or ID token. [C4] |

**China, recommended route.** Do not write Feishu, DingTalk or WeCom
adapters in Habitat. Each is a different non-standard flow. Hand-adapting
them would add one per-vendor authentication path to the gateway, the most
security-sensitive code in the product, and each would need its own
validation story without ID-token signatures. Instead, document **Casdoor**
(open source, self-hostable next to Habitat) or **Authing** (hosted) as the
OIDC issuer. Both have built-in DingTalk, WeCom and Lark/Feishu providers and
present standard OIDC to the application. [C5, C6] Small OIDC bridges exist
for single vendors (`oidc-bridge`, `oidc-dingtalk`, `Feishu-OIDC-Workers`).
They are less established and can be mentioned without recommendation.
GitHub reachability for *code* is separate. Section 6 makes sign-in work
without github.com. Cloning from GitHub still depends on the server's
network, and the `release-mirror` issue covers installation.

## 5. Admission and roles

Admission stays the broker's decision, following the pattern that already
exists for GitHub teams. The gateway reports **observations** from the
validated sign-in, and the broker decides from its sources.

- **Issuer-wide** (`issuer_wide: true`): anyone the IdP lets sign in to this
  client gets an account. This is right when the IdP itself gates access, as
  with Entra's *Assignment required*, Google "Internal" or a Keycloak client
  restricted by role. It is the OIDC counterpart of the broker's existing
  admit-any mode, scoped to one source. It must be an explicit opt-in.
- **Claim match** (`claims`): one or more `{name, values}` pairs. A
  sign-in's claim values are sent to the broker in an observation op modeled
  on `team_sign_in`, and admission follows the same rules as team admission.
  Leaving a group takes effect at the next sign-in, and an open session
  continues until it ends. Only exact string matches are allowed, with no
  patterns. If the claim is missing because of Entra overage, the sign-in is
  refused with the existing `membership_unavailable` wording.
- **Email domain** (`email_domains`): only together with a verified email
  signal: `email_verified: true`, Google's `hd`, or Entra's `xms_edov: true`.
  For Google, `hd` is the check.
- **Single person by subject** (`oidc:<name>:sub:<sub>`): exact and safe, but
  the administrator rarely knows a `sub`.
- **Invitation by email** (`oidc:<name>:email:<addr>`, in `site.json` or as
  a runtime admission): admits the **first** sign-in from that source whose
  verified email equals the address. The broker then pins the entry to the
  resulting ID, exactly as a GitHub team is pinned to its numeric id by its
  first member today. After the pin, a later email change or a second account
  with the same address does nothing. The remaining risk is someone inside
  the same IdP getting the address before the invitee signs in. It is
  bounded because the administrator chose the issuer and its tenant. It is
  why invitations require a verified-email signal and are shown as "pending
  first sign-in" on the access page.
- **Administrators.** The same typed entries in `identities.administrators`.
  The browser's administrator designation (now numeric id) takes the
  qualified subject.

Runtime admission in the browser (ADR 0030) cannot resolve an OIDC person in
advance. Generic OIDC has no user lookup API. The browser therefore offers
email invitations for OIDC sources and keeps the GitHub-login lookup for
GitHub.

## 6. What depends on GitHub today, and what changes

| Today | For a person who signed in with OIDC |
| --- | --- |
| Sign-in delivers a GitHub token to `gh` | No token. The transport needs a **token-less handoff**: first login carries only the site AI, speech and search keys. An ordinary sign-in needs no handoff. |
| `gh` "own" account = sign-in subject | The person connects GitHub in Settings › Koodipalvelut. **Recommended: `gh`'s own device-code login**, relayed through the browser the way the integrations catalog already relays logins (ADR 0026). It needs no GitHub OAuth app on the site and stores the token only in `gh`. The daemon records the connected GitHub account id in the person's own state. `nativegh` compares against that id instead of the sign-in subject. For GitHub sign-in people, connected = subject, unchanged. |
| Default repositories imported at the binding-creating login (ADR 0030) | No GitHub token at that login. **Proposed amendment:** the plan is offered once, at the person's first GitHub connection, and the gateway's access check uses the token from that connection. For device-code connections the gateway never sees a token, so the check moves to the daemon, which ADR 0030 rejected because the whole default list would enter the person's UID. Alternative: skip defaults for OIDC people until they connect, and show the defaults as suggestions in the clone chooser. **This needs Jari's decision** (section 11). |
| GitHub team admission | Not available. Group or role claims replace it. |
| Repo list, clone, publish, workflow scope | Work as soon as `gh` holds a login. These already go through the daemon's `gh`, not the sign-in. |
| GitHub disconnect needs a recent GitHub sign-in (`githubAt`) | Generalize to "a recent sign-in by the person's method" (`authAt`, `method: github|oidc|link`). |
| Avatars only from `avatars.githubusercontent.com` | OIDC people show initials. Loading `picture` URLs from arbitrary IdP hosts would leak the viewer to that host, and Entra puts no picture URL in the token. |
| Git identity suggestion (`noreply` address) | Suggest the ID-token name and email. The person still confirms them. |
| Multiplayer subject `github:<id>` | Validators and schema accept `oidc:<32 base32>`. Existing files remain valid. |
| CLI `--github-id` | Becomes `--subject <provider:id>`. The bare number stays GitHub. |
| Onboarding step named `github` | Becomes a neutral sign-in step. The GitHub step appears only when it is relevant. |
| Operator guide and `skill print operator` | Gain an OIDC registration section per provider and a China section. |

## 7. Security

What the implementation must do. Each item is testable.

- **ID token validation** per OIDC Core §3.1.3.7 [S1]:
  - signature by a key from the discovered `jwks_uri`, with an algorithm
    allowlist (RS256, PS256, ES256) that is never `none` or HMAC;
  - `iss` exactly the configured issuer;
  - `aud` contains the client id, and if there are several audiences, `azp`
    equals the client id;
  - `exp` in the future and `iat` recent, with small skew;
  - `nonce` equals the pending flow's nonce.

  Unknown `kid` triggers one rate-limited JWKS refetch, which handles key
  rotation, and nothing more.
- **Flow protections already in `auth.go` carry over unchanged:** one-use
  `state`, PKCE S256, the `__Host-` browser-binding cookie,
  per-peer admission buckets, the pending cap, a strict callback query shape,
  and no provider text in logs or redirects. Add `nonce` and per-source
  callbacks, and keep the RFC 9207 `iss` check.
- **Userinfo is optional.** If it is used for profile claims, its `sub` must
  equal the ID token's (OIDC Core §5.3.2), and it is never an admission
  source unless the claim is absent from the ID token.
- **No stored IdP tokens.** The access and refresh tokens from the IdP are
  dropped after validation. Keeping refresh tokens to recheck the IdP would
  be a credential store, which the project's rules forbid. The consequence is
  the next item.
- **Session lifetime.** Sessions now last up to 90 days idle and 365 days
  absolute. Disabling someone in the company IdP does not end their Habitat
  session. This is the same model as GitHub team membership today, but
  companies will expect offboarding in the IdP to take effect. Recommend a
  per-source `max_session_days` (for example 7–30) for OIDC sources. OIDC
  Back-Channel Logout [S4] could follow later for IdPs that support it
  (Keycloak does; Entra does not). Until then the access page's *Poista
  pääsy* remains the immediate stop.
- **Account takeover by email:** covered in sections 2 and 5. Never link or
  admit by an unpinned email. Require a verified-email signal for
  invitations. Pin to the ID at first use.
- **Mix-up between sources:** per-source callback paths plus the `iss` check.
  A pending flow records which source started it, and the callback refuses
  any other.
- **Authority boundaries stay where they are.** The gateway authenticates and
  holds the client secrets. The broker receives only (provider, ID,
  candidate, observations) and decides admission and the account. The daemon
  trusts no identity claim. Adding issuers adds configuration, not new
  authority.
- **New dependency:** `github.com/coreos/go-oidc/v3`, which pulls in
  `github.com/go-jose/go-jose/v4` and `golang.org/x/oauth2`. [L1] The
  repository has a hand-written RS256 verifier for Cloudflare Access
  (`access.go`), so a hand-written OIDC verifier is possible. But JOSE
  algorithm handling, key types and rotation are where JWT bugs live, and
  go-oidc is small, maintained and widely deployed. I recommend the
  dependency. As a major dependency, it is Jari's decision.

## 8. Migration

- **No identity migration for GitHub people.** Their key, files in homes,
  sessions and roles stay.
- **Broker state** gains a `provider` field on bindings and admission
  entries. This is pre-release, so a one-time step in `host upgrade` rewrites
  the files with `provider: "github"` instead of carrying a reader for the
  old shape. The view-address reset is the precedent.
- **`site.json`**: `gateway.oauth_*` moves to `sign_in.github`. `host plan`
  names the change, and the operator edits the file at upgrade, as for other
  format changes.
- **Session store and administration state:** subjects become qualified.
  This is also a one-time rewrite at upgrade.
- **Moving an existing person from GitHub to OIDC:** linking (stage 4) or
  root's rebind.

## 9. Tests

- **Go, gateway:** a synthetic OIDC issuer on `httptest` (discovery, JWKS
  with rotation, token endpoint) driving the callback. Table tests for every
  rejection: wrong `iss` and `aud`, missing or extra `azp`, expired, bad
  `nonce`, `alg: none` and HS256, unknown `kid`, discovery `issuer` mismatch,
  callback `iss` mismatch, a flow started by another source, and
  `email_verified` false with an invitation. The logging-policy tests extend
  to the new events.
- **Go, broker:** wire validation for `provider: oidc` and hashed IDs,
  claim observations, invitation pinning (first verified sign-in pins; second
  account with the same email refused), aliases, the cap, and rebind.
- **Go, transport, daemon and `nativegh`:** token-less handoff,
  connected-account anchor, and membership subjects in both forms.
- **Contracts:** schema changes generated and checked by
  `scripts/check-generated.sh`.
- **Browser (Playwright):** a login card with one, two or no GitHub button;
  an OIDC-only first sign-in through a fixture issuer; GitHub connection via
  device code from Settings; Explain cards for the new controls.
- **VM:** a `jit-login` variant with a containerised Keycloak as the issuer,
  covering first-login account creation, group admission and refusal.
- **Manual qualification**, recorded per release: Entra single-tenant with
  app roles, Google Workspace with `hd`, and Casdoor in front of one Chinese
  provider, all on synthetic test tenants.

## 10. Size and staged plan

The estimate is in issues of the size this repository usually lands in one
worker run.

**Stage 0: decision (1 ADR).** Identity key, site schema, admission sources,
`go-oidc`, the ADR 0030 amendment and session lifetime. Optionally a
prototype round for the login card with several sources and for the access
page with invitations.

**Stage 1: OIDC sign-in (6–9 issues; about half the work).**

1. Broker wire and state: `provider` and hashed IDs, upgrade rewrite.
2. Transport and daemon config: provider-neutral subject, token-less
   handoff.
3. Gateway: OIDC source (discovery, flow, validation), per-source routes,
   `nonce`, session `method`/`authAt`, optional GitHub.
4. Admission: issuer-wide, claim observations, typed `site.json` entries,
   `host check` of discovery.
5. Contracts and web: sign-in sources endpoint, login card, neutral
   onboarding step, initials avatars, qualified subjects in members and
   shares.
6. CLI `--subject`, operator guide, operator skill.
7. Tests: synthetic issuer, Playwright, VM with Keycloak.

**Stage 2: GitHub as a connection (3–4 issues).** `gh` device-code login
relay in Settings, `nativegh` connected-account anchor, git identity
suggestion, and the default-repository decision.

**Stage 3: invitations and administration (2–3 issues).** Email
invitations with pinning (site and runtime), access page for OIDC people,
per-source session lifetime.

**Stage 4: linking and rebind (3 issues).** Broker aliases and switch,
link and unlink flows in Settings and on the admin page, root rebind CLI.

**Later, only on demand:** several OIDC sources in the UI beyond the first;
Back-Channel Logout; `private_key_jwt`; a China operator guide with Casdoor.

Stages 1 and 2 together give the issue's goal: a bookkeeper signs in with the
company account, and a developer on the same site connects GitHub for code.
Stage 1 alone already serves OIDC-only sites (China via Casdoor) for
non-programmers.

## 11. Decisions that need Jari

1. **Identity key:** `github:<id>` unchanged and `oidc:<hash(iss, sub)>` for
   OIDC. Email is never a key and never a link.
2. **New dependency `go-oidc` (with `go-jose`, `x/oauth2`)**, rather than a
   hand-written verifier.
3. **ADR 0030 amendment for OIDC people's default repositories.** Either
   offer the plan at the first GitHub connection, which makes the daemon do
   the access check, or show the defaults only as suggestions. I lean to
   suggestions: it keeps ADR 0030's rule that inaccessible defaults never
   enter the person's UID, at the cost of one click per repository.
4. **OIDC session lifetime** shorter than GitHub's (per-source
   `max_session_days`).
5. **Linking** behind a root switch, from the person's own session only, in
   stage 4.
6. **China** through Casdoor or Authing, with no vendor adapters in the
   gateway.

## Sources

Standards

- [S1] OpenID Connect Core 1.0 (sub uniqueness §2, ID token validation
  §3.1.3.7, nonce §3.1.2.1, stable identifier §5.7, userinfo `sub` §5.3.2):
  https://openid.net/specs/openid-connect-core-1_0.html
- [S2] RFC 9700, Best Current Practice for OAuth 2.0 Security (PKCE; mix-up
  defence §4.4): https://www.rfc-editor.org/rfc/rfc9700
- [S3] RFC 9207, OAuth 2.0 Authorization Server Issuer Identification:
  https://www.rfc-editor.org/rfc/rfc9207
- [S4] OpenID Connect Back-Channel Logout 1.0:
  https://openid.net/specs/openid-connect-backchannel-1_0.html
- OpenID Connect Discovery 1.0 (issuer must match):
  https://openid.net/specs/openid-connect-discovery-1_0.html

Providers

- [P1] Microsoft, ID token claims reference (sub pairwise, oid, email
  mutable, groups overage at 200):
  https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference
- [P2] Google, OpenID Connect (use `sub`, `email_verified`, `hd` claim versus
  parameter): https://developers.google.com/identity/openid-connect/openid-connect
- [P3] Descope, nOAuth disclosure: https://www.descope.com/noauth
- [P4] Semperis, nOAuth abuse in Entra cross-tenant SaaS apps (2025):
  https://www.semperis.com/blog/noauth-abuse-alert-full-account-takeover/ ;
  SecurityWeek follow-up:
  https://www.securityweek.com/thousands-of-saas-apps-could-still-be-susceptible-to-noauth/
- [P5] authentik OAuth2 provider and property mappings (groups in `profile`,
  include claims in id_token):
  https://docs.goauthentik.io/add-secure-apps/providers/oauth2/ ,
  https://docs.goauthentik.io/add-secure-apps/providers/property-mappings/ ;
  Subject mode default and behavior described in
  https://github.com/goauthentik/authentik/discussions/14857
- [P6] Microsoft, optional claims reference (`xms_edov`):
  https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims-reference ;
  migrating off email claim authorization:
  https://learn.microsoft.com/en-us/entra/identity-platform/migrate-off-email-claim-authorization
- [P7] Keycloak Authorization Services Guide (group claim paths):
  https://www.keycloak.org/docs/latest/authorization_services/index.html ;
  group membership mapper configuration:
  https://registry.terraform.io/providers/medarion/keycloak/latest/docs/resources/openid_group_membership_protocol_mapper
- Discovery documents fetched 28.11.2026:
  https://accounts.google.com/.well-known/openid-configuration (S256 listed)
  and https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration
  (issuer template `{tenantid}`, no `code_challenge_methods_supported`).

China

- [C1] Feishu Open Platform, "Get user_access_token" (OIDC-named endpoint
  that returns a user access token):
  https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/authen-v1/oidc-access_token/create
- [C2] open-webui discussion on Feishu/Lark login (OAuth2 only, no OIDC
  provider URL): https://github.com/open-webui/open-webui/discussions/10385 ;
  bridge implementations: https://github.com/XmmShp/oidc-bridge ,
  https://github.com/BrandonStudio/Feishu-OIDC-Workers
- [C3] DingTalk web login flow (community write-up and OIDC wrapper):
  https://izpc.org/2024/04/10/authentik-use-dingtalk-login/ ,
  https://github.com/suzuran-workshop/oidc-dingtalk
- [C4] WeCom web authorization differs from OAuth2 (no ID token, no PKCE or
  nonce): https://github.com/zibyn/polaris/issues/170 ,
  https://zhuanlan.zhihu.com/p/527107950
- [C5] Casdoor OAuth providers (DingTalk, WeCom, Lark) and DingTalk
  provider: https://casdoor.ai/docs/provider/oauth/overview/ ,
  https://casdoor.org/docs/provider/oauth/DingTalk/ ,
  https://casdoor.ai/blog/dingtalk-wecom-lark-login/
- [C6] Authing (hosted identity platform with Chinese enterprise IdPs):
  https://www.authing.cn/

Libraries

- [L1] coreos/go-oidc v3: https://github.com/coreos/go-oidc
