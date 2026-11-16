# Personal Google accounts: External OAuth without scope verification

## Saatesanat

Henkilökohtaisen Gmail-tilin voi yhdistää julkaistuun External-sovellukseen ilman Googlen scope-vahvistusta pienessä, rajatussa käytössä. Julkaiseminen ja Googlen vahvistus ovat eri asioita. Tämä ei ole yleinen lupa julkaista vahvistamatonta palvelua kenelle tahansa: Google erottaa henkilökohtaisen ja kehityskäytön julkisesta jakelusta. [S1, S2]

Keskeiset käytännön erot ovat varoitus ennen lupien myöntämistä ja projektin elinkaaren mittainen 100 uuden käyttäjän raja. Raja ei tarkoita sataa yhtäaikaista yhteyttä. Testing-tilan seitsemän päivän vanheneminen ei koske samalla tavalla tuotannossa annettuja refresh tokeneita; yhteys voi silti katketa esimerkiksi luvan perumisen tai Gmail-salasanan vaihdon vuoksi. [S3, S4]

Habitatin Google-kirjautumiskoodista ei löytynyt henkilökohtaisia tilejä estävää organisaatiorajausta. Muutos kohdistuu ensisijaisesti ylläpitäjän ohjeeseen ja henkilön opastukseen. Varoitusta ei pidä kuitata merkityksettömäksi: henkilön on tunnistettava palvelin ja sen ylläpitäjä. Työtilin ylläpitäjän estoa ei voi ohittaa samalla tavalla kuin vahvistamattoman sovelluksen varoitusta. [Repository inspection below; S5]

Kaksi asiaa jää aidosti varmistettavaksi: säilyvätkö jo annetut tokenit juuri Internal → External -vaihdossa, ja mitkä ovat Googlen tämänhetkiset suomenkieliset varoitustekstit. Dokumentaatio ei anna ensimmäiseen nimenomaista takuuta, eikä jälkimmäisestä löytynyt suomenkielistä ensisijaista lähdettä. Prototyypissä nämä eivät saa muuttua varmoiksi lupauksiksi. Myös tietosuojaseloste kuuluu käyttöönottoon, vaikka sovellusta ei lähetettäisi scope-vahvistukseen. [S4, S9, S10]

## Scope and evidence

Researched **2026-11-16**. Repository baseline: `a0a69ef5d8a9216bf333970d6b3d2cf7479e00e4`. This is documentation research and source inspection, not a live Google Console migration or OAuth test. No product code, Cloud project, credentials or deployed installation was changed. All external sources below are Google's own documentation; no forum answers are used.

“Confirmed” means stated in the cited documentation, not observed in a signed-in account. “Inference” and “unconfirmed” distinguish recommendations and remaining evidence gaps. Google updates pages independently; a current page can still contain an old screenshot.

## 1. Published External, unverified: limits and consent

### Audience, cap and publication

**Confirmed:** External accepts Google Accounts outside the owning organisation, including personal accounts. `Publish app` changes the publishing status to **In production**; this is not approval of the brand or requested scopes. For unapproved sensitive/restricted scopes, the usual cap is **100 new users in total, over the project's lifetime**. It cannot be reset by removing connections or rotating clients. It is project-wide, not per OAuth client, per month or a concurrent-session quota. Google notes that quotas can be adjusted for particular apps. Check usage in Google Auth Platform › Audience / OAuth user cap. [S3, S6]

The Testing list is a different concept: at most 100 named test users, with seven-day authorizations for these scopes. Publishing does not mean adding everyone as a tester. Personal-use exceptions cover a small known user group; the cap is not a compliance safe harbour for any public service with fewer than 100 customers. Keep development and production projects separate. [S1, S2, S3, S17]

### What the person sees

**Confirmed English labels:** Google's documentation contains two warning headings:

- “Google hasn't verified this app” [S7].
- “This app isn't verified” [S8], also present in the older mobile screenshot linked from the unverified-app help page [S6].

The documented route is **Advanced → Go to {Project Name} (unsafe)**. It leads onward to permission consent, not directly to a connected Habitat account. Proceed only when the person recognises and trusts this particular installation; keep cancellation available. This route is not a workaround for an organisation block, exhausted cap or other access denial. [S7, S8, S5]

