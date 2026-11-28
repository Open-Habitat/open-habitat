# Apple Notes and Reminders for agents

Research report, 28 November 2026. It replaces the desk research of 23 November
(`scripts/from-history.sh issues/apple-notes-reminders/research.md` shows that
version) and folds in what the trial ([trial.md](trial.md), 23 November) and the
attended session (24 November, recorded in [item.md](item.md)) showed on a real Mac.
It changes no product code.

## Tiivistelmä Jarille

**Kyllä, mutta vain ihmisen oman Macin kautta, ja nyt tiedämme tarkalleen miten.**
iCloudissa ei ole julkista rajapintaa Muistiinpanoille eikä nykyisille Muistutuksille.
Notes on Applen omassa CloudKit-säiliössä, johon kolmannella osapuolella ei ole pääsyä,
ja Muistutukset eivät enää näy CalDAVin kautta. Kaikki Macittomat reitit ovat
epävirallisia (iCloud.comin selainautomaatio) tai rajattuja (iPhonen Pikakomennot).

Kokeilu Macilla ratkaisi tärkeimmän tuntemattoman. Kun agentti ajaa komennon Macilla
SSH:n kautta, macOS pitää lupapyynnön vastuullisena **SSH-palvelinta
(`sshd-keygen-wrapper`)**, ei työkalua. Siitä seuraa kolme asiaa:

