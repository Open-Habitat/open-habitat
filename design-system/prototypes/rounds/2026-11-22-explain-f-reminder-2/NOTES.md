# Selitystila: missä palkissa F-vihje on (kierros 2)

Jari 22.11.: kierros `2026-11-22-explain-f-reminder` valitsi A:n. F-vihje
on vain selitystilan palkissa, ei koskaan kortissa. Tällä kierroksella
kokeillaan, missä kohtaa palkkia vihje on ja miltä se näyttää. Vihjeen
napsautus ei avaa ilmoitusta viimeksi osoitetusta kohdasta. Se avaa
yleisen palautteen Habitatista.

Akseli: **vihjeen paikka palkissa ja miltä se näyttää.**

- **A Otsikossa** (suositus): ääriviivallinen `[F] Ilmoita virheestä`
  -painike heti *Selitystila*-otsikon jäljessä. Sen jälkeen tulee ohut
  pystyviiva ja tuotannon ohje.
- **B Lopussa**: sama painike *Lopeta Esc* -painikkeen vieressä. Ne
  muodostavat yhden näppäinrivin.
- **C Keskellä**: keskelle palkkia tulee hiljainen tilarivi *Osoita
  kohtaa; napsautus toimii kuten aina. [F] ilmoittaa virheestä*.
  Lauseessa vain F-osa on painike, ja se näyttää alleviivatulta linkiltä.
  Tuotannon vasemman reunan ohje jää pois, koska tilarivi korvaa sen.

Sama kaikissa suunnissa:

- Kortti on kierroksen `explain-follow` A Vierellä. Kortissa ei ole
  F-riviä, ei edes levossa. F kiinnittää kortin ja avaa ilmoituskentän.
  Napsautus ei avaa ilmoitusta, Esc irrottaa ja toinen Esc lopettaa tilan.
- Vihje on oikea painike (`aria-haspopup="dialog"`, `aria-expanded`).
  Napsautus tai Enter avaa vihjeen alle paneelin *Palaute Habitatista*.
  Paneeli ei kerro mistään kohdasta. Kortti päästää irti, eikä paneelissa
  ole kohdan nimeä tai tunnusta. Paneeli kertoo, että kohdan virheestä
  ilmoitetaan osoittamalla kohtaa ja painamalla F. Kun paneeli on auki,
  osoittaminen ei selitä mitään. Esc sulkee paneelin, palauttaa
  kohdistuksen vihjeeseen ja jättää tilan päälle. Jos kenttään on
  kirjoitettu, napsautus paneelin ulkopuolella vain muistuttaa eikä
  hävitä tekstiä, kuten kiinnitetyssä kortissa. Lähetys näyttää saman
  "Avattu GitHubissa" -tilan kuin kortin ilmoitus.
- Vihjeen osoittaminen ei tuo uutta korttia. Palkki on tilan omaa
  aluetta, joten edellinen kortti vain himmenee.
- Kun kortti on kiinnitetty, vihje poistuu ja palkki kertoo Esc:stä.
- **Ruudunlukija**: vihjeen nimi on sen näkyvä teksti. Kuvaus
  (`aria-describedby`) kertoo F:stä ja siitä, että napsautus avaa yleisen
  palautteen. Kortin lopussa on yhä näkymätön rivi "F: ilmoita
  virheestä tässä selityksessä."
- **Kapea ikkuna hiirellä** (alle 800 px): tuotannon palkki pudottaa
  ohjeen ja näppäinmerkit. Vihje säilyttää F-merkkinsä. C:stä jää vain
  keskitetty F-osa.
- **Kosketus**: F-näppäintä ei ole, joten vihjettä ei näytetä. Arkissa on
  oikea **Ilmoita virheestä** -painike.

## Näkymä ja lähteet

Näkymä, osumantunnistus ja kortin sijoittelu tulevat kierroksesta 1.
Siitä on poistettu B:n ja C:n kortin rivi sekä Kokeilija-valinta. Korttien
tekstit tulevat tuotannon `text/explainMode.ts`:stä ja ulkoasu tuotannon
`ExplainMode.css`:stä. Palkin perusohje on tuotannon `bar.hint`.

Katselmointipalkissa ovat teema, kieli, Liike ja Alusta. `?v=1|2|3`,
`?theme=dark`, `?lang=en` ja `?motion=less` valitsevat alkutilan.

Issue `explain-f-reminder`. Suositus ja kysymykset ovat sen `result.md`:n
osiossa *Kierros 2*.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-22-explain-f-reminder-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 900 \
  node design-system/prototypes/rounds/2026-11-22-explain-f-reminder-2/check.mjs \
  design-system/prototypes/dist/explain-f-reminder-2/offline.html <kuvahakemisto> [--quick]
```

Rakennus kirjoittaa `design-system/prototypes/dist/explain-f-reminder-2/`:een
`offline.html`:n, jossa fontit ovat upotettuina, ja `index.html`:n ilman
fontteja. `check.mjs`:n alussa kerrotaan, mitä se tarkistaa.