**Not confirmed:** a single exact, complete current warning paragraph for Habitat's Desktop client; the current Finnish heading and button labels; exactly which identifier replaces the project-name placeholder for an unverified Desktop client. The Finnish help URL explicitly falls back to English. Do not present a translated guess as a Google UI quotation. Current branding documentation says an unverified brand does not display its configured name/logo, so do not promise the continuation link will literally say “Open Habitat.” [S9, S10]

Recommended prototype treatment: Finnish explanation in Habitat, with the documented English navigation labels as an example and the variable app identifier clearly marked. Validate the actual Finnish labels later with a consenting test account; do not commit a real account's screen capture.

### Token lifetime and other limits

**Confirmed:** External Testing tokens for the requested services expire after seven days. Production has no equivalent documented fixed seven-day expiry; this is **not** a permanent-token guarantee. Revocation, six months without token use, password changes affecting Gmail-scoped tokens, live-token limits, time-limited authorization and administrator restrictions can invalidate refresh tokens. There is a **100-refresh-token limit per Google Account per OAuth client ID**: issuing another invalidates the oldest without warning. A larger aggregate account-wide limit across clients exists, but Google does not publish its number. This is independent of the 100-user project cap. [S4]

A separate new-user authorization **rate** limit depends on app history and risk; no universal numeric rate is documented. It can produce `403 rate_limit_exceeded`, independently of the lifetime cap. Advanced Protection and Workspace policy can also prevent authorization. API-specific quotas still apply. [S11, S3]

## 2. Workspace administrator control

**Confirmed:** administrators can block even verified apps, restrict services/scopes, or disallow unconfigured third-party apps. Thus External does not guarantee access for a work account. The documented setup path is:

1. Admin console › **Security › Access and data control › API controls**.
2. **Manage App Access › Configure new app**.
3. Search using the **exact OAuth client ID**, select the matching app.
4. Choose the organisation or organisational units.
5. **Continue › Trusted › Continue**, review, then **Finish**.

The administrator needs the Service Settings privilege. `Trusted` permits requested restricted services; it is broad, not Google's verification approval. `Specific Google data` is a narrower alternative if the organisation wants to limit scopes. Changes may take up to 24 hours. Blocking previously available services can revoke tokens. [S5]

**Does trust remove the warning?** The current state overview says a Trusted external app is treated as internal for that organisation, overriding some limits, explicitly including Testing's cap and seven-day expiry. This supports expecting the unverified interstitial to be suppressed for covered users, but the consulted pages do **not explicitly guarantee that exact screen disappears**. Treat suppression as an inference to validate, not a UI promise. Separately, the native-app guide explicitly says Trusted apps bypass **granular permission consent** and receive all requested scopes or none; that is not the same screen. Trust never changes the experience for unrelated personal Gmail accounts. [S12, S13]

Source caveat: the Workspace article “Authorize unverified third-party apps” describes a Gmail-specific restriction above 100 users. Do not generalise its statement about other services to the OAuth-wide cap: the Cloud Audience documentation expressly covers both sensitive and restricted scopes. [S14, S3]

## 3. Changing an existing project Internal → External

**Confirmed:** Internal requires a Cloud organisation; users outside it receive `org_internal`. External admits the wider Google-account audience, subject to publication, verification and admin policy. A return to Internal is possible for an eligible organisation-owned project: Google's cancellation guide explicitly describes External → Internal and switching back. This is not an irreversible conversion. Returning to Internal excludes personal accounts from new authorization. [S3, S15]

**Unconfirmed:** Google does not explicitly document, in the consulted audience/token/change pages, whether every existing Internal refresh token survives this transition unchanged, whether old grants are counted retroactively, or whether an intermediate Testing state affects them. Nor is there a documented guarantee that switching back revokes every previously issued external token immediately. Absence from a revocation list is not proof of survival. [S3, S4, S15]

**Recommendation, not a migration guarantee:** retain the same project and client, scopes and credentials. Do not disconnect everyone or manufacture new clients as part of the audience change. Explicitly check the final publication status. Verify an existing connection's refresh and API read, then authorize a new personal account; re-consent only affected accounts if necessary. Issue a fresh grant after publication for a connection originally made in Testing: do not assume publication retroactively lengthens a token already issued with an expiry. These checks remain operator follow-up, not evidence from this run.