- **Muistiinpanot ja perusmuistutukset toimivat SSH:n yli AppleScriptillä**, kun
  ihminen on kerran sallinut kaksi macOS-ikkunaa ("sshd-keygen-wrapper haluaa ohjata
  Muistiinpanoja / Muistutuksia"). Kokeilussa luotiin kansio ja muistiinpanoja, luettiin
  ne HTML:nä, tekstinä ja Markdownina, haettiin otsikolla ja sisällöllä, luotiin lista
  ja päiväkohtaisia sekä kellonaikaan sidottuja muistutuksia ja merkittiin yksi tehdyksi.
- **Toistuvia muistutuksia ei saa SSH:n yli.** AppleScript ei tunne toistoa, ja EventKit
  (remindctl) ei voi saada lupaa SSH-polulla lainkaan: macOS kieltää sen ilman ikkunaa.
  remindctl toimi täydellisesti (toisto, hälytykset, aikavyöhykkeet), kun se ajettiin
  ihmisen omassa työpöytäistunnossa avatussa Terminalissa.
- **Lupa kuuluu kaikelle, mikä tulee SSH:n kautta tällä käyttäjällä**, ei yhdelle
  työkalulle. Se on sama tilitason luottamus, jonka hyväksyit Omille koneille 23.11.

**Suositus:** tehdään ensin pelkkä agenttiohje ilman uutta komponenttia:
Muistiinpanot luku ja uudet tekstimuistiinpanot, Muistutukset ilman toistoa,
AppleScriptillä Omien koneiden SSH-yhteyden yli, ja agentti kertoo ihmiselle etukäteen,
mikä ikkuna Macille ilmestyy. Toisto ja muut EventKit-ominaisuudet vaativat Macin
työpöytäistuntoon jotain, joka omistaa luvan (pieni apuohjelma). Se on uusi
komponentti ja arkkitehtuuripäätös, joten tehdään se vain, jos toistoa oikeasti
tarvitaan. Macitonta iCloud-selainautomaatiota en suosittele: se tarvitsee pysyvän
kirjautuneen selainistunnon, kaatuu Applen käyttöliittymämuutoksiin ja Advanced Data
Protection estää sen oletuksena.

**Mitä ihminen tekee:** Macin etäkirjautuminen ja Omat koneet -yhteys (jo olemassa),
Mac hereillä ja kirjautuneena, ja ensimmäisellä kerralla Macin ääressä kaksi Salli-
painallusta. Etäkäyttäjien täysi levyn käyttöoikeus pidetään pois päältä.

macOS 27 toi Applen oman MCP-tuen Pagesiin, Keynoteen ja Numbersiin, mutta ei
Muistiinpanoihin eikä Muistutuksiin. Jos Apple laajentaa sen niihin, asetelma muuttuu, ja
se kannattaa tarkistaa seuraavan macOS-julkaisun yhteydessä.

Päätettävät kysymykset ovat raportin lopussa.

## Evidence levels

Three kinds of evidence appear below, and each claim says which it rests on:

- **Trial (E1, E2):** observed on one desktop Mac running macOS 26.6.2, reached over
  the Omat koneet SSH path as the logged-in user, with synthetic objects only. E1 is
  the unattended trial (permission attribution, privacy daemon log), E2 the attended
  session after the person allowed the two Automation dialogs.
- **Upstream:** a tool's documentation, code, releases or issue tracker, checked on
  28 November 2026 through the GitHub API. Not reproduced by us unless E1/E2 says so.
- **Apple:** Apple's documentation, support articles and newsroom.

Not tested anywhere: macOS 27, a locked screen after consent was given, a logged-out
account, a Mac after restart, phone-side sync timing, and anything with Advanced Data
Protection turned on.

## 1. What iCloud offers without a Mac

| Surface | Status | Basis |
| --- | --- | --- |
| **Notes in iCloud** | No public API. Notes syncs through Apple's own CloudKit container. CloudKit's public SDK and CloudKit Web Services serve containers that a developer's own app is entitled to; there is no grant into Apple's Notes container. Unofficial clients reverse-engineer private endpoints with the full Apple ID session. | Apple [A6] |
| **Reminders over CalDAV** | Upgraded Reminders (iOS 13 / macOS 10.15 and later) need current Apple clients and iCloud.com. Apple does not document the protocol change, but tool authors report that CalDAV writes no longer reach the modern Reminders store. Habitat's Apple CalDAV integration must therefore not be described as covering Reminders. | Apple [A8], upstream [T7] |
| **iCloud.com web apps** | Notes and Reminders work in the browser. Automating that UI is possible (below, §6) but it is a signed-in browser session, not an API. | Apple [A7], upstream [T7] |
| **Apple MCP in macOS 27** | Apple added MCP support to Keynote, Pages and Numbers (macOS 27, announced October 2026). Notes and Reminders have none. These servers are local to the Mac, not iCloud services. | Apple [A15] |

**2FA and Advanced Data Protection.** Two-factor authentication does not affect the
Mac route: the agent never handles Apple credentials, and the Mac is already signed in.
For anything that logs in to iCloud from the server, 2FA means an interactive login and
periodic re-approval from a trusted device. With Advanced Data Protection, iCloud.com
access to Notes and Reminders is off by default; the person can turn web access on and
must then approve each web session from a trusted device. App-specific passwords cover
CalDAV, CardDAV and mail, not Notes or Reminders. Turning ADP off to make an integration
work is not something we should ever suggest. [A7, T7]

## 2. The person's Mac as the bridge

### The transport already exists

Omat koneet gives the person's Linux account SSH to an approved Mac account through the
account's own userspace Tailscale node. The SSH config files are the only machine list,
host keys are pinned, and the authorized-key line carries `restrict`, a `from=` tailnet
address and an optional expiry, but no forced command. So the agent can run anything
the Mac user can. [P1, P3]

```text
Habitat agent ── ssh <machine> ──▶ Mac user session ──▶ osascript ──▶ Notes / Reminders
                                                                      │
                                                                      ▼
                                                              normal iCloud sync
```

An MCP server on the Mac can be used the same way, launched over SSH with stdio
forwarded and no pseudo-terminal, or its AppleScript core can be driven directly. No
network listener, gateway route or new credential is involved.

### Who macOS thinks is asking (E1)

The privacy daemon (`tccd`) records an attribution chain for each request. For every
command that arrived over SSH, whether remindctl, `osascript` or `/bin/ls`, it was:

```text
responsible = com.apple.sshd-keygen-wrapper  (the launchd program of Remote Login)
accessing   = the tool binary
```

So privacy grants on the SSH path belong to the SSH server identity, shared by every
key, session and program that logs in as that user. Per mechanism:

| Mechanism | Over SSH | In the desktop session | Evidence |
| --- | --- | --- | --- |
| **Automation (AppleScript via `osascript`) → Notes** | One dialog naming sshd-keygen-wrapper; after Allow, works in every later SSH session. | Works. | E1 dialog raised, E2 functional |
| **Automation → Reminders** | Same; one separate dialog. | Works. | E1, E2 |
| **EventKit Reminders (remindctl and other EventKit tools)** | **Cannot be granted.** The daemon applies a no-prompt policy to the SSH server identity, answers *denied* in milliseconds, shows nothing and leaves nothing to switch on in System Settings. | Works after the app that launched it (e.g. Terminal) gets "full access to Reminders". | E1, E2, Apple [A1] |
| **Full Disk Access (Notes database, attachments)** | Only through the Remote Login switch "Allow full disk access for remote users", which covers Mail, Messages, Notes and everything else. Habitat's Mac steps tell people to keep it off. | Per app. | E1, Apple [A4, A5], P2 |
| **Shortcuts (`shortcuts run`)** | Not tested. Shortcuts actions run in a separate runner process, so attribution may differ from the table above. | Works (upstream). | Apple [A9], upstream [T3, T10] |
| **An app launched through LaunchServices (`open`)** | `open -a Terminal` over SSH worked, and the grant then went to Terminal, not SSH. This suggests a small app bundle launched with `open` could own its own grants. Not tested beyond Terminal. | — | E2 |

Calendar access for the SSH identity was already present on the trial Mac, origin
unknown (E1). It shows such a grant can exist, not that a person can create one today.

### What worked and how fast (E2)

- **Notes via apple-notes-mcp's AppleScript core** (version 2.16.11, run in process
  with its broker, helpers and Shortcuts bridges off): create a folder, create plain
  (Finnish characters), HTML and Markdown notes (Markdown routed through HTML on this
  build), list, read back as HTML, plain text and Markdown, search by title and by
  content, sync status. All succeeded; one transient "folder not found" right after
  folder creation.
