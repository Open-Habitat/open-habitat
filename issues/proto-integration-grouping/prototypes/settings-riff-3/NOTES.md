# Tekoäly-sivu: oletusmallin rivi · Kierros 3

Valitsit kierroksella 2 *Ponnahduksen*, mutta oletusmallin rivi näytti
oudolta. Siinä kirjoituskentän pilleri (vihreä laatta, ”Sonnet 5 · Medium”)
kellui kaukana oikealla kahden rivin selityksen vieressä. Tällä kierroksella
vaihtelee vain tämä rivi. Kaikki neljä avaavat saman ponnahdusvalikon kuin
kierroksella 2: työpöydällä rivin alle, puhelimessa alhaalta nousevana arkkina.
Rivin alla olevat Tilaukset ja API-avaimet ovat kierroksen 2 hyväksyttyä
Ponnahdus-sivua sellaisenaan.

Jokainen vaihtoehto ottaa kantaa kolmeen asiaan:

- **mitä rivi näyttää**: malli, palvelu (minkä tilauksen tai avaimen kautta)
  ja ajattelutaso
- **miten rivin tunnistaa klikattavaksi**
- **miten oletus suhteutuu keskustelun omaan malliin**: uusi keskustelu alkaa
  oletuksella, ja avoin keskustelu pitää mallinsa.

Palvelu on mukana kaikissa, koska ”Sonnet 5” voi tulla Claude-tilauksesta tai
Anthropic-avaimesta, ja vika on usein juuri siinä. Tuotannon `ModelChip`
näyttää vain mallin ja ajattelutason.

Kaikki tilit, mallit ja avaimet ovat keksittyjä.

## Neljä vaihtoehtoa

| Vaihtoehto | Mitä rivi on | Vahvuus | Hinta |
| --- | --- | --- | --- |
| **1 · Valintakenttä** | Otsikko ”Oletusmalli” ja sen alla lomakkeen valintakenttä: `[Cl] Sonnet 5  Claude-tilaus …  💡 Medium ⇕`. Selitysrivi kentän alla. Valikko aukeaa kentän alle. | Kentän tunnistaa heti valittavaksi, ja kaikki kolme tietoa ovat yhdellä rivillä. Virhe näkyy punaisena kenttänä ja selityksenä sen alla. | Muut asetusrivit eivät näytä tältä, joten rivi erottuu lomakkeena. Selitysteksti vie oman rivinsä. |
| **2 · Asetusrivi** | Koko rivi on painike. Vasemmalla ”Oletusmalli / Uusille keskusteluille”, oikealla arvo: **Sonnet 5**, alla ”Claude-tilaus · ajattelu Medium”, ja ⇕-merkki. Puhelimessa arvo on otsikon alla. | Rauhallisin. Lukee kuin asetuksen arvo eikä kuin kontrolli, ja sopii sivun muihin riveihin. Selitystä ei tarvita, koska ”Uusille keskusteluille” riittää. | Klikattavuuden kertovat vain ⇕ ja hover, joten kosketusnäytöllä se on hienovaraisin. Suhde avoimiin keskusteluihin jää sanomatta. |
| **3 · Peili** | ”Uuden keskustelun malli” ja pienoiskuva uuden keskustelun kirjoituskentästä. Siinä on täsmälleen sama siru kuin tuotannossa (”Sonnet 5 💡 Medium”). Palvelu kerrotaan tekstirivillä alla. | Opettaa suhteen näyttämällä sen: tämä siru on se, jonka näet jokaisessa uudessa keskustelussa, ja keskustelussa tehty vaihto koskee vain sitä keskustelua. | Kuva kirjoituskentästä voi houkutella kirjoittamaan siihen. Vie eniten tilaa. Palvelu ei ole sirussa, joten se jää tekstiksi. |
| **4 · Erittely** | Otsikko ja **Vaihda…**-painike. Alla kolme nimettyä kenttää: *Malli*, *Palvelu* (laatta, nimi ja tila, esim. ✓ Kirjautunut) ja *Ajattelutaso*. Lopussa ⓘ-rivi oletuksen ja keskustelun mallin suhteesta. | Jokainen tieto on nimetty, ja palvelun tila näkyy suoraan rivillä. Painike on yksiselitteinen. Virheessä painike muuttuu ensisijaiseksi. | Raskain ja hallintapaneelimaisin. Kolme laatikkoa kilpailevat huomiosta, vaikka tavallisesti tarvitaan vain mallin nimi. |

