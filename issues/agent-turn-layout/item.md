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

## Prototyyppikierrokset

`prototype.html` on itsenäinen vertailusivu (tokenit ja fontit upotettu),
jossa suunnat vaihtuvat näppäimillä 1–3. Se poistetaan, kun valittu suunta
on viety tuotantokomponentteihin.

Kierros 1 (12.10.2026) vertasi kolmea suuntaa: tekijäotsake kerran vuoron
alussa, pystylanka marginaalissa ja ajattelu proosana. Jari valitsi langan:
lanka sitoo ajattelun, työkalut ja vastauksen yhdeksi vuoroksi ja malli on
vastauskuplan tilarivillä. Samalla sovittiin:

- Avatussa bash-työkalussa ei ole Argumentit-otsaketta eikä `command`-nimeä;
  näkyvissä on komento ja tuloste.
- Lähetä-painike on kentän vieressä, ei omalla rivillään; nykyinen käyttöliittymä
  on liian väljä.
- Agentti voi tehdä useita lankoja peräkkäin ilman käyttäjän viestiä välissä,
  joten tekijämerkintä ei voi olettaa käyttäjän viestiä edelleen.

Kierros 2 rakentaa langan päälle ja eroaa avoimissa kohdissa: miten lanka
tiivistetään, ovatko viestien tila- ja tekijärivit ylä- vai alalaidassa
(käyttäjän ja agentin kuplat yhdenmukaistetaan), ja esitetäänkö peräkkäiset
langat erillisinä vai samalla langalla.