A user-requested Habitat reconnect already asks for consent. A level change separately revokes the old grant first; neither action should be confused with changing the Cloud project's audience (see repository map).

## 4. Would narrower scopes solve this?

| Scope choice | Classification / effect | Consequence for agents |
| --- | --- | --- |
| `gmail.modify` | Restricted | Current full mailbox read/change/draft/send capability; no immediate permanent deletion bypassing Trash. [S16] |
| `gmail.readonly` | **Still restricted** | Reading/search remains; no message changes or sending. Does not remove the cap/warning. [S16, S6] |
| `gmail.send` | Sensitive, not restricted | Send only; loses inbox reading/search and mailbox triage. Sensitive-scope warning/cap still applies if unapproved. [S16, S6] |
| `gmail.compose` | Restricted | Draft management also permits sending; not a no-send replacement. [S16] |
| `drive` / `drive.readonly` | Both restricted | Full Drive access versus reading/downloading; read-only is not a verification escape. [S18] |
| `drive.file` | Non-sensitive, per-file | New app-created files and files explicitly opened/shared with the app, not general access to an existing Drive. [S18] |
| `calendar`, `contacts` (and their read-only variants) | Treat as sensitive; confirm exact classification in Data Access | Read-only loses edits, invitations/contact changes. Google identifies calendar reading and contact writing as sensitive examples, but the public scope catalogue does not label every row; Console classification was not inspected. [S2, S19] |

**Inference for Habitat:** `drive.file` would require a different file-selection/authorization experience and capability reporting; replacing the string cannot preserve arbitrary existing My Drive tree sync or broad document discovery. Habitat's folder selection today limits local sync, not the OAuth grant. Retaining any restricted Gmail scope still leaves restricted-scope verification obligations; removing restricted scopes but retaining unapproved sensitive scopes still leaves warning/cap constraints. Narrowing is worthwhile for least privilege, not a drop-in solution to this issue. [S6, S18; repository map]

## 5. Branding, privacy and domain ownership

The External setup should collect **app name, monitored user-support email, developer contact email, homepage, privacy-policy URL, terms URL and authorized domains**. The support email must be the signed-in Google account or a group it manages. Google's branding page calls the app-domain links required for external production apps; register their domains first. Brand and scope approvals are separate. [S10] **Documentation discrepancy:** the production-policy guide calls terms of service optional. Supply them in the recommended setup, but do not claim every Console form requires them. [S17]

**Privacy policy: yes.** The API User Data Policy requires publication of a policy describing access, use, storage and sharing; listing its URL in OAuth configuration is required when publicly available. Verification exemptions do not waive data-policy obligations. In-product disclosure must match actual agent processing, storage and onward transfers, not merely assert that data “stays on the server.” [S20, S1]

**Domain verification: do not promise an exemption.** Google's production guidance requires owned domains and a public homepage; its verification procedure uses Search Console ownership. The documentation is less explicit about exactly which form saves/Publish operations reject missing verification for an exempt, unverified Desktop app. That console enforcement was not tested. The prudent guide is to supply and verify the operator's real website domain, not teach omission because a form might allow it. `localhost` is the native redirect, not a public website domain to verify. [S17, S6, S10]

## 6. AI-powered-agent client marking

**Confirmed:** the checkbox **Use this client for an AI-powered agent** is a self-declaration for agent actions/context retrieval. It grants no extra scopes or privileges and does **not** exempt External clients from consent or verification. Some Google MCP endpoints require this marking. Google requires separate clients for standard interactive API features and agent workflows when both are offered. Keep the marking in Habitat's guide; it is not a remedy for the cap or warning. The present integration uses native gog/rclone rather than establishing use of Google's remote MCP servers. [S21; repository map]

The marking is also not blanket approval for sending Google data to any model provider. Workspace data-use restrictions remain applicable, including restrictions on training generalised models. Whether a particular model/provider configuration satisfies those terms was not audited here. [S22]

## Repository map: what should change, and what should not