**Suosittelen vaihtoehtoa 2, Asetusrivi.** Kierroksen 2 rivi näytti oudolta,
koska siinä oli kontrolli asetussivun keskellä. Asetusrivi näyttää oletuksen
arvona, kuten muutkin asetukset, ja koko rivi on klikattava. Se kertoo myös
palvelun, joka pilleristä puuttui. Virhetilassa malli muuttuu punaiseksi
varoitusmerkin kanssa ja syy näkyy rivin alla, joten rikkinäinen oletus ei
jää huomaamatta. Klikattavuuden hienovaraisuutta voi korjata ⇕-merkin
tilalla olevalla nuolella tai painikemaisella reunalla. Vaihtoehto 3 kertoo
suhteen keskustelun malliin parhaiten. Jos sitä kaipaat, sen yhden rivin
selityksen (”Kun vaihdat mallin keskustelussa, muutos koskee vain sitä
keskustelua”) voi lisätä ponnahdusvalikon alaosaan.

## Kokeile

```
issues/proto-integration-grouping/prototypes/settings-riff-3/index.html
```

Tiedosto avautuu sellaisenaan ilman verkkoa. Vaihtoehtoa vaihdetaan alareunan
valitsimella, näppäimillä 1–4 tai ←/→. Yläpalkin *Tilanne* vaihtaa tilannetta,
ja *Tumma* vaihtaa teeman. Kokeile ainakin:

- **Virheitä**: oletusmallin avain on hylätty. Katso, miltä rikkinäinen
  oletus näyttää kussakin muodossa ja johtaako rivi korjaukseen.
- **Uusi henkilö, ylläpitäjän avain**: palvelu on ”Anthropic API ·
  ylläpitäjän avain”, joka on pisin palvelun nimi.
- 390 px leveä ikkuna: valikko nousee arkkina alhaalta.
- **Lisää API-avain** → Anthropic → *täytä esimerkkiavain* → tallenna:
  ensimmäinen avain vaihtaa oletuksen, ja rivi päivittyy heti.

Kuvat ovat kansiossa `evidence/` (laitteen skaalaus 2):
`N-desktop-light-ok-top`, `N-desktop-light-open`, `N-desktop-dark-err`,
`N-desktop-light-site`, `N-phone-light-ok`, `N-phone-light-open` ja
`N-phone-dark-err`, missä N on vaihtoehdon numero.

## Rajoja

- Ponnahdusvalikon sisältö on kierroksen 2 mukainen. Siihen ei koskettu
  tällä kierroksella, paitsi että valikko on hieman leveämpi, jotta neljä
  palveluvälilehteä mahtuvat yhdelle riville. Viides välilehti (Anthropic API)
  rivittyy yhä.
- Mikään vaihtoehto ei näytä, mitä mallia avoimet keskustelut käyttävät.
  Pi:n istunnot tietävät sen, mutta yhteenveto olisi uusi tieto asetussivulle,
  eikä sitä pyydetty.
- Merkit ovat kierroksen 1 kirjainlaattoja, eivät palvelujen logoja.

## Rakentaminen ja tarkistus

```sh
python3 issues/proto-integration-grouping/prototypes/settings-riff-3/build.py
PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" node issues/proto-integration-grouping/prototypes/settings-riff-3/check.mjs
```

`build.py` upottaa tokenit, fontit ja vaihtoehtovalitsimen `index.html`-tiedostoon.
`check.mjs` tarvitsee `web/`-riippuvuudet (`npm ci --prefix web`). Se avaa
jokaisen vaihtoehdon kaikissa kolmessa tilanteessa 390 ja 1440 px leveänä ja
tarkistaa, että rivi nimeää mallin ja palvelun ja ettei sivu tai avattu
valikko vieri vaakasuunnassa. Lisäksi se käy läpi oletuksen vaihdon, Escapen
ja ulkopuolisen klikkauksen (fokus palaa riville), virheestä toipumisen ja
ensimmäisen avaimen vaikutuksen riviin. Konsolissa ei saa olla virheitä, eikä
sivu saa tehdä verkkopyyntöjä.
