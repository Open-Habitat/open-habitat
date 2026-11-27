# Result: administrator and person UI for several organisations

Built as prototype round 4 (`2026-11-27-entra-organisaatiot-4`) was approved,
in production components, with round 4's texts in Finnish and English.

## What changed

- **Microsoft row** (Palvelinintegraatiot): only *Organisaatiot n* and
  *Tasot n/4* follow the name, the count in the same pill. The line of set
  levels and the row's own *Mitä tasot sallivat* are gone; the levels' names
  are in the Levels button's accessible name and tooltip and in its dialog.
  Partial state: *2/4 tasoa tarjolla* in the state column and *Tasot 2/4*
  asking for attention. No level set: production *Luo sovellukset…* alone.
- **Organisations dialog** (`MicrosoftOrganisations.tsx`): centred like
  Levels, A2a rows (name and *Oma*, the approval state the server can say
  below, *Hyväksyntä* and the red removal at the row's end, removal last and
  `--ah-s4` apart). Adding, approval (the approved message and per-level
  links, narrowest first) and the removal confirmation are steps that return
  to the list with focus on the row they came from. The list is read from
  the broker's page the way every daemon builds its table
  (`app/microsoftOrganisations.ts`); the consent link is
  `integrationapps.MicrosoftConsentURL` byte for byte (unit test).
  Writes go through step 2's `tenants/set` and `tenants/remove`; a refusal
  or a lost reply stays on its step, a lost one with *Lue uudelleen*.
- **Person** (Tiedot agenteille): with more than one organisation,
  connecting asks *Minkä organisaation tiedot yhdistetään?* first, the
  chosen organisation is named at the top of the sign-in (with the guest's
  line for another than the own), only that organisation's levels are
  offered, and its `tenant_id` is sent. The Microsoft section lists the
  organisations in order: a card per connection with the organisation under
  the address, a row *Ei yhdistetty · Yhdistä* for one not connected
  (round 2's person view). A connection without mail, calendar and contacts
  says *Posti, kalenteri ja yhteystiedot: ei vierastilillä.*, and its
  completion *Ei postilaatikkoa: vain tiedostot.* Renewal, level change,
  removal and stopping a sync send the connection's `tenant_id`, so
  `organisation_required` does not arise from the browser. Refusals in such
  an organisation use round 2's texts with its label (consent with *Kopioi
  pyyntö*, `not_in_organisation`, blocked device code, expiry, an
  organisation taken off the list since the page was read).
- **Single organisation**: no organisation step, no organisation named on
  the card, no `tenant_id` sent; only the row's two buttons differ.
- **Spacing fixes** in production: Levels dialog's Remove buttons
  (`.ml-known`), a row's badge link above its disclosure
  (`.ah-people-person`), wrapped row actions (`.ah-people-end`) to
  `--ah-control-gap`; the removal confirmation `--ah-s4` from Cancel
  (`.si-destructive`).
- `outside_tenant` no longer speaks of "the server's organisation";
  `not_in_organisation` has its text.
- A list read that a removal overtook no longer brings the removed card
  back (found by the clean gate in the new spec; vitest ordering test).
- Explain-mode cards MS01–MS09 for the new buttons, dialog actions and the
  organisation step; the operations guide names the browser dialog.

## How it was verified

- `web/tests/microsoft-organisations.spec.ts` against the synthetic host
  (real gateway, broker relay and daemon catalog; the Microsoft stand-in now
  serves the organisations root's file names and names a connection in a
  chosen organisation `address~tenant`): the administrator's add (field
  errors, duplicate, GUID lowercased), approval step and its links, removal
  with cancel, counts and the partial and full states, focus return, a phone
  (actions under the name, dialog within the screen), the person's
  organisation step, one address in two organisations, the guest's
  files-only card, renewal naming the organisation, each refusal, an
  organisation removed before connecting, removal of one of the two, and
  the single-organisation case. Axe on every new dialog step; every row and
  dialog checked that no two visible controls are closer than
  `--ah-control-gap` and a removal is `--ah-s4` from the control before it
  (the check fails on the old `.ml-known` 2 px gap).
