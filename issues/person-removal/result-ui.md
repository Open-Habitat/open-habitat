# Person removal, prototype: the administrator's removal flow

## Saatesanat

Tässä kierroksessa ylläpitäjä poistaa henkilön Palvelimen ylläpidossa.
Kierros noudattaa ADR 0037:ää, joka valmistui kesken työn. Sivu aukeaa
Käyttäjät ja pääsy -näkymään, ja suunnan ensimmäinen ikkuna on auki
henkilölle @mikko-l. Jokaisen suunnan poistoikkunassa on ADR:n neljä
seurausta: pääsy loppuu, palvelut irrotetaan, jaetut linkit lakkaavat
toimimasta ja kotihakemisto poistetaan, sen koko mainiten. Ikkunassa on
myös muistutus, ettei Habitat ilmoita henkilölle. Vahvistus tehdään
kirjoittamalla henkilön tunnus.

Suunnat eroavat siinä, milloin koti poistetaan ja mistä poisto alkaa. 1
Armonaika antaa valita 14 päivää tai heti. Rivillä näkyy silloin
`Poistetaan 5.12.` ja Peru poisto. 2 Heti poistaa saman tien, eikä poistoa
voi perua. 3 Vaiheittain vaatii ensin tutun Poista pääsy -toiminnon, ja
vasta Ei pääsyä -rivillä voi poistaa henkilön.

Sulje ikkuna ja katso Levytilaa. Rajojen summa putoaa 128,5 GiB:stä alle
levyn koon heti, kun poisto alkaa, ja varoitus häviää. Katkoviivarivi
ylhäällä ei ole osa tuotetta. Sillä siirretään aikaa (+1 pv, +14 pv) ja
saadaan seuraava poisto keskeytymään, jolloin näkee Poisto kesken -tilan.

Suosittelen ykköstä. Väärän henkilön poiston voi perua kaksi viikkoa, ja
Poista heti on samassa ikkunassa, kun levytilaa tarvitaan heti.
Vaiheittainen kulku olisi selkein, mutta se tekee kiireellisestä poistosta
kahden käynnin asian. Nimet ja 14 päivää ovat yhä paikkamerkkejä, kunnes
ADR hyväksytään.

## Built page

`/var/tmp/agent-keep/person-removal/dist/offline.html` (fonts embedded)
and `index.html` (without fonts), built with
`node design-system/prototypes/rounds/2026-11-21-person-removal/build.mjs <out>`
(default out: `design-system/prototypes/dist/person-removal`). Sources and
commands are in the round's `NOTES.md`. `check.mjs` passed 491 checks with a
clean console. It covers each direction's default view at 1440 and 390 px
in light, dark and contrast, and each direction's full flow at both widths
in light and dark: typed-login gating, the stages on both lists, the sum of
limits (128.5 → 102.7 → 88.5 GiB), cancel leaving access withdrawn, the
interrupted removal (`files_remain`) and the retry. It also asserts that
the dialog names nothing from the home. English was checked on desktop and
phone. Screenshots (not committed): `/var/tmp/agent-keep/person-removal/shots/`.
The pre-ADR version's screenshots are in `shots-before-adr/` beside them.

## How the round met ADR 0037

The round was first built before the ADR existed. It then had three
directions: a 7-day grace period; a window listing workspaces by name,
conversations and connected accounts, confirmed with two clicks; and an
archive of the home on the server. When the ADR landed, the round was
rebuilt to it:

- The archive direction was dropped. Section 3 hands the administrator no
  archive or export.
- The dialog no longer names workspaces, conversations or connected
  accounts (section 2). It states the consequences in the person's terms
  and shows the home's size.
- Confirmation is the typed GitHub login (section 2), case-insensitive,
  with or without `@`.
- Removal is a separate action beside "Poista pääsy" (section 1).
  Cancelling leaves access withdrawn rather than restoring it.
- Stage 1 closes the person out at once: sign-in, processes, services and
  shared links. Stage 2 deletes the home at the due time, and the broker
  starts it by itself (sections 1 and 5).
