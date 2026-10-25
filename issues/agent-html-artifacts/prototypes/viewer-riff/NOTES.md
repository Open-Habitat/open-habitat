# HTML-näkymät · Kierros 2: ihminen valitsee paikan

Jarin 25.10. valitsema oikean reunan paneeli on yhteinen lähtökohta.
Tässä verrataan **valinnan tekemistä ja sen jatkuvuutta**, ei raportti- ja
prototyyppikortteja. Sama `offer(i)` piirtää molemmat: jäädytetyn HTML:n ja
käynnissä olevan prototyypin. Tieto sisällön lajista ei valitse paikkaa.
Kaikki henkilöt, luvut ja osoitteet ovat synteettisiä.

| Suunta | Akseli ja vahvuus | Hinta |
| --- | --- | --- |
| Suora | Kaksi näkyvää toimintoa joka kortissa: **Avaa** paneeliin ja **Avaa omalle välilehdelle**. Jokainen painallus on uusi valinta, eikä aiempi käyttö muuta sitä. | Leveämpi kortti; puhelimessa painikkeet rivittyvät. Toistuva välilehtikäyttäjä tekee aina toissijaisen valinnan. |
| Muistava | Pääpainike kertoo viimeksi valitun paikan. **Vaihda** avaa kaksi vaihtoehtoa, joista valittu sekä avaa että muuttuu seuraavaksi päätoiminnoksi. Sama muistettu paikka koskee tiedostoja ja eläviä näkymiä. | Painikkeen merkitys muuttuu; paikka on luettava. Välilehden valitseminen raportille vaikuttaa myös seuraavaan prototyyppiin. |
| Oletus | **Oma oletus** on selaimen näkymäasetuksen luonnos. Kortin **Avaa muualla** ohittaa sen kerran, muuttamatta oletusta. Toistuva käyttö pysyy vakaana mutta poikkeus onnistuu. | Yksi erillinen asetus sekä kaksi eri käsitettä: pysyvä oletus ja kertavalinta. Asetusrivi vie tässä näkyvästi tilaa. |

Mikään suunta ei muuta sisältöä tai avaa mitään agentin aloitteesta.
Valitsimen ulkoasu ja johdotus ovat prototype-skillin `PICKER.md`:stä,
vain nimet vaihtuvat ja ehdollinen uusintapainike jää pois. Vaihto on välitön.
Habitatin tokenit, fontit, keskustelupinta ja raportin luvut on otettu kierroksesta 1.
Kierros 1 jää vertailuksi; tämä kierros korvaa sen KOKEILTAVAA-rivin.

## Kokeile

```sh
tw browser-open ~/Sources/open-habitat/issues/agent-html-artifacts/prototypes/viewer-riff/index.html
```

Yksi HTML-tiedosto, ei verkkoyhteyttä. **1–3**, **←/→** vaihtavat suuntaa,
**R** aloittaa näkymän uudelleen. `?v=` säilyttää valitun suunnan.

1. Avaa raportti paneeliin ja kokeile **Eurot / Tilaukset**. Avaa sitten
   käynnissä oleva tilannekuva samalla korttitoiminnolla. Paneelin nimipainikkeet
   vaihtavat tarjottujen sisältöjen välillä avaamatta uutta paneelia.
2. **Laajenna** antaa sisällölle tilan ja taittaa keskustelun vasemmaksi
   kaistaleeksi. **Pienennä** tai kaistale palauttaa rinnakkaislukemisen.
   Jakajaa voi vetää, säätää nuolilla tai palauttaa kaksoisnapsautuksella.
3. **Sulje** (tai Escape Habitatin omissa kontrolleissa) palauttaa fokuksen
   aloituskortin Avaa-painikkeeseen. Sulkeminen ei hylkää tarjousta.
   Iframe ei välitä Escapea isännälle: Tab / Shift+Tab tuo takaisin kehykseen.
