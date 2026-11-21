# Person removal, prototype: the administrator's removal flow

## Saatesanat

Tässä kierroksessa ylläpitäjä poistaa henkilön Palvelimen ylläpidossa.
Sivu aukeaa Käyttäjät ja pääsy -näkymään, ja poiston vahvistus on auki
henkilölle @mikko-l. Suunnat eroavat siinä, milloin tiedot katoavat. 1
Armonaika poistaa pääsyn heti ja tiedot viikon päästä. Rivillä näkyy
`Poistetaan 7 pv päästä` ja Peru poisto. 2 Luettelo näyttää tarkalleen, mitä
poistetaan, ja poistaa kahdella painalluksella heti, eikä poistoa voi
perua. 3 Arkisto tekee kotihakemistosta ensin arkiston palvelimelle ja
poistaa sitten tiedot. Arkistosta voi palauttaa 30 päivän ajan.

Sulje ikkuna ja kokeile Levytilaa navigaatiosta. Rajojen summa putoaa
128,5 GiB:stä alle levyn koon, ja ylivarausvaroitus häviää. Katkoviivarivi
ylhäällä ei ole osa tuotetta: sillä siirretään aikaa (+1 pv, +7 pv) ja
saadaan seuraava poisto keskeytymään, jolloin näkee Poisto kesken -tilan
ja Yritä uudelleen -painikkeen.

Suosittelen ykköstä ja siihen kakkosen luettelo. Väärän henkilön poiston
voi perua viikon ajan, kotihakemistoa ei poisteta saman tien, eikä
selain saa missään vaiheessa toisen ihmisen tiedostoja. Raja lakkaa
varaamasta levyä heti, vaikka koti vapautuu vasta poistossa. Tämä
ratkaisee alkuperäisen ongelman: summa ei enää jää vanhan rajan varaan.

Nimet ja ajat (`Poistetaan 7 pv päästä`, 7 pv, 30 pv) ovat paikkamerkkejä.
Rinnakkainen arkkitehtuuripäätös ei ollut valmis, kun kierros tehtiin.

## Built page

`/var/tmp/agent-keep/person-removal/dist/offline.html` (fonts embedded)
and `index.html` (without fonts), built with
`node design-system/prototypes/rounds/2026-11-21-person-removal/build.mjs <out>`
(default out: `design-system/prototypes/dist/person-removal`). Sources and
commands are in the round's `NOTES.md`. `check.mjs` passed 395 checks with a
clean console: each direction's default view at 1440 and 390 px in light,
dark and contrast, and each direction's full flow at both widths in light
and dark: stages on both lists, the sum of limits 128.5 → 102.7 → 88.5 GiB,
undo, the error mid-removal and the retry. English was checked on desktop
and phone. Screenshots (not committed): `/var/tmp/agent-keep/person-removal/shots/`.

## Axis and directions

Axis: **when the person's data disappears, and how the removal is
confirmed.** The same five people, the same disk and the same subject
(@mikko-l: 40 GiB limit, 14.2 GiB used, 4 workspaces, 37 conversations of
which 2 running, GitHub and Google connected, 3 published links) appear in
every direction.

- **1 Armonaika (grace period).** One confirmation: access ends now, open
  sessions and agents stop, and the data is deleted on 28.11. (7 days), with
  undo available until then. The window has a one-line inventory. The row
  shows `Poistetaan 7 pv päästä` with Peru poisto on both Käyttäjät ja pääsy
  and Levytila. The countdown ticks by day. When the period ends, the
  removal runs by itself and its steps show on the row. An interrupted run
  leaves `Poisto kesken` with the steps done and the step that failed, plus
  Yritä uudelleen on both lists. Removed people stay on Käyttäjät ja pääsy
  as `Poistettu` (in Poistetut) and leave Levytila.
- **2 Luettelo (one window).** The window lists exactly what is deleted:
  the home with its path and size, the workspaces by name, conversations
  and the running ones, connected accounts (with a note that the services'
  own grants must be revoked there), published links, and the Unix account.
  It says "Poistoa ei voi perua." Two presses: Poista lopullisesti →
  Vahvista poisto, which disarms after 5 s. The same two-click pattern was
  decided for permanent deletion on 15.11. Progress, failure and retry run
  inside the window, and closing it leaves the row in its state. Poista
  vain pääsy stays as a side path in the window, giving today's revoke.
