# Selitystilan palaute, kierros 3

Jari 21.11. kierroksesta 2: A Kulkureitti. Myönteistä palautetta ei kerätä,
koska sellaisia viestejä ei haluta GitHubiin. Väärin ja huomio yhdistetään:
ihmisen on kirjoitettava jotain, ja ilmoituksen pitää tulla meille hyvin
helposti ja suoraan.

Kortti pysyy kaikissa suunnissa kuten kierroksen 2 A:ssa. Alarivillä on yksi
painike, **Ilmoita virheestä · Selitys on väärin tai puutteellinen** (tai F).
Se avaa kentän, johon on kirjoitettava. Tyhjänä lähetys pyytää ensin tekstiä
eikä lähetä mitään.

Akseli: **miten kirjoitettu ilmoitus pääsee perille.**

- **A GitHub**: lähetyspainike on Avaa GitHubissa. Teksti, kortin nimi ja
  tunnus, versio ja kieli avautuvat uuteen välilehteen valmiiksi täytettynä
  julkisena issuena. Palvelimelle ei jää mitään. Tarvitaan GitHub-tili ja
  yhteys github.comiin, ja issue lähtee GitHubin Submit-painalluksella.
- **B Oma tili**: Tallenna vie ilmoituksen per-käyttäjä-daemonin kautta
  ihmisen omalle tilille. Palkissa näkyy Lähettämättä · n, ja kertyneet
  lähtevät yhtenä GitHub-issuena kuten kierroksella 2.
- **C Palautelaatikko**: Lähetä kehittäjille lähettää tekstin selaimesta
  suoraan projektin palautelaatikkoon. Tiliä ei tarvita, eikä ilmoitus ole
  julkinen, mutta palvelua ei vielä ole. Prototyyppi ei lähetä mitään.

Kaikissa suunnissa kortissa näkyy, mitä ilmoitus tarvitsee ja mikä siitä on
julkista, ja Näytä, mitä lähtee näyttää koko tekstin. Klikkaus muualle ei
hukkaa kirjoitettua tekstiä. Ensimmäinen Esc peruu ilmoituksen, toinen
lopettaa tilan. Kohdistettu kohta selittää itsensä, ja F siirtää
kohdistuksen ilmoitukseen.

Osoittaminen on kierroksen 2 kopio tuotannon `ExplainLayer`ista, ja A:n
kulkureitti on mukana. `?path=off` poistaa kulkureitin, jolloin osoittaminen
toimii kuten tuotannossa; tarkistuksen negatiivinen kontrolli käyttää sitä.
CSS on tuotannon `ExplainMode.css`, ja korttien tekstit tulevat tuotannon
`text/explainMode.ts`:stä ja `explainParts.ts`:stä.

Katselmointipalkki: Näkymä (Selitystila / Omat ilmoitukset), Alku (Kortti /
Ilmoitus kirjoitettu / Lähetetty), teema ja kieli. `?s=card|note|done`,
`?view=mine`, `?theme=dark|contrast`, `?lang=en` ja `?path=off` valitsevat
alkutilan.

Issue `explain-mode-feedback`; suunnat, suositus ja kysymykset ovat sen
`result-3.md`:ssä.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-21-explain-feedback-3/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 900 \
  node design-system/prototypes/rounds/2026-11-21-explain-feedback-3/check.mjs \
  design-system/prototypes/dist/explain-feedback-3/offline.html <kuvahakemisto> [--quick]
```

Rakennus kirjoittaa `design-system/prototypes/dist/explain-feedback-3/`:een
`offline.html`:n, jossa fontit ovat upotettuina, ja `index.html`:n ilman
fontteja. `check.mjs`:n alussa kerrotaan, mitä se tarkistaa.
