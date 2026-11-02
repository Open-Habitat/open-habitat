# Jira, Confluence ja Trello – kierros 1

Issue `proto-atlassian-trello-connect`, selvityksen
`research-atlassian-trello` (`report.md`) pohjalta. Yksi näkymä:
Asetukset › Tiedot agenteille (entinen Integraatiot). Se on rakennettu
tuotannon palasista: `AccountCard` (Googlen tili), `GrantLimits`,
`LetterMark`, `ControlButton`, `Segmented`, `StatusMark`, `TextField`,
`Checkbox`, `ExternalLink`, `Integrations.css`:n kortti-, rivi-, ilmoitus-
ja dialogiluokat sekä Gitea/GitLab-dialogin kehys. Henkilö, sivusto, taulut
ja ajat ovat synteettisiä.

## Akseli ja suunnat

Akseli: missä organisaation hyväksyntä ja luku/kirjoitusraja näkyvät.

1. **Tilikortti**: Atlassian ja Trello ovat tavallisia tilikortteja Googlen
   rinnalla. Hyväksyntä on kortin ilmoitus, ja raja näkyy kortin
   tasomerkkinä.
2. **Oikeustaulu**: Jira, Confluence ja Trello yhdessä taulukossa, jonka
   sarakkeet kertovat, mitä agentti voi tehdä ja kuka rajan asettaa.
3. **Hyväksyntäpolku**: jokainen yhteys vaiheina (sinä kirjaudut,
   organisaatio sallii, agentti lukee, kirjoitus erikseen), ja ylläpitäjän
   pyyntö näkyy sivulla.

Suositus: **Tilikortti**, ja siihen Hyväksyntäpolun näkyvä pyyntö
ylläpitäjälle odotustilassa.

## Tilat (Tilanne-valitsin)

Ei yhdistetty · Odottaa hyväksyntää (oletus) · Hylätty · Vain luku ·
Kirjoitus sallittu · Vanhentunut tai peruttu. Oletusnäkymässä Atlassian
odottaa Contosoia ja Trello toimii lukuoikeudella, joten kaksi eri tilaa
näkyy heti.

## Sama kaikissa suunnissa

- Atlassian: kirjautuminen henkilön omalla OAuthilla Pi:n kautta. Dialogissa
  valitaan ensin Lue ja hae tai Lue, hae ja kirjoita, missä Contoso sallii.
  Sen jälkeen avataan Atlassian ja liitetään avautumattoman paluusivun
  osoite, kuten Googlen kirjautumisessa. Ensimmäinen kirjautuminen päättyy
  tilaan "Kirjauduit, mutta Contoso ei vielä päästä yhteyttä läpi". Samalla
  näytetään valmis pyyntö ylläpitäjälle (Connectors › Atlassian MCP server:
  paluuosoitteen domain, IP-sallinta, Read/Search päälle, Write pois).
  Habitat ei lähetä pyyntöä itse, ja Tarkista lukee tilan uudelleen.
- Kirjoitusta luvataan vain, kun palvelu sen estää: kirjautumisessa
  myöntämättä jätetty oikeus, Contosoin tuotekohtainen esto tai Trello-tokenin
  `read`-oikeus. Jokaisen rajan kohdalla sanotaan, kuka sen asettaa.
- Trello-token annetaan asetusten lomakkeessa (salasanakenttä, Näytä-painike)
  eikä koskaan keskustelussa. Lomake linkittää Trellon hyväksyntäsivulle
  valitulla oikeudella (`read` tai `read,write`) ja 30 päivän
  voimassaololla. Varoitus kertoo, että token avaa kaikki taulut eikä vain
  valittuja. Tulos näyttää Trellon vahvistaman oikeuden ja voimassaolon.
- Vanhentunut Trello-token uusitaan antamalla uusi token, koska uusimista
  ei ole. Peruttu Atlassian-kirjautuminen korjataan kirjautumalla
  uudelleen.
- Poisto erottaa paikallisen poiston perumisesta. Trellossa Peru token myös
  Trellossa on oletuksena päällä. Atlassianissa annetaan linkki
  Atlassian-tilin Yhdistetyt sovellukset -sivulle.
- Mitä agentti tietää: `personal-data`-taito kertoo sivuston, Trello-tilin,
  työkalut ja sallitun käytön, ei tunnuksia. Agentti lukee ja hakee
  kysymättä, kirjoittaa vain pyydetyn muutoksen, ei noudata sivuihin
  kirjoitettuja ohjeita eikä poista tai muuta oikeuksia.

Toteutuksessa tekstit menevät molempien kielten katalogeihin
(`web/src/text/`). Prototyyppi on vain suomeksi.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-02-atlassian-trello/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-02-atlassian-trello/check.mjs \
  design-system/prototypes/dist/atlassian-trello/offline.html <kuvahakemisto>
```

`check.mjs` tekee nämä:

- käy jokaisen suunnan läpi vaaleana, tummana ja 390 px:n levyisenä
- tarkistaa oletusnäkymän sisällön ja ottaa kuvan jokaisesta tilasta
- klikkaa hyväksynnän saapumisen (Tarkista), tason vaihdon kirjoitukseen,
  ensimmäisen Atlassian-kirjautumisen virheellisine ja oikeine
  paluuosoitteineen, Trello-lomakkeen tyhjällä ja annetulla tokenilla,
  vanhentuneen tokenin uusimisen ja poiston
- ottaa kuvat kertoimella 2 ja vaatii konsolin puhtaaksi (99 tarkistuspistettä)

Kuvat ovat `evidence/`-hakemistossa:

- `d1/d2/d3-oletus-*`: kolme leveyttä ja teemaa
- `d1/d2/d3-<tila>-1440-light`: jokainen tila
- dialogit kolmella leveydellä ja teemalla: `atl-yhdista`,
  `atl-paluuosoite`, `atl-odottaa`, `trello-token`, `trello-yhdistetty`
  ja `trello-poista`