- Unit and component tests: the organisations table and consent link,
  the dialog's refused, lost and locked states, the removal ordering race.
- Existing integration, server-integrations, Google, agent resources,
  onboarding and explain-coverage specs pass with the changes.
- Full clean gate passed (receipt for tree 6ab4696b, commit 19d4bf628).
  The first run failed only on the removal race above.
- Screenshots at 1440 and 390, light and dark, are kept outside the tree in
  `/var/tmp/agent-keep/m365-ui/`.

## How to try it on the test machine without real Microsoft accounts

The administrator's side needs no Microsoft account:

1. Set at least one shared section with root's CLI, for example
   `sudo open-habitat admin integrations set --provider microsoft_shared_read
   --client-id <GUID> --tenant-id <the own tenant's GUID>` (any client GUID;
   a synthetic one only makes the links point nowhere).
2. Palvelinintegraatiot › Microsoft 365 › *Organisaatiot*: add a synthetic
   organisation (any GUID), read its approval message and links, go back,
   remove it. The row's counts follow; `admin integrations tenants list`
   shows the same list.

The person's side up to the device code: with the own organisation and one
synthetic organisation on the list, Tiedot agenteille › Microsoft 365 asks
for the organisation, names it, and offers that organisation's levels. What
Microsoft answers for a synthetic tenant is not known (it is not a real
organisation), so a sign-in itself needs step 4's accounts.
`scripts/test-focused.sh --area browser --spec
microsoft-organisations.spec.ts` runs the whole person flow with the
synthetic host's stand-in.

## What waits for step 4's real accounts

- Which refusal code a real unapproved client returns at the device code
  request and at approval, and so which of the person's refusal texts it
  shows.
- A real guest's grant and whether its connection really lacks mail: the
  daemon does not yet probe the mailbox (design section 5), so today a
  guest connection lists mail, calendar and contacts as the tenant answers
  them; the files-only card appears once the daemon reports only the file
  services.
- What the client's administrator sees following the message's links with
  an unverified publisher.

## Decisions for later review

- **Organisation step and rows together.** Round 2's person view lists each
  organisation as a card or a *Yhdistä* row; the brief and the design ask for
  an organisation step. Both are built: the rows when something is
  connected, the step from the tile (nothing connected yet) and from *Lisää
  toinen Microsoft 365 -tili* (another address). The step's words are new
  (round 1's, shortened): *Minkä organisaation tiedot yhdistetään?* and
  *Jos olet organisaatiossa vieraana, kirjaudu omalla työtililläsi.*
- **The card names the organisation, not "vieraana".** The host does not
  say whether the person is a guest, so the card shows the label alone; a
  files-only connection's line says the rest is not for guest accounts, as
  round 2 wrote it.
- **Files-only is read from the services**: a Microsoft connection without
  mail, calendar and contacts. No contract change.
- **Organisations n counts what the dialog lists**: the daemons' table plus
  listed organisations without any application, which the administrator
  must be able to remove. The own organisation served only by single-tenant
  sections is *Oma organisaatio*, without a removal (it is not on the list).
  Without any shared application, a note says other organisations can
  connect only once those applications are set.
- **Tasot n/4 counts the single-tenant sections**, as the Levels dialog does.
  Shared sections are set from root's CLI; a browser guide for creating them
  (design section 4, *Useita organisaatioita*) was not in round 4 and is not
  built.
- **The message's publisher** is the own organisation's label on the list,
  or `<organisaationne nimi>` for the administrator to fill in.
- **Expiry in a client organisation** offers *Kopioi pyyntö* without a link:
  the person's browser does not know the client ids, and the contract gives
  `consent_url` only with `consent_required`.
- **Explain cards** were added for the dialog's own actions too, though the
  Levels dialog has none.
