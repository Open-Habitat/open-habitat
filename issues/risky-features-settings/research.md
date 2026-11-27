# Research: which capabilities belong in a "risky features" Settings section

Research worker report for `risky-features-settings`. Proposals only: each
recommended member is discussed with Jari separately.

## Yhteenveto Jarille

**Periaate.** Vaaralliset toiminnot -osioon kuuluu kyky, joka avaa
*pysyvän* reitin: kun se on päällä, jokin muu kuin henkilön oma harkittu
teko (vieras linkki, verkkosivu, toinen ihminen, ajastus) voi saada hänen
agenttinsa toimimaan hänen tunnuksillaan tai viedä jotain ulos, eikä
henkilö pysty käyttöhetkellä arvioimaan riskiä. Jos kyvyllä on jo oma
luonnollinen suostumushetki, jossa riski näkyy (näkymän julkaisu, oman
koneen pääsyn velho, integraation taso, monen pelaajan kutsu), se *ei*
kuulu osioon, koska kytkin olisi toinen varoitus samasta asiasta ja
opettaisi kuittaamaan lukematta. Kytkin on henkilökohtainen, oletuksena
pois, ja vain henkilö itse voi kääntää sen selaimessa (agentti ei voi
`open-habitat agent` -komennolla, muuten agenttiin päässyt ohje voisi avata
reitin itselleen). Ylläpitäjä voi tehdä toiminnon palvelimella
saatavuttomaksi mutta ei koskaan kytkeä sitä kenenkään puolesta päälle.
Kokeellisuus on eri akseli (kypsyys); riskinen ominaisuus valmistuessaan
siirtyy tähän osioon pois päältä, ei oletuksena päälle.

**Suositellut ensimmäiset jäsenet.**

1. `conversation-links-prefilled-draft`: linkit, jotka avaavat keskustelun
   valmiilla viestillä (sovittu ensimmäinen jäsen).
2. Oma palvelinselain (`remote-browser`) sen valmistuessa: agentti toimii
   kaikilla selaimen kirjautumisilla, ja verkkosivun teksti voi ohjata sitä.
3. GitHub Actions -työnkulkujen lupa: on jo olemassa varoituksellisena
   kytkimenä GitHub-kortilla; osio voisi listata sen ja viitata korttiin
   (päätetään prototyypissä, siirretäänkö).
4. Mahdollinen myöhempi: ajastetut agenttiajot (`scheduled-agent-runs`),
   jos agentti saa luoda toistuvia ajoja itse; ja mikä tahansa tuleva
   "älä kysy lupaa" -oikotie yhdistettyjen tilien kirjoituksiin.

**Tietoisesti ulkopuolelle.** Julkiset näkymälinkit, omat koneet,
integraatioiden tasot (postin lähetys), monen pelaajan kutsu ja täydet
oikeudet, Palaa tähän, omat API-avaimet ja Brave-avain (niillä on oma
suostumushetkensä tai kulut ovat henkilön tiedossa); ajastettu herätys,
agenttien väliset viestit ja Taskfleet-työntekijät (henkilön omien
keskustelujen sisällä); projektin luottamus `~/src`-hakemistossa (agentti
ajaa jo repon koodia, varoitus ei lisäisi mitään); kaikki ylläpitäjän
asetukset (OIDC, palvelimen AI-avain, kirjautumiskuori, palveluntarjoajien
saatavuus); äänet, teema ja muut, joissa riskiä ei ole.

**Avoin kysymys Jarille.** Jos linkit tulevat ensin kokeellisina, onko
niiden kytkin silloin Kokeellisissa (riskiteksti "Edellyttää"-kohdassa) ja
siirtyy Vaarallisiin valmistuessaan, vai onko niillä alusta asti kytkin
Vaarallisissa? Suositus: yksi ominaisuus, yksi kytkin; jos linkit eivät ole
kokeellisia, kytkin on Vaarallisissa ensimmäisestä päivästä.

## 1. Membership principle

### What the section is for

A switch in this section earns its place when **all** of the following hold:

1. **Standing exposure, not a single act.** Once on, it opens a route that
   stays open: something other than the person's own considered action can
   reach their agent, credentials or data, or send things outward, *later*,
   at moments when the person cannot judge the risk. The prefilled-draft link
   is the type case: whoever can put a link in front of the person (a chat
   message, a mail) can put text into their composer, and at click time the
   person cannot tell a genuine automation link from a crafted one (the round
   1 result already treats `from` as a claim, not a sender:
   `issues/conversation-links-prefilled-draft/result.md`).