- "Poisto kesken" carries a fixed reason (`files_remain`) and says the
  server retries hourly (section 6). Cancelling is not offered once the
  data stage has begun.
- The person counts in the sum of limits by usage from stage 1 (section 7).
  The row leaves Levytila after stage 2.
- The "Poistettu" row keeps provider counts only (sections 4 and 8).
- The administrator has no removal action on themselves (section 2).

## Axis and directions

Axis: **when the home is deleted, and where removal starts.** The people,
the disk and the subject (@mikko-l: 40 GiB limit, 14.2 GiB used) are the
same in every direction.

- **1 Armonaika (grace period).** Both "Poista pääsy" and "Poista henkilö"
  are on an admitted row; a withdrawn row has "Poista henkilö". The dialog
  has a Milloin choice: "14 päivän päästä, 5.12." (default) or "Heti". The
  confirm button names what happens ("Poista 5.12." / "Poista heti").
  The scheduled row shows `Poistetaan 5.12.` and "N pv jäljellä". Peru
  poisto is on both Käyttäjät ja pääsy and Levytila. At the due date the
  removal runs by itself and its remaining steps show on the row.
- **2 Heti (immediate only).** The same dialog without the choice, with
  "Poista pysyvästi" as the confirm button. Progress, the interruption and
  "Yritä nyt" run inside the window. There is no undo. Withdrawal stays as
  the separate, reversible action.
- **3 Vaiheittain (in steps).** An admitted row has only "Poista pääsy".
  Its dialog is production's, with one added line: removal is the next,
  separate step. The withdrawn row then has "Poista henkilö", which always
  schedules 14 days out.

## Recommendation

**1 Armonaika.** Reasons:

- A mistaken removal is the expensive error, and the grace period makes it
  cheap to undo. The only cost is reconnecting services, and the dialog
  says so.
- "Heti" in the same dialog covers the case that started this issue: the
  disk is overcommitted and space is needed now.
- The sum of limits is right from the first stage, whichever timing is
  chosen.
- 3 is the clearest about the two acts, but it makes an urgent removal two
  visits. 2 leaves no room for a mistake.

## What the view assumes from the host

From ADR 0037: the access list read carries, for each person, the removal
record's stage, due time and fixed reason. The removed record carries the
provider counts. Levytila's storage read reports which bindings are being
removed, so it can count them by usage. The removal request carries the
subject and "now or grace"; the typed login is checked in the browser and
again by the gateway against the subject. The browser receives no
workspace names, file listings, account names or paths.

## Decisions for later review

- **Step names on the row** ("Kirjautuminen estetty ja prosessit
  pysäytetty", "Yhdistetyt palvelut irrotettu", "Jaetut linkit lakkasivat
  toimimasta", "Kotihakemisto poistettu", "Levytila todettu vapaaksi",
  "Unix-tili poistettu"). These collapse the ADR's broker steps into what an
  administrator can judge. Alternative: show only the stage and the reason.
  Chosen because an interrupted removal is easier to judge with what is
  already done in view.
- **"Yritä nyt" beside the hourly retry.** The ADR says the broker retries
  hourly and that repeating the action continues. Alternative: no button.
  Chosen so an administrator who has fixed the cause need not wait an hour.
- **The typed login is case-insensitive and accepts a leading `@`.**
  GitHub logins are case-insensitive.
- **The Unix username is not shown in the removal dialog.** The access row
  already shows it, and the ADR keeps the dialog in the person's terms.
- **Removed rows have no clear action yet.** ADR question 4 recommends
  clearing the record from the list. That is left out until it is decided.

## Questions for Jari

1. Which direction: 14 days with "Heti" as a choice (my recommendation and
   the ADR's), immediate only, or withdraw first and remove later?
2. Is 14 days right, and should the remaining days show on the row
   ("13 pv jäljellä") or only the date ("Poistetaan 5.12.")? The round
   shows both.
3. Is the typed login the right weight for both timings, or should
   "Poista 5.12." (undoable) confirm with one press and only "Heti" ask
   for the login?
4. Should the "Poistettu" row stay until the administrator clears it (ADR
   question 4)? If so, should the clear action be on the row?
