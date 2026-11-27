# Result: the Levels guide creates and converts the shared applications

## What changed

- **First choice on the start page** (Palvelinintegraatiot › Microsoft 365 ›
  *Luo sovellukset…* / *Tasot*): a segmented choice *Vain oma organisaatio* |
  *Useita organisaatioita*, with one line under it. An installation without a
  shared section opens on *Vain oma organisaatio*, and that walk is unchanged
  (same steps, texts, saves). With a shared section, the dialog opens on
  *Useita organisaatioita*. Each choice has its own table, ticks and list of
  saved levels (the shared sections, with their own removal).
- **Creating the shared applications** walks the same four steps per level,
  differing where design section 4 says:
  1. *Supported account types*: **Multiple Entra ID tenants** (Entra's current
     wording; the note gives the older *Accounts in any organizational
     directory*).
  2. A new sub-item *Nimi ja julkaisija* in the first application of the walk,
     after *New registration*: what a client's administrator sees, that
     publisher verification is optional, and the organisation's name. If the
     allowed list already names the own tenant, that label is shown instead
     of a field. Each application's name becomes
     `Open Habitat – <taso> (<organisaation nimi>)`.
  3. The save writes the level's `microsoft_shared*` section and, if the own
     tenant is not on the allowed list, adds it (lowercased) under that name.
     The tenant is added once. If the list refuses (for example when it is
     full), the section stays saved, the walk stays on its last sub-item and
     says why, and *Tallenna* tries the list again without writing the
     section again.
- **Converting** (design section 3, "Shortcut"): when a level has an
  own-organisation application and no shared one, the shared start page asks
  what to do with those applications: *Muunna usean organisaation
  sovelluksiksi* (the default) or *Luo uudet sovellukset*. The convert option
  says plainly that the switch widens who can approve and use the app. A
  converted level is a two-step walk: *Muunna sovellus* (find the app by its
  id, Authentication (Preview) › Supported accounts › Multiple Entra ID
  tenants › Save, the name and publisher once, and a done line) and *Tallenna*
  (the same client and tenant id, read-only, then the widening statement).
  The save writes the shared section with the single-tenant section's ids and
  lists the own tenant as above. The single-tenant sections are kept, so
  existing connections keep their cell and client and go on without a
  sign-in.
- **The guide cannot see Entra, and the converting step says so**: it does
  not know whether the switch was made, and the first sign-in from another
  organisation is what shows it. It also names the usual reason Entra refuses
  the switch (an Application ID URI that is not unique across organisations)
  and says to create a new app in that case.
- **The Microsoft row** counts a level as offered when its single-tenant
  *or* shared section is set. Before this, an installation with only shared
  applications showed just *Luo sovellukset…* and no *Organisaatiot* button.
  Problems in shared sections are shown under their level too. Removing a
  shared section uses the level confirmation with one extra line: it applies
  to every listed organisation that has no app of its own for that level.
- `noShared` in the Organisations dialog now says where the shared
  applications are set.
- The operations guide describes the browser route and the conversion.
- No contract, gateway, broker or Go change: the broker already accepted the
  shared section names and the tenant write. The browser's section type was
  only widened (`AnySection`).

## How it was verified

Focused checks only. No contract changed, nothing crossed the
gateway/broker boundary, and root-side configuration writing is the same
broker operation as before, so the full gate and `/llm-review` were not run.

- `web/tests/microsoft-shared-setup.spec.ts` (new, real synthetic host,
  passed with `--repeat-each 3`):
  - **Create shared:** the shared kind, the missing name stopping the walk,
    the name carried into the app name, steps
    register/public/permissions/consent, the uppercase tenant pasted,
    the first shared id refused for the second level. The exact writes were
    `set microsoft_shared`, then `tenants/set {own, label}` once, then
    `set microsoft_shared_read`. The row then shows *Tasot 2/4*,
    *Organisaatiot 1* and status ready.
  - **Convert:** a full list of 32 organisations. The writes are the same ids
    as the single-tenant sections, and a refused list keeps the saved app. A
    retry sends only the tenant write. The second level reads the name from
    the list. The single-tenant sections are unchanged afterwards.
  - **Create instead of convert:** the full creation walk. The listed name is
    shown, not asked. The own organisation's app id is refused as the shared
    one.
  - axe on the start page, the new sub-item and the convert save. The
    adjacency check runs on the start page (desktop), the kind and convert
    choices on a phone, the new sub-item's panel and the walk's footer. No
    horizontal overflow at 390 px.