4. Avaa molemmat sisällöt omalle välilehdelle suoraan kortilta. Kokeile myös
   paneelin **Avaa välilehdellä**. Se pyytää uuden välilehden, mutta **jättää
   paneelin ja sen nykyisen tilan auki**. Ilmoitus kertoo tämän; sulje paneeli
   itse, jos et tarvitse sitä. Selain voi estää avauksen, joten ilmoitus ei
   väitä sisällön näkyvän. Korttiavaus ei sulje jo auki olevaa paneelia.
5. Muistavassa valitse raportille välilehti. Nyt myös tilannekuvan pääpainike
   avaa välilehden. Valitse paneeli takaisin. Oletus-suunnassa aseta
   välilehtioletus ja avaa kerran paneeliin: seuraava päätoiminto on yhä välilehti.
6. Puhelimessa paneeli korvaa keskustelun koko koealueella; Sulje palauttaa
   keskusteluun. Laajenna taittaa sen myös paluukaistaleeksi. Erillinen välilehti
   avaa uuden selainkohteen, ei Habitatin sisäistä välilehteä. Palaa alkuperäiseen
   selaimen välilehtivalitsimella; koe ei pakota navigointia takaisin.
7. Yläpalkki tarjoaa vanhentuneet tarjoukset, palvelimen offline-tilan sekä
   pysähtyneen tai vastaamattoman prototyypin. Avauspainikkeet ovat estettyjä
   molemmille paikoille; toimiva jäädytetty raportti säilyy avattavana, vaikka
   prototyyppi pysähtyy. Palvelinta ei käynnistetä selaimesta.

## Ratkaisuja myöhempää arviointia varten

- **Muistamisen rajaus:** tässä kokeessa `sessionStorage` jäljittelee henkilön
  valintaa vain nykyisessä selainvälilehdessä. Muistava ja Oletus käyttävät eri
  avaimia; valinta säilyy latauksessa ja R:llä, mutta ei ole tilikohtainen asetus
  eikä lupaus laitteiden välisestä synkronoinnista. Säilytysvirhe kerrotaan;
  muistamaton avaus palautuu paneeliin. Tuotannon muistamisen laajuus jää valittavaksi.
- **Muistava oppii vain kortin paikkavalinnasta.** Paneelin pop-out on tämän
  katselukerran toiminto eikä vaihda seuraavaa avauspaikkaa. Oletus ei opi käytöstä.
- **Pop-out ei poista paneelia:** tämä kestää selaimen estämän avauksen eikä
  hävitä lukukohtaa. Haittana on saman sisällön kaksi katselupaikkaa; henkilö
  sulkee tarpeettoman itse. Tämä on tarkoituksellinen arvioitava ratkaisu.
- **Laajenna on paikallinen katselutila**, ei uusi avausoletus. Se ei muuta
  Muistavan pääpainiketta eikä Oletusta. Sulkeminen palauttaa normaalin tilan.
- **Kokeen poikkeustilan vaihto aloittaa suunnan uudelleen.** Se ei mallinna
  elävän yhteyden katkeamista kesken katselun, varmuuskopiota tai uudelleenyhdistämistä.
- **Erillinen osoite on näkyvä simulaatio.** Kumpikin sisältö avautuu oikeaan
  `blob:`-välilehteen `noopener noreferrer` -linkillä. Sivun yläosa näyttää
  erilliset `oh-view-jaana-frozen-demo.example.invalid`- ja
  `oh-view-jaana-live-demo.example.invalid`-osoitteet ja tekstin **Vain sinulle**.
  Ei oikeaa palvelinta, kirjautumista, pääsynvalvontaa tai jaettavaa linkkiä.
- **Sisältö on oikea sandbox-iframe**, ilman same-origin-oikeutta. Verkko on
  estetty. Tämä todistaa vain offline-vuorovaikutuksen, ei tuotannon eristystä.
- Oma oletus on tarkoituksella näkyvissä vertailussa. Tuotannon Asetukset-sivua
  ei rakennettu eikä tämän sijaintia ole päätetty. Jakaminen ja julkisuus ovat
  kokonaan ulkopuolella.

