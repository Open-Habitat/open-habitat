# Tulos: myönnön lukeminen ja kapeamman myönnön hyväksyminen (vaihe 1/3)

Toteutettu. Daemon lukee jokaisen OAuth-tilin myönnön palvelukohtaiseksi
tasoksi (`access`: full, drafts, read, none) `Service`-riveille ja myönnön
palvelun omin nimin tilille (`grant`: granted, not_granted). Lähteet:

- **Google**: kirjautuminen tuo tokenivastauksen scopet gogin omaan
  avainrenkaaseen, ja ne luetaan takaisin `gog auth list --json`
  -komennolla ilman verkkoa. Osittainen suostumus hyväksytään.
- **Microsoft**: kirjautuminen pyytää `https://graph.microsoft.com/.default`,
  joten organisaation kapeampi hyväksyntä yhdistyy. Adapterin `verify`
  palauttaa tenantin vastauksen scopet jokaisella tilatarkistuksella.
  ms-365-mcp-serverin `--allowed-scopes` johdetaan myönnöstä ja säilyy
  tenantin vaihdon (Align) yli.
- **Dropbox**: kirjautuminen tarkistaa tokenin scopet; Dropbox ei myönnä
  kapeampaa joukkoa tähän pyyntöön.

Myönnöstä, joka ei ulotu yhteenkään palveluun, tulee kirjautumisvirhe
`nothing_granted`. Sivun yläosan varoitus kertoo nyt, mitä myöntö ei estä.

Katselmointi: riippumaton `/llm-review` (etsijä gpt-6-astra, varmistaja
claude-fable-5-1) ja `/assess-findings`. Kaksi vahvistettua löydöstä
korjattiin: taso ei saa koskaan väittää vähempää kuin token pystyy (Mail.Send
on aina täysi posti; Files.* ja Sites.* ulottuvat kumpikin OneDriveen ja
kirjastoihin). Kolmas (käynnissä oleva MCP-palvelin pitää vanhan
access tokenin enintään sen elinajan) on olemassa jo ennestään ja jätettiin.

## Päätöksiä myöhempää tarkistusta varten

- **Microsoft pyytää `.default`-scopea eikä nimettyjä oikeuksia.** Vaihtoehto
  oli jatkaa nimetyillä. Nimetty oikeus, jota tenant ei ole hyväksynyt,
  kaataa koko pyynnön (AADSTS65001), joten kapeampi organisaation myöntö ei
  olisi koskaan päätynyt daemonille. Ylläpitäjän hyväksyntälinkki pyytää
  edelleen koko Täysi-joukon.
- **Vain luku -tiedostoja ei synkronoida tässä vaiheessa.** Vaihtoehto oli
  yksisuuntainen peili. Peili kuuluu Tilitason vaiheisiin; nyt rivi sanoo,
  ettei tiedostoja synkronoida, koska synkronointi kulkee molempiin
  suuntiin. Googlella Drive-oikeudeton tai lukuoikeudellinen myöntö ei saa
  rclone-kirjautumista, ja uusi kapeampi kirjautuminen poistaa aiemman.
- **Taso ei koskaan väitä vähempää kuin token pystyy.** Esim. Mail.Read +
  Mail.Send näkyy täytenä postina, ei vain lukuna, koska erillistä
  "lukee ja lähettää" -tasoa ei ole. Vaihtoehto olisi ollut uusi taso.
- **Kuka rajasi, päätellään palveluntarjoajasta.** Microsoftilla teksti on
  "Organisaatiosi on rajannut…", Googlella "Kirjautuessa jäi myöntämättä…"
  ja maininta Workspace-ylläpitäjästä. Organisaation nimeä ei haeta.
- **Dropboxin myöntö on aina täysi.** Dropbox hylkää pyynnön, jota sovellus
  ei voi myöntää kokonaan, eikä henkilö voi jättää scopeja pois, joten
  tallennettu kirjautuminen kantaa pyydetyn joukon. Kapeampi tokeni
  hylätään (`nothing_granted`), koska ainoa palvelu on kaksisuuntainen
  synkronointi.
- **Microsoftin myöntö luetaan tenantin vastauksesta tilatarkistuksessa.**
  Jos tenanttiin ei saada yhteyttä, tasoja ei näytetä lainkaan (ei arvata).
  Taidon (personal-data) teksti lukee Outlookin tason Pi:n MCP-
  rekisteröinnin `--allowed-scopes`-arvosta, koska taito kirjoitetaan
  ilman verkkoa.
- **Organisaation myöhempi kavennus ei päivitä MCP-rekisteröintiä ennen
  uutta kirjautumista.** Sivu näyttää kavennuksen heti; työkalun
  token-pyynnöt epäonnistuvat, kunnes henkilö kirjautuu uudelleen.

Ei todennettu: oikean tenantin käytös `.default`-pyynnöllä osittaisen
hyväksynnän kanssa (vain synteettinen Entra).
