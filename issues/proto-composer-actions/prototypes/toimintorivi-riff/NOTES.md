# Sanelu kirjoituskentän rivillä: kierros 2, opas

Avaa `index.html` selaimessa (toimii ilman verkkoa). Alhaalla oleva valitsin
vaihtaa suuntaa (1–4 tai ← →). Yläpalkin painikkeet:

- **Tila**: *Levossa*, *Työssä*, *Painettu* (mikrofoni on auki, yhteys
  aukeaa vielä), *Kuuntelee*, *Kuuntelee + työ* (agentti työskentelee
  sanelun aikana) ja *Viimeistely* (viimeiset sanat vahvistuvat).
  *▶ Kulku* näyttää koko kulun alusta loppuun ja toistaa sitä: lepo,
  painallus, kuuntelu, Valmis ja lopuksi teksti kentässä.
- **Kenttä: Tyhjä / Tekstiä**: sanelu jatkaa kentässä jo olevan tekstin
  perään, kuten tuotannossa.
- **Haamut: Vastintilan paikat**: piirtää katkoviivoin vastintilan
  painikkeet. Kuuntelun vastintila on lepo ja painetun tilan vastintila on
  kuuntelu. Jos viiva ei osu painikkeeseen, painike hyppää.
- **Teema** ja **Leveys**. Kapeaa puhelinta voi kokeilla lisäämällä
  osoitteeseen `&pw=360`.

Kaikki toimii myös käsin. Sanele aloittaa sanelun, ja *Valmis*, Enter tai
Esc lopettaa sen niin, että teksti jää kenttään. Rasti peruu sanelun
pois, jolloin kenttä palaa ennalleen. Lähetä lopettaa sanelun ja lähettää
tekstin. Pikanäppäin `Ctrl+Shift+Space` (Macissa `⌘⇧Space`) aloittaa ja
lopettaa sanelun. Se on paikanpitäjä: oikea pikanäppäin tulee
rinnakkaisesta `dictation-fast-start-keys`-työstä. Puhe on synteettistä,
eikä mikrofonia käytetä.

## Lähtökohta: *Nyt*

*Nyt* on tämänpäiväinen tuotanto sellaisenaan. Siinä Sanele-painikkeen
paikalle kasvaa punertava pilleri, jossa on piste, tasopalkit, aika,
”kuuntelee” ja *Valmis*. Työpöydällä apupainikkeet himmenevät, ja
puhelimessa pilleri vie koko rivin. Huomioita:

- **Painettu näyttää väärää.** Kun Sanelea painaa, ääni tallentuu jo
  ennen kuin yhteys puhepalveluun on auki, mutta pilleri näyttää harmaata
  ”Yhdistetään…” ja kenttä ”Yhdistetään Sonioxiin…”. Se kehottaa
  odottamaan, vaikka voisi jo puhua.
- **Sanelu hyppää, kun agentti aloittaa työn** sanelun aikana, samasta
  syystä kuin kierroksella 1.
- **Kapealla puhelimella pilleri ei mahdu.** Kun agentti työskentelee,
  *Valmis* piirtyy Ohjaa-sirun päälle (näkyy prototyypissä, ei vielä
  todettu oikealla puhelimella).
- Perumista ei ole: sekä Esc että *Valmis* jättävät tekstin kenttään.

## Suunnat

Kaikissa kolmessa painettu tila näyttää heti punaiset, liikkuvat
tasopalkit ja tekstin ”kuuntelee · yhdistää…”. Kentässä lukee ”Puhu vain,
ääni tallentuu jo”. Kaikissa on myös peru-rasti. Ohjaa pysyy omana
erottuvana sirunaan.

1. **Paikallaan.** Rivin järjestys on kierroksen 1 *Roolit*, mutta Sanele
   on vasemman ryhmän ensimmäinen. Pilleri kasvaa Sanelen kohdalta
   oikealle apupainikkeiden päälle, ja ne pysyvät alla paikoillaan. Pilleri
   näyttää samalta kuin nyt (piste, palkit, aika, ”kuuntelee”, *Valmis*),
   lisänä on rasti ja *Valmis*-painikkeessa näkyvä Enter. Pilleri on aina
   saman levyinen, joten *Valmis* ei liiku edes silloin, kun agentti
   aloittaa työn. Puhelimessa pilleri on lyhyempi (palkit, rasti, Valmis).
   *Hinta:* Sanele siirtyy oikealta vasempaan reunaan, ja apupainikkeet
   ovat sanelun ajan piilossa.
2. **Palkki.** Järjestys on kierroksen 1 *Ankkuroitu*, eli Sanele ja Lähetä
   ovat oikeassa reunassa kuten nyt. Kun Sanelea painaa, koko vasen puoli
   muuttuu leveäksi kuuntelupalkiksi (rasti, aika, ääniaalto, ”Enter
   valmis”). Sanelen paikalle tulee *Valmis*, joten lopettaminen tapahtuu
   samasta kohdasta kuin aloittaminen.
   *Hinta:* puhelimessa *Valmis* on pelkkä ✓-kuvake. Palkin oikea pää
   lyhenee, kun Ohjaa ja Stop tulevat näkyviin kesken sanelun, mutta
   painikkeet eivät liiku.
3. **Kenttä.** Järjestys on kierroksen 1 *Roolit* sellaisenaan. Rivi ei
   muutu lainkaan: vain Sanele vaihtuu samankokoiseksi *Valmis*-painikkeeksi.
   Kuuntelu näkyy kentän yläreunan nauhassa (aika, ääniaalto, rasti), ja
   teksti tulee sen alle.
   *Hinta:* nykyinen ”kasvava painike”, josta pidät, muuttuu nauhaksi
   kentän sisällä. Kenttä kasvaa yhden rivin verran korkeammaksi.

## Suositus

**Paikallaan.** Se säilyttää nykyisen kuuntelunäkymän, josta pidät. Mikään
ei hyppää missään tilassa, ei työpöydällä eikä 360 px:n puhelimessa.
Suunta jatkaa kierroksen 1 suositusta (Roolit) niin, että Sanele on
syötön apuvälineiden alussa. Painettu tila kertoo, että voi jo puhua.

Arvioi erityisesti, sopiiko Sanele rivin vasempaan reunaan vai haluatko
sen oikealle Lähetän viereen (silloin *Palkki*). Tehdyt valinnat on
kirjattu issuen `result.md`-tiedostoon kohtaan *Decisions for later
review*. Esimerkkejä ovat peru-rasti, pikanäppäimen paikanpitäjä ja
puhelimen lyhennetty pilleri.
