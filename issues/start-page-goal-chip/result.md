# Tulos: tavoitesiru ja opas sivupaneelissa

Toteutettu suunta A (proto-start-page-goal). Aloita kirjoittaa luonnoksen
alkuun tavoitteen taitokutsun `/skill:<nimi> `, ja viestikenttä näyttää sen
tavoitesiruna. Kenttään jää henkilön oma teksti ja paikkamerkki. Oppaan
vaiheet ovat oikean reunan paneelissa (työpöydällä auki Aloitasta, puhelimessa
yläpalkin Opas-painikkeesta). Lähetetty viesti on Pi:n oma taitokutsu, joten
historian taitosiru näyttää tavoitteen nimen (taidon kuvaus). Uudelleenlatauksen
jälkeen tavoite löytyy Pi:n tallentamasta taitokutsusta.

Tarkistukset: `test-focused.sh --area web`, `--area go --go-package
./internal/daemon`, selainspecit `lab-start-page-goal.spec.ts` (1440 vaalea,
390 tumma) ja `start-here.spec.ts`; koko selainsarja ennen yhdistämistä.
Katselmus: `/llm-review` (gpt-6-astra) ja `/assess-findings`; kolme
vahvistettua löydöstä korjattiin testeineen (tavoitteen teksti ei ole
`!`-komento, opas palaa myös kun taitokutsu on vanhemmassa historiassa,
fokus siirtyy oppaaseen kun se korvaa toisen paneelin).

## Decisions for later review

1. **Siru on luonnoksen alun näyttötapa, ei erillinen tila.** Siru näkyy, kun
   luonnos alkaa aloitussivun tavoitteen taidon kutsulla ja välilyönnillä
   (result.md:n ehdottama yksinkertaistus). Myös itse kirjoitettu
   `/skill:<tavoitteen taito> ` saa sirun. Vaihtoehto: erillinen sirutila
   (prototyyppi). Syy: luonnos pysyy täsmälleen siinä muodossa, jonka Pi saa,
   eikä uutta tilaa tallenneta.
2. **Oma taito tunnistetaan kuvauksesta.** Jos taidon kuvaus on sama kuin
   tavoitteen otsikko (1b:n ohje), pyyntöä ei kirjoiteta luonnokseen, koska
   taito kantaa sen. Muussa tapauksessa (yleinen taito, kuten `review`)
   pyyntö tulee sirun perään kenttään kuten ennen. Vaihtoehdot: jättää pyyntö
   aina pois (vanhat sivut menettäisivät pyyntönsä) tai uusi kenttä
   sivumuotoon. Syy: sivumuoto ei muutu, ja olemassa olevat sivut toimivat.
3. **Sivumuoto ennallaan; `prompt` toistaa taidon rungon.** Sirun kortti ja
   **Muokkaa tekstinä** käyttävät sivun `prompt`ia, ja host tarjoaa sitä
   tekstinä, jos taito katoaa. Taito-ohje pyytää pitämään ne samoina.
   Vaihtoehto: korttiin taidon oikea runko (vaatisi uuden lukureitin).
4. **Sirun kortti on tuotannon sivuarkki** (sama kuin historian taitosirun
   lukunäkymä), ei prototyypin korttia kentän yllä. Syy: olemassa oleva,
   saavutettava malli.
5. **Opas jakaa oikean reunan paneelin** näkymien ja tiedostohyllyn kanssa
   (yksi paneeli kerrallaan). Oppaan oletusleveys on 400 px, erillään
   näkymän leveydestä.
6. **Paneelin tila on välilehden muistissa** (moduulin muisti, ei
   sessionStorage): uudelleenlataus sulkee paneelin, ja tavoite tulee Pi:n
   historiasta. Luonnin aikana aloitettu opas siirtyy luodulle keskustelulle
   samassa kohdassa kuin luonnos (`adoptCreation`).
7. **Tavoitteen palautus:** ensin ladatun historian uusin tavoitteen
   taitokutsu, sitten keskustelun ensimmäisen viestin taitokutsu natiivin
   historian alusta (`history?after=&limit=10`, olemassa oleva sopimus), kun
   historiaa on ladattua enemmän. Aloita on tarjolla vain ennen ensimmäistä
   viestiä, joten aloitettu tavoite on aina ensimmäinen viesti.
8. **Otsikkoa ei johdeta tavoitteesta.** Jarin kysymys 3 (saako taidolla
   aloitettu keskustelu nimen tavoitteesta) on erillinen host-päätös eikä
   kuulunut tähän issueen; otsikko syntyy kuten ennenkin.
9. **Labin ensimmäinen tavoite on 1b-muotoinen** (`korjaa-ongelma`), ja
   labin Pi-korvike laajentaa nyt minkä tahansa projektitaidon kuten Pi.
