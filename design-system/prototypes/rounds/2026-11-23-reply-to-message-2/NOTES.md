# Vastaa agentin viestiin – kierros 2

Issue `reply-to-agent-message`. Jari 23.11.2026: kierroksen 1 suunta A
(lainauskortti kentän yllä) on pohja, mutta design systemin omalla kielellä:
ei värillistä palkkia vasemmalla eikä muuta `design-system/`-hakemistolle
vierasta. Jokainen suunta lainaa lainaukselle olemassa olevan pinnan ja
pariksi sille kulmapainikkeen paikan ja alkuperäisen merkinnän.

Rakennettu tuotannon komponenteista (`AppShell`, `WorkspaceRail`,
`AgentHeader`, `ConversationTimeline`, `UserMessage`, `AssistantMessage`,
`ToolRow`, `Composer`, `ControlButton`, `Icon`) ja tuotannon luokista
(`.ah-message-actions`, `.ah-queue-heading`, `.ah-queue-items`). Kierroksen
omia ovat vastausnuoli ja lainauksen säännöt, jotka käyttävät vain tokeneita.
`AssistantMessage` ei vielä ota `actions`-proppia, joten painike viedään
portaalilla siihen kohtaan korttia, johon tuotanto sen antaisi.

## Suunnat

- **A Liite**: lainaus on luonnoksen liitekortin näköinen (`.ah-attachment-chip`:
  viiva, säde, pinta) kentän yllä. ↩ on kortin oikeassa yläkulmassa
  `actions`-paikassa kuten Palaa tähän -valikko (työpöydällä osoittimen alla).
  Hyppy välähdyttää alkuperäisen.
- **B Kentän sisällä**: lainaus on kentän laatikon ensimmäinen rivi, upotettu
  pinta kuten Markdownin frontmatter (`--ah-sunken`, `--ah-line-soft`). ↩ on
  Kopioi-painikkeen vieressä samassa esitystavassa. Alkuperäinen on samaa
  upotettua pintaa niin kauan kuin vastaus on kesken.
- **C Jonon rivi**: lainaus on jonon oma otsake ja yksi rivi
  (`.ah-queue-heading`, `.ah-queue-items`). *Vastaa*-tekstipainike on viestin
  alla. Alkuperäinen pysyy jonon rivin sävyssä (`--ah-accent-soft`), kunnes
  vastaus lähtee.

Lähetetyn viestin lainaus on kussakin samaa pintaa kuin kentässä. *Näytä,
mitä natiivi istunto kirjaa* näyttää suositellun vaihtoehdon tekstin
(issuen `result.md`, *Mitä agentille lähtee*).

## Rakentaminen ja tarkistus

```
ln -s <open-habitat>/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-23-reply-to-message-2/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-23-reply-to-message-2/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

`check.mjs` käy kaikki suunnat Päivä-, Yö- ja Korkea kontrasti -teemassa
1440 ja 390 px: lainauksen paikka (kentän yllä tai sisällä, kentän levyinen),
ettei vasen reuna ole muita leveämpi tai eri värinen, painikkeen paikka
(kulma, Kopioin ja kellonajan välissä, viestin alla), alkuperäisen merkintä,
hypyt, ✕ luonnoksen säilyessä, uusi vastaus, lähetys ja natiivin istunnon
teksti. Konsolin pitää pysyä puhtaana.
