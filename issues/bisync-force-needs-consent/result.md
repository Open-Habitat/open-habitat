# Prototype round 1: sync stop and consent to one forced pass (14.11.2026)

Round: `design-system/prototypes/rounds/2026-11-14-sync-consent/` (build and
check commands, and "What the host would need", in its `NOTES.md`).

**Axis:** where the stop and the decision sit on the Microsoft 365 card in
Settings › Tiedot agenteille. What is the same in every direction: sync
stops and does not continue by itself. The person sees a count of what
continuing would do (changed, new and deleted files on each side) and
consents to one continuation of exactly that count. If the count includes
deletions, they get a strong warning and a checkbox, and the button names
the number. They can also ask the agent.

- **A Rivi**: the stop shows on OneDrive's own row, where production already
  shows failures, with a button there. The count and the consent are in a
  dialog.
- **B Ilmoitus**: a notice at the top of the card explains the stop, with
  two buttons: see what continuing would do, and ask the agent. The count
  and the consent are in the same dialog as in A.
- **C Paneeli**: a panel opens under the row and the count fills in there.
  The dialog only confirms.

**Recommendation: B.** The stop is the most important thing on the card and
waits for the person, so it belongs at the top, like production's other
notices that wait for the person. The dialog keeps the count and the consent
together, so consent goes to exactly the count shown. A gets lost among the
service rows. C is heavy and leaves an old count on screen while files
change.

States in every direction: stopped, counting, count with no deletions, count
with many deletions, running, done, refused (files changed after the count;
the review bar can simulate this), failed. Finnish and English.

## Decisions for later review

- **The count is made on request, not automatically at the stop.**
  Alternative: the host counts as soon as it stops and the card shows the
  numbers straight away. Why: a count shown long before the decision is
  stale by the time the person reads it. Counting on request makes the
  count and the consent one moment, which is what the binding relies on.
- **Consent is bound to the count by a one-use check id plus a re-listing
  before the forced pass**, refused if anything changed. Alternatives: a
  time limit only, or trusting the count. Why: only this closes the gap
  from `bisync-all-files-changed-abort`, where a deletion arriving between
  the dry run and the forced pass goes through. A residual window of
  seconds remains on the cloud side, because `--force` also bypasses
  `--max-delete` in the same pass (NOTES). Jari can decide whether that
  is acceptable.
- **Any deletion counts as "many" for the strong warning and the
  checkbox.** Alternatives: bisync's own 50 % threshold, or a fixed number.
  Why: this stop usually comes from an agent editing every file, which
  deletes nothing, so any deletion is unexpected here. The prototype shows
  the many-deletions state with 212 of 240.
- **The agent may count and, after a yes in the conversation, request the
  forced pass by the same check id.** It does not run rclone `--force`
  itself. This is an instruction in the skill, not an enforced boundary:
  the agent runs as the same Unix user. No authority moves between
  gateway, daemon and provision.
- **The stop stays in-memory observation**, with no new store. The next pass
  after a daemon restart stops again and shows it.
- **Production fixes the prototype found**, both in NOTES:
  - `needsSignIn` offers Kirjaudu uudelleen for this stop, and signing in
    again would resync the whole folder.
  - `failureHelp` shows the quota help under it.
- **Wording:** the row uses production's service name ("OneDrive ja
  SharePoint"), while the round's texts say "OneDrive". The real texts
  name the folder the stop concerns.

## Questions for Jari

1. Direction: B, or another?
2. Is the remaining seconds-long cloud-side window acceptable, or should a
   forced pass with no deletions in its count run in a mode that cannot
   delete?

## Live check

Nothing on the test server yet. This is an offline prototype. Open
`offline.html` from the worker results and try B: Katso, mitä jatkaminen
tekisi…, then Jatka kerran. Then choose "Laskelma: paljon poistoja" and the
checkbox. Then open the count again, press "Simuloi: tiedosto muuttuu
laskelman jälkeen" and continue, which is refused.