2. **No natural consent point already exists.** If the capability is used
   through an explicit act whose UI states the risk at that moment (publish
   this view, grant this machine, connect this account at this level, invite
   this person), the act *is* the consent. A second switch in Settings would be
   a duplicate warning, and duplicate warnings are what people learn to click
   through.
3. **The warning changes behaviour.** Most people do not need the
   capability, so "off unless you know you want it" is the right default and
   a concrete one-time warning ("anyone who can send you a link can prepare a
   message to your agent") lets the minority decide knowingly. If nearly
   everyone needs it (code-host push, an AI subscription), it is not risky in
   this sense but simply the product, and a warning would be noise.
4. **The risk is borne mainly by the person or by people who trust them.**
   Risk to the server or to other people on it (capacity, shared keys, legal
   terms of a shared subscription, the site's access pin) is the
   administrator's to accept, so those capabilities belong behind a site
   setting, not a personal switch. A capability can have both: the
   administrator makes it available, the person switches it on.

### Rules for every member

- **Per person, default off.** Stored with the account like the
  experimental choices (`internal/experimental/catalog.json`: "Valinnat
  tallentuvat tilillesi ja koskevat kaikkia laitteitasi").
- **Only the person turns it on, in the browser.** Today the agent can change
  many of the person's settings through `open-habitat agent …`
  (`agent experimental update`, `agent credential update`, `agent code-host
  create`; `internal/cli/*.go`). A risky switch must be readable but not
  writable from the agent CLI, as view publication already is ("publication
  is theirs alone to change", `internal/cli/agent/SKILL.md`). Otherwise an
  instruction that reached the agent could open the route for itself. The
  same holds for the GitHub workflow permission, which needs a browser
  sign-in at GitHub.
- **Administrator may forbid, never enable.** A site switch makes the
  feature unavailable on this server; turning it off pauses what people had
  on, as removing `views.link_max_days` pauses publications
  (`docs/operations.md`, views). The administrator cannot switch it on for a
  person: the risk is the person's to accept. Whether the administrator sees
  who has a switch on is a separate question; nothing in the current admin
  pages lists personal preferences, and I would not add it without a reason.
- **Off is immediate and complete.** Switching off closes the route at once
  (an opened link after switch-off behaves as if the feature did not exist,
  with the draft still recoverable, not silently dropped).
- **The switch does not replace in-context signals.** The link draft's marker
  (round 1 direction A: *Viesti linkistä · linkin mukaan x · Mitään ei ole
  lähetetty*) stays; the switch decides whether the route exists, the marker
  says where a particular message came from.
- **Warning text is concrete**: who can reach what, what it can cause, how to
  close it. The experimental catalog's *Edellyttää* texts are good examples
  of the tone (`remote-browser`: "Agentti toimii selaimessa sinun
  tunnuksillasi: se saa käyttää kaikkea, mihin selain on kirjautunut").

### Relation to the other axes

| Axis | Question it answers | Where |
|---|---|---|
| Default-on | Needed by most, risk visible in use | the feature's own place |
| Per-act consent | Risk arises at one explicit act | the act's own dialog or card |
| Risky features | Standing route, no good consent moment, most people do not need it | this section |
| Administrator setting | Risk to the server, other people, shared keys or terms | Settings › Palvelin… |
| Experimental | Maturity: may change or disappear | Settings › Kokeelliset ominaisuudet |

Experimental and risky are orthogonal. A feature has one switch. While it is
experimental the switch lives in Experimental and its risk is stated in
*Edellyttää*; graduating a risky feature moves its switch to Risky (off)
rather than making it default-on. A risky feature that lands without an
experimental phase has its switch in Risky from day one.

## 2. Inventory

Sources: `docs/operations.md`, `docs/product.md`, `web/src/text/*`
(especially `settingsIndex.ts`, `codeHosts.ts`, `agentResources.tsx`,
`multiplayer.ts`, `offerCard.ts`, `shares.ts`, `permissionQuestion.ts`),
`internal/experimental/catalog.json`, `internal/cli/agent/SKILL.md`,
`internal/cli/*.go`, `internal/daemon/project_trust_linux.go`,
`internal/egress/egress.go`, and `issues/*/item.md`.

Verdicts: **belongs**, **maybe**, **no**.

### Existing capabilities

| Capability | Risk | Who bears it | Current gating | Verdict |
|---|---|---|---|---|
| Conversation links with prefilled draft (`conversation-links-prefilled-draft`, planned) | Anyone who can show the person a link can prepare a message to their agent; one press of Send runs it with all the person's tools. Social engineering, prompt injection with a human click. | Person (and whatever their agent can reach) | None yet; round 1 adds marker, no auto-send, `from` shown as a claim | **Belongs** (agreed first member). Standing route from outside, no meaningful click-time judgement, most people will not use it. |
| Own server browser (`remote-browser`, experimental) | Agent acts with every signed-in session in the browser; page content can steer the agent (indirect prompt injection). | Person, and whoever the person's signed-in accounts touch | Experimental switch; server must have TigerVNC + Chrome (installed everywhere, `docs/operations.md`) | **Belongs on graduation.** Standing exposure to web content with logged-in credentials; the classic case comparables gate (Claude in Chrome, ChatGPT agent). |
| GitHub Actions workflow permission (`workflow` scope) | Agents can change workflows, and workflows read repository secrets. | Person and repository collaborators (secrets) | Per-person opt-in on the GitHub card with warning, default *Ei sallittu* (`codeHosts.ts` wf*) | **Belongs in shape** (standing, risky, rarely needed, warning helps). Already exists where its sign-in happens; the prototype decides whether the section lists it and links to the card or the switch moves. |
| Public view and file-offer links | Anyone with the address opens the content, past the site's access pin. | Person (data), site (traffic, bounded) | Administrator enables (`views.link_max_days`); person flips the globe per item; admin lists and deletes addresses | **No.** Every publication is an explicit act with a clear card state (*Julkinen … asti*); two-level gating already right. |
| Own machines (Tailscale + SSH grant) | Agent runs anything the user can on the person's machine without per-command approval; root on the server can use the grant. | Person; their machine | Multi-step wizard that states the root caveat before saving; per machine, revocable on the machine (`docs/operations.md` Own machines) | **No.** Per-grant consent with the strongest warning in the product; a switch would duplicate it. |
| Machines from `~/.ssh/config` (experimental) | Read-only listing; Habitat never writes the file. | Person | Experimental switch | **No.** No new reach. |
| Integration levels (Microsoft *Täysi* incl. `Mail.Send`, Google *Täysi*, Dropbox full) | Agent sends mail, creates sharing links, sends invitations in the person's name. | Person and recipients | Person chooses level per account at connect; *Vaihda taso…*; administrator registers the level's app; agent asks permission before account-changing calls (`permissionQuestion.ts`) | **No.** The level picker is the consent point and is per account; splitting it into a Settings switch would duplicate it. |
| Permission question on account-changing calls (*Salli kaikki* per run) | — (it is a safeguard) | — | Always on; *Salli kaikki* lasts one run | **No** as it is. A future "never ask on this account" shortcut would **belong**. |
| Multiplayer (invite, *Täydet oikeudet*) | Another person's messages drive the owner's agent with the owner's tools, model and credentials. | Owner; subscription terms (`multiplayer-own-conversation-kind`) | Experimental; per-invite; full rights behind a confirmation naming what is lent | **No** (maybe for the server). Each exposure is an explicit invite or confirmation. The subscription-terms risk is the administrator's and the design's (`multiplayer-own-conversation-kind`: API-key model only), not a personal switch. |
| Agent-to-agent messages | An instruction in one conversation propagates to another. | Person | Only between the person's own conversations; always labelled with the sender | **No.** Stays inside the person's own work; labelling handles provenance. |
| Scheduled wake (`agent wake create`) | Agent gets a turn later without the person present. | Person (quota) | Agent sets it on the person's request; one-shot; visible in the conversation | **No.** One-shot, visible, inside one conversation. |
| Taskfleet workers | Autonomous agents in worktrees with the person's authority. | Person | Same authority as a conversation | **No.** No new reach beyond the conversation that started them. |
| Project trust auto-`--approve` below `~/src` (`project_trust_linux.go`) | A cloned repository's `.pi/` extensions and skills load without a prompt. | Person | Automatic; a saved "do not trust" is honoured | **No.** Decided: the agent already runs the repository's code, so Pi's trust does not limit tools; a warning would protect nothing. |
| Code hosts with write tokens (GitHub, Gitea, GitLab) | Agents push, comment, open PRs in the person's name. | Person, collaborators | Person connects; resources panel says what agents can do (`agentResources.tsx`) | **No.** Core use; nearly everyone needs it. |
| Own API keys / AI subscriptions | Spend money; terms of a personal subscription. | Person | Person enters key or signs in | **No.** Cost is the person's own, known at entry. |
| Web search key (Brave), dictation key (Soniox) | Queries or audio go to a third party; cost. | Person | Person enters key, or administrator's shared key | **No.** Same as API keys. |
| Rewind with files (`rewind-conversation`) | Overwrites later changes, including the person's. | Person | Experimental; confirmation per use; current content saved first | **No.** Per-act, reversible. |
| Trash, workspace/conversation deletion | Data loss. | Person | Per-act confirmations; trash | **No.** Per-act, reversible. |
| Sign in on a phone (device link) | Code could be shoulder-surfed. | Person | Short-lived code | **No.** |
| Sounds, theme, language, editor, recap, rail motion | None meaningful | — | Ordinary settings | **No.** |
| Site AI key, shared Brave/Soniox keys, server integrations, onboarding, people, limits | Cost and capacity for the site | Administrator | Administrator settings | **No.** Administrator axis. |
| SSH login shell (`identities.login_shell`) | Shell access to the Unix account | Site | Site configuration by root | **No.** Administrator axis. |

### Planned and untriaged

| Issue | Risk | Who bears it | Verdict |
|---|---|---|---|
| `scheduled-agent-runs` (untriaged) | Unattended recurring turns: spend quota or money, act outward with nobody watching, pile up capacity. | Person; server capacity | **Maybe.** If a person creates each schedule explicitly in the UI, that is per-act consent. If agents may create recurring runs themselves (like wakes), "agents may set recurring runs that act without you" belongs, and the administrator needs a site switch for capacity. |
| `oidc-sign-in` | Who may sign in | Site | **No.** Administrator. |
| `ai-provider-registry` (China endpoints) | Conversation content goes to a provider in another jurisdiction | Person, organisation | **No.** The model picker shows the provider; availability per site is the administrator's. |
| `multiplayer-own-conversation-kind` | As multiplayer above | Owner, terms | **No.** Starting a multiplayer conversation is the consent point. |
| `m365-teams-messages`, `m365-pin-folders`, `apple-notes-reminders` | More read reach / local copies | Person | **No.** Covered by the integration's level or own-machine grant. |
| `native-app-notifications` (deferred) | Notification text passes through Apple/Google push | Person | **No.** Solved by keeping content out of the payload, not by a warning. |
| `worker-asks-parent` | — | — | **No.** Internal flow. |
| `admin-onboarding-note-questions` | — | — | **No.** |
| Hypothetical: links that auto-send, inbound webhooks or mail that start a turn | Outside text runs without a human press | Person | **Belongs, and needs its own decision.** Round 1 deliberately excludes auto-send; any such trigger is a stronger member than the draft link, not part of it. |

## 3. Comparables

- **Browser site permissions** (Chrome, Firefox). Powerful capabilities
  (camera, microphone, location, notifications, pop-ups) are per site,
  asked at the moment the site requests them, and listed afterwards in one
  place where they can be revoked. Lesson: the in-context prompt does the
  work; the central page is an overview and revocation point. Notification
  prompts became the textbook case of prompt fatigue, which is why Chrome
  added quieter prompts. https://support.google.com/chrome/answer/114662
- **GitHub "Danger Zone".** Irreversible or exposure-changing repository
  actions (visibility, transfer, archive, delete) are grouped at the bottom
  of Settings, styled red, and need typing the repository name; an
  organisation owner can forbid members from changing visibility. Lesson:
  grouping plus friction for rare acts, and an administrator who can forbid
  but not perform on someone's behalf.
  https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility
- **ChatGPT Developer mode.** Full MCP read/write connectors sit behind an
  opt-in in Settings › Apps › Advanced, described as "powerful but
  dangerous", naming prompt injection and destructive write actions; write
  calls still need per-call confirmation, and workspace admins control
  availability. Closest analogue to our principle: a standing route switched
  on once by the person, plus in-context confirmation.
  https://www.theregister.com/2025/09/15/full_mcp_support_in_beta_chatgpt/
- **Claude in Chrome.** Per-site permissions and a mode choice (manually
  approve vs. automatic with a safety classifier); some actions (purchases,
  account creation) are always blocked whatever the setting. Lesson: some
  things should stay impossible rather than become a switch.
  https://support.claude.com/en/articles/12902446-claude-in-chrome-permissions-guide
- **VS Code Workspace Trust.** An unfamiliar folder opens in Restricted Mode
  (no tasks, debugging, workspace settings, agents) until the person trusts
  it; trust is per folder and a parent folder can be trusted once. Lesson:
  Open Habitat chose the opposite for `~/src` because the agent already runs
  code there; VS Code's own docs admit trust does not stop a malicious
  extension, the same reasoning applied the other way.
  https://code.visualstudio.com/docs/editing/workspaces/workspace-trust

Common pattern: the risky capability is off by default, switched on by the
person once with a concrete warning, still confirmed or marked in context,
revocable from one place, and forbiddable by an organisation administrator.
None of the comparables lets the automation itself turn the switch on.
