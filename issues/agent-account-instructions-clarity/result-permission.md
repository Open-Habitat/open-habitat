# Prototype round: the agent asks permission for an account action, 2026-11-21

Round: `design-system/prototypes/rounds/2026-11-21-account-action-permission/` (sources and NOTES.md).
Build: `node design-system/prototypes/rounds/2026-11-21-account-action-permission/build.mjs` writes `design-system/prototypes/dist/account-action-permission/offline.html`.

## Saatesanat

Tämä on kysymys, jonka Habitat näyttää, kun agentti on poistamassa jotain
yhdistetyltä tililtä tai jakamassa kalenteria. Aino pyytää poistamaan
postikansion Laskut 2024 ja jakamaan Perhe-kalenterin Villelle. Agentti
etsii kansion ja kalenterin ja pysähtyy kysymään kahdesti peräkkäin, kerran
kummastakin toimesta. Kysymys kertoo toimen ihmisen sanoin ("Poista
postikansio ’Laskut 2024’"), millä tilillä se tehdään ja mitä siitä seuraa
("Kansio ja sen 37 viestiä poistetaan postilaatikosta"). Painikkeet ovat
Älä salli ja Salli. Tekninen kutsu on avattavissa kortin alalaidassa niille,
jotka haluavat nähdä sen. Kun Aino sallii poiston ja kieltää jaon, agentti
kertoo lopuksi, mitä teki ja mitä jätti tekemättä. Odottaessa otsikkopalkin
merkki kertoo, että agentti odottaa lupaa.

Suunnat näyttävät saman tarinan, ja ne eroavat siinä, missä kysymys on.
**1 Kortti** on kortti keskustelussa. **2 Kenttä** nousee kirjoituskentän
paikalle. **3 Työkalurivi** on itse odottava työkalurivi.

Suosittelen korttia ja ikoniksi kilpeä, jonka sisällä on kysymysmerkki.
Kortti sanoo toimen ensin ihmisen kielellä, ja päätös jää historiaan
riviksi juuri siihen kohtaan, jossa agentti pysähtyi. Kilpi on jo tilien ja
oikeuksien merkki Integraatioissa ja palvelinasetuksissa, joten sama
ääriviiva kysymysmerkillä kertoo, että kyse on tilistä ja että sinulta
kysytään.

Yksi asia ei ole vielä olemassa. Selain saa nykyään vain kysymyksen tekstin.
Jotta kortti voi näyttää toimen, tilin ja seurauksen omina osinaan,
selain–host-sopimukseen tarvitaan uusi kysymyslaji, ja se on suunniteltava
skeemasta alkaen.

## Directions (axis: where the question sits)

1. **1 Kortti / Card** (recommended). A card in the conversation, at the
   point where the agent stopped. From top to bottom: an icon in a soft
   accent disc, *Agentti pyytää lupaa*, the account (*Microsoft-tilillä
   aino.virtanen@contoso.test*), the action as a heading, its consequence,
   then *Tekninen kutsu* (a disclosure with the area and tool,
   `ms-admin · delete-mail-folder`, and the arguments) beside Älä salli /
   Salli. Once decided, the card shrinks to one bordered line (icon,
   ✓ Sallit or ✕ Et sallinut, the action, the technical disclosure), and
   the call follows as an ordinary tool row (done or blocked).
2. **2 Kenttä / Field.** The same question replaces the composer while it
   is open. On a phone it becomes a bottom sheet with full-width buttons.
   The stream shows only the line *Agentti odottaa lupaasi · Poista
   postikansio ’Laskut 2024’*, which becomes the decision once answered.
   The question cannot scroll out of sight, and the person cannot write
   while it is open. The decision is left in history only as a faint line.
3. **3 Työkalurivi / Tool row.** The waiting call is a tool row
   (`delete-mail-folder Laskut 2024`, *odottaa lupaa*), held open, with the
   action, account, consequence and buttons inside. A decision collapses
   it to *valmis* or *et sallinut*. This direction is the most consistent
   with the work trail, but it leads with the tool name, which is the part
   the person understands least.

Shared by all three directions: one question at a time (Pi's `confirm`
blocks the call until answered, so two actions are two questions in a row),
the header's `waiting` mark with "Odottaa lupaasi", the Stop button in the
composer (the turn is running), and the agent's closing reply naming what
was and was not done.

## Icon (recommendation: Kilpi ja kysymys)

The candidates are shown at 16, 20 and 24 px beside production icons and in
three places (stream line, card heading, header status). Open them with
*Ikoniehdokkaat*. The *Ikoni* selector puts any of them into the
directions.

| Candidate | Reading | Verdict |
|---|---|---|
| **Kilpi ja kysymys** (shield + ?) | The settings account shield, with a question instead of the exclamation. | **Recommended.** It ties the question to accounts and permissions and stays legible at 16 px. |
| Avain ja kysymys (key + ?) | Credentials about to be used. | Cramped at 16 px. The key also already means GitLab tokens. |
| Agentti kysyy (agent head with ?) | Says who asks. | Does not say what is at stake. |
| Käsi (raised hand) | "Wait". | Reads as a refusal, and is the busiest shape at 16 px. |
| Sinun hyväksyntäsi (person + tick) | The decision is yours. | Reads as "already approved". |

The recommended icon sits next to the existing `shield` (shield with an
exclamation). At 16 px the two are distinguishable by the inner glyph only.
That is intended, since they are siblings, but it means the new icon should
not appear right beside the plain shield.

## Host facts the view assumes

- Habitat's Pi extension `tool_call` hook confirms the named calls (every
  `delete-…`, sending, and granting or changing calendar sharing; the 19
  calls in research-topics.md). It blocks with a reason on no, or when no
  browser is attached.