- **Reminders via AppleScript:** create a list, an all-day and a timed reminder with a
  remind-me time, complete one, read dates back; about 7 seconds. The JXA (JavaScript
  for Automation) variant created reminders and then hung; plain AppleScript is the one
  to use.
- **remindctl from a desktop Terminal:** date-only, timed with alarm, weekly and
  every-3-days recurrence; JSON output under three time zones; completing a weekly
  reminder produced the next occurrence a week later; edits and clearing a due date.
  All-day reminders are stored at local midnight and keep their day.

### Locked, asleep, offline

First-time consent needs someone at an unlocked Mac: the trial's dialogs sat unanswered
behind a locked screen and the client hit the AppleEvent timeout (error -1712) (E1).
Whether automation keeps working on a locked screen once granted is expected but not
tested. A sleeping or powered-off Mac cannot answer; Apple's network-wake settings do
not make wake through a userspace Tailscale/SSH path dependable [A11]. Shortcuts does
not run while the Mac sleeps [T10].

The behaviour to aim for: fail promptly and say whether transport, consent or the app
failed; no local cache of notes and no queued writes; after a timeout read the target
back before retrying, because the Mac may have saved the change (apple-notes-mcp
enforces this with content hashes) [T3]; report "saved on the Mac" separately from
"seen on the phone".

## 3. Tools and MCP servers

Release dates are GitHub publication dates read from the API on 28 November 2026.

### Notes

| Tool | What it does | State | Judgment |
| --- | --- | --- | --- |
| **sweetrb/apple-notes-mcp** | Node stdio MCP. AppleScript core: folders (nested, per account), create/update/move/delete notes, read as HTML/plain/Markdown, search. Database reads with Full Disk Access add checklist state, tables, attachment export and fast content search. Optional Shortcuts bridges and an optional permission broker. | MIT; v2.16.11 (21 Nov 2026), dependency updates since. Open #337 (Markdown saved literally on macOS 26.6.2; worked around by routing through HTML) and #220 (FDA differs by launcher). | **Use its AppleScript core.** Verified for the approved scope in E2. Keep FDA, the private-framework helper and the broker off. [T3, T4] |
| **antoniorodr/memo** | Python CLI: browse, search, Markdown read, editor-based add/edit, export; Reminders view/complete. | Apache-2.0; v0.7.1 (26 Nov 2026). Open reports of link and style loss on edit. | Fine for reading; its interactive editor flow does not suit an agent writer. [T5] |
| **VladUZH/intents-mcp** | Wraps chosen App Intents (via signed Shortcuts) as MCP tools. `notes.create` only; actions on existing notes are not supported. | MIT; v0.1.6 (26 Sep 2026), young. | Worth watching as the "public APIs only" route; too narrow today. [T10] |

### Reminders

