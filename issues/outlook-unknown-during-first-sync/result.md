# Tulos

Syy: kun tilin ensimmäinen tiedostosynkronointi (tai sitä edeltävä laskenta)
on käynnissä, luettelon tarkistus ei kysy natiivityökaluilta mitään, koska ne
jakavat ajon natiivilukon ja tunnuksen. Se merkitsi kaikki palvelut tilaan
`unknown`, ja kortti sanoi Postille, Kalenterille ja Yhteystiedoille *Tilaa ei
saatu selville* koko ajon ajan (Contosoilla laskenta 16 min, oikea kopio
tunteja).

Nyt tarkistus antaa niille uuden tilan `pending_first_sync`
(`catalog_linux.go` `Catalog.check`). Kortti näyttää sen neutraalisti
kellokuvakkeella: *Tarkistetaan ensimmäisen synkronoinnin jälkeen* /
*Checked after the first sync*, ilman varoitusväriä ja ilman *Tarkistettu
klo …* -aikaa, koska palvelua ei tarkistettu. Ajon kopioimat tiedostot
näkyvät edelleen tilassa *Synkronoi* edistymisineen. Kun ajo päättyy, seuraava
tarkistus kysyy työkaluilta tavalliseen tapaan. Natiiviprosesseja ei
käynnistetä ajon rinnalla.

Tarkistetut muut palvelut ja tilanteet:

- Google (Gmail, Kalenteri, Yhteystiedot) ja Dropbox: sama haara, sama
  korjaus. Microsoftin SharePoint ja Teams-kirjastot, joita ajo ei kopioi:
  samoin.
- Saman palveluntarjoajan toinen tili, kun ensimmäisen tilin ajo pitää
  natiivilukkoa: kaikki sen palvelut ovat `pending_first_sync`; tiedostojen
  viimeisin synkronointiaika näkyy yhä, koska se luetaan rclonen omista
  listauksista.
- Kirjautumisen viimeistely (koodin vaihto, kansioiden haku) pitää samaa
  lukkoa ilman ensimmäistä ajoa: jää `unknown`ksi (katso päätökset).
  Katselmus löysi tämän; korjattu ennen yhdistämistä.
- Apple-kortti (IMAP/DAV): ei ensimmäisiä ajoja, ei muutosta.

Todisteet: `TestServicesBesideFirstPassWaitForIt` (oma tili: tiedostot
`syncing`, muut `pending_first_sync`; toinen tili: kaikki
`pending_first_sync`; työkalua ei kysytty kertaakaan; kirjautumisen lukko
antaa `unknown`; ajon jälkeen työkalu kysytään ja tila on `ok`),
`web/tests/lab-integration-first-sync.spec.ts` (kortti 1280 vaalea ja 390
tumma: odottavat rivit ilman varoitustyyliä ja ilman tarkistusaikaa, axe,
ei vaakavieritystä, uudelleentarkistuksen jälkeen `ok` ja tarkistusajat
palaavat; ×3 toistoa vihreänä), Storybook `MicrosoftFirstSync`.
Selitystilassa ei ole palvelurivikohtaisia kortteja (asetussivulla on yksi
kortti, rivit kuvaavat itsensä), joten uusi tila ei tarvinnut korttia.

Katselmus: `/llm-review` (gpt-6-astra etsijänä, paikallinen todennus) ja
`/assess-findings`: yksi vahvistettu löydös (kirjautumisen viimeistely
väitettiin ensimmäiseksi synkronoinniksi), korjattu.

## Päätökset myöhempää tarkistusta varten

- **Uusi tila eikä viimeisin tunnettu tarkistus.** Vaihtoehto oli näyttää
  edellisen onnistuneen tarkistuksen tulos. Luettelo ei tallenna aiempia
  tarkistuksia, ja niiden tallentaminen olisi uusi välimuisti natiivin
  totuuden rinnalle, mitä projekti välttää; ensimmäisen ajon aikana uudella
  tilillä aiempaa tarkistusta ei edes ole. Totuudenmukainen *tarkistetaan
  jälkeen* -tila ei vaadi tallennusta.
- **Ei luettu Outlookin MSAL-välimuistia lukotta.** Se olisi antanut oikean
  tilan, mutta Commit nimeää välimuistin uudelleen saman lukon alla, ja
  lukoton luku vaatisi oman suunnittelunsa. Hyöty (tunnuksen voimassaolo
  ajon aikana) ei riitä siihen nyt.
- **Kirjautumisen viimeistely jää `unknown`ksi.** Se kestää sekunneista
  minuutteihin; *ensimmäisen synkronoinnin jälkeen* olisi väärä, koska
  ajoa ei välttämättä tule. Jos tämäkin halutaan pois, sille tarvitaan oma
  sanansa (esim. *tarkistetaan, kun kirjautuminen valmistuu*).
- **Sama teksti toisen tilin palveluille.** Teksti ei nimeä, kenen
  ensimmäistä synkronointia odotetaan; tilin nimeäminen vaatisi sopimukseen
  lisäkentän. Kortti sanoo saman yleisemmin, ja tila on harvinainen.
- **Ei varoitusväriä, kellokuvake.** Odottaminen ei ole vika; `unknown`
  pitää varoituksensa.