- **3 Arkisto (archive first).** The window offers "Tee arkisto ennen
  poistoa" (on by default), with the archive's path on the server, its
  estimated size and retention (30 days). Only the server's operator can
  reach it, on the command line. The removal then runs on the row
  (`Arkistoidaan…`, then the steps). The removed row says how long the
  archive is kept and offers Palauta arkistosta. Levytila gets an Arkistot
  row, because archives take disk without being in the sum of limits.
  Without an archive, the removal asks twice like 2.

Common to all: a person without access (old revoke, grace period,
unfinished removal) counts in the sum of limits by what their home uses,
not by their limit. Their limit shows struck through, with "Ei varaa rajaa:
lasketaan käytön mukaan".

## Recommendation

**1 Armonaika, with 2's full inventory in its window** instead of the
one-line summary. Reasons:

- A mistaken removal is the expensive error, and the grace period makes it
  free to undo. A single confirmation is then enough, which keeps the flow
  as light as today's access removal.
- The sum of limits is right at once. That is what the original report
  asked for, and it holds whether or not the data is gone yet.
- It extends what exists: today's `Ei pääsyä` row simply gains a date. The
  final deletion is a scheduled host action, not something the browser has
  to stay open for.
- 3's archive is a real need only if someone must be able to recover a
  removed person's work after the grace period. It also creates a second
  store of a person's home outside their account, which the project's
  principles warn against. I would add it later only on demand.

## What the view assumes from the host

- A removal is a host-side job the broker (or an equivalent root
  authority) runs in ordered steps, reporting each step's result: stop
  sessions and agents, forget connected credentials, unpublish links,
  delete workspaces and home, remove the Unix account. An interrupted job
  reports how far it got and can be resumed.
- The admin view receives counts, names and sizes only: workspace names,
  conversation counts, connected service names, link count and home size.
  It never receives file contents, credentials or another user's daemon
  route.
- For 1: a scheduled deletion time per person that can be cancelled, and
  the host performs the deletion when it is due.
- For 3: an archive written by root, outside every person's reach, with a
  retention time and a restore operation.
- Levytila's storage read reports a stage per person, so the sum of limits
  can count people without access by usage.

## Decisions for later review

- **People without access count by usage in the sum of limits.**
  Alternatives: keep counting their limit until data deletion, or count 0.
  Chosen because nothing of theirs runs, so the home cannot grow, and their
  bytes still occupy the disk.
- **One row action, "Poista", replaces "Poista pääsy" in 1.** In 2 the
  access-only removal is a side path inside the window; in 3 the window
  offers the archive. Alternative: keep both actions on every row.
  Chosen to keep the row to one action at 390 px.
- **Removed people stay on Käyttäjät ja pääsy as `Poistettu`** (in the
  Poistetut filter), and they leave Levytila. Alternative: drop them from
  both. Chosen so the administrator can see that removal happened and when.
- **Undo in 1 restores the previous state.** A person who had access gets
  it back; someone already without access stays without. Alternative: undo
  always restores access. Chosen so undo cannot quietly re-admit someone.
- **The Unix id is not reused** (named in 2's inventory). This follows the
  operator guide's warning about a stale ledger reassigning UIDs. It is a
  placeholder for the ADR.
- **Placeholder names and periods:** `Ei pääsyä`, `Poistetaan N pv päästä`,
  `Poisto kesken` (production's word), `Poistettu`, 7 days of grace, 30
  days of archive retention.

## Questions for Jari

1. Grace period or immediate deletion? If grace, is a week right, and
   should the administrator be able to delete at once from the grace row
   (with 2's two-click confirmation)?
2. Should a person without access count in the sum of limits by usage
   (my choice), or should only a real removal free their limit?
3. Is an archive of a removed person's home needed at all? If so, who may
   reach it: only the operator on the command line (as shown), or the
   person themself if readmitted? This is an authority question for the
   ADR. In no direction does the browser offer the archive for download.
4. Should the person be told, by mail or on their next sign-in attempt,
   that their account is scheduled for removal?
5. Connected accounts: is it enough that Habitat forgets the credentials
   and says the grants must be revoked in each service, or should removal
   try to revoke the grants (GitHub app, Google token) itself?