| Tool | What it does | State | Judgment |
| --- | --- | --- | --- |
| **AppleScript (no tool)** | Lists, titles, body, priority, completion, all-day and timed due dates, remind-me time. No recurrence, sections or tags. | Built in. | **First route over SSH.** E2. |
| **openclaw/remindctl** | Swift/EventKit CLI, macOS 14+: search, CRUD, lists, alarms, recurrence, JSON. Notarised releases with checksums and a signing manifest. | MIT; v0.3.9 (21 Oct 2026), main 21 Nov. Open #120: crash setting a due date when the macOS calendar is set to ISO 8601. | **Best EventKit CLI**, verified in E2 from a desktop Terminal. Over SSH it can only report "not determined". [T1] |
| **FradSer/mcp-server-apple-events** | Node MCP with a Swift EventKit CLI: Reminders and Calendar CRUD, lists, subtasks (stored in notes), tags. Recurrence, alarms and locations read-only. Times out headless calls rather than hanging. | MIT; v1.6.2 (22 Oct 2026). | Same SSH limit as any EventKit tool; recurrence is read-only, so it adds nothing over AppleScript for writing. [T9] |
| **keith/reminders-cli** | Swift/EventKit CLI; no released recurrence. | MIT; last release May 2024. | Superseded by remindctl. [T2] |

**supermemoryai/apple-mcp**, still linked from many lists, has been archived since
August 2025 [T6]. Roundups list twenty-odd further Apple MCP servers; most drive the
same AppleScript or EventKit underneath and meet the same permission rules [T11].

The SSH finding narrows tool choice more than features do. Any EventKit tool, whether a
CLI or an MCP server, needs a desktop-session owner for its grant. Any AppleScript tool
works over SSH after one dialog per app. Database-reading features need remote Full Disk
Access, which we keep off.

## 4. Security and consent

- **The authority is the existing account-wide SSH trust.** A Notes or Reminders
  Automation grant extends to every SSH login as that Mac user: every key, every program.
  A tool's folder filter, list allow-list or read-only mode guides normal use, but it
  is not a boundary against an agent that can run any command. Jari accepted this trust
  model on 23 November. An enforced per-folder, read-only or confirm-each-write grant
  would need a different design, such as a forced command or a broker with its own
  authentication, not just a tool flag.
- **The dialog names the SSH server, not Habitat or the tool.** Without guidance the
  person cannot tell what they are allowing. The agent should say beforehand which Mac,
  which app, that the dialog will say "sshd-keygen-wrapper", and that Allow applies to
  all SSH sessions as this user. Revocation: System Settings → Privacy & Security →
  Automation, and the Omat koneet page for the key. Removing the connection in Habitat
  alone does not remove the authorized-key line on the Mac. [P1, P2]
- **Remote Full Disk Access is the bigger risk.** If "Allow full disk access for remote
  users" is on, any SSH key that reaches the account can read the Notes, Reminders, Mail
  and Messages databases directly, with no dialog at all (E1). Habitat's Mac steps
  already say to keep it off [P2]; the agent should detect it and say so rather than
  depend on it.
- **Content leaves the Mac.** Whatever the agent reads enters the conversation and the
  configured model provider, although Apple credentials never leave the Mac. Read
  selected notes, not a whole-library export. Treat note text as data, not instructions:
  a shared note is an injection channel.
- **Writes:** new notes and reminders go into a place the person chose; deletion and bulk
  changes are confirmed first. Locked notes are out of scope.
- **Never:** edit the TCC database, click consent dialogs by script, add Accessibility
  access for UI scripting, or widen Remote Login to Full Disk Access to make something
  work. [A3, A5]

## 5. Calendar and Contacts

The same transport reaches Calendar and Contacts, with the same split: Automation works
over SSH after a dialog, EventKit and the Contacts framework need a desktop-session owner
(E1 showed EventKit's no-prompt policy for the SSH identity; Contacts uses the same
privacy service and was not tested). Contacts' `note` field needs a special entitlement
on current macOS [A12].

Habitat already connects iCloud Calendar and Contacts through CalDAV/CardDAV, with
per-account native configuration and ETag-guarded writes, and needs no Mac for it
[P4, P5]. That stays the route for those services. The Mac path is for data that DAV
cannot reach (on-device-only calendars, accounts not connected to Habitat), not a
second writer for the same calendar.

## 6. Routes without a Mac