Source references are repository paths and symbols at the baseline above, not a new permanent description of the product.

- **`web/src/components/ServerIntegrations.tsx`, `googleSteps()`**: the `audience` step hardcodes `Audience = Internal` and only an app name. Add the two audience paths, External publication, brand/privacy preparation and an existing-project migration path. Keep Desktop app, API enablement and agent marking. The existing-credentials path also needs audience guidance: an already saved client does not establish that personal accounts work.
- **`web/src/text/serverIntegrations.tsx`**: revise `chooseProject`, `internal`, `audience` and add localized External/publication/limits/help text. The project need not belong to an organisation for personal-account use. Preserve the Internal option rather than replace it universally. This file contains Finnish and English wording (and existing language variants); keep variants consistent.
- **`docs/operations.md`, Google app registration / Google account levels**: replace the categorical claim that External production requires verification with the bounded exception and its limits. Distinguish Gmail/Drive restricted scopes from Calendar/Contacts, add admin trust and cautious migration checks, and document privacy/branding prerequisites. Retain the native callback and per-user credential ownership.
- **`internal/daemon/integrations/google_linux.go`, `StartLevelLogin`, `Wait`, `GoogleApp`**: no Internal setting, `hd` request/claim check or email-domain allowlist found. The request uses PKCE, state, offline access, consent and an optional login hint. `Wait` checks Google's verified email, syntactic address validity and an expected-account match, not organisation membership. `catalog_linux.go:ValidAddress` validates address shape. No daemon relaxation is needed for Gmail accounts.
- **Scopes and native stores**: `googleScopes`/`googleReadScopes`, `googleRules` and `Commit` carry the present service grants into gog/rclone. A scope redesign would need changes here; it is outside this audience-only task. Tokens remain under the person's Unix account. `endLevel` revokes for a level change, not for Cloud audience changes.
- **`web/src/components/Integrations.tsx`, `PasteStep`**: put Google-specific warning help before the person opens Google, and make it reachable while waiting to paste the return URL. `RedirectExpected` already explains the final localhost error page; distinguish that expected final page from Google's earlier warning or block. Do not put all help only in `FailedStep`: a block may leave the person on Google and never reach Habitat.
- **`web/src/text/integrations.tsx`**: extend the copy around `siteAsks`, `approveTab`, `pasteWhere`, `errorPageBody` with Google-specific, bilingual conditional help; preserve the scope-level and partial-grant explanations.
- **State limitation**: `GoogleApp` contains client ID/secret, not Google's audience, verification, cap or Workspace trust state. The person flow cannot infer these from an email suffix or from a configured client. Prototype conditional wording (“if Google shows…”) rather than a fake live status badge. No new configuration authority or contract is proposed by this report.

## Implications for the two prototype rounds

### Round 1 — administrator setup guide

Show these states, grounded in sections 1–6 rather than a single happy path:

1. **Choose audience**: organisation-only versus also personal accounts. Explain who is excluded, not just the Cloud labels.
2. **New project and existing client**: both reach the audience/publication instructions. Existing connections are not deliberately revoked; migration has an explicit verification checklist and no token-survival guarantee.
3. **External Testing / External In production / scope-unverified**: separate states; publishing is a Cloud action, not a Habitat credential-save side effect. Show the lifetime cap consequence and where the operator checks actual usage.
4. **Brand/privacy preparation**: operator-owned links and contacts, domain preparation, and a realistic preview that does not guarantee a verified app name/logo. Do not label optional verification as optional privacy.
5. **Workspace policy block**: exact-client-ID handoff to the organisation administrator; trust is not globally verified status.
6. **Ready for the person's test**: same Desktop client and APIs, both existing levels retained; test an existing connection and a new personal account. A saved credential is not a successful OAuth test.

### Round 2 — person's connect flow

