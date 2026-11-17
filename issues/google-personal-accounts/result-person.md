# Round 2 — person's connect flow (2026-11-17)

## Saatesanat

Tämä kierros näyttää, mitä henkilö näkee yhdistäessään Google-tilinsä, kun
palvelimen Google-sovellus voi olla julkaistu mutta Googlen vahvistamaton.
Habitat ei näe Googlen välilehteä eikä tiedä, varoittaako Google, pysäyttääkö
se vai meneekö kaikki suoraan läpi. Siksi kaikki kolme suuntaa antavat
ehdollisen ohjeen eivätkä väitä tilaa, jota Habitat ei tiedä. Suunnat eroavat
siinä, missä ohje on.

Suosittelen B:tä, Reittiä. Siinä nykyinen sininen huomautus virhesivusta
laajenee koko matkaksi Googlen välilehdellä: tili, mahdollinen varoitus,
luvat ja virhesivu. Varoitus on reitillä "voi tulla" -askel, joten se ei
näytä virheeltä, eikä sen puuttuminenkaan näytä. Pysäytyksen ohje kertoo,
kumman ylläpitäjän puoleen kääntyä: tämän palvelimen vai työ- tai koulutilin.

Kaksi muutosta ulottuu ulkoasua pidemmälle. Kun henkilö peruu Googlessa,
paluuosoitteessa on Googlen virhe, ja nykyinen ikkuna sanoo harhaanjohtavasti,
että osoite voi olla vanhan kirjautumisen. Lisäksi työtilin ylläpitäjä
tarvitsee sovelluksen client ID:n, ja se löytyy jo kirjautumisosoitteesta.
Kumpikaan ei tarvitse uutta palvelintietoa eikä muuta valtarajoja.

Googlen suomenkielisiä tekstejä ei lainata, koska niitä ei ole varmistettu.
Ohje käyttää Googlen dokumentoimia englanninkielisiä nimiä (Advanced, Go to
… (unsafe)) ja kertoo, että suomenkielisen Googlen sanat voivat olla toiset.

## The page

Built from production components: `AppShell`, `AccountSettings` (Tiedot
agenteille) and production's `ConnectDialog` for Google's pasted-redirect
sign-in. Source: `design-system/prototypes/rounds/2026-11-17-google-personal-connect/`
(build and check commands in its `NOTES.md`). Built page:
`design-system/prototypes/dist/google-personal-connect/offline.html` (not
committed; rebuild with `build.mjs`). Screenshots of the check run are kept
outside the repository.

Situations (all three directions, fi/en, light/dark, 1440 and 390 px):

1. Choosing the level (new account): production's `Intro`, unchanged.
2. Before opening Google (default view).
3. Google open, waiting for the address; 3a warning help open; 3b "the
   name or page looks unfamiliar".
4. Hard refusals as help: 4a work account's organisation blocks the app
   (with the client ID to copy), 4b app only for its organisation
   (`org_internal`), 4c Testing allowlist, 4d lifetime user cap reached,
   4e new-user rate limit (`rate_limit_exceeded`).
5. Return: 5a a return address with Google's error (stopped at Google),
   5b expired. Paste, cancel and the countdown are production's.