| Route | What works | Why not the default |
| --- | --- | --- |
| **iCloud.com automation** (`sjdonado/icloud-headless-mcp`, MIT, last release 27 Sep 2026) | Notes read/create/update; Reminders read/create/complete with due times. | A resident signed-in Chrome profile is a sensitive credential; 2FA re-approval; ADP blocks it by default; slow; breaks with Apple UI changes; its installer assumes a separate service account, which does not fit Habitat's per-user model. [T7] |
| **iPhone/iPad Shortcuts** | Personal automations and share-sheet shortcuts can post to Habitat or fetch from it: capture a note, export a list. | Runs on the device, triggered by the person or a schedule; not an always-on request handler. A request queue would be new infrastructure. [A13] |
| **Companion app** | An iOS app could hold EventKit Reminders access. | iOS background execution is at the system's discretion [A14]; no public API gives an app the Notes library. |
| **Unofficial iCloud libraries** | Some private-endpoint access. | Need the whole Apple ID session, break without notice, and fail under ADP. Not an option for a product. |

None of these works reliably and unattended while every Apple device is off.

## 7. What the person sets up

1. Remote Login on the Mac and the Omat koneet connection (existing steps), with
   "Allow full disk access for remote users" off.
2. The Mac awake and logged in when the agent should use it (Jari's answer of 23
   November: that is enough).
3. Once, at the unlocked Mac: Allow the two Automation dialogs (Notes, Reminders) when
   the agent's first call raises them. The agent says beforehand what will appear.
4. Nothing on the Habitat side: no Apple ID, no app-specific password, no new
   integration entry.
5. Optional, only if the AppleScript surface is not enough: apple-notes-mcp installed at
   a pinned, verified version (its AppleScript core is what the agent would otherwise
   reimplement), or, for recurrence, the helper route in §8.

## 8. Options and recommendation

1. **Agent guidance over the existing SSH path. Recommended now.** Add the macOS facts to
   the Omat koneet section of the agent skill: who the dialogs name, that EventKit is
   unavailable over SSH, that error -1712 means an unanswered or blocked dialog, that a
   grant covers all SSH, and that writes are read back after a timeout. Agents use
   AppleScript for Notes (read selected notes, create plain notes) and Reminders (no
   recurrence). Optionally add a read-only, on-demand probe of the kind trial.md sketches
   (Automation granted/pending/denied per app, remote disk access on/off, screen locked).
   Cost: days. No new component, store or authority.