- **Contract:** the card needs a question that says it is an account-action
  permission and carries its parts (action, account, consequence,
  technical call) as separate fields. Today the browser gets `question_kind`
  `confirm` and one `prompt`. The change starts in
  `contracts/v1/event.schema.json`. The alternative, a title convention that
  the browser parses, is rejected because it reads meaning out of free text.
- Names and counts ("Laskut 2024", 37 messages) are not in the call's
  arguments, which carry only IDs. The hook would have to look them up
  with a read call before asking, or the question falls back to the ID.
- The consequence wording makes no claim about recovery (Deleted Items),
  because this has not been verified against Graph.

## Decisions for later review

- **Allow is primary (filled), Don't allow secondary.** The alternative is
  making Don't allow the default or styling Allow as dangerous. The person
  asked for the action a moment ago, so allowing is the expected answer.
  A red Allow on every question would wear the warning out.
- **No "allow all of this kind" button.** The alternative is a per-turn
  allowance remembered by the extension. That would need state in the
  extension and a wording for its scope. Two questions in a row are
  cheap, so this waits for real use.
- **The call still appears as a tool row after the decision (1 and 2).**
  The alternative is letting the card stand in for it. The tool row is
  what Pi's native history holds, and the card is only the question.
- **The account line uses the mail icon for a Microsoft account.** A
  provider-specific mark would be better at implementation. Production has
  no Microsoft mark icon.
- **Header status uses the existing `waiting` mark state, not the new
  icon.** The alternative is the new icon in the header. The mark already
  means "the agent waits for you", and the new icon says why in the stream.

## Questions for Jari

1. Card (1) as the place for the question: or do you want it to rise into
   the composer's place (2), so it can never scroll out of sight?
2. The shield with a question as the icon: or does it sit too close to the
   existing shield-with-exclamation?
3. Should the consequence line say whether the action can be undone (for
   example "Kansio siirtyy Poistetut-kansioon")? That needs verifying
   per tool.
4. When the agent wants to delete ten folders in a row, should there be a
   "Salli loput tässä vuorossa", or one question each?
5. The contract change (a typed permission question) is the one piece
   that is new to the host: go ahead and design it with the hook?

## Evidence

Screenshots from `check.mjs` (550 checks, clean console) are at
`/var/tmp/agent-keep/agent-account-instructions-clarity/permission-round/`
and are not committed.