- The adjacency helper moved to `web/tests/control-spacing.ts`, shared with
  `microsoft-organisations.spec.ts`. It now counts a segmented control's
  options as one control (the primitive puts them 2 px apart by design).
- Vitest: a shared walk that skipped the name sub-item with *Minulla on jo
  sovellus* is sent back to it, in another step, before anything is written.
- Passed: `scripts/test-focused.sh --area web` (biome, tsc, 2274 unit and
  component tests), `--area browser --spec server-integrations.spec.ts --spec
  microsoft-organisations.spec.ts`, and `--lab --spec
  lab-explain-coverage.spec.ts`.

## How to try it in the synthetic lab

`scripts/test-focused.sh --area browser --spec microsoft-shared-setup.spec.ts`
runs all three journeys. By hand on a test host, no Microsoft account needed:

1. With a single-tenant level set, open Palvelinintegraatiot › Microsoft 365 ›
   *Tasot*, choose *Useita organisaatioita*, keep *Muunna…*, tick the level,
   walk it, give a name, *Tallenna*. Then `sudo open-habitat admin
   integrations list` shows `microsoft_shared…` with the same client id, and
   `admin integrations tenants list` shows the own tenant with that name.
2. On a host with no Microsoft section, *Luo sovellukset…* › *Useita
   organisaatioita* walks the creation. Any GUIDs are accepted, but they make
   the links point nowhere.

## What only a real Entra shows

- That Entra's *Supported account types* drop-down and the *Supported
  accounts* tab still read as the guide quotes them (*Multiple Entra ID
  tenants*). The design notes that the wording has changed more than once.
  The two new sub-items show the existing captures with the *Kuva puuttuu*
  caption. A synthetic capture of the multi-tenant option, the Supported
  accounts tab and Branding & properties is still to be made (design section
  4) and should be checked against the portal when it is.