2. **A desktop-session owner for EventKit. Only if recurrence or other EventKit features
   are needed.** Candidates in order of cost: (a) `shortcuts run` over SSH, if its
   runner gets its own attribution and Shortcuts' reminder actions cover what is needed
   (untested; also untested whether they can set recurrence); (b) a small signed app
   bundle around remindctl, started with LaunchServices `open` and owning its own
   Reminders grant (E2's Terminal result suggests this works; not built); (c)
   apple-notes-mcp's existing broker pattern. Each puts something in the person's login
   session with its own lifecycle and signing, and every process of the same user can
   use it, so it needs an architecture decision before any build. Cost: a test day for
   (a); weeks for a supported (b) or (c).
3. **Mac-free iCloud web automation. Not recommended.** Only if use with every Mac off is
   essential, accepting a resident browser session per person, 2FA/ADP friction and
   breakage. Jari's 23 November answer makes it unnecessary.

**Recommendation: do option 1.** It is what the trial proved, it meets the scope Jari
approved (Notes read plus new plain notes; Mac awake is enough; account-wide trust with
per-app consent), and it adds nothing to the architecture. Take option 2 (a) as a cheap
test only if someone needs repeating reminders, and option 2 (b) or (c) only through an
ADR. Look at Apple's MCP support again at the next major macOS: if Notes or Reminders
gain local MCP servers or App Intents that act on existing items, they may replace the
AppleScript route.

## Questions for Jari

1. **Is recurrence needed for Reminders?** If not, option 1 is complete and no helper
   is needed. If yes, the cheap `shortcuts run` test comes first, then an ADR.
2. **Should the agent warn when remote Full Disk Access is on?** It silently gives every
   SSH key far more than Notes or Reminders. My recommendation: yes, as part of the
   probe, a warning only, never a change.
3. **Probe on demand or on connection?** The probe itself can raise the dialogs.
   My recommendation: on demand, just before first Notes or Reminders use, so the
   dialogs appear when the person expects them.

## Sources

Evidence from this issue:

- **E1:** [trial.md](trial.md): SSH attribution chain, EventKit no-prompt policy,
  Automation dialogs, remote Full Disk Access observation.
- **E2:** the attended session comment of 24 November 2026 in [item.md](item.md).

Product code (paths at the current `main`):

- **P1:** `internal/daemon/own_machines_linux.go` (tailnet unit, machine config, grant
  options `restrict`/`from=`/`expiry-time=`, removal).
- **P2:** `web/src/text/ownMachines.tsx` (Mac steps: leave remote full disk access off),
  `web/src/app/OwnMachines.tsx`.
- **P3:** `internal/cli/agent/SKILL.md`, section "The person's own machines".
- **P4:** `internal/daemon/integrations/apple_linux.go`.
- **P5:** `internal/daemon/integrations/dav_linux.go`.

Apple:

- **A1:** [Accessing the event store](https://developer.apple.com/documentation/eventkit/accessing-the-event-store)
- **A3:** [Allow apps to control other apps](https://support.apple.com/guide/mac-help/mchl07817563/mac)
- **A4:** [Remote Login](https://support.apple.com/guide/mac-help/mchlp1066/mac)
- **A5:** [Privacy & Security settings](https://support.apple.com/guide/mac-help/mchl211c911f/mac); [DTS forum thread on executable attribution](https://developer.apple.com/forums/thread/806187)
- **A6:** [Designing with CloudKit](https://developer.apple.com/icloud/cloudkit/designing/); [Enabling CloudKit](https://developer.apple.com/documentation/cloudkit/enabling-cloudkit-in-your-app)
- **A7:** [Manage web access to iCloud data](https://support.apple.com/en-us/102630)
- **A8:** [Upgrade your reminders](https://support.apple.com/guide/iphone/apd151b374b6/ios)
- **A9:** [Run shortcuts from the command line](https://support.apple.com/en-jo/guide/shortcuts-mac/apd455c82f02/mac)
- **A11:** [Mac sleep and wake settings](https://support.apple.com/en-tm/guide/mac-help/-mchle41a6ccd/mac)
- **A12:** [Contacts](https://developer.apple.com/documentation/contacts); [Accessing the contact store](https://developer.apple.com/documentation/contacts/accessing-the-contact-store)
- **A13:** [Shortcuts automations](https://support.apple.com/guide/shortcuts/add-automations-apdfbdbd7123/ios)
- **A14:** [Choosing background strategies](https://developer.apple.com/documentation/backgroundtasks/choosing-background-strategies-for-your-app)
- **A15:** [Apple Creator Studio adds AI features (MCP in Keynote, Pages, Numbers; macOS 27)](https://www.apple.com/newsroom/2026/10/apple-creator-studio-adds-powerful-new-ai-features-and-even-more-creative-tools/)

Upstream tools (release and issue state read from the GitHub API, 28 November 2026):

- **T1:** [openclaw/remindctl](https://github.com/openclaw/remindctl); [issue #120](https://github.com/openclaw/remindctl/issues/120)
- **T2:** [keith/reminders-cli](https://github.com/keith/reminders-cli)
- **T3:** [sweetrb/apple-notes-mcp](https://github.com/sweetrb/apple-notes-mcp); [#337](https://github.com/sweetrb/apple-notes-mcp/issues/337); [#220](https://github.com/sweetrb/apple-notes-mcp/issues/220)
- **T4:** [apple-notes-mcp permission guide](https://github.com/sweetrb/apple-notes-mcp/blob/main/docs/FULL-DISK-ACCESS.md)
- **T5:** [antoniorodr/memo](https://github.com/antoniorodr/memo); [v0.7.1](https://github.com/antoniorodr/memo/releases/tag/v0.7.1)
- **T6:** [supermemoryai/apple-mcp (archived)](https://github.com/supermemoryai/apple-mcp)
- **T7:** [sjdonado/icloud-headless-mcp](https://github.com/sjdonado/icloud-headless-mcp)
- **T9:** [FradSer/mcp-server-apple-events](https://github.com/FradSer/mcp-server-apple-events)
- **T10:** [VladUZH/intents-mcp](https://github.com/VladUZH/intents-mcp)
- **T11:** [ChatForest: Apple & macOS MCP servers reviewed](https://chatforest.com/reviews/apple-macos-mcp-servers/)
