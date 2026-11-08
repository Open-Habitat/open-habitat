# Result: integration levels set up in one guided flow

## What landed

- **Host: the `nosend` level end to end.** Root's integrations file has a
  fourth Microsoft section `microsoft_nosend` (the shared
  `integrationapps.Providers` list, so the broker accepts it without a code
  change of its own; the gateway likewise). The daemon offers the level
  `nosend` between `full` and `drafts`, signs in with that section's Entra
  application, and reads the level back from the grant (mail `drafts`, every
  other service `full`). Its Graph permissions are the full level's without
  `Mail.Send`: `Files.ReadWrite.All Sites.ReadWrite.All Mail.ReadWrite
  Calendars.ReadWrite Contacts.ReadWrite` (plus `openid profile
  offline_access User.Read`), the minimal set the prototype lists. The
  Outlook MCP server's `--allowed-scopes` is computed from the grant as
  before, so a no-send account's agent never gets `Mail.Send`. Contracts:
  the `level` enum gains `nosend`, the server-integrations `provider` enum
  gains `microsoft_nosend`, and the list's `maxItems` is 7.
- **Browser, person side.** The level card *Kaikki paitsi postin lähetys*
  and the rename of the drafts level to *Luonnokset, muu vain luku*; the
  level's warning names calendars (invitations) and files (sharing), not mail.
- **Browser, administrator side** (`web/src/components/MicrosoftLevels.tsx`).
  Microsoft 365 is one row: *n/4 tasoa asetettu: …*, *n/4 tasoa tarjolla*,
  and one button *Luo sovellukset… / Aseta puuttuvat… / Tasot*. *Mitä tasot
  sallivat* opens the round-2 comparison table under the row (✕ Ei cells),
  closed by default also before setup (round 5). Google and Dropbox rows get
  the same disclosure for their current levels. The button opens round 5's
  *Rastit taulukossa*: the table with *Asetettu* for set levels and a ticked
  *Aseta nyt* for each missing one, the set levels' provenance lines above
  it. *Aloita* walks the ticked levels as round 4's *Jokainen kokonaan*: 17
  sub-items per application over the masked Entra crops (copied from the
  round-3 crop set into `web/src/assets/entra/`), *Kuva puuttuu* where no
  capture exists, one forward button (A1b5), each application saved at its
  end, then on to the next ticked level and finally back to the start.
- Screenshots: `evidence/{sivu,alku,kavely,puuttuu,oikeudet,tenantti}-{1440,390}-{light,dark}.avif`.

## Decisions for later review

- **The new flow replaces the old Microsoft setup instead of shipping as an
  experimental feature.** Alternatives: keep the per-level rows and add the
  flow behind Kokeelliset ominaisuudet. Chosen because everything the old
  path did has a place in the new one (removal per level on the start page,
  ignored sections named on the row and offered again, the consent link for
  someone without the role, *Minulla on jo sovellus* jumping to an
  application's ids), and two Microsoft setup paths would be two guides to
  keep true. The project is pre-release with a disposable test server.
- **Removal lives on the dialog's start page** (a trash button per set
  level's line), not in a row menu: the page has one Microsoft row now.
  Removing the full level while another level stays usable uses the level
  wording (accounts at this level cannot sign in again), not "no new
  connections".
- **Partly set reads as a warning** (*2/4 tasoa tarjolla*) as the prototype
  drew it, though people can already connect at the set levels. The row's
  `data-status` stays `ready`.
- **The tenant is reused from the first usable Microsoft section** in level
  order; with none set it is asked in the walk's first application. The
  browser does not check that root's sections agree on the tenant; the
  broker could (not done: the brief keeps the broker unchanged).
- **The duplicate client id check is the browser's only**, against every
  other section's id in the list and the ids typed in this walk. The broker
  still judges each section alone.
- **Application names** are the prototype's four (*Open Habitat – täysi*,
  *– ei lähetystä*, *– luonnokset*, *– vain luku*); an existing full app
  named *Open Habitat* keeps working, the name is only a suggestion typed
  in Entra.
- **Google and Dropbox get no new level** (round 1's *Kaikki paitsi Gmailin
  muutokset* and *Kaikki paitsi jakaminen* were not decided); their tables
  show their current levels only, and Google's level cards do not list
  `nosend` as *not offered*.
- **"Minulla on jo sovellus"** (a quiet button on each application's first
  sub-item) was kept from the old guide though the prototype did not draw it.

## Checks (harvest run 01m6y1rad0j5gryq7nr47b05mm)

The implementation was written by run 01m6xzbd34021wsyvfeerz736r, which
exited before its checks; this run cherry-picked it onto main of 8.11.
(conflicts only in KOKEILTAVAA.md and the generated contracts, which were
regenerated) and ran:

- contracts: `test-focused.sh --area contracts` — generation clean, 97
  schemas valid;
- Go: `go test` of `internal/daemon/integrations`, `internal/integrationapps`,
  `internal/cli`, `internal/provision`, `internal/gateway` — ok; `go vet
  ./test/browser-host` — ok;
- web: `test-focused.sh --area web` — 191 files, all passed (after the review
  fixes `MicrosoftLevels.test.tsx` has 11 tests);
- browser: `integrations.spec.ts` 12 passed, `server-integrations.spec.ts`
  4 passed.

## Review

Independent `/llm-review` (finder gpt-6-astra, verifier claude-fable-5-1 on
the credential/scope boundary) and `/assess-findings`. Two findings, both
confirmed by tests that failed before the fix, both fixed:

- Dropbox's comparison table showed ✕ for sharing at the App folder level,
  though that application asks `sharing.write`; its cells now all read
  *Vain sovelluskansio*.
- Going back from the walk to the start page dropped an unsaved
  application's typed client id and tenant; they now live in the dialog.

The verifier found no path by which a no-send account signs in with another
level's application, gets `Mail.Send` in the Outlook server's
`--allowed-scopes`, reads back as another level, or has its section refused
by the broker, gateway or daemon.

## Not verified

- No real tenant: the new level's application and consent are exercised
  with the synthetic host and daemon unit tests only. The four uncaptured
  Entra screens stay *Kuva puuttuu*.