## Rakentaminen ja näyttö

```sh
python3 issues/agent-html-artifacts/prototypes/viewer-riff/build.py
PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" node issues/agent-html-artifacts/prototypes/viewer-riff/check.mjs
python3 scripts/validate-project-view.py
git diff --stat main -- web/ internal/ contracts/
```

`evidence/` sisältää jokaisesta suunnasta työpöydän (1440×1000) ja puhelimen
(390×844) vaaleat ja tummat kuvat: tarjoukset, paneeli, laajennus sekä valikko
niissä suunnissa, joissa se on. Lisäksi erillinen välilehti ja poikkeustilat.
`check.log` kertoo toiminnallisen tarkistuksen lopputuloksen. Kuvien synteettinen
sisältö ei ole asiakasdataa. Oikean puhelimen selainta tai ruudunlukijaa ei testata.

## Kohdennettu itsearviointi · prototype-skillin craft bar

- Kolme eri toimintamallia, ei kolme väriä: aina eksplisiittinen, käytöstä
  muistava sekä asetettu oletus / kertapoikkeus. Kaikki käyttävät samaa paneelia.
- Kummankin sisältölajin molemmat avauspaikat ovat toimivia. Nimet, luvut,
  tilaviestit, mittaripainikkeet ja erillinen sivu ovat kokeiltavissa.
  Lähetä kertoo rehellisesti, ettei koetila kutsu agenttia.
- Avaus siirtää fokuksen otsikkoon; sulkeminen palauttaa sen alkuperäiselle
  kortille myös valikosta avattaessa. Puhelimen piilotettu keskustelu on inertti.
- Paneelin sulkeminen, Laajenna/paluu ja pop-out on erotettu. Ei piilotettua
  oppimista pop-outista, automaattista navigointia tai pakotettua välilehteä.
- Sisällön vaihdossa ei ole animaatiota. Valitsimen ainoa liike käyttää skillin
  omaa alle 300 ms ease-out-ajoitusta ja reduced-motion-tukea.
- Kuvista tarkistettiin työpöydän suora paneeli, Oletus-suunnan asetus/ohitus,
  Muistavan puhelinvalikko, vaalea laajennus, tumma puhelinpaneeli sekä erillinen
  prototyyppisivu. Fontista puuttuva valikkonuoli korvattiin CSS-nuolella.
  Kuvausta muutettiin vierittämään tarjous kokonaan näkyviin: puhelimen ensimmäinen
  kuva näytti aiemmin kortista vain otsikon. Nyt myös kummankin kortin toiminnot
  ovat omissa kuvissaan. Ei vaakaylivuotoa, paneeli ei peitä valitsinta.
  Pienen ruudun pitkästä keskustelusta joutuu yhä vierittämään kortille; tämä on
  näkyvä kustannus etenkin asetusrivin kanssa. Tarkistukset eivät korvaa Jarin valintaa.

## Työkalujen epäonnistumiset ja rajat

Ensimmäinen selainajo keskeytyi ennen selaimen käynnistystä:
`ReferenceError: browser is not defined`. Testipohjan generointi katkaisi
alustuksen ensimmäisen importin `try`-lohkon kohdalta. Korjattu testipohja
ajettiin uudelleen onnistuneesti; lopullinen tarkistus sisältää myös iframe-fokuksen
palautuksen ja näkymän vaihdon. Ensimmäisen yrityksen loki on
`evidence/check-attempt-1.log`, onnistuneen lopullisen ajon `evidence/check.log`.
Ei puuttuvia vaadittuja tarkistuksia eikä muita epäonnistuneita työkaluja,
ulkoisia palveluja tai delegoituja työnkulkuja. Ei ulkoista mallikatsausta,
julkaisua tai palvelinkokeita: ne eivät kuulu tähän offline-kierrokseen.

Jari valitsee avausmallin. Kierros ei muuta issuen tilaa eikä tuotantokoodia.