6. Outcome: 6a connected with every permission, 6b some permissions (listed
   in the dialog, and production's card notice after closing), 6c nothing
   granted (production's refusal).
7. 7a changing the level (production's revoke-first explanation), 7b
   signing in again: the same help as a new connection.

## Directions

Axis: where the help for Google's own screens lives in Habitat's dialog.
Content is the same in all three.

- **A Muistutus (Note).** Production's dialog with one short note before
  Google: "Google may warn that it has not verified this server's app;
  continue only if you recognise the server." A link opens a panel with all
  seven cases as rows. While waiting, a link "Did Google warn or stop you?"
  opens the same panel. Decides: smallest change; the help is text behind a
  link, and the dialog has two notes before Google.
- **B Reitti (Route).** The blue "error page is expected" note becomes a
  four-step route: account, "may appear: warning" (dashed, with the English
  path and links "More" and "I don't recognise the name"), permissions, error
  page. Below it a branch "Did Google stop you before the permissions?" with
  the five refusals as chips and one answer. While waiting, the route stays
  and marks step 4 "Come back here". Decides: one place explains the whole
  trip; the warning is an expected step, not an exception.
- **C Tarkistus (Check).** Before Google a card: whose app this is (server
  address, registered by its administrator), the sign-in address to check
  (`https://accounts.google.com`), the possible warning, and "I don't
  recognise the server" as a button of its own that stops the flow. While
  waiting, "Google showed something else" opens a chooser of seven tiles and
  one answer. Decides: stopping is an explicit choice; the card adds a step
  for installations that never show the warning.

Each answer carries a "who acts" chip: you can continue yourself / ask this
server's administrator / ask the work or school account's administrator /
wait and try later. Retrying is said not to help where it does not.

## Recommendation

**B.** It replaces a note instead of adding one, the "may appear" step
makes both the warning and its absence normal, and the refusal help sits
where the refusal happens. Take C's explicit stop into B's warning step (it
already has "I don't recognise the name", which says: close Google's tab,
cancel, ask the server's administrator). A hides the key information behind
a link. C's card would be one more read for every connection, also on
organisation installations that never see the warning.

## What the view assumes from the host

Nothing new in the contract. Details in the round's `NOTES.md`:

- The help is conditional; `GoogleApp` exposes no audience, publication,
  cap or Workspace trust, and the person flow does not infer them.
- The client ID is read in the browser from `authorization_url`.
- Proposed: a pasted return address with Google's `error=access_denied` is
  shown as a cancellation at Google, not as `redirect_rejected`. Today
  `google_linux.go`'s `Redirect` rejects every `error=` address, and the
  dialog then says the address may belong to an old sign-in.
- Proposed: the connected dialog lists the granted services from the
  account already in the integration list.

## Decisions for later review

- **No live status badge.** Alternatives: a stored audience/verification
  field shown to the person. Why: Habitat cannot read Google's state; a
  stored field would be an administrator claim that drifts (as research
  recommended).
- **Client ID shown only in the organisation-block answer.** Alternative:
  show it in the warning help as "the identifier Google shows". Why: it is
  unconfirmed which identifier the unverified warning displays; the client ID
  is certainly what a Workspace administrator searches for.
- **The server is named by its address, not by a configured app name.**
  Alternative: the administrator stores the Google project name so the help
  can say "Google shows X". Why: that is a new configuration field, and an
  unverified brand may not show the configured name at all.
- **Help is the same for a new connection, a relogin and a level change.**
  Why: Google may show the warning on every consent; the round does not
  claim it does or does not.
- **Folder step left out of the flow.** Why: unchanged by this issue; the
  prototype goes from paste to connected.
- **Partial grant wording says Google "may let you leave services out"**,
  not that everyone can, since Trusted organisations receive all scopes or
  none.

## Questions for Jari

1. **Which direction?** Recommendation: B, with C's explicit stop already
   in its warning step.
2. **Should a pasted address with Google's error show "you stopped at
   Google"?** Recommendation: yes, in the browser's paste check (it already
   validates the address) and in the daemon's mapping to `cancelled`; today's
   "may be an old sign-in" text is wrong for this case.
3. **Should the connected dialog list the granted services?**
   Recommendation: yes; today a partial grant is visible only on the card
   after closing, and a person who unchecked a service at Google should see
   it at once.
4. **Does the administrator get a way to tell people the app's name?**
   Recommendation: not now. Revisit after an authorised account test shows
   what Google's warning actually names (still unverified, see research).
5. **When are Google's real Finnish labels checked?** Recommendation: before
   implementation, with a consenting synthetic test account on the staging
   installation; captures stay out of the repository.

## Verification

- `build.mjs` builds the page.
- `check.mjs` full run (3 directions × 17 situations × 1440/390 px ×
  light/dark, the click flows, English, one phone flow): 1237 checks,
  console clean.
- `scripts/validate-project-view.py` and `issuectl doctor` clean;
  `git diff --check` clean.
- Review level: self-review against the research's state list. Prototype
  only: no product code, contract, session, daemon state or authorization
  boundary changed, so no independent model review. No Go or browser suites
  run.
