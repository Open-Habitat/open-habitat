---
created: 2026-10-12
updated: 2026-10-12
type: improvement
status: open
priority: normal
lane: web
lane_seq: 6
collision: [web/]
preparation: pending
---

# Agent turn repeats its author and hides short thinking

Jari observed this in a Pi conversation using GPT-5.5 on pilot.22 on
2026-10-12. The native-session inspection recorded in this report found
only short, single-line thinking summaries (31–51 characters), such as
`**Planning status table parsing with Python**`. Opening "Ajattelu" exposed
that one line in a code-styled box with visible Markdown asterisks.
"PI · GPT-5.5" also repeated above thinking, tool calls and messages,
adding noise to the agent's work.

The reader should be able to follow the work and recognize the actual reply
without opening a disclosure just to read a short summary. Short single-line
thinking belongs directly on the "Ajattelu" row with Markdown rendered;
multi-line thinking retains an expandable form. This concerns the readable
text supplied by Pi, not encrypted thinking data.

The agent's reply gets a bubble, like the "Sinä" message, giving its copy
action a natural home. The author/model label appears at most once per reply
rather than above each work block. User messages keep their author treatment,
and model information remains attached to the assistant message it describes.

The [conversation draft](../../design-system/drafts/Pi-keskustelun%20lohkot.dc.html)
provides the surrounding visual language. Its bubble-free reply and collapsed
thinking examples predate the changes requested here. The shared icon rules
are in [design.md](../../design-system/design.md).

Lab validation on desktop and phone should show that short summaries are
readable directly, longer thinking remains accessible, and replies and their
copy actions are easy to find even in a turn with many tool calls.

## Sovittu esitys (prototyyppikierrokset 12.10.2026)

Esitys suunniteltiin kuudella `/prototype`-kierroksella; valittu kokonaisuus
on vedoksena [Agentin vuoro.proto.html](../../design-system/drafts/Agentin%20vuoro.proto.html)
ja kierrosten vertailusivu on `prototype.html` tässä kansiossa, kunnes
toteutus on valmis. Tämä issue toteuttaa vuoron rakenteen; tulosteen ja
komennon laatikot ovat [@bash-tool-card](../bash-tool-card/item.md)issa.

- **Lanka.** Agentin vuoro on pystylanka vasemmassa marginaalissa: pää,
  ajattelu- ja työkalusolmut ja vastaus. Langan pää on "PI · malli" kerran per
  vastaus, avausnappina, jolla työn saa kiinni; tiivistettynä päärivillä lukee
  ajatusten ja työkalujen määrä ja vastaus jää näkyviin. Jokainen vastaukseen
  päättyvä toimi on oma lankansa myös silloin, kun agentti tekee niitä
  peräkkäin ilman käyttäjän viestiä välissä.
- **Kuplat ja tilarivit.** Käyttäjän ja agentin viestit ovat kuplia, joiden
  ylärivi on samanmuotoinen: Sinä · kopioi · aika ja ✓ Vastaus valmis · malli ·
  kopioi · aika. Malli näkyy vain vastauksen rivillä, ei työlohkojen edessä.
- **Ajattelu.** Yksirivinen ajattelu on Ajattelu-rivillä Markdown renderöitynä
  ilman avausta; monirivinen on avattava lainauslohko.
- **Työn aikana.** Elävyys on yhdessä tilanauhassa langan viimeisenä rivinä
  vastauksen alla: "● Ajaa bash · 0:05" kertoo mitä agentti tekee ja kauanko
  työ on kestänyt. Lohkot ilmestyvät heti lopullisessa muodossaan ilman
  sykkeitä; virtaava ajattelu näkyy yhtenä vaihtuvana rivinä, virtaava vastaus
  kursorilla ja ylärivillä "Vastaa". Lanka ei ole tiivistettävissä työn
  aikana. Työn päätyttyä nauhasta tulee rivi "Työ · 2 ajatusta · 3 työkalua ·
  0:14", josta työn saa kiinni ja auki; lanka jää oletuksena auki.
- **Vieritys.** Kirjoituskenttä pysyy paikallaan ja uusi sisältö nousee sen
  yllä. Näkymä seuraa uusinta, kunnes lukija vierittää ylös, ja jatkaa, kun
  hän palaa alas. Lähetä on kentän vieressä, ei omalla rivillään.

Hylätyt suunnat ja niiden hinnat ovat Git-historiassa tämän tiedoston
aiemmissa versioissa.