# Prototype round 2: the stop and consent in the conversation (14.11.2026)

Round: `design-system/prototypes/rounds/2026-11-14-sync-consent-2/` (build
and check commands, and "What the host would need", in its `NOTES.md`).
Jari on round 1: the person will not find the stop in Settings; it belongs
where the agent did the work that caused it.

**Axis:** where in the conversation the stop and the consent sit. The count
and its binding are round 1's. Same in all directions: the rail marks the
conversation that caused the stop (production's attention mark), the bell
carries it for the whole account, and the consent is always Habitat's own
button, never the agent's word.

- **A Kortti**: Habitat's card in the timeline right after the turn whose
  edits stopped sync ("Synkronointi pysähtyi, koska tämän keskustelun
  muutokset koskivat kaikkia OneDrive-kansion tiedostoja"), naming the
  edits. *Katso, mitä jatkaminen tekisi* fills the count and the consent
  into the card. *Kysy agentilta* drafts a message in the field.
- **B Agentti kertoo**: Habitat tells the agent (a line in the timeline),
  the agent explains in its own words what it did and runs the count, and
  Habitat's consent card sits under its reply.
- **C Kentän yllä**: a fixed line above the message field, not in the
  timeline. The count and the consent are in round 1's dialog.

**Fallback** (no conversation caused it): no rail mark. The bell item
explains and opens round 1's dialog, and the Microsoft card in Settings
keeps round 1's notice (B) behind *Avaa asetukset*.

**Recommendation: A.** It sits where the person reads the agent's result
and says which edits caused the stop. The consent needs no agent turn, so
A works when the agent has moved on or Pi has stopped. B explains best,
but it starts a turn the person did not ask for, and the agent's account
can be wrong. A's *Kysy agentilta* gives that explanation on request. C
comes loose from its cause and takes field space on a phone.

States in every direction: stopped, counting, count (no deletions / 212
moved, deletions gated by a checkbox), running, done, refused (change after
the count; the review bar simulates it), failed, another conversation open,
fallback. Finnish and English.

## Round 2 decisions for later review

- **Attribution only when it is sure enough.** The daemon attributes the
  stop from the native history of the user's conversations. `edit`/`write`
  paths inside the synced folder are certain. `bash` with its cwd in the
  folder, or naming the folder, is probable. Otherwise the fallback is
  used. Alternative: attribute the most recent conversation that touched
  the folder at all. Why not: a card in the wrong conversation gives the
  wrong cause.
- **The agent may count and explain, never force.** Round 1 let the agent
  request the forced pass after a yes in the conversation. Round 2 drops
  that, per Jari's "a real button, not the agent's word": the CLI has no
  force command and the skill says so. Not an enforced boundary (same Unix
  user, as in round 1), and no authority moves.
- **B wakes an idle agent once per stop**, the way a finished background
  process does. If Pi is not running, B behaves as A. Alternative: never
  start a turn, and tell the agent only at the person's next message. Why:
  B's whole point is the agent telling. That cost is part of why A is
  recommended.
- **A's card is host state, not native history.** It shows while the stop
  holds, then as a one-line receipt until the conversation is reopened.
- **The bell carries the stop in every case**, also when the causing
  conversation is open, because it is an account condition.

## Questions for Jari (round 2)

1. Direction: A, or another?
2. In the fallback, is the bell plus the Settings card enough, or should
   the stop also open as a notice on the start page?

## Live check

Nothing on the test server yet. This is an offline prototype. Open
`offline.html` from the worker results. In A, press *Katso, mitä jatkaminen
tekisi*, then *Jatka kerran*. Switch Keskustelu to *Arkistointi* for the
212-deletions case and its checkbox. Choose *Toinen keskustelu auki* and
click the marked conversation in the rail. Choose *Varapaikka* and open the
bell.