- That switching an existing application keeps the admin consent already
  given in the own tenant, and that its connections refresh unchanged
  afterwards (step 4's proof, item 7).
- What a client's administrator sees for the chosen name with an unverified
  publisher (design section 7, item 6).
- Whether Entra refuses the switch for an app with an Application ID URI, and
  with what message.

## Decisions for later review

- **Convert is the default** when an own-organisation application exists. The
  design offers it as the shortcut, and its widening statement sits beside
  the choice and again at the save. *Luo uudet sovellukset* is one click away.
- **Converting keeps the single-tenant sections.** The own tenant's cell
  stays on the same client either way, and removing them would make a level
  depend on the Entra switch having worked. They can be removed from the
  *Vain oma organisaatio* side at any time.
- **The organisation's name is asked in the guide.** The design says the flow
  adds the own tenant to the list but not under which name. One field serves
  both the list label and the app names ("the application name should say who
  runs it"). It is asked once per walk, in its first application, and skipped
  when the list already names the own tenant.
- **A refused or lost list write leaves the section saved**, and the walk
  stays to try the list again. It does not undo the section. A lost reply to
  the section write still closes the dialog, as before.
- **The Levels count is the union** of single-tenant and shared levels.
  *Tasot n/4* and *n/4 tasoa tarjolla* mean "offered" on this server.
- **The adjacency check is scoped on the walk** to the new panel and the
  footer. The existing app rail above the walk has its buttons 4 px apart, in
  both kinds. That predates this change and was not touched, since the rail is
  laid out to stay on one line on a phone.
- The new sub-items reuse existing Entra captures with the *Kuva puuttuu*
  caption until synthetic captures exist (no screenshots in the tree from
  this change).

## New texts for proofreading

Finnish (`web/src/text/microsoftLevels.tsx` unless noted):

- *Kenen tilit voivat yhdistää* (the choice's accessible name), *Vain oma
  organisaatio*, *Useita organisaatioita*
- *Sovellukset palvelevat vain oman organisaatiosi tilejä.*
- *Sovellukset palvelevat myös Organisaatiot-listan organisaatioita, kun
  niiden pääkäyttäjä on hyväksynyt ne. Ne luodaan omaan Entraasi kuten oman
  organisaation sovellukset.*
- *Oman organisaation sovellukset (Täysi, Vain luku)*
- *Muunna usean organisaation sovelluksiksi*: *Sama sovellus ja sama tunnus,
  joten nykyiset yhteydet jatkuvat ilman uutta kirjautumista. Laajentaa sitä,
  kuka voi hyväksyä ja käyttää sovellusta.*
- *Luo uudet sovellukset*: *Nykyiset jäävät palvelemaan vain omaa
  organisaatiota.*
- Steps *Muunna sovellus*, *Tallenna*. Sub-items *Nimi ja julkaisija*,
  *Tunnukset*
- *Toisen organisaation pääkäyttäjä näkee hyväksyessään sovelluksen nimen ja
  julkaisijan. Nimen on hyvä kertoa, kuka palvelua ylläpitää.*
- *Organisaationne nimi*: *Tulee sovellusten nimiin ja organisaatiolistalle
  oman organisaation nimeksi. Näkyy palvelimen käyttäjille.* Error: *Anna
  organisaation nimi (enintään 64 merkkiä).* Placeholder: *<organisaationne
  nimi>*
- *Nimen voi vaihtaa sovelluksen valikosta Branding & properties, kohdassa
  Name:*
- *Julkaisijan vahvistus (Publisher verification) on vapaaehtoinen. Ilman
  sitä hyväksyntäsivu näyttää julkaisijan vahvistamattomana (unverified).*
- *Avaa valikko ja valitse* + *Multiple Entra ID tenants*. Note: *Ei
  vaihtoehtoa, jossa ovat mukana henkilökohtaiset Microsoft-tilit.
  Vanhemmassa näkymässä sama vaihtoehto on Accounts in any organizational
  directory.*
- *Hae listasta sovelluksen tunnuksella ja avaa sovellus.*
- *Valitse sovelluksen vasemmasta valikosta Authentication (Preview) ja
  välilehti Supported accounts. Valitse Multiple Entra ID tenants ja Save.*
- *Tämä sivu ei näe Entraa eikä tiedä, onko muutos tehty. Sen kertoo
  ensimmäinen kirjautuminen toisesta organisaatiosta.*
- *Jos Entra ei tallenna muutosta, syy on yleensä sovelluksen Application ID
  URI, jonka pitää olla yksilöllinen kaikissa organisaatioissa. Luo silloin
  uusi sovellus tämän sijaan.*
- Done: *Valmis, kun Supported accounts-välilehdellä on valittuna Multiple
  Entra ID tenants.*
- *Usean organisaation sovellus tallennetaan samoilla tunnuksilla. Oman
  organisaation yhteydet jatkuvat ilman uutta kirjautumista.*
- *Muutos laajentaa sitä, kuka voi hyväksyä ja käyttää sovellusta: minkä
  tahansa organisaation pääkäyttäjä voi hyväksyä sen, ja sen jälkeen
  organisaation ihmiset voivat kirjautua sillä. Habitat palvelee vain
  organisaatiolistan organisaatioita, mutta lista ei ole tietoturvaraja.*
- *Sovellus on tallennettu, mutta omaa organisaatiota ei lisätty
  organisaatiolistalle. <syy> Tallenna yrittää uudelleen.*
- *Vastaus katosi matkalla, joten ei tiedetä, lisättiinkö oma organisaatio
  listalle.*
- Missing-picture captions: *hyväksyntäsivu, jonka toisen organisaation
  pääkäyttäjä näkee*, *Branding & properties -sivu*, *Supported account
  types -valikon vaihtoehto Multiple Entra ID tenants*, *Authentication
  (Preview) › Supported accounts -välilehti*
- `serverIntegrations.tsx`: *Microsoft 365, taso Vain luku, usean
  organisaation sovellus* (removal title) and *Koskee kaikkia listan
  organisaatioita, joilla ei ole tälle tasolle omaa sovellusta.*
- `microsoftOrganisations.ts` (changed): *…vasta, kun usean organisaation
  sovellukset on asetettu (Tasot › Useita organisaatioita).*

English (US and UK) carry the same texts.