1. **Before opening Google**: chosen account/permission level, what agents can do, and concise conditional warning help with an explicit choice to stop.
2. **Google warning encountered / no warning encountered**: neither should be treated as failure. Use the documented English navigation example, with Finnish explanatory prose; reserve final Finnish Google quotations for validation.
3. **Identity looks unfamiliar**: stop and ask the server administrator, rather than teaching indiscriminate bypass.
4. **Hard refusal**: separate organisation policy, Internal-only audience, Testing allowlist, exhausted project cap and rate-limit guidance. These are help states, not claims Habitat currently detects each provider error. Direct the person to the right administrator instead of repeatedly reconnecting.
5. **Return from Google**: preserve the expected localhost error-page explanation, complete-URL paste, cancellation and timeout. Never ask for a Google password or paste the return URL into a conversation.
6. **Full, partial, empty grant**: show actual connected services; no false claim that every user can deselect individual permissions (Trusted organisations can differ). Existing read-only/full levels stay intact. [S13]
7. **Reconnect / change level**: warning help remains available, but existing revoke-first level-change consequences are still explained. Publication itself is not sold as a permission-level change.

## Remaining verification and review

A later, explicitly authorised test should establish: current English/Finnish warning labels and identifier; fresh grant and refresh after publication; existing Internal token refresh after audience change; trust/no-trust Workspace behavior; and actual Cloud form requirements for an unverified Desktop client. Do not exhaust the real user cap to test it. Use synthetic prototype illustrations, not captures of personal installations.

Review level: source-grounded self-review, proportionate to a research-only diff. No sessions, contracts, daemon state or authorization boundary changed; an independent code review and product test suite would not establish the unresolved Google behavior. Validation commands and outcomes are recorded in `result.md`.

## Sources

All accessed 2026-11-16. URLs are retained so this working report remains usable outside the research session.

- **S1** — Verification exceptions: <https://support.google.com/cloud/answer/13464323?hl=en>
- **S2** — Sensitive-scope verification and personal-use exception: <https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification>
- **S3** — Audience, publication, Testing expiry and project-lifetime cap: <https://support.google.com/cloud/answer/15549945>
- **S4** — Refresh-token expiry and token-count limits: <https://developers.google.com/identity/protocols/oauth2#expiration>
- **S5** — Workspace API controls (Google's replacement for support.google.com/a/answer/7281227): <https://knowledge.workspace.google.com/admin/apps/control-which-apps-access-google-workspace-data?hl=en>
- **S6** — Unverified apps, warnings and verification procedure: <https://support.google.com/cloud/answer/7454865?hl=en>
- **S7** — English warning heading and continuation path (Device Access example, not a claim about its separate token rules): <https://developers.google.com/nest/device-access/reference/errors/authorization>
- **S8** — Alternate warning heading and continuation path: <https://developers.google.com/workspace/admin/directory/v1/guides/troubleshoot-authentication-authorization>
- **S9** — Finnish help request, English fallback: <https://support.google.com/cloud/answer/7454865?hl=fi>
- **S10** — Branding, domains, links and separate brand/scope status: <https://support.google.com/cloud/answer/15549049>
- **S11** — Authorization rate limits: <https://support.google.com/cloud/answer/9028764>
- **S12** — State overview and administrator overrides: <https://developers.google.com/identity/protocols/oauth2/production-readiness/overview>
- **S13** — Desktop OAuth, granted scopes and Trusted consent behavior: <https://developers.google.com/identity/protocols/oauth2/native-app?hl=en>
- **S14** — Workspace unverified-app restrictions: <https://knowledge.workspace.google.com/admin/apps/authorize-unverified-third-party-apps>
- **S15** — Audience changes and verification-request cancellation: <https://support.google.com/cloud/answer/16868008?hl=en>
- **S16** — Gmail scope classification and capabilities: <https://developers.google.com/workspace/gmail/api/auth/scopes>
- **S17** — Production policies, separate projects and owned domains: <https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance>
- **S18** — Drive scopes and per-file authorization: <https://developers.google.com/workspace/drive/api/guides/api-specific-auth>
- **S19** — Calendar/People scope catalogue and Console classification guidance: <https://developers.google.com/identity/protocols/oauth2/scopes>
- **S20** — API Services User Data Policy, privacy disclosure: <https://developers.google.com/terms/api-services-user-data-policy>
- **S21** — AI-agent client designation: <https://support.google.com/cloud/answer/15549257?hl=en>
- **S22** — Verification FAQ, project cap and AI/ML data-use discussion: <https://support.google.com/cloud/answer/13463817?hl=en>
